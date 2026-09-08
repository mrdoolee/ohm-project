import type { CircuitEdge } from './circuitTypes'
import { pointKey, type GridPoint } from './grid'
import { partTerminals, type Part } from './parts'
import { expandWireToUnitPoints, type Wire } from './wires'

class UnionFind {
  private parent = new Map<string, string>()

  private root(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x)
    let r = x
    while (this.parent.get(r) !== r) r = this.parent.get(r)!
    this.parent.set(x, r)
    return r
  }

  union(a: string, b: string) {
    const ra = this.root(a)
    const rb = this.root(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }

  find(a: string): string {
    return this.root(a)
  }
}

function partTerminalNodeId(partId: string, terminal: 'a' | 'b'): string {
  return `part:${partId}:${terminal}`
}

function wirePointNodeId(wireId: string, idx: number): string {
  return `wire:${wireId}:${idx}`
}

/** Unordered key for a 1-cell segment between two grid points. */
function segmentKey(p: GridPoint, q: GridPoint): string {
  const a = pointKey(p)
  const b = pointKey(q)
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Any two entities that land on the exact same grid point — a part
 * terminal, a wire endpoint, or a wire's interior pass-through point —
 * are electrically connected there. There is no separate "junction
 * dot" step: touching is connecting, the same way real jumper wires
 * and component leads work.
 */
export function buildCircuitEdges(parts: Part[], wires: Wire[]): CircuitEdge[] {
  const nodesByPoint = new Map<string, string[]>()
  const addTouch = (p: GridPoint, nodeId: string) => {
    const key = pointKey(p)
    const list = nodesByPoint.get(key) ?? []
    list.push(nodeId)
    nodesByPoint.set(key, list)
  }

  for (const part of parts) {
    const { a, b } = partTerminals(part)
    addTouch(a, partTerminalNodeId(part.id, 'a'))
    addTouch(b, partTerminalNodeId(part.id, 'b'))
  }

  const expandedByWire = new Map(wires.map((w) => [w.id, expandWireToUnitPoints(w)] as const))
  for (const wire of wires) {
    expandedByWire.get(wire.id)!.forEach((p, idx) => addTouch(p, wirePointNodeId(wire.id, idx)))
  }

  // A part's own footprint is a "cut" in any wire segment that exactly overlaps it —
  // otherwise the wire would keep conducting straight past the part and bypass it
  // entirely (short it out) instead of forcing current through it.
  const partSpanSegments = new Set(
    parts.map((part) => {
      const { a, b } = partTerminals(part)
      return segmentKey(a, b)
    }),
  )

  const uf = new UnionFind()

  // Same-wire points are mutually connected (one continuous entity, 0 resistance) —
  // except where a part sits directly on that segment, splitting it in two.
  for (const wire of wires) {
    const unitPoints = expandedByWire.get(wire.id)!
    for (let i = 1; i < unitPoints.length; i++) {
      if (partSpanSegments.has(segmentKey(unitPoints[i - 1], unitPoints[i]))) continue
      uf.union(wirePointNodeId(wire.id, i - 1), wirePointNodeId(wire.id, i))
    }
  }

  // Anything sharing a grid point is connected there.
  for (const nodeIds of nodesByPoint.values()) {
    for (let i = 1; i < nodeIds.length; i++) {
      uf.union(nodeIds[0], nodeIds[i])
    }
  }

  return parts.map((part) => {
    const nodeA = uf.find(partTerminalNodeId(part.id, 'a'))
    const nodeB = uf.find(partTerminalNodeId(part.id, 'b'))
    const isBattery = part.kind === 'battery'
    const isSwitch = part.kind === 'switch'
    const resistance = part.kind === 'resistor' || part.kind === 'rheostat' || part.kind === 'bulb' ? part.value : 0
    return {
      id: part.id,
      kind: part.kind,
      nodeA,
      nodeB,
      resistance,
      emf: isBattery ? part.value : 0,
      closed: isSwitch ? part.closed : true,
    }
  })
}
