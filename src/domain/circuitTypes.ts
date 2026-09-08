export type ComponentKind =
  | 'battery'
  | 'resistor'
  | 'rheostat'
  | 'bulb'
  | 'switch'
  | 'ammeter'
  | 'voltmeter'

/**
 * A two-terminal circuit element as seen by the solver.
 * `emf` is the open-circuit potential rise from nodeA to nodeB (0 for
 * everything except a battery). `closed` only matters for switches;
 * an open switch is excluded from the graph entirely by the caller.
 */
export interface CircuitEdge {
  id: string
  kind: ComponentKind
  nodeA: string
  nodeB: string
  resistance: number
  emf: number
  closed: boolean
}

export type CircuitStatus = 'ok' | 'open' | 'short' | 'unsupported'

export interface ComponentResult {
  id: string
  current: number
  voltage: number
}

export interface SolveResult {
  status: CircuitStatus
  components: Record<string, ComponentResult>
}
