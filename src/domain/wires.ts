import type { GridPoint } from './grid'

export interface Wire {
  id: string
  points: GridPoint[] // polyline vertices; each consecutive pair shares a row or a col (straight segment)
}

function step(from: number, to: number): number {
  if (to > from) return 1
  if (to < from) return -1
  return 0
}

/**
 * Expands a wire's corner vertices into every unit grid point it passes
 * through. A long straight drag from (0,1) to (4,1) is stored as just those
 * two corners, but connectivity needs every cell in between to be a real,
 * checkable point — a part terminal or another wire landing on (2,1) must
 * connect there even though it's not one of this wire's own corners.
 */
export function expandWireToUnitPoints(wire: Wire): GridPoint[] {
  const expanded: GridPoint[] = [wire.points[0]]
  for (let i = 1; i < wire.points.length; i++) {
    const from = wire.points[i - 1]
    const to = wire.points[i]
    const dc = step(from.col, to.col)
    const dr = step(from.row, to.row)
    let cur = from
    while (cur.col !== to.col || cur.row !== to.row) {
      cur = { col: cur.col + dc, row: cur.row + dr }
      expanded.push(cur)
    }
  }
  return expanded
}
