import { GRID_COLS, GRID_ROWS, type GridPoint } from './grid'

export type PartKind = 'battery' | 'resistor' | 'rheostat' | 'bulb' | 'switch' | 'voltmeter' | 'ammeter'

export type Rotation = 0 | 90 | 180 | 270

export interface Part {
  id: string
  kind: PartKind
  origin: GridPoint
  rotation: Rotation
  value: number // ohms for resistor/rheostat/bulb, volts for battery; unused for switch/meters
  closed: boolean // switch only; ignored otherwise
}

const DIRECTION: Record<Rotation, { dc: number; dr: number }> = {
  0: { dc: 1, dr: 0 },
  90: { dc: 0, dr: 1 },
  180: { dc: -1, dr: 0 },
  270: { dc: 0, dr: -1 },
}

/** Terminal A is the part's "negative"/first end, terminal B the "positive"/second end. */
export function partTerminals(part: Part): { a: GridPoint; b: GridPoint } {
  const { dc, dr } = DIRECTION[part.rotation]
  return {
    a: part.origin,
    b: { col: part.origin.col + dc, row: part.origin.row + dr },
  }
}

export function rotatePart(part: Part): Part {
  const next = ((part.rotation + 90) % 360) as Rotation
  return { ...part, rotation: next }
}

export function isWithinGrid(p: GridPoint): boolean {
  return p.col >= 0 && p.col < GRID_COLS && p.row >= 0 && p.row < GRID_ROWS
}

export function partFitsOnGrid(part: Part): boolean {
  const { a, b } = partTerminals(part)
  return isWithinGrid(a) && isWithinGrid(b)
}

/** Clamps origin so both terminals stay on the grid for the given rotation. */
export function clampOriginForRotation(origin: GridPoint, rotation: Rotation): GridPoint {
  const { dc, dr } = DIRECTION[rotation]
  const minCol = dc < 0 ? 1 : 0
  const maxCol = dc > 0 ? GRID_COLS - 2 : GRID_COLS - 1
  const minRow = dr < 0 ? 1 : 0
  const maxRow = dr > 0 ? GRID_ROWS - 2 : GRID_ROWS - 1
  return {
    col: Math.min(Math.max(origin.col, minCol), maxCol),
    row: Math.min(Math.max(origin.row, minRow), maxRow),
  }
}

export const RESISTANCE_PRESETS = [10, 20, 50, 100]
export const BATTERY_PRESETS = [1.5, 9]

export const DEFAULT_VALUE: Record<PartKind, number> = {
  battery: 9,
  resistor: 20,
  rheostat: 50,
  bulb: 10,
  switch: 0,
  voltmeter: 0,
  ammeter: 0,
}
