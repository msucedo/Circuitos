import { useCallback, useMemo, useState } from 'react'
import type { Harness } from '../sim/harness.ts'
import { tryHarness } from '../sim/verify.ts'
import { CircuitError } from '../sim/types.ts'
import type { Bit, ChipLibrary, Circuit, Problem } from '../sim/types.ts'

export interface Signals {
  error?: Problem
  oscillating: boolean
  hasClock: boolean
  /** Step mode only: the last step changed nothing. */
  settled: boolean
  /** Step mode only: the last event (a step, or an input or clock change) changed what this source pin carries. */
  changed: (node: string, pin: string) => boolean
  /** Value on a source pin (what its wires carry), or received by an OUTPUT node (pin `in`). */
  pin: (node: string, pin: string) => number
}

export interface Simulation {
  signals: Signals
  /** Step mode: advance one gate delay. */
  step: () => void
}

const OFF: Signals = { oscillating: false, hasClock: false, settled: true, changed: () => false, pin: () => 0 }

/**
 * Recompiles only when the structure changes (not when nodes move), and keeps
 * one harness per structure so latches remember their state between toggles.
 * In step mode inputs are applied but the circuit only advances on `step()`.
 */
export function useSimulation(
  circuit: Circuit,
  library: ChipLibrary,
  inputs: ReadonlyMap<string, number>,
  clock: Bit,
  stepMode: boolean,
): Simulation {
  const structure = JSON.stringify([circuit.nodes.map((n) => [n.id, n.kind, n.width]), circuit.wires])
  // Keyed on `structure`, not `circuit`: moving a node must not reset the simulator.
  const harness = useMemo(() => tryHarness(circuit, library), [structure, library]) // eslint-disable-line react-hooks/exhaustive-deps
  // A new token whenever inputs, clock or structure change: there is something to propagate again.
  const token = useMemo(() => ({}), [harness, inputs, clock]) // eslint-disable-line react-hooks/exhaustive-deps
  const [last, setLast] = useState<{ token: object; settled: boolean }>()
  const settled = last?.token === token && last.settled

  const signals = useMemo((): Signals => {
    if (harness instanceof CircuitError) return { ...OFF, error: harness }
    // In step mode, a new token after the first is an input or clock change. A change made
    // outside step mode settles at once, and a new circuit starts fresh: nothing to compare with.
    const seen = harness.lastEvent
    if (!stepMode || seen !== token) harness.remember(token, stepMode && seen !== undefined)
    for (const pin of harness.inputs) harness.set(pin.name, inputs.get(pin.name) ?? 0)
    harness.sim.setClock(clock)
    const oscillating = stepMode ? false : harness.sim.settle().status === 'oscillating'
    return {
      oscillating,
      hasClock: harness.sim.compiled.clockSignals.length > 0,
      settled,
      changed: (node, pin) => harness.changedSinceEvent(node, pin),
      pin: (node, pin) => read(harness, node, pin),
    }
    // `last` changes on every step: the simulator was mutated, so the values must be read again.
  }, [harness, inputs, clock, stepMode, settled, last]) // eslint-disable-line react-hooks/exhaustive-deps

  const step = useCallback(() => {
    if (harness instanceof CircuitError) return
    harness.remember(token, true)
    setLast({ token, settled: harness.sim.step().length === 0 })
  }, [harness, token])

  return { signals, step }
}

function read(harness: Harness, node: string, pin: string): number {
  if (pin === 'in') return harness.outputs.some((p) => p.name === node) ? harness.read(node) : 0
  return harness.probe(node, pin)
}
