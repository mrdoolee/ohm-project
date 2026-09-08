export const CELL = 40
export const GRID_COLS = 16
export const GRID_ROWS = 12
export const MAX_PARTS = 20

export interface GridPoint {
  col: number
  row: number
}

export function pointKey(p: GridPoint): string {
  return `${p.col},${p.row}`
}

export function pointsEqual(a: GridPoint, b: GridPoint): boolean {
  return a.col === b.col && a.row === b.row
}

export function toPixel(p: GridPoint): { x: number; y: number } {
  return { x: p.col * CELL, y: p.row * CELL }
}

export function nearestGridPoint(x: number, y: number): GridPoint {
  return { col: Math.round(x / CELL), row: Math.round(y / CELL) }
}

export function clampToGrid(p: GridPoint): GridPoint {
  return {
    col: Math.min(Math.max(p.col, 0), GRID_COLS - 1),
    row: Math.min(Math.max(p.row, 0), GRID_ROWS - 1),
  }
}
