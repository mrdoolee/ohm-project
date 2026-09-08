import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react'
import { buildCircuitEdges } from '../domain/circuitGraph'
import { solveCircuit } from '../domain/circuitSolver'
import type { SolveResult } from '../domain/circuitTypes'
import { circuitReducer, initialCircuitState, type CircuitAction, type CircuitState } from './circuitReducer'

interface CircuitContextValue {
  state: CircuitState
  dispatch: Dispatch<CircuitAction>
  solution: SolveResult
}

const CircuitContext = createContext<CircuitContextValue | null>(null)

export function CircuitProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(circuitReducer, initialCircuitState)

  const solution = useMemo(() => {
    const edges = buildCircuitEdges(state.parts, state.wires)
    return solveCircuit(edges)
  }, [state.parts, state.wires])

  const value = useMemo(() => ({ state, dispatch, solution }), [state, solution])

  return <CircuitContext.Provider value={value}>{children}</CircuitContext.Provider>
}

export function useCircuit(): CircuitContextValue {
  const ctx = useContext(CircuitContext)
  if (!ctx) throw new Error('useCircuit must be used within CircuitProvider')
  return ctx
}
