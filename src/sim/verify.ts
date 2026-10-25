import { Harness } from './harness.ts'
import { combinations } from './simulate.ts'
import type { SettleResult } from './simulate.ts'
import { CircuitError } from './types.ts'
import type { Bit, ChipLibrary, Circuit, Pin } from './types.ts'

/** Inputs to set, then the outputs expected once the circuit settles (unlisted outputs are not checked). Bus values are numbers. */
export interface Step {
  set: Record<string, number>
  expect: Record<string, number>
}

/** Steps run in order on one simulator, so sequential circuits keep their state between them. */
export interface Spec {
  inputs: string[]
  outputs: string[]
  /** Pin widths other than 1. */
  widths?: Record<string, number>
  /** Every input combination with no memory involved: a truth table can show the expected values. */
  combinational?: boolean
  steps: Step[]
}

export interface StepResult {
  step: Step
  actual: Record<string, number>
  status: SettleResult['status']
  ok: boolean
}

export interface VerifyResult {
  passed: boolean
  error?: string
  steps: StepResult[]
}

export const specWidth = (spec: Spec, pin: string) => spec.widths?.[pin] ?? 1

/** Spec for a combinational circuit of 1-bit pins: every input combination against `fn`. */
export function tableSpec(inputs: string[], outputs: string[], fn: (...bits: Bit[]) => Bit[]): Spec {
  const zip = (names: string[], bits: Bit[]) => Object.fromEntries(names.map((name, i) => [name, bits[i]]))
  return {
    inputs,
    outputs,
    combinational: true,
    steps: combinations(inputs.length).map((bits) => ({ set: zip(inputs, bits), expect: zip(outputs, fn(...bits)) })),
  }
}

function pinError(kind: string, actual: Pin[], expected: string[], spec: Spec): string | undefined {
  const missing = expected.find((id) => !actual.some((p) => p.name === id))
  if (missing) return `Falta la ${kind} "${missing}"`
  const extra = actual.find((p) => !expected.includes(p.name))
  if (extra) return `Sobra la ${kind} "${extra.name}"`
  const wrong = actual.find((p) => p.width !== specWidth(spec, p.name))
  if (wrong) return `La ${kind} "${wrong.name}" debe ser de ${specWidth(spec, wrong.name)} bit(s)`
}

/** Builds a harness, or returns the user-facing reason it can't be built. */
export function tryHarness(circuit: Circuit, library: ChipLibrary): Harness | string {
  try {
    return new Harness(circuit, library)
  } catch (error) {
    if (error instanceof CircuitError) return error.message
    throw error
  }
}

export function verify(circuit: Circuit, library: ChipLibrary, spec: Spec): VerifyResult {
  const harness = tryHarness(circuit, library)
  if (typeof harness === 'string') return { passed: false, error: harness, steps: [] }
  const error =
    pinError('entrada', harness.inputs, spec.inputs, spec) ?? pinError('salida', harness.outputs, spec.outputs, spec)
  if (error) return { passed: false, error, steps: [] }

  const steps = spec.steps.map((step): StepResult => {
    for (const [id, value] of Object.entries(step.set)) harness.set(id, value)
    const { status } = harness.sim.settle()
    const actual = Object.fromEntries(spec.outputs.map((id) => [id, harness.read(id)]))
    const ok = status === 'stable' && Object.entries(step.expect).every(([id, value]) => actual[id] === value)
    return { step, actual, status, ok }
  })
  return { passed: steps.every((s) => s.ok), steps }
}

export const MAX_TABLE_BITS = 6

export interface LiveTable {
  inputs: Pin[]
  outputs: Pin[]
  rows: { inputs: number[]; outputs: number[]; status: SettleResult['status'] }[]
}

/**
 * Truth table of the current circuit over its top-level pins. Every row starts
 * from all-zero state so memory circuits don't leak state between rows.
 */
export function liveTable(circuit: Circuit, library: ChipLibrary): LiveTable | string {
  const harness = tryHarness(circuit, library)
  if (typeof harness === 'string') return harness
  const bits = harness.inputs.reduce((n, p) => n + p.width, 0)
  if (bits > MAX_TABLE_BITS) return `La tabla solo se muestra con hasta ${MAX_TABLE_BITS} bits de entrada (hay ${bits})`
  const rows = combinations(bits).map((combo) => {
    harness.sim.values.fill(0)
    let at = 0
    const inputs = harness.inputs.map((pin) => {
      const value = combo.slice(at, (at += pin.width)).reduce<number>((n, b) => n * 2 + b, 0)
      harness.set(pin.name, value)
      return value
    })
    const { status } = harness.sim.settle()
    return { inputs, outputs: harness.outputs.map((p) => harness.read(p.name)), status }
  })
  return { inputs: harness.inputs, outputs: harness.outputs, rows }
}
