import { describe, expect, it } from 'vitest'
import { build } from './build.ts'
import { parseProject } from './schema.ts'
import { verify, tableSpec } from './verify.ts'
import { CircuitError } from './types.ts'

const bit = (value: boolean | number) => (value ? 1 : 0)
const wrap = (kind: string, inputs: string[]) =>
  build({ inputs, parts: { p: { kind, in: Object.fromEntries(inputs.map((i) => [i, i])) } }, outputs: { out: 'p' } })

describe('builtins', () => {
  it('VCC is always 1', () => {
    expect(verify(wrap('VCC', []), new Map(), { inputs: [], outputs: ['out'], steps: [{ set: {}, expect: { out: 1 } }] }).passed).toBe(true)
  })

  it('RELAY passes in while the coil is on', () => {
    const spec = tableSpec(['c', 'in'], ['out'], (c, i) => [bit(c && i)])
    expect(verify(wrap('RELAY', ['c', 'in']), new Map(), spec).passed).toBe(true)
  })

  it('RELAY_NC passes in while the coil is off', () => {
    const spec = tableSpec(['c', 'in'], ['out'], (c, i) => [bit(!c && i)])
    expect(verify(wrap('RELAY_NC', ['c', 'in']), new Map(), spec).passed).toBe(true)
  })

  it('files may use builtins but no chip can take a builtin id', () => {
    const circuit = wrap('RELAY', ['c', 'in'])
    expect(parseProject(JSON.stringify({ version: 1, circuit, chips: [] })).circuit.nodes[2].kind).toBe('RELAY')
    const evil = { version: 1, circuit, chips: [{ id: 'RELAY', name: 'x', circuit: wrap('VCC', []) }] }
    expect(() => parseProject(JSON.stringify(evil))).toThrow(CircuitError)
  })
})
