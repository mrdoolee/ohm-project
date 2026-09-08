import { GRID_COLS, GRID_ROWS, MAX_PARTS, clampToGrid, type GridPoint } from '../domain/grid'
import { nextId } from '../domain/idGenerator'
import {
  clampOriginForRotation,
  DEFAULT_VALUE,
  partFitsOnGrid,
  rotatePart,
  type Part,
  type PartKind,
} from '../domain/parts'
import type { Wire } from '../domain/wires'

export type DisplayMode = 'realistic' | 'schematic'
export type WireEndpoint = 'start' | 'end'

export interface CircuitState {
  parts: Part[]
  wires: Wire[]
  selectedId: string | null
  selectedWireId: string | null
  limitWarning: boolean
  displayMode: DisplayMode
}

export type CircuitAction =
  | { type: 'ADD_PART'; kind: PartKind; origin: GridPoint }
  | { type: 'MOVE_PART'; id: string; origin: GridPoint }
  | { type: 'ROTATE_PART'; id: string }
  | { type: 'SET_VALUE'; id: string; value: number }
  | { type: 'REMOVE_PART'; id: string }
  | { type: 'TOGGLE_SWITCH'; id: string }
  | { type: 'SELECT'; id: string | null }
  | { type: 'SELECT_WIRE'; id: string | null }
  | { type: 'ADD_WIRE'; origin: GridPoint }
  | { type: 'MOVE_WIRE'; id: string; origin: GridPoint }
  | { type: 'RESIZE_WIRE_ENDPOINT'; id: string; endpoint: WireEndpoint; point: GridPoint }
  | { type: 'REMOVE_WIRE'; id: string }
  | { type: 'LOAD'; parts: Part[]; wires: Wire[] }
  | { type: 'SET_DISPLAY_MODE'; mode: DisplayMode }

export const initialCircuitState: CircuitState = {
  parts: [],
  wires: [],
  selectedId: null,
  selectedWireId: null,
  limitWarning: false,
  displayMode: 'realistic',
}

function clampWireOrigin(origin: GridPoint): GridPoint {
  return {
    col: Math.min(Math.max(origin.col, 0), GRID_COLS - 2),
    row: Math.min(Math.max(origin.row, 0), GRID_ROWS - 1),
  }
}

/** Axis-locks `point` relative to `fixed` (the endpoint that stays put), like every other wire segment: horizontal or vertical only, never diagonal. */
export function axisLock(point: GridPoint, fixed: GridPoint): GridPoint {
  const dCol = Math.abs(point.col - fixed.col)
  const dRow = Math.abs(point.row - fixed.row)
  return dCol >= dRow ? { col: point.col, row: fixed.row } : { col: fixed.col, row: point.row }
}

export function circuitReducer(state: CircuitState, action: CircuitAction): CircuitState {
  switch (action.type) {
    case 'ADD_PART': {
      if (state.parts.length >= MAX_PARTS) {
        return { ...state, limitWarning: true }
      }
      const origin = clampOriginForRotation(clampToGrid(action.origin), 0)
      const part: Part = {
        id: nextId(action.kind),
        kind: action.kind,
        origin,
        rotation: 0,
        value: DEFAULT_VALUE[action.kind],
        closed: true,
      }
      return { ...state, parts: [...state.parts, part], selectedId: part.id, selectedWireId: null, limitWarning: false }
    }

    case 'MOVE_PART': {
      return {
        ...state,
        parts: state.parts.map((p) =>
          p.id === action.id ? { ...p, origin: clampOriginForRotation(clampToGrid(action.origin), p.rotation) } : p,
        ),
      }
    }

    case 'ROTATE_PART': {
      return {
        ...state,
        parts: state.parts.map((p) => {
          if (p.id !== action.id) return p
          const rotated = rotatePart(p)
          if (partFitsOnGrid(rotated)) return rotated
          return { ...rotated, origin: clampOriginForRotation(rotated.origin, rotated.rotation) }
        }),
      }
    }

    case 'SET_VALUE': {
      return {
        ...state,
        parts: state.parts.map((p) => (p.id === action.id ? { ...p, value: action.value } : p)),
      }
    }

    case 'REMOVE_PART': {
      return {
        ...state,
        parts: state.parts.filter((p) => p.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        limitWarning: false,
      }
    }

    case 'TOGGLE_SWITCH': {
      return {
        ...state,
        parts: state.parts.map((p) => (p.id === action.id && p.kind === 'switch' ? { ...p, closed: !p.closed } : p)),
      }
    }

    case 'SELECT': {
      return { ...state, selectedId: action.id, selectedWireId: action.id ? null : state.selectedWireId }
    }

    case 'SELECT_WIRE': {
      return { ...state, selectedWireId: action.id, selectedId: action.id ? null : state.selectedId }
    }

    case 'ADD_WIRE': {
      const origin = clampWireOrigin(clampToGrid(action.origin))
      const wire: Wire = { id: nextId('wire'), points: [origin, { col: origin.col + 1, row: origin.row }] }
      return { ...state, wires: [...state.wires, wire], selectedWireId: wire.id, selectedId: null, limitWarning: false }
    }

    case 'MOVE_WIRE': {
      return {
        ...state,
        wires: state.wires.map((w) => {
          if (w.id !== action.id) return w
          const first = w.points[0]
          const dCol = action.origin.col - first.col
          const dRow = action.origin.row - first.row
          const moved = w.points.map((p) => clampToGrid({ col: p.col + dCol, row: p.row + dRow }))
          return { ...w, points: moved }
        }),
      }
    }

    case 'RESIZE_WIRE_ENDPOINT': {
      return {
        ...state,
        wires: state.wires.map((w) => {
          if (w.id !== action.id) return w
          const isStart = action.endpoint === 'start'
          const neighborIndex = isStart ? 1 : w.points.length - 2
          const neighbor = w.points[neighborIndex]
          const target = axisLock(clampToGrid(action.point), neighbor)
          // never let an endpoint collapse onto its neighbor (zero-length segment)
          if (target.col === neighbor.col && target.row === neighbor.row) return w
          const points = [...w.points]
          points[isStart ? 0 : w.points.length - 1] = target
          return { ...w, points }
        }),
      }
    }

    case 'REMOVE_WIRE': {
      return {
        ...state,
        wires: state.wires.filter((w) => w.id !== action.id),
        selectedWireId: state.selectedWireId === action.id ? null : state.selectedWireId,
      }
    }

    case 'LOAD': {
      return {
        ...state,
        parts: action.parts,
        wires: action.wires,
        selectedId: null,
        selectedWireId: null,
        limitWarning: false,
      }
    }

    case 'SET_DISPLAY_MODE': {
      return { ...state, displayMode: action.mode }
    }

    default:
      return state
  }
}
