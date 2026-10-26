import { build, nand } from './build.ts'
import { SELECTOR, WORD, toLibrary } from './types.ts'

/** Level 0: two relays in series give a AND b; a normally closed relay inverts it. */
export const RELAY_NAND = build({
  inputs: ['a', 'b'],
  parts: {
    vcc: { kind: 'VCC', in: {} },
    ra: { kind: 'RELAY', in: { c: 'a', in: 'vcc' } },
    rb: { kind: 'RELAY', in: { c: 'b', in: 'ra' } },
    inv: { kind: 'RELAY_NC', in: { c: 'rb', in: 'vcc' } },
  },
  outputs: { out: 'inv' },
})

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

/** Block 3: from multiplexers to a 4-bit ALU. Buses are WORD bits wide, split into b0 (least significant) upwards. */

const BITS = Array.from({ length: WORD }, (_, i) => i)
const split = (from: string, width = WORD) => ({ kind: 'SPLIT', width, in: { in: from } })
const join = (bit: (i: number) => string) => ({ kind: 'JOIN', width: WORD, in: Object.fromEntries(BITS.map((i) => [`b${i}`, bit(i)])) })
/** One 1-bit chip per bit, named `${prefix}${i}`. */
const perBit = (prefix: string, kind: string, inputs: (i: number) => Record<string, string>) =>
  Object.fromEntries(BITS.map((i) => [`${prefix}${i}`, part(kind, inputs(i))]))

export const MUX = build({
  inputs: ['a', 'b', 'sel'],
  parts: {
    ns: part('NOT', { a: 'sel' }),
    x: part('AND', { a: 'a', b: 'ns' }),
    y: part('AND', { a: 'b', b: 'sel' }),
    o: part('OR', { a: 'x', b: 'y' }),
  },
  outputs: { out: 'o' },
})

export const DMUX = build({
  inputs: ['in', 'sel'],
  parts: { ns: part('NOT', { a: 'sel' }), x: part('AND', { a: 'in', b: 'ns' }), y: part('AND', { a: 'in', b: 'sel' }) },
  outputs: { a: 'x', b: 'y' },
})

export const NOT4 = build({
  inputs: ['in'],
  parts: { s: split('in'), ...perBit('n', 'NOT', (i) => ({ a: `s.b${i}` })), j: join((i) => `n${i}`) },
  outputs: { out: 'j' },
  widths: { in: WORD, out: WORD },
})

export const MUX4 = build({
  inputs: ['a', 'b', 'sel'],
  parts: {
    sa: split('a'),
    sb: split('b'),
    ...perBit('m', 'MUX', (i) => ({ a: `sa.b${i}`, b: `sb.b${i}`, sel: 'sel' })),
    j: join((i) => `m${i}`),
  },
  outputs: { out: 'j' },
  widths: { a: WORD, b: WORD, out: WORD },
})

export const DECODER = build({
  inputs: ['sel'],
  parts: {
    s: split('sel', SELECTOR),
    n0: part('NOT', { a: 's.b0' }),
    n1: part('NOT', { a: 's.b1' }),
    d0: part('AND', { a: 'n1', b: 'n0' }),
    d1: part('AND', { a: 'n1', b: 's.b0' }),
    d2: part('AND', { a: 's.b1', b: 'n0' }),
    d3: part('AND', { a: 's.b1', b: 's.b0' }),
  },
  outputs: { y0: 'd0', y1: 'd1', y2: 'd2', y3: 'd3' },
  widths: { sel: SELECTOR },
})

/** Bit 0 always flips; every other bit is a half adder with the carry from below. */
export const INC4 = build({
  inputs: ['in'],
  parts: {
    s: split('in'),
    o0: part('NOT', { a: 's.b0' }),
    h1: part('HALF_ADDER', { a: 's.b1', b: 's.b0' }),
    h2: part('HALF_ADDER', { a: 's.b2', b: 'h1.carry' }),
    h3: part('HALF_ADDER', { a: 's.b3', b: 'h2.carry' }),
    j: join((i) => (i === 0 ? 'o0' : `h${i}.sum`)),
  },
  outputs: { out: 'j' },
  widths: { in: WORD, out: WORD },
})

/**
 * op: 0 ADD, 1 SUB, 2 AND, 3 OR. Subtraction is a + NOT b + 1, and op's bit 0
 * is both "invert b" and that carry-in 1. op's bit 1 picks arithmetic or logic.
 */
export const ALU4 = build({
  inputs: ['a', 'b', 'op'],
  parts: {
    so: split('op', SELECTOR),
    nb: part('NOT4', { in: 'b' }),
    bb: part('MUX4', { a: 'b', b: 'nb', sel: 'so.b0' }),
    sa: split('a'),
    sb: split('b'),
    sbb: split('bb'),
    add: part('ADDER4', {
      ...Object.fromEntries(BITS.map((i) => [`a${i}`, `sa.b${i}`])),
      ...Object.fromEntries(BITS.map((i) => [`b${i}`, `sbb.b${i}`])),
      cin: 'so.b0',
    }),
    arith: join((i) => `add.s${i}`),
    ...perBit('and', 'AND', (i) => ({ a: `sa.b${i}`, b: `sb.b${i}` })),
    ...perBit('or', 'OR', (i) => ({ a: `sa.b${i}`, b: `sb.b${i}` })),
    ands: join((i) => `and${i}`),
    ors: join((i) => `or${i}`),
    logic: part('MUX4', { a: 'ands', b: 'ors', sel: 'so.b0' }),
    result: part('MUX4', { a: 'arith', b: 'logic', sel: 'so.b1' }),
    sr: split('result'),
    lo: part('OR', { a: 'sr.b0', b: 'sr.b1' }),
    hi: part('OR', { a: 'sr.b2', b: 'sr.b3' }),
    any: part('OR', { a: 'lo', b: 'hi' }),
    none: part('NOT', { a: 'any' }),
  },
  outputs: { out: 'result', zero: 'none' },
  widths: { a: WORD, b: WORD, op: SELECTOR, out: WORD },
})

/** Block 3, memory: everything stored changes only when `clk` rises. */

/** A multiplexer feeds the flip-flop either its own value (keep) or `in` (load). */
export const BIT = build({
  inputs: ['in', 'load', 'clk'],
  parts: { m: part('MUX', { a: 'd.q', b: 'in', sel: 'load' }), d: part('D_FLIPFLOP', { d: 'm', clk: 'clk' }) },
  outputs: { out: 'd.q' },
})

export const REGISTER4 = build({
  inputs: ['in', 'load', 'clk'],
  parts: { s: split('in'), ...perBit('r', 'BIT', (i) => ({ in: `s.b${i}`, load: 'load', clk: 'clk' })), j: join((i) => `r${i}`) },
  outputs: { out: 'j' },
  widths: { in: WORD, out: WORD },
})

/** Next value: 0 on reset, else `in` on load, else the count plus one; the register stores it on every edge. */
export const COUNTER4 = build({
  inputs: ['in', 'load', 'reset', 'clk'],
  parts: {
    one: { kind: 'VCC', in: {} },
    ones: join(() => 'one'),
    zeros: part('NOT4', { in: 'ones' }),
    plus: part('INC4', { in: 'reg' }),
    loaded: part('MUX4', { a: 'plus', b: 'in', sel: 'load' }),
    next: part('MUX4', { a: 'loaded', b: 'zeros', sel: 'reset' }),
    reg: part('REGISTER4', { in: 'next', load: 'one', clk: 'clk' }),
  },
  outputs: { out: 'reg' },
  widths: { in: WORD, out: WORD },
})

/** The decoder picks which register `load` reaches; two levels of multiplexers pick which one is read. */
export const RAM4 = build({
  inputs: ['in', 'addr', 'load', 'clk'],
  parts: {
    dec: part('DECODER', { sel: 'addr' }),
    ...perBit('w', 'AND', (i) => ({ a: `dec.y${i}`, b: 'load' })),
    ...perBit('r', 'REGISTER4', (i) => ({ in: 'in', load: `w${i}`, clk: 'clk' })),
    sa: split('addr', SELECTOR),
    lo: part('MUX4', { a: 'r0', b: 'r1', sel: 'sa.b0' }),
    hi: part('MUX4', { a: 'r2', b: 'r3', sel: 'sa.b0' }),
    o: part('MUX4', { a: 'lo', b: 'hi', sel: 'sa.b1' }),
  },
  outputs: { out: 'o' },
  widths: { in: WORD, addr: SELECTOR, out: WORD },
})

export const LIBRARY = toLibrary(
  Object.entries({
    NOT,
    AND,
    OR,
    XOR,
    HALF_ADDER,
    FULL_ADDER,
    ADDER4,
    D_LATCH,
    D_FLIPFLOP,
    MUX,
    NOT4,
    MUX4,
    DECODER,
    INC4,
    BIT,
    REGISTER4,
  }).map(([id, circuit]) => ({
    id,
    name: id,
    circuit,
  })),
)
