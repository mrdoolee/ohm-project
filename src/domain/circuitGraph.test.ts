import { describe, expect, test } from 'vitest'
import { buildCircuitEdges } from './circuitGraph'
import { solveCircuit } from './circuitSolver'
import type { Part } from './parts'
import type { Wire } from './wires'

describe('buildCircuitEdges', () => {
  test('wire endpoints touching component terminals connect them into one working circuit', () => {
    const parts: Part[] = [
      { id: 'batt', kind: 'battery', origin: { col: 0, row: 0 }, rotation: 0, value: 9, closed: true },
      { id: 'r1', kind: 'resistor', origin: { col: 1, row: 2 }, rotation: 90, value: 10, closed: true },
    ]
    const wires: Wire[] = [
      { id: 'w1', points: [{ col: 1, row: 0 }, { col: 1, row: 2 }] }, // batt.b -> r1.a
      { id: 'w2', points: [{ col: 1, row: 3 }, { col: 0, row: 3 }, { col: 0, row: 0 }] }, // r1.b -> batt.a
    ]

    const edges = buildCircuitEdges(parts, wires)
    const result = solveCircuit(edges)

    expect(result.status).toBe('ok')
    expect(result.components.r1.current).toBeCloseTo(0.9)
  })

  test('a wire passing through a component terminal connects there automatically', () => {
    // r1 sits at (2,1)-(2,2); the top leg connects batt.a to r1.a directly by
    // wire endpoints. The bottom leg is one long wire from batt.b that merely
    // *passes through* r1.b at (2,2) on its way to (4,2) — a part terminal always
    // taps into whatever wire it lands on.
    const parts: Part[] = [
      { id: 'batt', kind: 'battery', origin: { col: 0, row: 1 }, rotation: 90, value: 9, closed: true },
      { id: 'r1', kind: 'resistor', origin: { col: 2, row: 1 }, rotation: 90, value: 10, closed: true },
    ]
    const wires: Wire[] = [
      { id: 'top', points: [{ col: 0, row: 1 }, { col: 2, row: 1 }] }, // batt.a -> r1.a, direct endpoints
      { id: 'bottom', points: [{ col: 0, row: 2 }, { col: 4, row: 2 }] }, // batt.b -> passes through r1.b=(2,2) -> (4,2)
    ]

    const result = solveCircuit(buildCircuitEdges(parts, wires))
    expect(result.status).toBe('ok')
    // batt.b(+) feeds r1.b through the bottom wire, so current runs r1.b -> r1.a: negative in a->b terms.
    expect(result.components.r1.current).toBeCloseTo(-0.9)
  })

  test('two independent wires crossing connect automatically, same as any other shared point', () => {
    // Horizontal (0,1)-(2,1) and vertical (1,0)-(1,2) cross at (1,1), an interior
    // point of both. r1 taps the horizontal wire at its own endpoint (0,1); r2
    // taps the vertical wire at its own endpoint (1,0).
    const wires: Wire[] = [
      { id: 'horizontal', points: [{ col: 0, row: 1 }, { col: 2, row: 1 }] },
      { id: 'vertical', points: [{ col: 1, row: 0 }, { col: 1, row: 2 }] },
    ]
    const probes: Part[] = [
      { id: 'r1', kind: 'resistor', origin: { col: 0, row: 1 }, rotation: 180, value: 10, closed: true },
      { id: 'r2', kind: 'resistor', origin: { col: 1, row: 0 }, rotation: 270, value: 10, closed: true },
    ]

    const edges = buildCircuitEdges(probes, wires)
    const r1 = edges.find((e) => e.id === 'r1')!
    const r2 = edges.find((e) => e.id === 'r2')!
    expect(r1.nodeA).toBe(r2.nodeA)
  })

  test('a part whose whole footprint overlaps one wire segment is inserted in series, not bypassed', () => {
    // A single long wire from (0,0) to (10,0). r1 sits at (3,0)-(4,0), squarely on
    // top of that wire's own path. Without splitting the wire there, the wire's
    // 0-ohm segment between those two points would run in parallel with r1 and
    // short it out — current would skip r1 entirely and every meter on it would
    // read 0, even though nothing about the circuit looks "open".
    const parts: Part[] = [
      { id: 'batt', kind: 'battery', origin: { col: 0, row: 0 }, rotation: 90, value: 9, closed: true }, // a=(0,0) b=(0,1)
      { id: 'r1', kind: 'resistor', origin: { col: 3, row: 0 }, rotation: 0, value: 20, closed: true },
    ]
    const wires: Wire[] = [
      { id: 'long', points: [{ col: 0, row: 0 }, { col: 10, row: 0 }] }, // batt.a -> ... -> (10,0)
      { id: 'return', points: [{ col: 10, row: 0 }, { col: 10, row: 1 }, { col: 0, row: 1 }] }, // (10,0) -> batt.b
    ]

    const edges = buildCircuitEdges(parts, wires)
    const r1 = edges.find((e) => e.id === 'r1')!
    expect(r1.nodeA).not.toBe(r1.nodeB)

    const result = solveCircuit(edges)
    expect(result.status).toBe('ok')
    // 9V / 20ohm, entering r1 at its b terminal (return wire arrives from the right): b -> a, negative.
    expect(result.components.r1.current).toBeCloseTo(-0.45)
  })
})
