import { pointKey, type GridPoint } from './grid'
import { partTerminals, type Part } from './parts'
import { expandWireToUnitPoints, type Wire } from './wires'
import type { ComponentResult } from './circuitTypes'

export interface WireSegmentFlow {
  wireId: string
  /** Segment `index` connects `expandWireToUnitPoints(wire)[index]` -> `[index + 1]`. */
  index: number
  /** Positive = flows from the earlier point to the later point in the wire's own expansion order. */
  current: number
}

function segmentKey(p: GridPoint, q: GridPoint): string {
  const a = pointKey(p)
  const b = pointKey(q)
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

interface GraphEdge {
  wireId: string
  index: number
  p: GridPoint
  q: GridPoint
}

/**
 * Reconstructs per-unit-segment current for every wire, for the flow-arrow
 * display. The solver only tracks current through *parts* (wires are
 * zero-resistance connectivity, collapsed away entirely by circuitGraph's
 * union-find) — so this derives wire current from the already-solved part
 * currents via KCL: each part injects/draws current at its two terminal
 * points, and for any wire subnetwork that forms a tree (the overwhelming
 * common case — nothing about a student circuit calls for a redundant wire
 * loop), the current on every edge is uniquely determined by summing the
 * known injections in the subtree hanging off that edge. A wire subnetwork
 * containing a cycle is genuinely underdetermined (real wire resistances
 * would decide the split; wires here are ideal 0-resistance) — segments in
 * such a component are omitted rather than guessed at.
 */
export function computeWireSegmentFlows(
  parts: Part[],
  wires: Wire[],
  components: Record<string, ComponentResult>,
): WireSegmentFlow[] {
  // A part's own span "cuts" the wire segment it directly overlaps (see
  // circuitGraph) — the wire doesn't conduct there, the part does.
  const partSpanSegments = new Set(
    parts.map((part) => {
      const { a, b } = partTerminals(part)
      return segmentKey(a, b)
    }),
  )

  const edges: GraphEdge[] = []
  for (const wire of wires) {
    const unitPoints = expandWireToUnitPoints(wire)
    for (let i = 0; i < unitPoints.length - 1; i++) {
      const p = unitPoints[i]
      const q = unitPoints[i + 1]
      if (partSpanSegments.has(segmentKey(p, q))) continue
      edges.push({ wireId: wire.id, index: i, p, q })
    }
  }

  // Net current injected into the wire network at each grid point by the
  // parts touching it: a part with signed current I (a -> b through the
  // part) draws I out of the wire network at 'a' and returns it at 'b'.
  const injection = new Map<string, number>()
  const addInjection = (point: GridPoint, delta: number) => {
    const key = pointKey(point)
    injection.set(key, (injection.get(key) ?? 0) + delta)
  }
  for (const part of parts) {
    const current = components[part.id]?.current ?? 0
    if (current === 0) continue
    const { a, b } = partTerminals(part)
    addInjection(a, -current)
    addInjection(b, current)
  }

  const adjacency = new Map<string, number[]>()
  edges.forEach((edge, edgeIdx) => {
    for (const pt of [edge.p, edge.q]) {
      const key = pointKey(pt)
      const list = adjacency.get(key) ?? []
      list.push(edgeIdx)
      adjacency.set(key, list)
    }
  })

  const results: WireSegmentFlow[] = []
  const visitedPoint = new Set<string>()

  for (const startKey of adjacency.keys()) {
    if (visitedPoint.has(startKey)) continue

    // BFS spanning tree over this connected component, flagging any extra
    // edge (both endpoints already visited via a different edge) as a cycle.
    const parentEdge = new Map<string, number>()
    const parentPoint = new Map<string, string>()
    const order: string[] = [startKey]
    visitedPoint.add(startKey)
    let hasCycle = false

    for (let qi = 0; qi < order.length; qi++) {
      const key = order[qi]
      for (const edgeIdx of adjacency.get(key) ?? []) {
        const edge = edges[edgeIdx]
        const otherKey = pointKey(edge.p) === key ? pointKey(edge.q) : pointKey(edge.p)
        if (!visitedPoint.has(otherKey)) {
          visitedPoint.add(otherKey)
          parentEdge.set(otherKey, edgeIdx)
          parentPoint.set(otherKey, key)
          order.push(otherKey)
        } else if (parentEdge.get(key) !== edgeIdx) {
          hasCycle = true
        }
      }
    }

    if (hasCycle) continue // underdetermined split; no arrows for this island

    // Post-order subtree sums (children before parents) give each edge's flow.
    const subtreeSum = new Map<string, number>()
    for (const key of order) subtreeSum.set(key, injection.get(key) ?? 0)
    for (let qi = order.length - 1; qi >= 1; qi--) {
      const key = order[qi]
      const pKey = parentPoint.get(key)!
      subtreeSum.set(pKey, (subtreeSum.get(pKey) ?? 0) + (subtreeSum.get(key) ?? 0))
    }

    for (let qi = order.length - 1; qi >= 1; qi--) {
      const key = order[qi]
      const edgeIdx = parentEdge.get(key)!
      const edge = edges[edgeIdx]
      const flowChildToParent = subtreeSum.get(key) ?? 0
      const childIsP = pointKey(edge.p) === key
      const current = childIsP ? flowChildToParent : -flowChildToParent
      results.push({ wireId: edge.wireId, index: edge.index, current })
    }
  }

  return results
}
