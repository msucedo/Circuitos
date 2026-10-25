import { useMemo } from 'react'
import { flatten, pinKey } from '../sim/flatten.ts'
import { Simulator, compile } from '../sim/simulate.ts'
import { CircuitError } from '../sim/types.ts'
import type { Bit, ChipLibrary, Circuit } from '../sim/types.ts'

export interface Signals {
  error?: string
  oscillating: boolean
  hasClock: boolean
  /** Value on a source pin (what its wires carry), or on an OUTPUT node. */
  pin: (node: string, pin: string) => Bit
}

const OFF: Signals['pin'] = () => 0

/**
 * Recompiles only when the structure changes (not when nodes move), and keeps
 * one simulator per structure so latches remember their state between toggles.
 */
export function useSimulation(circuit: Circuit, library: ChipLibrary, inputs: ReadonlyMap<string, Bit>, clock: Bit): Signals {
  const structure = JSON.stringify([circuit.nodes.map((n) => [n.id, n.kind]), circuit.wires])
  // Keyed on `structure`, not `circuit`: moving a node must not reset the simulator.
  const build = useMemo(() => {
    try {
      const flat = flatten(circuit, library)
      return { flat, sim: new Simulator(compile(flat)) }
    } catch (error) {
      if (error instanceof CircuitError) return { error: error.message }
      throw error
    }
  }, [structure, library]) // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo((): Signals => {
    if (!('sim' in build) || !build.sim) return { error: build.error, oscillating: false, hasClock: false, pin: OFF }
    const { sim, flat } = build
    for (const id of sim.compiled.inputIds) sim.setInput(id, inputs.get(id) ?? 0)
    sim.setClock(clock)
    const { status } = sim.settle()
    const values = sim.values.slice()
    const { signalOf } = sim.compiled
    const valueOf = (node: string) => {
      const signal = signalOf.get(node)
      return (signal === undefined ? 0 : values[signal]) as Bit
    }
    return {
      oscillating: status === 'oscillating',
      hasClock: sim.compiled.clockSignals.length > 0,
      pin: (node, pin) => {
        if (pin === 'in') return valueOf(node)
        const probe = flat.probes.get(pinKey(node, pin))
        return probe ? valueOf(probe.node) : 0
      },
    }
  }, [build, inputs, clock])
}
