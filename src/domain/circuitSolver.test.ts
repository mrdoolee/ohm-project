import { describe, expect, test } from 'vitest'
import { solveCircuit } from './circuitSolver'
import type { CircuitEdge } from './circuitTypes'

describe('solveCircuit - pure series', () => {
  test('R1=10, R2=20, battery 9V yields I=0.3A and per-resistor voltage split', () => {
    const edges: CircuitEdge[] = [
      { id: 'batt', kind: 'battery', nodeA: 'neg', nodeB: 'pos', resistance: 0, emf: 9, closed: true },
      { id: 'r1', kind: 'resistor', nodeA: 'pos', nodeB: 'mid', resistance: 10, emf: 0, closed: true },
      { id: 'r2', kind: 'resistor', nodeA: 'mid', nodeB: 'neg', resistance: 20, emf: 0, closed: true },
    ]

    const result = solveCircuit(edges)

    expect(result.status).toBe('ok')
    expect(result.components.batt.current).toBeCloseTo(0.3)
    expect(result.components.r1.current).toBeCloseTo(0.3)
    expect(result.components.r2.current).toBeCloseTo(0.3)
    expect(result.components.r1.voltage).toBeCloseTo(3)
    expect(result.components.r2.voltage).toBeCloseTo(6)
  })
})

describe('solveCircuit - pure parallel', () => {
  test('R1=10, R2=10, battery 5V yields 0.5A per branch and 1A total', () => {
    const edges: CircuitEdge[] = [
      { id: 'batt', kind: 'battery', nodeA: 'neg', nodeB: 'pos', resistance: 0, emf: 5, closed: true },
      { id: 'r1', kind: 'resistor', nodeA: 'pos', nodeB: 'neg', resistance: 10, emf: 0, closed: true },
      { id: 'r2', kind: 'resistor', nodeA: 'pos', nodeB: 'neg', resistance: 10, emf: 0, closed: true },
    ]

    const result = solveCircuit(edges)

    expect(result.status).toBe('ok')
    expect(result.components.r1.current).toBeCloseTo(0.5)
    expect(result.components.r2.current).toBeCloseTo(0.5)
    expect(result.components.batt.current).toBeCloseTo(1)
  })
})

describe('solveCircuit - series + parallel mixed', () => {
  test('R1=2 in series with (R2=6 parallel R3=6), battery 10V', () => {
    const edges: CircuitEdge[] = [
      { id: 'batt', kind: 'battery', nodeA: 'neg', nodeB: 'a', resistance: 0, emf: 10, closed: true },
      { id: 'r1', kind: 'resistor', nodeA: 'a', nodeB: 'b', resistance: 2, emf: 0, closed: true },
      { id: 'r2', kind: 'resistor', nodeA: 'b', nodeB: 'neg', resistance: 6, emf: 0, closed: true },
      { id: 'r3', kind: 'resistor', nodeA: 'b', nodeB: 'neg', resistance: 6, emf: 0, closed: true },
    ]

    const result = solveCircuit(edges)

    expect(result.status).toBe('ok')
    expect(result.components.r1.current).toBeCloseTo(2)
    expect(result.components.r1.voltage).toBeCloseTo(4)
    expect(result.components.r2.current).toBeCloseTo(1)
    expect(result.components.r3.current).toBeCloseTo(1)
    expect(result.components.batt.current).toBeCloseTo(2)
  })
})

describe('solveCircuit - multiple batteries in series', () => {
  test('two 9V batteries, same polarity, sum to 18V', () => {
    const edges: CircuitEdge[] = [
      { id: 'b1', kind: 'battery', nodeA: 'neg', nodeB: 'mid', resistance: 0, emf: 9, closed: true },
      { id: 'b2', kind: 'battery', nodeA: 'mid', nodeB: 'pos', resistance: 0, emf: 9, closed: true },
      { id: 'r1', kind: 'resistor', nodeA: 'pos', nodeB: 'neg', resistance: 9, emf: 0, closed: true },
    ]

    const result = solveCircuit(edges)

    expect(result.status).toBe('ok')
    expect(result.components.r1.current).toBeCloseTo(2) // 18V / 9ohm
  })

  test('two 9V batteries, opposite polarity, cancel out', () => {
    const edges: CircuitEdge[] = [
      { id: 'b1', kind: 'battery', nodeA: 'neg', nodeB: 'mid', resistance: 0, emf: 9, closed: true },
      { id: 'b2', kind: 'battery', nodeA: 'pos', nodeB: 'mid', resistance: 0, emf: 9, closed: true },
      { id: 'r1', kind: 'resistor', nodeA: 'pos', nodeB: 'neg', resistance: 9, emf: 0, closed: true },
    ]

    const result = solveCircuit(edges)

    expect(result.status).toBe('ok')
    expect(result.components.r1.current).toBeCloseTo(0)
  })
})

describe('solveCircuit - open circuit', () => {
  test('open switch breaks the loop, all currents read 0', () => {
    const edges: CircuitEdge[] = [
      { id: 'batt', kind: 'battery', nodeA: 'neg', nodeB: 'pos', resistance: 0, emf: 9, closed: true },
      { id: 'r1', kind: 'resistor', nodeA: 'pos', nodeB: 'mid', resistance: 10, emf: 0, closed: true },
      { id: 'sw', kind: 'switch', nodeA: 'mid', nodeB: 'neg', resistance: 0, emf: 0, closed: false },
    ]

    const result = solveCircuit(edges)

    expect(result.status).toBe('open')
    expect(result.components.batt.current).toBeCloseTo(0)
    expect(result.components.r1.current).toBeCloseTo(0)
    expect(result.components.sw.current).toBeCloseTo(0)
  })
})

describe('solveCircuit - short circuit', () => {
  test('battery directly wired to itself reports short, does not crash', () => {
    const edges: CircuitEdge[] = [
      { id: 'batt', kind: 'battery', nodeA: 'neg', nodeB: 'pos', resistance: 0, emf: 9, closed: true },
      { id: 'wire', kind: 'switch', nodeA: 'pos', nodeB: 'neg', resistance: 0, emf: 0, closed: true },
    ]

    const result = solveCircuit(edges)

    expect(result.status).toBe('short')
    expect(Number.isFinite(result.components.batt.current)).toBe(true)
    expect(Number.isFinite(result.components.wire.current)).toBe(true)
  })
})

describe('solveCircuit - switch open zeroes only its own branch', () => {
  test('closed switch carries loop current, opening it drops current to 0 immediately', () => {
    const closedEdges: CircuitEdge[] = [
      { id: 'batt', kind: 'battery', nodeA: 'neg', nodeB: 'pos', resistance: 0, emf: 9, closed: true },
      { id: 'r1', kind: 'resistor', nodeA: 'pos', nodeB: 'mid', resistance: 10, emf: 0, closed: true },
      { id: 'sw', kind: 'switch', nodeA: 'mid', nodeB: 'neg', resistance: 0, emf: 0, closed: true },
    ]
    const closedResult = solveCircuit(closedEdges)
    expect(closedResult.status).toBe('ok')
    expect(closedResult.components.sw.current).toBeCloseTo(0.9)

    const openEdges = closedEdges.map((e) => (e.id === 'sw' ? { ...e, closed: false } : e))
    const openResult = solveCircuit(openEdges)
    expect(openResult.status).toBe('open')
    expect(openResult.components.sw.current).toBeCloseTo(0)
    expect(openResult.components.r1.current).toBeCloseTo(0)
  })
})

describe('solveCircuit - a dangling branch must not zero out an otherwise-closed loop', () => {
  test('bulb1 hangs off the loop with one end unconnected; battery + bulb2 still solve normally', () => {
    // bulb2 sits directly across the battery's own two nodes (a closed loop),
    // while bulb1 shares the "pos" node but its other end goes nowhere.
    const edges: CircuitEdge[] = [
      { id: 'batt', kind: 'battery', nodeA: 'neg', nodeB: 'pos', resistance: 0, emf: 9, closed: true },
      { id: 'bulb2', kind: 'bulb', nodeA: 'pos', nodeB: 'neg', resistance: 10, emf: 0, closed: true },
      { id: 'bulb1', kind: 'bulb', nodeA: 'pos', nodeB: 'dangling', resistance: 10, emf: 0, closed: true },
    ]

    const result = solveCircuit(edges)

    expect(result.status).toBe('ok')
    expect(result.components.batt.current).toBeCloseTo(0.9)
    expect(result.components.bulb2.current).toBeCloseTo(0.9)
    expect(result.components.bulb2.voltage).toBeCloseTo(9)
    expect(result.components.bulb1.current).toBeCloseTo(0)
  })
})
