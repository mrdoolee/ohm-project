import { describe, expect, test } from 'vitest'
import { circuitReducer, initialCircuitState, type CircuitState } from './circuitReducer'

function withParts(count: number): CircuitState {
  let state = initialCircuitState
  for (let i = 0; i < count; i++) {
    state = circuitReducer(state, { type: 'ADD_PART', kind: 'resistor', origin: { col: 1, row: 1 } })
  }
  return state
}

describe('circuitReducer', () => {
  test('refuses to add a 21st part', () => {
    const state = withParts(20)
    expect(state.parts).toHaveLength(20)

    const next = circuitReducer(state, { type: 'ADD_PART', kind: 'resistor', origin: { col: 2, row: 2 } })

    expect(next.parts).toHaveLength(20)
    expect(next.limitWarning).toBe(true)
  })

  test('rotating a part cycles through 0/90/180/270', () => {
    let state = circuitReducer(initialCircuitState, { type: 'ADD_PART', kind: 'battery', origin: { col: 5, row: 5 } })
    const id = state.parts[0].id
    state = circuitReducer(state, { type: 'ROTATE_PART', id })
    expect(state.parts[0].rotation).toBe(90)
  })

  test('moving a part snaps origin onto the grid and within bounds', () => {
    let state = circuitReducer(initialCircuitState, { type: 'ADD_PART', kind: 'resistor', origin: { col: 5, row: 5 } })
    const id = state.parts[0].id
    state = circuitReducer(state, { type: 'MOVE_PART', id, origin: { col: 99, row: -5 } })
    expect(state.parts[0].origin.col).toBeLessThan(16)
    expect(state.parts[0].origin.row).toBeGreaterThanOrEqual(0)
  })

  test('toggling a switch flips its closed flag', () => {
    let state = circuitReducer(initialCircuitState, { type: 'ADD_PART', kind: 'switch', origin: { col: 3, row: 3 } })
    const id = state.parts[0].id
    expect(state.parts[0].closed).toBe(true)
    state = circuitReducer(state, { type: 'TOGGLE_SWITCH', id })
    expect(state.parts[0].closed).toBe(false)
  })

  test('dropping a wire places a 1-cell segment starting exactly at the drop point', () => {
    const state = circuitReducer(initialCircuitState, { type: 'ADD_WIRE', origin: { col: 5, row: 7 } })

    expect(state.wires).toHaveLength(1)
    expect(state.wires[0].points).toEqual([{ col: 5, row: 7 }, { col: 6, row: 7 }])
    expect(state.selectedWireId).toBe(state.wires[0].id)
  })

  test('dragging an endpoint lengthens or shortens the wire, staying axis-locked', () => {
    let state = circuitReducer(initialCircuitState, { type: 'ADD_WIRE', origin: { col: 5, row: 7 } })
    const id = state.wires[0].id

    state = circuitReducer(state, { type: 'RESIZE_WIRE_ENDPOINT', id, endpoint: 'end', point: { col: 9, row: 7 } })
    expect(state.wires[0].points).toEqual([{ col: 5, row: 7 }, { col: 9, row: 7 }])

    // dragging off-axis still snaps to a straight horizontal/vertical segment (locks to whichever axis moved more)
    state = circuitReducer(state, { type: 'RESIZE_WIRE_ENDPOINT', id, endpoint: 'end', point: { col: 5, row: 10 } })
    expect(state.wires[0].points).toEqual([{ col: 5, row: 7 }, { col: 5, row: 10 }])
  })

  test('resizing an endpoint onto its neighbor (zero length) is rejected', () => {
    let state = circuitReducer(initialCircuitState, { type: 'ADD_WIRE', origin: { col: 5, row: 7 } })
    const id = state.wires[0].id

    state = circuitReducer(state, { type: 'RESIZE_WIRE_ENDPOINT', id, endpoint: 'end', point: { col: 5, row: 7 } })
    expect(state.wires[0].points).toEqual([{ col: 5, row: 7 }, { col: 6, row: 7 }])
  })

  test('moving a wire translates every point by the same offset', () => {
    let state = circuitReducer(initialCircuitState, { type: 'ADD_WIRE', origin: { col: 5, row: 7 } })
    const id = state.wires[0].id

    state = circuitReducer(state, { type: 'MOVE_WIRE', id, origin: { col: 8, row: 2 } })
    expect(state.wires[0].points).toEqual([{ col: 8, row: 2 }, { col: 9, row: 2 }])
  })

  test('selecting and removing a wire clears the selection', () => {
    let state = circuitReducer(initialCircuitState, { type: 'ADD_WIRE', origin: { col: 0, row: 0 } })
    const wireId = state.wires[0].id
    expect(state.selectedWireId).toBe(wireId)

    state = circuitReducer(state, { type: 'REMOVE_WIRE', id: wireId })
    expect(state.wires).toHaveLength(0)
    expect(state.selectedWireId).toBeNull()
  })

  test('selecting a part clears any selected wire, and vice versa', () => {
    let state = circuitReducer(initialCircuitState, { type: 'ADD_WIRE', origin: { col: 0, row: 0 } })
    const wireId = state.wires[0].id

    state = circuitReducer(state, { type: 'ADD_PART', kind: 'resistor', origin: { col: 5, row: 5 } })
    expect(state.selectedId).not.toBeNull()
    expect(state.selectedWireId).toBeNull()

    state = circuitReducer(state, { type: 'SELECT_WIRE', id: wireId })
    expect(state.selectedWireId).toBe(wireId)
    expect(state.selectedId).toBeNull()
  })
})
