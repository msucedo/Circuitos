import { build, nand } from './build.ts'
import { toLibrary } from './types.ts'

/** Reference circuits made only of NAND gates. */

export const NOT = build({
  inputs: ['a'],
  parts: { n: nand('a', 'a') },
  outputs: { out: 'n' },
})

export const AND = build({
  inputs: ['a', 'b'],
  parts: { n: nand('a', 'b'), inv: nand('n', 'n') },
  outputs: { out: 'inv' },
})

export const OR = build({
  inputs: ['a', 'b'],
  parts: { na: nand('a', 'a'), nb: nand('b', 'b'), n: nand('na', 'nb') },
  outputs: { out: 'n' },
})

export const XOR = build({
  inputs: ['a', 'b'],
  parts: { n: nand('a', 'b'), x: nand('a', 'n'), y: nand('b', 'n'), z: nand('x', 'y') },
  outputs: { out: 'z' },
})

/** Active-low inputs: `s=0` sets q=1, `r=0` resets q=0, both 1 holds. */
export const SR_LATCH = build({
  inputs: ['s', 'r'],
  parts: { q: nand('s', 'qb'), qb: nand('r', 'q') },
  outputs: { Q: 'q', QB: 'qb' },
})

/** Built from the chips above: each one only uses chips defined before it. */

const part = (kind: string, inputs: Record<string, string>) => ({ kind, in: inputs })

export const HALF_ADDER = build({
  inputs: ['a', 'b'],
  parts: { x: part('XOR', { a: 'a', b: 'b' }), c: part('AND', { a: 'a', b: 'b' }) },
  outputs: { sum: 'x', carry: 'c' },
})

export const FULL_ADDER = build({
  inputs: ['a', 'b', 'cin'],
  parts: {
    h1: part('HALF_ADDER', { a: 'a', b: 'b' }),
    h2: part('HALF_ADDER', { a: 'h1.sum', b: 'cin' }),
    o: part('OR', { a: 'h1.carry', b: 'h2.carry' }),
  },
  outputs: { sum: 'h2.sum', cout: 'o' },
})

/** Inputs and outputs most significant bit first: a3 a2 a1 a0 b3 b2 b1 b0 cin → s3 s2 s1 s0 cout. */
export const ADDER4 = build({
  inputs: ['a3', 'a2', 'a1', 'a0', 'b3', 'b2', 'b1', 'b0', 'cin'],
  parts: {
    f0: part('FULL_ADDER', { a: 'a0', b: 'b0', cin: 'cin' }),
    f1: part('FULL_ADDER', { a: 'a1', b: 'b1', cin: 'f0.cout' }),
    f2: part('FULL_ADDER', { a: 'a2', b: 'b2', cin: 'f1.cout' }),
    f3: part('FULL_ADDER', { a: 'a3', b: 'b3', cin: 'f2.cout' }),
  },
  outputs: { s3: 'f3.sum', s2: 'f2.sum', s1: 'f1.sum', s0: 'f0.sum', cout: 'f3.cout' },
})

/** While `en` is 1, q follows d; when `en` drops, q keeps its value. */
export const D_LATCH = build({
  inputs: ['d', 'en'],
  parts: {
    nd: nand('d', 'd'),
    s: nand('d', 'en'),
    r: nand('nd', 'en'),
    lq: nand('s', 'lqb'),
    lqb: nand('r', 'lq'),
  },
  outputs: { q: 'lq' },
})

/** Master-slave: q takes the value of d when clk goes from 0 to 1. */
export const D_FLIPFLOP = build({
  inputs: ['d', 'clk'],
  parts: {
    nclk: part('NOT', { a: 'clk' }),
    master: part('D_LATCH', { d: 'd', en: 'nclk' }),
    slave: part('D_LATCH', { d: 'master.q', en: 'clk' }),
  },
  outputs: { q: 'slave.q' },
})

export const LIBRARY = toLibrary(
  Object.entries({ NOT, AND, OR, XOR, HALF_ADDER, FULL_ADDER, D_LATCH }).map(([id, circuit]) => ({ id, name: id, circuit })),
)
