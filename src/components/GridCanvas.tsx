import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useCircuit } from '../state/CircuitContext'
import { CELL, GRID_COLS, GRID_ROWS, clampToGrid, nearestGridPoint, pointKey, toPixel, type GridPoint } from '../domain/grid'
import { clampOriginForRotation, partTerminals, type Part, type PartKind } from '../domain/parts'
import { expandWireToUnitPoints, type Wire } from '../domain/wires'
import { computeWireSegmentFlows } from '../domain/wireFlow'
import { axisLock, type WireEndpoint } from '../state/circuitReducer'
import { FLOW_EPSILON, PartSymbol, flowArrowColor } from './parts/PartSymbol'
import { RealisticDefs } from './parts/realisticGlyphs'

/** Small filled triangle centered at (x,y), pointing toward angle degrees (0 = +x). */
function WireFlowArrow({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  return (
    <polygon
      points="-4,-3.5 -4,3.5 4,0"
      style={{ fill: color }}
      transform={`translate(${x},${y}) rotate(${angle})`}
      pointerEvents="none"
    />
  )
}

const WIDTH = GRID_COLS * CELL
const HEIGHT = GRID_ROWS * CELL

// Reserved trash corner: dragging a part/wire here (instead of dropping it
// back on the grid) deletes it. Lives in the same SVG pixel space as
// everything else, so hit-testing is plain coordinate math — no cross-
// component DOM lookups needed.
const DELETE_ZONE = { x: 4, y: 4, width: CELL * 2 - 8, height: CELL - 8 }

const DRAG_THRESHOLD_PX = 8

function clientToGrid(svg: SVGSVGElement, clientX: number, clientY: number): GridPoint {
  const rect = svg.getBoundingClientRect()
  const x = ((clientX - rect.left) / rect.width) * WIDTH
  const y = ((clientY - rect.top) / rect.height) * HEIGHT
  return clampToGrid(nearestGridPoint(x, y))
}

function clientToSvgPixel(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = svg.getBoundingClientRect()
  return {
    x: ((clientX - rect.left) / rect.width) * WIDTH,
    y: ((clientY - rect.top) / rect.height) * HEIGHT,
  }
}

function isInDeleteZone(x: number, y: number): boolean {
  return (
    x >= DELETE_ZONE.x &&
    x <= DELETE_ZONE.x + DELETE_ZONE.width &&
    y >= DELETE_ZONE.y &&
    y <= DELETE_ZONE.y + DELETE_ZONE.height
  )
}

function translateWirePoints(points: GridPoint[], target: GridPoint): GridPoint[] {
  const first = points[0]
  const dCol = target.col - first.col
  const dRow = target.row - first.row
  return points.map((p) => clampToGrid({ col: p.col + dCol, row: p.row + dRow }))
}

function resizeWirePoints(points: GridPoint[], endpoint: WireEndpoint, target: GridPoint): GridPoint[] {
  const isStart = endpoint === 'start'
  const neighborIndex = isStart ? 1 : points.length - 2
  const neighbor = points[neighborIndex]
  const resolved = axisLock(clampToGrid(target), neighbor)
  if (resolved.col === neighbor.col && resolved.row === neighbor.row) return points // no zero-length segment
  const next = [...points]
  next[isStart ? 0 : points.length - 1] = resolved
  return next
}

interface GridCanvasProps {
  draggingKind: PartKind | 'wire' | null
}

export interface GridCanvasHandle {
  /** Update (or clear, if outside the canvas) the WYSIWYG palette-drag hover preview. */
  updateDragHover: (clientX: number, clientY: number) => void
  /** Place the dragged palette item if the pointer is over the canvas, then clear the preview either way. */
  commitDrop: (clientX: number, clientY: number, kind: PartKind | 'wire') => void
}

export const GridCanvas = forwardRef<GridCanvasHandle, GridCanvasProps>(function GridCanvas(
  { draggingKind },
  ref,
) {
  const { state, dispatch, solution } = useCircuit()
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverPoint, setHoverPoint] = useState<GridPoint | null>(null)

  // While dragging, the moved/resized geometry lives only in this local state —
  // never dispatched to the reducer until the pointer is released. Dispatching
  // on every pointermove would recompute the whole circuit (and re-render every
  // consumer of useCircuit()) on every pixel of mouse movement, which is what
  // made dragging feel like it was lagging a step behind the cursor.
  const [draggingPartId, setDraggingPartId] = useState<string | null>(null)
  const [dragPartOrigin, setDragPartOrigin] = useState<GridPoint | null>(null)
  const [draggingWireId, setDraggingWireId] = useState<string | null>(null)
  const [draggingEndpoint, setDraggingEndpoint] = useState<{ id: string; endpoint: WireEndpoint } | null>(null)
  const [dragWireOriginal, setDragWireOriginal] = useState<Wire | null>(null)
  const [dragWirePoints, setDragWirePoints] = useState<GridPoint[] | null>(null)
  const [overDeleteZone, setOverDeleteZone] = useState(false)

  const wireFlows = useMemo(
    () => computeWireSegmentFlows(state.parts, state.wires, solution.components),
    [state.parts, state.wires, solution.components],
  )

  function isClientPointInsideSvg(clientX: number, clientY: number): boolean {
    if (!svgRef.current) return false
    const rect = svgRef.current.getBoundingClientRect()
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  }

  // A palette item being dragged in is driven from App.tsx's window-level
  // pointer listeners, not this SVG's own onPointerMove/onPointerUp — on
  // touch, a pointer's events stay targeted at wherever it went *down*
  // (the palette item) and only bubble from there, so they never reach this
  // SVG's own handlers no matter where the finger physically moves. Only
  // App's window listener (which receives them via bubbling regardless of
  // that target-lock) can reliably tell when the pointer is over the canvas.
  useImperativeHandle(ref, () => ({
    updateDragHover(clientX, clientY) {
      if (!svgRef.current) return
      setHoverPoint(isClientPointInsideSvg(clientX, clientY) ? clientToGrid(svgRef.current, clientX, clientY) : null)
    },
    commitDrop(clientX, clientY, kind) {
      if (svgRef.current && isClientPointInsideSvg(clientX, clientY)) {
        const point = clientToGrid(svgRef.current, clientX, clientY)
        if (kind === 'wire') dispatch({ type: 'ADD_WIRE', origin: point })
        else dispatch({ type: 'ADD_PART', kind, origin: point })
      }
      setHoverPoint(null)
    },
  }))

  // A tap on touch is never perfectly still: the finger jitters a few px, which
  // fires pointermove. Without a dead zone that jitter counted as a drag, and
  // because the dragged part snapped to the grid point nearest the *finger*
  // (not to where it was grabbed) a plain tap on a switch's body slid the part
  // sideways by up to a cell before the click could toggle it. So: ignore
  // movement until it passes DRAG_THRESHOLD_PX, and keep the grab offset
  // (pointer minus anchor point) so the part follows the finger without jumping.
  const grabRef = useRef<{ cx: number; cy: number; ox: number; oy: number; moved: boolean } | null>(null)

  function beginGrab(e: React.PointerEvent, anchor: GridPoint) {
    if (!svgRef.current) return
    const p = clientToSvgPixel(svgRef.current, e.clientX, e.clientY)
    const a = toPixel(anchor)
    grabRef.current = { cx: e.clientX, cy: e.clientY, ox: p.x - a.x, oy: p.y - a.y, moved: false }
  }

  function startPartDrag(part: Part) {
    dispatch({ type: 'SELECT', id: part.id })
    setDraggingPartId(part.id)
    setDragPartOrigin(part.origin)
  }

  function startWireBodyDrag(wire: Wire) {
    dispatch({ type: 'SELECT_WIRE', id: wire.id })
    setDraggingWireId(wire.id)
    setDragWireOriginal(wire)
    setDragWirePoints(wire.points)
  }

  function startWireEndpointDrag(wire: Wire, endpoint: WireEndpoint) {
    dispatch({ type: 'SELECT_WIRE', id: wire.id })
    setDraggingEndpoint({ id: wire.id, endpoint })
    setDragWireOriginal(wire)
    setDragWirePoints(wire.points)
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return
    const isDraggingSomething = draggingPartId || draggingWireId || draggingEndpoint
    if (isDraggingSomething) {
      const svgPoint = clientToSvgPixel(svgRef.current, e.clientX, e.clientY)
      const overDelete = isInDeleteZone(svgPoint.x, svgPoint.y)
      setOverDeleteZone(overDelete)
      if (overDelete) return // freeze in place while hovering the delete zone
    }
    let point = clientToGrid(svgRef.current, e.clientX, e.clientY)
    const grab = grabRef.current
    if (grab && (draggingPartId || draggingWireId)) {
      if (!grab.moved) {
        if (Math.hypot(e.clientX - grab.cx, e.clientY - grab.cy) < DRAG_THRESHOLD_PX) return
        grab.moved = true
      }
      const px = clientToSvgPixel(svgRef.current, e.clientX, e.clientY)
      point = clampToGrid(nearestGridPoint(px.x - grab.ox, px.y - grab.oy))
    }
    if (draggingPartId) {
      const part = state.parts.find((p) => p.id === draggingPartId)
      if (part) setDragPartOrigin(clampOriginForRotation(point, part.rotation))
    }
    if (draggingWireId && dragWireOriginal) {
      setDragWirePoints(translateWirePoints(dragWireOriginal.points, point))
    }
    if (draggingEndpoint && dragWireOriginal) {
      setDragWirePoints(resizeWirePoints(dragWireOriginal.points, draggingEndpoint.endpoint, point))
    }
  }

  function handlePointerUp() {
    if (overDeleteZone) {
      if (draggingPartId) dispatch({ type: 'REMOVE_PART', id: draggingPartId })
      else if (draggingWireId) dispatch({ type: 'REMOVE_WIRE', id: draggingWireId })
      else if (draggingEndpoint) dispatch({ type: 'REMOVE_WIRE', id: draggingEndpoint.id })
    } else {
      if (draggingPartId && dragPartOrigin) {
        dispatch({ type: 'MOVE_PART', id: draggingPartId, origin: dragPartOrigin })
      }
      if (draggingWireId && dragWirePoints) {
        dispatch({ type: 'MOVE_WIRE', id: draggingWireId, origin: dragWirePoints[0] })
      }
      if (draggingEndpoint && dragWirePoints) {
        const isStart = draggingEndpoint.endpoint === 'start'
        const point = dragWirePoints[isStart ? 0 : dragWirePoints.length - 1]
        dispatch({ type: 'RESIZE_WIRE_ENDPOINT', id: draggingEndpoint.id, endpoint: draggingEndpoint.endpoint, point })
      }
    }
    grabRef.current = null
    setDraggingPartId(null)
    setDragPartOrigin(null)
    setDraggingWireId(null)
    setDraggingEndpoint(null)
    setDragWireOriginal(null)
    setDragWirePoints(null)
    setOverDeleteZone(false)
  }

  function handleCanvasClick() {
    dispatch({ type: 'SELECT', id: null })
    dispatch({ type: 'SELECT_WIRE', id: null })
  }

  // WYSIWYG preview of a brand-new part/wire being dragged in from the palette —
  // shown at the exact spot and footprint it will actually land on, so there's
  // no guessing about "does the part start on this grid point or between them".
  const newDropOrigin = hoverPoint ? clampOriginForRotation(clampToGrid(hoverPoint), 0) : null
  const previewPart: Part | null =
    draggingKind && draggingKind !== 'wire' && newDropOrigin
      ? { id: '__preview__', kind: draggingKind, origin: newDropOrigin, rotation: 0, value: 0, closed: true }
      : null
  const previewWireEnd = newDropOrigin ? { col: newDropOrigin.col + 1, row: newDropOrigin.row } : null

  const gridDots = []
  for (let col = 0; col < GRID_COLS; col++) {
    for (let row = 0; row < GRID_ROWS; row++) {
      gridDots.push({ col, row })
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="canvas"
      role="group"
      aria-label="회로 격자 캔버스. 부품과 전선을 끌어서 옮기고 이어 붙입니다."
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleCanvasClick}
    >
      <RealisticDefs />
      {gridDots.map(({ col, row }) => {
        const { x, y } = toPixel({ col, row })
        const key = pointKey({ col, row })
        return <circle key={key} cx={x} cy={y} r={1.5} className="grid-dot" />
      })}

      {state.wires.map((wire) => {
        const isBeingDragged = (wire.id === draggingWireId || wire.id === draggingEndpoint?.id) && dragWirePoints
        const points = isBeingDragged ? dragWirePoints! : wire.points
        const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toPixel(p).x} ${toPixel(p).y}`).join(' ')
        const selected = state.selectedWireId === wire.id
        // Flow current is only meaningful for the wire's committed geometry —
        // skip arrows on the wire actively being reshaped mid-drag.
        const unitPoints = !isBeingDragged ? expandWireToUnitPoints(wire) : null
        return (
          <g key={wire.id}>
            {unitPoints &&
              wireFlows
                .filter((f) => f.wireId === wire.id && Math.abs(f.current) > FLOW_EPSILON)
                .map((f) => {
                  const p = unitPoints[f.index]
                  const q = unitPoints[f.index + 1]
                  const pPx = toPixel(p)
                  const qPx = toPixel(q)
                  const forward = f.current > 0
                  const flowsPToQ = state.flowDisplay === 'current' ? forward : !forward
                  const [fromPx, toPx] = flowsPToQ ? [pPx, qPx] : [qPx, pPx]
                  const angle = (Math.atan2(toPx.y - fromPx.y, toPx.x - fromPx.x) * 180) / Math.PI
                  return (
                    <WireFlowArrow
                      key={`${wire.id}-f${f.index}`}
                      x={(pPx.x + qPx.x) / 2}
                      y={(pPx.y + qPx.y) / 2}
                      angle={angle}
                      color={flowArrowColor(state.flowDisplay)}
                    />
                  )
                })}
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              className="wire-hit"
              onPointerDown={(e) => {
                e.stopPropagation()
                beginGrab(e, wire.points[0])
                startWireBodyDrag(wire)
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <path
              d={d}
              className={selected ? 'wire-line is-selected' : 'wire-line'}
              pointerEvents="none"
            />
            {selected &&
              (['start', 'end'] as const).map((endpoint) => {
                const p = endpoint === 'start' ? points[0] : points[points.length - 1]
                const { x, y } = toPixel(p)
                return (
                  <circle
                    key={endpoint}
                    cx={x}
                    cy={y}
                    r={6}
                    className="wire-handle"
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      startWireEndpointDrag(wire, endpoint)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                )
              })}
          </g>
        )
      })}

      {state.parts.map((part) => {
        const isDragging = part.id === draggingPartId && dragPartOrigin
        const renderPart = isDragging ? { ...part, origin: dragPartOrigin! } : part
        return (
          <g
            key={part.id}
            onPointerDown={(e) => {
              e.stopPropagation()
              beginGrab(e, part.origin)
              startPartDrag(part)
            }}
          >
            <PartSymbol
              part={renderPart}
              result={solution.components[part.id]}
              selected={state.selectedId === part.id}
              mode={state.displayMode}
              flowDisplay={state.flowDisplay}
              onSelect={() => dispatch({ type: 'SELECT', id: part.id })}
              onToggleSwitch={() => dispatch({ type: 'TOGGLE_SWITCH', id: part.id })}
            />
          </g>
        )
      })}

      {state.parts.map((part) => {
        const isDragging = part.id === draggingPartId && dragPartOrigin
        const renderPart = isDragging ? { ...part, origin: dragPartOrigin! } : part
        const { a, b } = partTerminals(renderPart)
        return [a, b].map((p, i) => {
          const { x, y } = toPixel(p)
          return <circle key={`${part.id}-t${i}`} cx={x} cy={y} r={2.5} className="terminal-dot" />
        })
      })}

      {/* Trash corner: drag a part/wire here to delete it. */}
      <g pointerEvents="none" className={overDeleteZone ? 'is-over' : undefined}>
        <rect
          className="trash-box"
          x={DELETE_ZONE.x}
          y={DELETE_ZONE.y}
          width={DELETE_ZONE.width}
          height={DELETE_ZONE.height}
          rx={8}
        />
        <g
          transform={`translate(${DELETE_ZONE.x + 16}, ${DELETE_ZONE.y + DELETE_ZONE.height / 2}) scale(0.6)`}
          className="trash-icon"
        >
          <rect x={-9} y={-4} width={18} height={16} rx={1.5} />
          <line x1={-12} y1={-4} x2={12} y2={-4} />
          <line x1={-4} y1={-8} x2={4} y2={-8} />
          <line x1={-4} y1={0} x2={-4} y2={8} />
          <line x1={4} y1={0} x2={4} y2={8} />
        </g>
        <text
          x={DELETE_ZONE.x + 30}
          y={DELETE_ZONE.y + DELETE_ZONE.height / 2 + 4}
          className="trash-text"
          textAnchor="start"
        >
          삭제
        </text>
      </g>

      {/* WYSIWYG drop preview: the exact footprint a palette drag will land as. */}
      {previewPart && (
        <g opacity={0.55} pointerEvents="none">
          <PartSymbol
            part={previewPart}
            result={undefined}
            selected={false}
            mode={state.displayMode}
            flowDisplay={state.flowDisplay}
            onSelect={() => {}}
            onToggleSwitch={() => {}}
          />
        </g>
      )}
      {draggingKind === 'wire' && newDropOrigin && previewWireEnd && (
        <g opacity={0.55} pointerEvents="none">
          <line
            x1={toPixel(newDropOrigin).x}
            y1={toPixel(newDropOrigin).y}
            x2={toPixel(previewWireEnd).x}
            y2={toPixel(previewWireEnd).y}
            className="preview-line"
          />
          <circle cx={toPixel(newDropOrigin).x} cy={toPixel(newDropOrigin).y} r={4} className="preview-dot" />
          <circle cx={toPixel(previewWireEnd).x} cy={toPixel(previewWireEnd).y} r={4} className="preview-dot" />
        </g>
      )}
    </svg>
  )
})
