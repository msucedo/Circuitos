import { chipPins, flatten, pinKey } from './flatten.ts'
import type { FlatCircuit } from './flatten.ts'
import { Simulator, compile } from './simulate.ts'
import { CircuitError, bitNode } from './types.ts'
import type { Bit, ChipLibrary, Circuit, Pin } from './types.ts'

/**
 * A circuit ready to run, driven through its top-level pins by name. Bus pins
 * take and return plain numbers (bit 0 is the least significant).
 */
export class Harness {
  readonly sim: Simulator
  readonly flat: FlatCircuit
  readonly inputs: Pin[]
  readonly outputs: Pin[]

  /** Throws CircuitError if the circuit cannot be built. */
  constructor(circuit: Circuit, library: ChipLibrary) {
    this.flat = flatten(circuit, library)
    this.sim = new Simulator(compile(this.flat))
    const pins = chipPins(circuit)
    this.inputs = pins.inputs
    this.outputs = pins.outputs
  }

  private pin(list: Pin[], name: string, kind: string): Pin {
    const pin = list.find((p) => p.name === name)
    if (!pin) throw new CircuitError(`No existe la ${kind} "${name}"`)
    return pin
  }

  set(name: string, value: number) {
    const { width } = this.pin(this.inputs, name, 'entrada')
    for (let i = 0; i < width; i++) this.sim.setInput(bitNode(name, i, width), ((value >> i) & 1) as Bit)
  }

  read(name: string): number {
    const { width } = this.pin(this.outputs, name, 'salida')
    let value = 0
    for (let i = 0; i < width; i++) value |= this.sim.read(bitNode(name, i, width)) << i
    return value
  }

  /** Value carried by the wires leaving a top-level source pin. */
  probe(node: string, pin: string): number {
    const bits = this.flat.probes.get(pinKey(node, pin)) ?? []
    return bits.reduce((value, end, i) => (end ? value | (this.sim.read(end.node) << i) : value), 0)
  }
}
