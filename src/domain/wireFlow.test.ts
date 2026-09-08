import { describe, expect, it } from 'vitest'
import { computeWireSegmentFlows } from './wireFlow'
import type { Part } from './parts'
import type { Wire } from './wires'
import type { ComponentResult } from './circuitTypes'

function part(id: string, col: number, row: number): Part {
  return { id, kind: 'resistor', origin: { col, row }, rotation: 0, value: 10, closed: true }
}

describe('computeWireSegmentFlows', () => {
  it('propagates a series loop current onto every wire segment, oriented along the wire', () => {
    // battery a=(0,0) b=(1,0); resistor a=(0,2) b=(1,2)
    const battery: Part = { id: 'battery', kind: 'battery', origin: { col: 0, row: 0 }, rotation: 0, value: 9, closed: true }
    const resistor = part('resistor', 0, 2)
    const wireTop: Wire = { id: 'wireTop', points: [{ col: 1, row: 0 }, { col: 1, row: 2 }] }
    const wireBottom: Wire = { id: 'wireBottom', points: [{ col: 0, row: 2 }, { col: 0, row: 0 }] }
    const components: Record<string, ComponentResult> = {
      battery: { id: 'battery', current: 2, voltage: 9 },
      resistor: { id: 'resistor', current: -2, voltage: 9 },
    }

    const flows = computeWireSegmentFlows([battery, resistor], [wireTop, wireBottom], components)

    const byKey = new Map(flows.map((f) => [`${f.wireId}:${f.index}`, f.current]))
    // wireTop expands (1,0)->(1,1)->(1,2): current flows battery.b down to resistor.b, i.e. p->q, positive.
    expect(byKey.get('wireTop:0')).toBe(2)
    expect(byKey.get('wireTop:1')).toBe(2)
    // wireBottom expands (0,2)->(0,1)->(0,0): current flows resistor.a up to battery.a, i.e. p->q, positive.
    expect(byKey.get('wireBottom:0')).toBe(2)
    expect(byKey.get('wireBottom:1')).toBe(2)
  })

  it('omits segments in a wire network that contains a cycle (underdetermined split)', () => {
    const battery: Part = { id: 'battery', kind: 'battery', origin: { col: 0, row: 0 }, rotation: 0, value: 9, closed: true }
    const resistor = part('resistor', 0, 2)
    const wireTop: Wire = { id: 'wireTop', points: [{ col: 1, row: 0 }, { col: 1, row: 2 }] }
    const wireBottom: Wire = { id: 'wireBottom', points: [{ col: 0, row: 2 }, { col: 0, row: 0 }] }
    // Redundant direct shortcut between the same two nodes as wireBottom -> creates a cycle.
    const wireShortcut: Wire = { id: 'wireShortcut', points: [{ col: 0, row: 0 }, { col: 0, row: 2 }] }
    const components: Record<string, ComponentResult> = {
      battery: { id: 'battery', current: 2, voltage: 9 },
      resistor: { id: 'resistor', current: -2, voltage: 9 },
    }

    const flows = computeWireSegmentFlows(
      [battery, resistor],
      [wireTop, wireBottom, wireShortcut],
      components,
    )

    // wireTop is its own (non-cyclic) component and still resolves normally;
    // wireBottom+wireShortcut form one cyclic component and are both omitted.
    expect(flows.every((f) => f.wireId === 'wireTop')).toBe(true)
    expect(flows.some((f) => f.wireId === 'wireBottom')).toBe(false)
    expect(flows.some((f) => f.wireId === 'wireShortcut')).toBe(false)
  })

  it('reports zero current on a wire dangling off an open circuit', () => {
    const resistor = part('resistor', 0, 0)
    const wire: Wire = { id: 'wire', points: [{ col: 1, row: 0 }, { col: 3, row: 0 }] }
    const components: Record<string, ComponentResult> = { resistor: { id: 'resistor', current: 0, voltage: 0 } }

    const flows = computeWireSegmentFlows([resistor], [wire], components)

    expect(flows.every((f) => f.current === 0)).toBe(true)
  })
})
