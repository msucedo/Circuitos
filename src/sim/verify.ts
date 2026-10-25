import { flatten } from './flatten.ts'
import { Simulator, combinations, compile } from './simulate.ts'
import type { SettleResult } from './simulate.ts'
import { CircuitError } from './types.ts'
import type { Bit, ChipLibrary, Circuit } from './types.ts'

/** Inputs to set, then the outputs expected once the circuit settles (unlisted outputs are not checked). */
export interface Step {
  set: Record<string, Bit>
  expect: Record<string, Bit>
}

/** Steps run in order on one simulator, so sequential circuits keep their state between them. */
export interface Spec {
  inputs: string[]
  outputs: string[]
  steps: Step[]
}

export interface StepResult {
  step: Step
  actual: Record<string, Bit>
  status: SettleResult['status']
  ok: boolean
}

export interface VerifyResult {
  passed: boolean
  error?: string
  steps: StepResult[]
}

/** Spec for a combinational circuit: every input combination against `fn`. */
export function tableSpec(inputs: string[], outputs: string[], fn: (...bits: Bit[]) => Bit[]): Spec {
  const zip = (names: string[], bits: Bit[]) => Object.fromEntries(names.map((name, i) => [name, bits[i]]))
  return {
    inputs,
    outputs,
    steps: combinations(inputs.length).map((bits) => ({ set: zip(inputs, bits), expect: zip(outputs, fn(...bits)) })),
  }
}

function pinError(kind: string, actual: string[], expected: string[]): string | undefined {
  const missing = expected.find((id) => !actual.includes(id))
  if (missing) return `Falta la ${kind} "${missing}"`
  const extra = actual.find((id) => !expected.includes(id))
  if (extra) return `Sobra la ${kind} "${extra}"`
}

export function verify(circuit: Circuit, library: ChipLibrary, spec: Spec): VerifyResult {
  let sim: Simulator
  try {
    sim = new Simulator(compile(flatten(circuit, library)))
  } catch (error) {
    if (error instanceof CircuitError) return { passed: false, error: error.message, steps: [] }
    throw error
  }
  const error =
    pinError('entrada', sim.compiled.inputIds, spec.inputs) ??
    pinError('salida', sim.compiled.outputIds, spec.outputs)
  if (error) return { passed: false, error, steps: [] }

  const steps = spec.steps.map((step): StepResult => {
    for (const [id, bit] of Object.entries(step.set)) sim.setInput(id, bit)
    const { status } = sim.settle()
    const actual = Object.fromEntries(spec.outputs.map((id) => [id, sim.read(id)]))
    const ok = status === 'stable' && Object.entries(step.expect).every(([id, bit]) => actual[id] === bit)
    return { step, actual, status, ok }
  })
  return { passed: steps.every((s) => s.ok), steps }
}
