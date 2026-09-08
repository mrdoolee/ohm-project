import { useMemo, useRef, useState } from 'react'
import { useCircuit } from '../state/CircuitContext'
import { CELL, GRID_COLS, GRID_ROWS, clampToGrid, nearestGridPoint, pointKey, toPixel, type GridPoint } from '../domain/grid'
import { clampOriginForRotation, partTerminals, type Part, type PartKind } from '../domain/parts'
import { expandWireToUnitPoints, type Wire } from '../domain/wires'
import { computeWireSegmentFlows } from '../domain/wireFlow'
import { axisLock, type WireEndpoint } from '../state/circuitReducer'
import { FLOW_ARROW_COLOR, FLOW_EPSILON } from './parts/PartSymbol'
import { PartSymbol } from './parts/PartSymbol'
import { RealisticDefs } from './parts/realisticGlyphs'

/** Small filled triangle centered at (x,y), pointing toward angle degrees (0 = +x). */
function WireFlowArrow({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <polygon
      points="-4,-3.5 -4,3.5 4,0"
      fill={FLOW_ARROW_COLOR}
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

export function GridCanvas({ draggingKind }: GridCanvasProps) {
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
    const point = clientToGrid(svgRef.current, e.clientX, e.clientY)
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
    // A brand-new part/wire being dragged in from the palette (pointer-based,
    // not HTML5 drag-and-drop, so it works on touch/tablet too) — just needs
    // the WYSIWYG hover preview kept in sync with the pointer.
    if (draggingKind) {
      setHoverPoint(point)
    }
  }

  function handlePointerUp() {
    if (draggingKind) {
      if (hoverPoint) {
        if (draggingKind === 'wire') {
          dispatch({ type: 'ADD_WIRE', origin: hoverPoint })
        } else {
          dispatch({ type: 'ADD_PART', kind: draggingKind, origin: hoverPoint })
        }
      }
      setHoverPoint(null)
      return
    }
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
      className="w-full h-auto max-w-full border border-slate-300 bg-slate-50 touch-none select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => draggingKind && setHoverPoint(null)}
      onClick={handleCanvasClick}
    >
      <RealisticDefs />
      {gridDots.map(({ col, row }) => {
        const { x, y } = toPixel({ col, row })
        const key = pointKey({ col, row })
        return <circle key={key} cx={x} cy={y} r={1.5} className="fill-slate-300" />
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
                    />
                  )
                })}
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              className="cursor-move"
              onPointerDown={(e) => {
                e.stopPropagation()
                startWireBodyDrag(wire)
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <path
              d={d}
              fill="none"
              stroke={selected ? '#2563eb' : '#334155'}
              strokeWidth={selected ? 4 : 2.5}
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
                    className="fill-white stroke-blue-600 cursor-pointer"
                    strokeWidth={2}
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
          return <circle key={`${part.id}-t${i}`} cx={x} cy={y} r={2.5} className="fill-emerald-600" />
        })
      })}

      {/* Trash corner: drag a part/wire here to delete it. */}
      <g pointerEvents="none">
        <rect
          x={DELETE_ZONE.x}
          y={DELETE_ZONE.y}
          width={DELETE_ZONE.width}
          height={DELETE_ZONE.height}
          rx={8}
          fill={overDeleteZone ? '#fee2e2' : '#f8fafc'}
          stroke={overDeleteZone ? '#dc2626' : '#cbd5e1'}
          strokeWidth={2}
          strokeDasharray="6 4"
        />
        <g
          transform={`translate(${DELETE_ZONE.x + 16}, ${DELETE_ZONE.y + DELETE_ZONE.height / 2}) scale(0.6)`}
          stroke={overDeleteZone ? '#dc2626' : '#94a3b8'}
          strokeWidth={2}
          fill="none"
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
          fontSize={11}
          textAnchor="start"
          fill={overDeleteZone ? '#dc2626' : '#64748b'}
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
            stroke="#334155"
            strokeWidth={2.5}
          />
          <circle cx={toPixel(newDropOrigin).x} cy={toPixel(newDropOrigin).y} r={4} fill="#16a34a" />
          <circle cx={toPixel(previewWireEnd).x} cy={toPixel(previewWireEnd).y} r={4} fill="#16a34a" />
        </g>
      )}
    </svg>
  )
}
