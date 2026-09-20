import type { CircuitEdge, CircuitStatus, ComponentResult, SolveResult } from './circuitTypes'

type EdgeTree =
  | { kind: 'leaf'; id: string }
  | { kind: 'series'; children: WEdge[] }
  | { kind: 'parallel'; children: WEdge[] }

interface WEdge {
  nodeA: string
  nodeB: string
  resistance: number
  emf: number
  tree: EdgeTree
}

function flip(e: WEdge): WEdge {
  const base = { nodeA: e.nodeB, nodeB: e.nodeA, resistance: e.resistance, emf: -e.emf }
  if (e.tree.kind === 'leaf') return { ...base, tree: e.tree }
  const children = e.tree.children.map(flip).reverse()
  return { ...base, tree: { kind: e.tree.kind, children } }
}

/**
 * Repeatedly applies series elimination (any degree-2 node) and parallel
 * merging (two edges sharing a node pair, both zero-EMF) until no more
 * moves are possible.
 *
 * A series merge whose two far endpoints coincide produces a self-loop
 * edge (nodeA === nodeB) — that's a fully closed sub-circuit, moved into
 * `selfLoops`. Whatever can't be reduced further (a genuine bridge/mesh
 * topology, or a dangling open path) is returned as `stuck`.
 */
function reduceComponent(initial: WEdge[]): { selfLoops: WEdge[]; stuck: WEdge[] } {
  let edges = [...initial]
  const selfLoops: WEdge[] = []

  while (true) {
    const degree = new Map<string, number>()
    for (const e of edges) {
      degree.set(e.nodeA, (degree.get(e.nodeA) ?? 0) + 1)
      degree.set(e.nodeB, (degree.get(e.nodeB) ?? 0) + 1)
    }

    let didSeries = false
    for (const [node, deg] of degree) {
      if (deg !== 2) continue
      const incident = edges.filter((e) => e.nodeA === node || e.nodeB === node)
      if (incident.length !== 2) continue
      const [e1, e2] = incident
      const far1 = e1.nodeA === node ? e1.nodeB : e1.nodeA
      const far2 = e2.nodeA === node ? e2.nodeB : e2.nodeA
      const e1o = e1.nodeA === far1 ? e1 : flip(e1)
      const e2o = e2.nodeA === node ? e2 : flip(e2)
      const merged: WEdge = {
        nodeA: far1,
        nodeB: far2,
        resistance: e1o.resistance + e2o.resistance,
        emf: e1o.emf + e2o.emf,
        tree: { kind: 'series', children: [e1o, e2o] },
      }
      edges = edges.filter((e) => e !== e1 && e !== e2)
      if (far1 === far2) {
        selfLoops.push(merged)
      } else {
        edges.push(merged)
      }
      didSeries = true
      break
    }
    if (didSeries) continue

    let didParallel = false
    outer: for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const e1 = edges[i]
        const e2 = edges[j]
        const samePair =
          (e1.nodeA === e2.nodeA && e1.nodeB === e2.nodeB) ||
          (e1.nodeA === e2.nodeB && e1.nodeB === e2.nodeA)
        if (!samePair) continue
        if (e1.emf !== 0 || e2.emf !== 0) continue
        const e2o = e2.nodeA === e1.nodeA ? e2 : flip(e2)
        const rSum = e1.resistance + e2o.resistance
        const rEq = rSum === 0 ? 0 : (e1.resistance * e2o.resistance) / rSum
        const merged: WEdge = {
          nodeA: e1.nodeA,
          nodeB: e1.nodeB,
          resistance: rEq,
          emf: 0,
          tree: { kind: 'parallel', children: [e1, e2o] },
        }
        edges = edges.filter((e) => e !== e1 && e !== e2)
        edges.push(merged)
        didParallel = true
        break outer
      }
    }
    if (didParallel) continue

    break
  }

  return { selfLoops, stuck: edges }
}

function containsBattery(tree: EdgeTree, batteryIds: Set<string>): boolean {
  if (tree.kind === 'leaf') return batteryIds.has(tree.id)
  return tree.children.some((c) => containsBattery(c.tree, batteryIds))
}

function assignZero(tree: EdgeTree, results: Record<string, ComponentResult>) {
  if (tree.kind === 'leaf') {
    results[tree.id] = { id: tree.id, current: 0, voltage: 0 }
    return
  }
  for (const c of tree.children) assignZero(c.tree, results)
}

/**
 * `current` handed down the tree is always measured along the *traversal*
 * direction of the edge it's attached to — and series/parallel merging may
 * have flipped a leaf (swapping its nodeA/nodeB) to line it up with that
 * traversal. A leaf's reported current must be relative to the *original*
 * part's terminals (positive = original nodeA -> nodeB), so it's sign-corrected
 * here by comparing the possibly-flipped leaf against the original nodeA.
 */
function solveTree(
  edge: WEdge,
  current: number,
  potA: number,
  results: Record<string, ComponentResult>,
  potentials: Map<string, number>,
  originalNodeA: Map<string, string>,
) {
  const potB = potA + edge.emf - current * edge.resistance
  potentials.set(edge.nodeA, potA)
  potentials.set(edge.nodeB, potB)

  if (edge.tree.kind === 'leaf') {
    const flipped = edge.nodeA !== originalNodeA.get(edge.tree.id) && edge.nodeA !== edge.nodeB
    results[edge.tree.id] = { id: edge.tree.id, current: flipped ? -current : current, voltage: Math.abs(potB - potA) }
    return
  }

  if (edge.tree.kind === 'series') {
    let pot = potA
    for (const child of edge.tree.children) {
      solveTree(child, current, pot, results, potentials, originalNodeA)
      pot = pot + child.emf - current * child.resistance
    }
    return
  }

  // parallel
  if (edge.resistance === 0) {
    const zeroIdx = edge.tree.children.findIndex((c) => c.resistance === 0)
    edge.tree.children.forEach((child, idx) => {
      solveTree(child, idx === zeroIdx ? current : 0, potA, results, potentials, originalNodeA)
    })
  } else {
    for (const child of edge.tree.children) {
      const childCurrent = (potA + child.emf - potB) / child.resistance
      solveTree(child, childCurrent, potA, results, potentials, originalNodeA)
    }
  }
}

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

const STATUS_SEVERITY: Record<CircuitStatus, number> = { ok: 0, open: 1, unsupported: 2, short: 3 }

export function solveCircuit(edges: CircuitEdge[]): SolveResult {
  const results: Record<string, ComponentResult> = {}
  const potentials = new Map<string, number>()
  const originalNodeA = new Map(edges.map((e) => [e.id, e.nodeA] as const))
  const batteryIds = new Set(edges.filter((e) => e.kind === 'battery').map((e) => e.id))

  const graphEdges: WEdge[] = edges
    .filter((e) => e.kind !== 'voltmeter' && !(e.kind === 'switch' && !e.closed))
    .map((e) => ({
      nodeA: e.nodeA,
      nodeB: e.nodeB,
      resistance: e.resistance,
      emf: e.emf,
      tree: { kind: 'leaf', id: e.id },
    }))

  const uf = new UnionFind()
  for (const e of graphEdges) uf.union(e.nodeA, e.nodeB)

  const groups = new Map<string, WEdge[]>()
  for (const e of graphEdges) {
    const root = uf.find(e.nodeA)
    const group = groups.get(root) ?? []
    group.push(e)
    groups.set(root, group)
  }

  let status: CircuitStatus = 'ok'
  const escalate = (s: CircuitStatus) => {
    if (STATUS_SEVERITY[s] > STATUS_SEVERITY[status]) status = s
  }

  for (const group of groups.values()) {
    const { selfLoops, stuck } = reduceComponent(group)

    // Every fully-closed self-loop is solved on its own terms — its current
    // depends only on its own R/E, never on some other dangling branch that
    // happens to share a node with it (a bulb left with one loose end must
    // not zero out an otherwise-complete loop elsewhere on the same rail).
    for (const loop of selfLoops) {
      if (loop.emf === 0) {
        assignZero(loop.tree, results)
      } else if (loop.resistance === 0) {
        escalate('short')
        assignZero(loop.tree, results)
      } else {
        const rawCurrent = loop.emf / loop.resistance
        const orientedLoop = rawCurrent < 0 ? flip(loop) : loop
        solveTree(orientedLoop, Math.abs(rawCurrent), 0, results, potentials, originalNodeA)
      }
    }

    if (stuck.length > 0) {
      const hasBattery = stuck.some((e) => containsBattery(e.tree, batteryIds))
      const isDangling = stuck.length === 1 && stuck[0].nodeA !== stuck[0].nodeB
      if (hasBattery) escalate(isDangling ? 'open' : 'unsupported')
      for (const e of stuck) assignZero(e.tree, results)
    }
  }

  for (const e of edges) {
    if (e.kind === 'voltmeter' || (e.kind === 'switch' && !e.closed)) {
      const a = potentials.get(e.nodeA)
      const b = potentials.get(e.nodeB)
      results[e.id] = { id: e.id, current: 0, voltage: a !== undefined && b !== undefined ? Math.abs(a - b) : 0 }
    }
  }

  return { status, components: results }
}
