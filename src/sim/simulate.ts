import { CircuitError, GATE_PINS, isGate } from './types.ts'
import type { Bit, Circuit, GateKind } from './types.ts'

/** Signal 0 is a constant 0; unconnected inputs read from it. */
const ZERO = 0

export const MAX_PASSES = 1000

export interface Compiled {
  inputIds: string[]
  outputIds: string[]
  clockSignals: Int32Array
  /** Signal index of every source node (INPUT/CLOCK/NAND), and of every OUTPUT node's driver. */
  signalOf: Map<string, number>
  signalCount: number
  /** NAND gates in evaluation order (dependencies first where there is no feedback). */
  gateA: Int32Array
  gateB: Int32Array
  gateOut: Int32Array
}

export interface SettleResult {
  status: 'stable' | 'oscillating'
  passes: number
}

/** Turns a circuit made only of primitives into flat arrays ready to simulate. */
export function compile(circuit: Circuit): Compiled {
  const kinds = new Map<string, GateKind>()
  for (const node of circuit.nodes) {
    if (kinds.has(node.id)) throw new CircuitError('duplicateId', { id: node.id })
    if (!isGate(node.kind)) throw new CircuitError('unknownKind', { kind: node.kind })
    kinds.set(node.id, node.kind)
  }

  const signalOf = new Map<string, number>()
  let signalCount = 1
  for (const node of circuit.nodes) {
    if (GATE_PINS[node.kind as GateKind].outputs.length > 0) signalOf.set(node.id, signalCount++)
  }

  const driver = new Map<string, number>()
  for (const { from, to } of circuit.wires) {
    const fromKind = kinds.get(from.node)
    const toKind = kinds.get(to.node)
    if (fromKind === undefined || toKind === undefined) {
      throw new CircuitError('missingWireNode', { node: fromKind ? to.node : from.node })
    }
    if (!GATE_PINS[fromKind].outputs.includes(from.pin)) {
      throw new CircuitError('noOutputPin', { node: from.node, pin: from.pin })
    }
    if (!GATE_PINS[toKind].inputs.includes(to.pin)) {
      throw new CircuitError('noInputPin', { node: to.node, pin: to.pin })
    }
    const key = `${to.node}\0${to.pin}`
    if (driver.has(key)) throw new CircuitError('twoWires', { pin: to.pin, node: to.node })
    driver.set(key, signalOf.get(from.node)!)
  }
  const source = (node: string, pin: string) => driver.get(`${node}\0${pin}`) ?? ZERO

  const nands = circuit.nodes.filter((n) => n.kind === 'NAND').map((n) => n.id)
  const order = evaluationOrder(nands, signalOf, source)
  const gateA = new Int32Array(order.length)
  const gateB = new Int32Array(order.length)
  const gateOut = new Int32Array(order.length)
  order.forEach((id, i) => {
    gateA[i] = source(id, 'a')
    gateB[i] = source(id, 'b')
    gateOut[i] = signalOf.get(id)!
  })

  const outputIds: string[] = []
  for (const node of circuit.nodes) {
    if (node.kind === 'OUTPUT') {
      outputIds.push(node.id)
      signalOf.set(node.id, source(node.id, 'in'))
    }
  }
  const inputIds = circuit.nodes.filter((n) => n.kind === 'INPUT').map((n) => n.id)
  const clockSignals = Int32Array.from(
    circuit.nodes.filter((n) => n.kind === 'CLOCK').map((n) => signalOf.get(n.id)!),
  )

  return { inputIds, outputIds, clockSignals, signalOf, signalCount, gateA, gateB, gateOut }
}

/**
 * Depth-first post-order over NAND dependencies, iterative so deep circuits
 * cannot overflow the stack. Combinational logic then settles in one pass.
 */
function evaluationOrder(
  nands: string[],
  signalOf: Map<string, number>,
  source: (node: string, pin: string) => number,
): string[] {
  const nandBySignal = new Map(nands.map((id) => [signalOf.get(id)!, id]))
  const state = new Map<string, 'visiting' | 'done'>()
  const order: string[] = []
  for (const root of nands) {
    if (state.has(root)) continue
    const stack: Array<{ id: string; next: number }> = [{ id: root, next: 0 }]
    state.set(root, 'visiting')
    while (stack.length > 0) {
      const top = stack[stack.length - 1]
      if (top.next < 2) {
        const dep = nandBySignal.get(source(top.id, top.next === 0 ? 'a' : 'b'))
        top.next++
        if (dep !== undefined && !state.has(dep)) {
          state.set(dep, 'visiting')
          stack.push({ id: dep, next: 0 })
        }
      } else {
        stack.pop()
        state.set(top.id, 'done')
        order.push(top.id)
      }
    }
  }
  return order
}

/**
 * Evaluates gates in place, in a fixed order, until nothing changes. The fixed
 * order makes feedback circuits (latches) deterministic; a circuit that never
 * settles is reported as oscillating instead of hanging.
 */
export class Simulator {
  readonly compiled: Compiled
  readonly values: Uint8Array

  constructor(compiled: Compiled) {
    this.compiled = compiled
    this.values = new Uint8Array(compiled.signalCount)
  }

  setInput(id: string, bit: Bit) {
    if (!this.compiled.inputIds.includes(id)) throw new CircuitError('noSuchInput', { name: id })
    this.values[this.compiled.signalOf.get(id)!] = bit
  }

  /** Drives every CLOCK node; call `settle()` afterwards. */
  setClock(bit: Bit) {
    for (const signal of this.compiled.clockSignals) this.values[signal] = bit
  }

  settle(maxPasses = MAX_PASSES): SettleResult {
    const { gateA, gateB, gateOut } = this.compiled
    const v = this.values
    for (let pass = 1; pass <= maxPasses; pass++) {
      let changed = false
      for (let i = 0; i < gateOut.length; i++) {
        const out = 1 - (v[gateA[i]] & v[gateB[i]])
        if (v[gateOut[i]] !== out) {
          v[gateOut[i]] = out
          changed = true
        }
      }
      if (!changed) return { status: 'stable', passes: pass }
    }
    return { status: 'oscillating', passes: maxPasses }
  }

  /**
   * One gate delay: every gate reads the values from before the step, so a
   * signal moves forward one gate at a time. Returns the signals that changed;
   * none means the circuit is stable.
   */
  step(): number[] {
    const { gateA, gateB, gateOut } = this.compiled
    const v = this.values
    const next = new Uint8Array(gateOut.length)
    for (let i = 0; i < gateOut.length; i++) next[i] = 1 - (v[gateA[i]] & v[gateB[i]])
    const changed: number[] = []
    for (let i = 0; i < gateOut.length; i++) {
      if (v[gateOut[i]] !== next[i]) {
        v[gateOut[i]] = next[i]
        changed.push(gateOut[i])
      }
    }
    return changed
  }

  /** Current value of a node: what an INPUT/NAND emits or what an OUTPUT receives. */
  read(id: string): Bit {
    const signal = this.compiled.signalOf.get(id)
    if (signal === undefined) throw new CircuitError('noSuchNode', { id })
    return this.values[signal] as Bit
  }
}

export interface TableRow {
  inputs: Bit[]
  outputs: Bit[]
  status: SettleResult['status']
}

/** Every combination of `count` bits, first bit as the most significant. */
export function combinations(count: number): Bit[][] {
  return Array.from({ length: 2 ** count }, (_, n) =>
    Array.from({ length: count }, (_, i) => ((n >> (count - 1 - i)) & 1) as Bit),
  )
}

/** Truth table of a circuit made only of primitives. */
export function truthTable(circuit: Circuit): TableRow[] {
  const sim = new Simulator(compile(circuit))
  const { inputIds, outputIds } = sim.compiled
  const rows: TableRow[] = []
  for (const inputs of combinations(inputIds.length)) {
    inputIds.forEach((id, i) => sim.setInput(id, inputs[i]))
    const { status } = sim.settle()
    rows.push({ inputs, outputs: outputIds.map((id) => sim.read(id)), status })
  }
  return rows
}
