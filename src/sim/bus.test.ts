import { describe, expect, it } from 'vitest'
import { LIBRARY } from './examples.ts'
import { Harness } from './harness.ts'
import { Simulator, compile } from './simulate.ts'
import { build, nand } from './build.ts'
import { toLibrary } from './types.ts'
import type { Circuit } from './types.ts'
import { MAX_TABLE_ROWS, liveTable, vectorSpec, verify } from './verify.ts'

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
    expect(verify(BUS_ADDER, LIBRARY, { ...spec, widths: { a: 8, b: 4, sum: 4 } }).error).toEqual({ code: 'inputWidth', params: { name: 'a', count: 8 } })
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
    expect(() => new Harness(narrow, LIBRARY)).toThrow(/widthMismatch \{"count":8,"pin":"in","node":"sa","width":4\}/)
    const tiny = { nodes: [{ id: 's', kind: 'SPLIT', width: 1 }], wires: [] }
    expect(() => new Harness(tiny, LIBRARY)).toThrow(/busTooNarrow/)
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
    if ('code' in table) throw new Error(table.code)
    expect(table.rows.map((r) => [r.inputs[0], r.outputs[0]])).toEqual([[0, 1], [1, 1], [2, 1], [3, 0]])
  })

  it('refuses tables with too many input bits', () => {
    expect(liveTable({ nodes: [{ id: 'a', kind: 'INPUT', width: 8 }], wires: [] }, LIBRARY)).toEqual({ code: 'tableTooWide', params: { max: 6, count: 8 } })
  })

  it("with a combinational spec, lists the spec's cases even past 6 input bits", () => {
    const wide = build({ inputs: ['a'], outputs: { out: 'a' }, widths: { a: 8, out: 8 } })
    const spec = vectorSpec({
      inputs: ['a'],
      outputs: ['out'],
      widths: { a: 8, out: 8 },
      cases: [{ a: 200 }, { a: 7 }],
      fn: ({ a }) => ({ out: a }),
    })
    const table = liveTable(wide, LIBRARY, spec)
    if ('code' in table) throw new Error(table.code)
    expect(table.rows.map((r) => [r.inputs[0], r.outputs[0]])).toEqual([[200, 200], [7, 7]])
  })

  it("uses the spec's cases only when the circuit's inputs are exactly the spec's", () => {
    const spec = vectorSpec({ inputs: ['a'], outputs: ['out'], widths: { a: 4, out: 4 }, cases: [{ a: 9 }], fn: ({ a }) => ({ out: a }) })
    // A 1-bit `a` (an old draft, an import) would only get bit 0 of 9: show its own combinations instead.
    const narrow = liveTable(build({ inputs: ['a'], outputs: { out: 'a' } }), LIBRARY, spec)
    if ('code' in narrow) throw new Error(narrow.code)
    expect(narrow.rows.map((r) => r.inputs)).toEqual([[0], [1]])
    // An extra input keeps every combination too.
    const extra = liveTable(build({ inputs: ['a', 'x'], outputs: { out: 'a' }, widths: { a: 4, out: 4 } }), LIBRARY, spec)
    if ('code' in extra) throw new Error(extra.code)
    expect(extra.rows).toHaveLength(32)
  })

  it('attaches what each row expects, in output order', () => {
    const spec = vectorSpec({ inputs: ['a'], outputs: ['out'], widths: { a: 8, out: 8 }, cases: [{ a: 3 }], fn: () => ({ out: 5 }) })
    const table = liveTable(build({ inputs: ['a'], outputs: { out: 'a' }, widths: { a: 8, out: 8 } }), LIBRARY, spec)
    if ('code' in table) throw new Error(table.code)
    expect(table.rows).toEqual([{ inputs: [3], outputs: [3], expected: [5], status: 'stable' }])
  })

  it('keeps the size limit when a spec has too many cases to show', () => {
    const many = vectorSpec({ inputs: ['a'], outputs: [], widths: { a: 8 }, cases: Array.from({ length: MAX_TABLE_ROWS + 1 }, (_, a) => ({ a })), fn: () => ({}) })
    const wide = build({ inputs: ['a'], outputs: {}, widths: { a: 8 } })
    expect(liveTable(wide, LIBRARY, many)).toEqual({ code: 'tableTooWide', params: { max: 6, count: 8 } })
  })
})

describe('build with buses', () => {
  it('gives pins and pieces their widths', () => {
    const circuit = build({
      inputs: ['a'],
      parts: { s: { kind: 'SPLIT', width: 4, in: { in: 'a' } }, j: { kind: 'JOIN', width: 4, in: { b0: 's.b3', b1: 's.b2', b2: 's.b1', b3: 's.b0' } } },
      outputs: { out: 'j' },
      widths: { a: 4, out: 4 },
    })
    expect(circuit.nodes.map((n) => [n.id, n.width ?? 1])).toEqual([['a', 4], ['s', 4], ['j', 4], ['out', 4]])
    const h = new Harness(circuit, LIBRARY)
    h.set('a', 0b0001)
    h.sim.settle()
    expect(h.read('out')).toBe(0b1000)
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
