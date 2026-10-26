import { describe, expect, it } from 'vitest'
import { build, nand } from './build.ts'
import { AND, NOT, OR, SR_LATCH, XOR } from './examples.ts'
import { Simulator, compile, truthTable } from './simulate.ts'
import { CircuitError } from './types.ts'
import type { Bit, Circuit } from './types.ts'

const outputsOf = (circuit: Circuit) => truthTable(circuit).map((row) => row.outputs.join(''))

describe('gates built from NAND', () => {
  it('NOT', () => expect(outputsOf(NOT)).toEqual(['1', '0']))
  it('AND', () => expect(outputsOf(AND)).toEqual(['0', '0', '0', '1']))
  it('OR', () => expect(outputsOf(OR)).toEqual(['0', '1', '1', '1']))
  it('XOR', () => expect(outputsOf(XOR)).toEqual(['0', '1', '1', '0']))

  it('combinational circuits settle in a single pass of changes', () => {
    const sim = new Simulator(compile(XOR))
    sim.setInput('a', 1)
    expect(sim.settle().passes).toBeLessThanOrEqual(2)
  })
})

describe('SR latch', () => {
  const step = (sim: Simulator, s: Bit, r: Bit) => {
    sim.setInput('s', s)
    sim.setInput('r', r)
    expect(sim.settle().status).toBe('stable')
    return [sim.read('Q'), sim.read('QB')]
  }

  it('sets, holds, resets and holds', () => {
    const sim = new Simulator(compile(SR_LATCH))
    expect(step(sim, 0, 1)).toEqual([1, 0])
    expect(step(sim, 1, 1)).toEqual([1, 0])
    expect(step(sim, 1, 0)).toEqual([0, 1])
    expect(step(sim, 1, 1)).toEqual([0, 1])
  })

  it('starts in a stable, valid state when both inputs hold', () => {
    const [q, qb] = step(new Simulator(compile(SR_LATCH)), 1, 1)
    expect(q).not.toBe(qb)
  })
})

describe('oscillation', () => {
  it('detects a ring of three inverters', () => {
    const ring = build({
      inputs: [],
      parts: { a: nand('c', 'c'), b: nand('a', 'a'), c: nand('b', 'b') },
      outputs: { out: 'c' },
    })
    expect(new Simulator(compile(ring)).settle()).toEqual({ status: 'oscillating', passes: 1000 })
  })

  it('detects a gate fed by itself', () => {
    const loop = build({ inputs: [], parts: { n: nand('n', 'n') }, outputs: { out: 'n' } })
    expect(new Simulator(compile(loop)).settle(50).status).toBe('oscillating')
  })
})

describe('compile errors', () => {
  const bad = (circuit: Circuit, message: RegExp) => expect(() => compile(circuit)).toThrow(message)

  it('unconnected inputs read as 0', () => {
    const open = build({ inputs: [], parts: {}, outputs: {} })
    open.nodes.push({ id: 'n', kind: 'NAND' }, { id: 'o', kind: 'OUTPUT' })
    open.wires.push({ from: { node: 'n', pin: 'out' }, to: { node: 'o', pin: 'in' } })
    expect(outputsOf(open)).toEqual(['1'])
  })

  it('rejects unknown kinds, duplicate ids, bad pins and doubly driven inputs', () => {
    bad({ nodes: [{ id: 'x', kind: 'XOR' }], wires: [] }, /unknownKind/)
    bad({ nodes: [{ id: 'x', kind: 'NAND' }, { id: 'x', kind: 'NAND' }], wires: [] }, /duplicateId/)
    bad(build({ inputs: ['a'], outputs: { o: 'a.q' } }), /noOutputPin/)
    bad(build({ inputs: ['a'], parts: { n: { kind: 'NAND', in: { c: 'a' } } }, outputs: {} }), /noInputPin/)
    bad(build({ inputs: [], outputs: { o: 'ghost' } }), /missingWireNode/)
    const twice = build({ inputs: ['a', 'b'], outputs: { o: 'a' } })
    twice.wires.push({ from: { node: 'b', pin: 'out' }, to: { node: 'o', pin: 'in' } })
    bad(twice, /twoWires/)
    expect(() => new Simulator(compile(NOT)).setInput('zz', 1)).toThrow(CircuitError)
  })
})
