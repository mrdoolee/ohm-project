import { useRef, useState } from 'react'
import { useCircuit } from '../state/CircuitContext'
import { CELL, GRID_COLS, GRID_ROWS, clampToGrid, nearestGridPoint, pointKey, toPixel, type GridPoint } from '../domain/grid'
import { clampOriginForRotation, partTerminals, type Part, type PartKind } from '../domain/parts'
import type { WireEndpoint } from '../state/circuitReducer'
import { PartSymbol } from './parts/PartSymbol'
import { RealisticDefs } from './parts/realisticGlyphs'

const WIDTH = GRID_COLS * CELL
const HEIGHT = GRID_ROWS * CELL

// Reserved trash corner: dragging a part/wire here (instead of dropping it
// back on the grid) deletes it. Lives in the same SVG pixel space as
// everything else, so hit-testing is plain coordinate math — no cross-
// component DOM lookups needed.
const DELETE_ZONE = { x: 4, y: 4, width: CELL * 2 - 8, height: CELL * 2 - 8 }

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

interface GridCanvasProps {
  draggingKind: PartKind | 'wire' | null
}

export function GridCanvas({ draggingKind }: GridCanvasProps) {
  const { state, dispatch, solution } = useCircuit()
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverPoint, setHoverPoint] = useState<GridPoint | null>(null)
  const [draggingPartId, setDraggingPartId] = useState<string | null>(null)
  const [draggingWireId, setDraggingWireId] = useState<string | null>(null)
  const [draggingEndpoint, setDraggingEndpoint] = useState<{ id: string; endpoint: WireEndpoint } | null>(null)
  const [overDeleteZone, setOverDeleteZone] = useState(false)

  function handleDragOver(e: React.DragEvent<SVGSVGElement>) {
    e.preventDefault()
    // Without an explicit dropEffect, Chrome falls back to the "not-allowed" cursor
    // over child elements (parts, wire handles) even though drop is accepted here.
    e.dataTransfer.dropEffect = 'copy'
    if (!svgRef.current) return
    setHoverPoint(clientToGrid(svgRef.current, e.clientX, e.clientY))
  }

  function handleDrop(e: React.DragEvent<SVGSVGElement>) {
    e.preventDefault()
    setHoverPoint(null)
    const kind = e.dataTransfer.getData('text/part-kind') as PartKind | 'wire'
    if (!kind || !svgRef.current) return
    const point = clientToGrid(svgRef.current, e.clientX, e.clientY)
    if (kind === 'wire') {
      dispatch({ type: 'ADD_WIRE', origin: point })
      return
    }
    dispatch({ type: 'ADD_PART', kind, origin: point })
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
      dispatch({ type: 'MOVE_PART', id: draggingPartId, origin: point })
    }
    if (draggingWireId) {
      dispatch({ type: 'MOVE_WIRE', id: draggingWireId, origin: point })
    }
    if (draggingEndpoint) {
      dispatch({ type: 'RESIZE_WIRE_ENDPOINT', id: draggingEndpoint.id, endpoint: draggingEndpoint.endpoint, point })
    }
  }

  function handlePointerUp() {
    if (overDeleteZone) {
      if (draggingPartId) dispatch({ type: 'REMOVE_PART', id: draggingPartId })
      else if (draggingWireId) dispatch({ type: 'REMOVE_WIRE', id: draggingWireId })
      else if (draggingEndpoint) dispatch({ type: 'REMOVE_WIRE', id: draggingEndpoint.id })
    }
    setDraggingPartId(null)
    setDraggingWireId(null)
    setDraggingEndpoint(null)
    setOverDeleteZone(false)
  }

  function handleCanvasClick() {
    dispatch({ type: 'SELECT', id: null })
    dispatch({ type: 'SELECT_WIRE', id: null })
  }

  const draggingPart = state.parts.find((p) => p.id === draggingPartId)
  const previewOrigin = draggingPart && hoverPoint ? clampOriginForRotation(hoverPoint, draggingPart.rotation) : null

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
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={() => setHoverPoint(null)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleCanvasClick}
    >
      <RealisticDefs />
      {gridDots.map(({ col, row }) => {
        const { x, y } = toPixel({ col, row })
        const key = pointKey({ col, row })
        return <circle key={key} cx={x} cy={y} r={1.5} className="fill-slate-300" />
      })}

      {state.wires.map((wire) => {
        const d = wire.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toPixel(p).x} ${toPixel(p).y}`).join(' ')
        const selected = state.selectedWireId === wire.id
        return (
          <g key={wire.id}>
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              className="cursor-move"
              onPointerDown={(e) => {
                e.stopPropagation()
                dispatch({ type: 'SELECT_WIRE', id: wire.id })
                setDraggingWireId(wire.id)
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
                const p = endpoint === 'start' ? wire.points[0] : wire.points[wire.points.length - 1]
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
                      dispatch({ type: 'SELECT_WIRE', id: wire.id })
                      setDraggingEndpoint({ id: wire.id, endpoint })
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                )
              })}
          </g>
        )
      })}

      {state.parts.map((part) => {
        const isDragging = part.id === draggingPartId
        const renderPart = isDragging && previewOrigin ? { ...part, origin: previewOrigin } : part
        return (
          <g
            key={part.id}
            onPointerDown={(e) => {
              e.stopPropagation()
              dispatch({ type: 'SELECT', id: part.id })
              setDraggingPartId(part.id)
            }}
          >
            <PartSymbol
              part={renderPart}
              result={solution.components[part.id]}
              selected={state.selectedId === part.id}
              mode={state.displayMode}
              onSelect={() => dispatch({ type: 'SELECT', id: part.id })}
              onToggleSwitch={() => dispatch({ type: 'TOGGLE_SWITCH', id: part.id })}
            />
          </g>
        )
      })}

      {state.parts.map((part) => {
        const { a, b } = partTerminals(part)
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
          transform={`translate(${DELETE_ZONE.x + DELETE_ZONE.width / 2}, ${DELETE_ZONE.y + DELETE_ZONE.height / 2 - 8})`}
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
          x={DELETE_ZONE.x + DELETE_ZONE.width / 2}
          y={DELETE_ZONE.y + DELETE_ZONE.height - 8}
          fontSize={11}
          textAnchor="middle"
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
