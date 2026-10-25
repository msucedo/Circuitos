import { describe, expect, it } from 'vitest'
import { build, nand } from './build.ts'
import { FULL_ADDER, LIBRARY, NOT } from './examples.ts'
import { MAX_DEPTH, checkLibrary, flatten } from './flatten.ts'
import { Simulator, compile, truthTable } from './simulate.ts'
import { toLibrary } from './types.ts'
import type { Circuit } from './types.ts'

const chip = (id: string, circuit: Circuit) => ({ id, name: id, circuit })
const use = (kind: string, inputs: Record<string, string> = {}) => ({ kind, in: inputs })

describe('flatten', () => {
  it('expands nested chips (FULL_ADDER → HALF_ADDER → XOR → NAND) into NAND only', () => {
    const flat = flatten(FULL_ADDER, LIBRARY)
    expect(new Set(flat.nodes.map((n) => n.kind))).toEqual(new Set(['INPUT', 'NAND', 'OUTPUT']))
    expect(flat.nodes.filter((n) => n.kind === 'NAND')).toHaveLength(15)
    expect(truthTable(flat).map((r) => r.outputs.join(''))).toEqual(['00', '10', '10', '01', '10', '01', '01', '11'])
  })

  it('reads an unconnected chip input as 0', () => {
    const circuit = build({ inputs: [], parts: { n: use('NOT') }, outputs: { out: 'n' } })
    expect(truthTable(flatten(circuit, LIBRARY))[0].outputs).toEqual([1])
  })

  it('passes a signal straight through a chip with no gates', () => {
    const library = toLibrary([chip('WIRE', build({ inputs: ['i'], outputs: { o: 'i' } }))])
    const circuit = build({ inputs: ['a'], parts: { w: use('WIRE', { i: 'a' }) }, outputs: { out: 'w.o' } })
    expect(truthTable(flatten(circuit, library)).map((r) => r.outputs[0])).toEqual([0, 1])
  })

  it('rejects a wire loop that has no gate in it', () => {
    const library = toLibrary([chip('WIRE', build({ inputs: ['i'], outputs: { o: 'i' } }))])
    const circuit = build({ inputs: [], parts: { w: use('WIRE', { i: 'w.o' }) }, outputs: { out: 'w.o' } })
    expect(() => flatten(circuit, library)).toThrow(/bucle de cables/)
  })

  it('rejects unknown chips and pins', () => {
    expect(() => flatten(build({ inputs: [], parts: { x: use('NOPE') }, outputs: {} }), LIBRARY)).toThrow(/desconocido/)
    expect(() => flatten(build({ inputs: ['a'], parts: { n: use('NOT', { zz: 'a' }) }, outputs: {} }), LIBRARY)).toThrow(
      /no tiene entrada "zz"/,
    )
  })

  it('rejects chips that contain themselves, directly or through another chip', () => {
    const self = toLibrary([chip('A', build({ inputs: [], parts: { a: use('A') }, outputs: {} }))])
    expect(() => checkLibrary(self)).toThrow(/se contiene a sí mismo/)
    expect(() => flatten(build({ inputs: [], parts: { a: use('A') }, outputs: {} }), self)).toThrow(/sí mismo/)
    const pair = toLibrary([
      chip('A', build({ inputs: [], parts: { b: use('B') }, outputs: {} })),
      chip('B', build({ inputs: [], parts: { a: use('A') }, outputs: {} })),
    ])
    expect(() => checkLibrary(pair)).toThrow(/sí mismo/)
  })

  it(`rejects more than ${MAX_DEPTH} levels of nesting`, () => {
    const chips = [chip('L0', NOT)]
    for (let i = 1; i <= MAX_DEPTH; i++) {
      chips.push(chip(`L${i}`, build({ inputs: ['a'], parts: { c: use(`L${i - 1}`, { a: 'a' }) }, outputs: { out: 'c' } })))
    }
    expect(() => checkLibrary(toLibrary(chips))).toThrow(/anida más de 16/)
    expect(() => checkLibrary(toLibrary(chips.slice(0, MAX_DEPTH)))).not.toThrow()
  })

  it('stops a chip that doubles itself at every level before building it', () => {
    const chips = [chip('D0', build({ inputs: [], parts: { n: nand('n', 'n') }, outputs: {} }))]
    for (let i = 1; i <= 15; i++) {
      chips.push(chip(`D${i}`, build({ inputs: [], parts: { x: use(`D${i - 1}`), y: use(`D${i - 1}`) }, outputs: {} })))
    }
    const huge = build({ inputs: [], parts: { a: use('D15'), b: use('D15'), c: use('D15'), d: use('D15') }, outputs: {} })
    expect(() => flatten(huge, toLibrary(chips))).toThrow(/demasiado grande/)
  })
})

describe('CLOCK', () => {
  it('drives the circuit through setClock', () => {
    const circuit = build({ inputs: [], parts: { c: use('CLOCK'), n: nand('c', 'c') }, outputs: { out: 'n' } })
    const sim = new Simulator(compile(circuit))
    sim.setClock(1)
    sim.settle()
    expect(sim.read('out')).toBe(0)
    sim.setClock(0)
    sim.settle()
    expect(sim.read('out')).toBe(1)
  })
})

describe('probes', () => {
  it('maps every top-level wire source, including chip outputs, to the gate that drives it', () => {
    const library = toLibrary([chip('WIRE', build({ inputs: ['i'], outputs: { o: 'i' } }))])
    const circuit = build({
      inputs: ['a'],
      parts: { n: use('NOT', { a: 'a' }), w: use('WIRE', { i: 'n' }), open: use('WIRE') },
      outputs: { out: 'w.o', dangling: 'open.o' },
    })
    const { probes } = flatten(circuit, new Map([...LIBRARY, ...library]))
    expect(probes.get('a\0out')).toEqual([{ node: 'a', pin: 'out' }])
    expect(probes.get('n\0out')).toEqual([{ node: 'n/n', pin: 'out' }])
    expect(probes.get('w\0o')).toEqual([{ node: 'n/n', pin: 'out' }])
    expect(probes.get('open\0o')).toEqual([undefined])
  })
})
