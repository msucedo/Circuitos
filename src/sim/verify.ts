import { Harness } from './harness.ts'
import { combinations } from './simulate.ts'
import type { SettleResult } from './simulate.ts'
import { CircuitError, problem } from './types.ts'
import type { Bit, ChipLibrary, Circuit, Pin, Problem } from './types.ts'

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
  /** No memory involved: every step stands on its own, so a truth table can show the expected values. */
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
  error?: Problem
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

const PIN_PROBLEMS = {
  inputs: { missing: 'missingInput', extra: 'extraInput', width: 'inputWidth' },
  outputs: { missing: 'missingOutput', extra: 'extraOutput', width: 'outputWidth' },
} as const

function pinError(side: keyof typeof PIN_PROBLEMS, actual: Pin[], expected: string[], spec: Spec): Problem | undefined {
  const codes = PIN_PROBLEMS[side]
  const missing = expected.find((id) => !actual.some((p) => p.name === id))
  if (missing) return problem(codes.missing, { name: missing })
  const extra = actual.find((p) => !expected.includes(p.name))
  if (extra) return problem(codes.extra, { name: extra.name })
  const wrong = actual.find((p) => p.width !== specWidth(spec, p.name))
  if (wrong) return problem(codes.width, { name: wrong.name, count: specWidth(spec, wrong.name) })
}

/** Builds a harness, or returns the reason it can't be built. */
export function tryHarness(circuit: Circuit, library: ChipLibrary): Harness | CircuitError {
  try {
    return new Harness(circuit, library)
  } catch (error) {
    if (error instanceof CircuitError) return error
    throw error
  }
}

/**
 * Spec for a combinational circuit checked on chosen cases (bus values as numbers),
 * for when every combination would be too many. `fn` computes what each case expects.
 */
export function vectorSpec(def: {
  inputs: string[]
  outputs: string[]
  widths?: Record<string, number>
  cases: Record<string, number>[]
  fn: (set: Record<string, number>) => Record<string, number>
}): Spec {
  const { inputs, outputs, widths, cases, fn } = def
  return { inputs, outputs, widths, combinational: true, steps: cases.map((set) => ({ set, expect: fn(set) })) }
}

export function verify(circuit: Circuit, library: ChipLibrary, spec: Spec): VerifyResult {
  const harness = tryHarness(circuit, library)
  if (harness instanceof CircuitError) return { passed: false, error: harness, steps: [] }
  const error =
    pinError('inputs', harness.inputs, spec.inputs, spec) ?? pinError('outputs', harness.outputs, spec.outputs, spec)
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
/** A level's own cases are shown instead of every combination when there are at most this many. */
export const MAX_TABLE_ROWS = 64

export interface LiveTable {
  inputs: Pin[]
  outputs: Pin[]
  rows: { inputs: number[]; outputs: number[]; status: SettleResult['status'] }[]
}

/**
 * Truth table of the current circuit over its top-level pins. With a combinational
 * spec of few cases, the rows are those cases (what Probar checks); otherwise every
 * combination, up to MAX_TABLE_BITS input bits. Every row starts from all-zero
 * state so memory circuits don't leak state between rows.
 */
export function liveTable(circuit: Circuit, library: ChipLibrary, spec?: Spec): LiveTable | Problem {
  const harness = tryHarness(circuit, library)
  if (harness instanceof CircuitError) return harness
  const bits = harness.inputs.reduce((n, p) => n + p.width, 0)
  const row = (values: number[]) => {
    harness.sim.values.fill(0)
    harness.inputs.forEach((pin, i) => harness.set(pin.name, values[i]))
    const { status } = harness.sim.settle()
    return { inputs: values, outputs: harness.outputs.map((p) => harness.read(p.name)), status }
  }
  if (spec?.combinational && spec.steps.length <= MAX_TABLE_ROWS) {
    const rows = spec.steps.map((step) => row(harness.inputs.map((pin) => step.set[pin.name] ?? 0)))
    return { inputs: harness.inputs, outputs: harness.outputs, rows }
  }
  if (bits > MAX_TABLE_BITS) return problem('tableTooWide', { max: MAX_TABLE_BITS, count: bits })
  const rows = combinations(bits).map((combo) => {
    let at = 0
    return row(harness.inputs.map((pin) => combo.slice(at, (at += pin.width)).reduce<number>((n, b) => n * 2 + b, 0)))
  })
  return { inputs: harness.inputs, outputs: harness.outputs, rows }
}
