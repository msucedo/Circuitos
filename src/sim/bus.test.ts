import { describe, expect, it } from 'vitest'
import { LIBRARY } from './examples.ts'
import { Harness } from './harness.ts'
import { Simulator, compile } from './simulate.ts'
import { build, nand } from './build.ts'
import { toLibrary } from './types.ts'
import type { Circuit } from './types.ts'
import { liveTable, verify } from './verify.ts'

/** a + b on 4-bit buses: split both, four full adders, join the sum. */
const BUS_ADDER: Circuit = {
  nodes: [
    { id: 'a', kind: 'INPUT', width: 4 },
    { id: 'b', kind: 'INPUT', width: 4 },
    { id: 'sa', kind: 'SPLIT', width: 4 },
    { id: 'sb', kind: 'SPLIT', width: 4 },
    ...[0, 1, 2, 3].map((i) => ({ id: `f${i}`, kind: 'FULL_ADDER' })),
    { id: 'j', kind: 'JOIN', width: 4 },
    { id: 'sum', kind: 'OUTPUT', width: 4 },
    { id: 'cout', kind: 'OUTPUT' },
  ],
  wires: [
    { from: { node: 'a', pin: 'out' }, to: { node: 'sa', pin: 'in' } },
    { from: { node: 'b', pin: 'out' }, to: { node: 'sb', pin: 'in' } },
    ...[0, 1, 2, 3].flatMap((i) => [
      { from: { node: 'sa', pin: `b${i}` }, to: { node: `f${i}`, pin: 'a' } },
      { from: { node: 'sb', pin: `b${i}` }, to: { node: `f${i}`, pin: 'b' } },
      { from: { node: `f${i}`, pin: 'sum' }, to: { node: 'j', pin: `b${i}` } },
      ...(i > 0 ? [{ from: { node: `f${i - 1}`, pin: 'cout' }, to: { node: `f${i}`, pin: 'cin' } }] : []),
    ]),
    { from: { node: 'j', pin: 'out' }, to: { node: 'sum', pin: 'in' } },
    { from: { node: 'f3', pin: 'cout' }, to: { node: 'cout', pin: 'in' } },
  ],
}

describe('buses', () => {
  it('adds two 4-bit numbers through SPLIT and JOIN', () => {
    const h = new Harness(BUS_ADDER, LIBRARY)
    for (const [a, b] of [[0, 0], [7, 5], [9, 9], [15, 15]]) {
      h.set('a', a)
      h.set('b', b)
      h.sim.settle()
      expect([h.read('sum'), h.read('cout')]).toEqual([(a + b) & 15, (a + b) >> 4])
    }
    expect(h.probe('j', 'out')).toBe(14)
    expect(h.probe('sa', 'b0')).toBe(1)
  })

  it('verifies bus pins against numeric specs, including their widths', () => {
    const steps = [{ set: { a: 3, b: 4 }, expect: { sum: 7, cout: 0 } }, { set: { a: 8, b: 8 }, expect: { sum: 0, cout: 1 } }]
    const spec = { inputs: ['a', 'b'], outputs: ['sum', 'cout'], widths: { a: 4, b: 4, sum: 4 }, steps }
    expect(verify(BUS_ADDER, LIBRARY, spec).passed).toBe(true)
    expect(verify(BUS_ADDER, LIBRARY, { ...spec, widths: { a: 8, b: 4, sum: 4 } }).error).toBe('La entrada "a" debe ser de 8 bit(s)')
  })

  it('works across chip boundaries: a chip with bus pins', () => {
    const library = new Map([...LIBRARY, ...toLibrary([{ id: 'ADD4', name: 'ADD4', circuit: BUS_ADDER }])])
    const outer: Circuit = {
      nodes: [
        { id: 'x', kind: 'INPUT', width: 4 },
        { id: 'add', kind: 'ADD4' },
        { id: 'y', kind: 'OUTPUT', width: 4 },
      ],
      wires: [
        { from: { node: 'x', pin: 'out' }, to: { node: 'add', pin: 'a' } },
        { from: { node: 'x', pin: 'out' }, to: { node: 'add', pin: 'b' } },
        { from: { node: 'add', pin: 'sum' }, to: { node: 'y', pin: 'in' } },
      ],
    }
    const h = new Harness(outer, library)
    h.set('x', 6)
    h.sim.settle()
    expect(h.read('y')).toBe(12)
  })

  it('rejects wires between pins of different widths and too-narrow splitters', () => {
    const narrow = { ...BUS_ADDER, nodes: BUS_ADDER.nodes.map((n) => (n.id === 'a' ? { ...n, width: 8 } : n)) }
    expect(() => new Harness(narrow, LIBRARY)).toThrow(/Un cable de 8 bit\(s\) no entra en "in" de "sa", que es de 4/)
    const tiny = { nodes: [{ id: 's', kind: 'SPLIT', width: 1 }], wires: [] }
    expect(() => new Harness(tiny, LIBRARY)).toThrow(/al menos 2 bits/)
  })
})

describe('live table', () => {
  it('lists every input combination with bus values as numbers', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'a', kind: 'INPUT', width: 2 },
        { id: 's', kind: 'SPLIT', width: 2 },
        { id: 'n', kind: 'NAND' },
        { id: 'out', kind: 'OUTPUT' },
      ],
      wires: [
        { from: { node: 'a', pin: 'out' }, to: { node: 's', pin: 'in' } },
        { from: { node: 's', pin: 'b0' }, to: { node: 'n', pin: 'a' } },
        { from: { node: 's', pin: 'b1' }, to: { node: 'n', pin: 'b' } },
        { from: { node: 'n', pin: 'out' }, to: { node: 'out', pin: 'in' } },
      ],
    }
    const table = liveTable(circuit, LIBRARY)
    if (typeof table === 'string') throw new Error(table)
    expect(table.rows.map((r) => [r.inputs[0], r.outputs[0]])).toEqual([[0, 1], [1, 1], [2, 1], [3, 0]])
  })

  it('refuses tables with too many input bits', () => {
    expect(liveTable({ nodes: [{ id: 'a', kind: 'INPUT', width: 8 }], wires: [] }, LIBRARY)).toMatch(/hasta 6 bits/)
  })
})

describe('unit-delay step', () => {
  it('moves a signal one gate per step', () => {
    const chain = build({ inputs: ['a'], parts: { n1: nand('a', 'a'), n2: nand('n1', 'n1'), n3: nand('n2', 'n2') }, outputs: { out: 'n3' } })
    const sim = new Simulator(compile(chain))
    sim.settle()
    sim.setInput('a', 1)
    const trace = []
    while (sim.step()) trace.push([sim.read('n1'), sim.read('n2'), sim.read('n3')].join(''))
    expect(trace).toEqual(['001', '011', '010'])
  })
})
