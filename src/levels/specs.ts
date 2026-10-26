import { tableSpec, vectorSpec } from '../sim/verify.ts'
import type { Spec } from '../sim/verify.ts'
import type { Bit } from '../sim/types.ts'

const bit = (value: boolean | number): Bit => (value ? 1 : 0)
const toNumber = (bits: Bit[]) => bits.reduce<number>((n, b) => n * 2 + b, 0)

/** Width of the buses in the 4-bit levels. */
export const WORD = 4
const WORD_MASK = 2 ** WORD - 1
const SEL2 = 2
const ALL_WORDS = Array.from({ length: 2 ** WORD }, (_, n) => n)

/** What the ALU's 2-bit `op` input selects. */
export const ALU_OP = { ADD: 0, SUB: 1, AND: 2, OR: 3 } as const
const ALU = {
  [ALU_OP.ADD]: (a: number, b: number) => (a + b) & WORD_MASK,
  [ALU_OP.SUB]: (a: number, b: number) => (a - b) & WORD_MASK,
  [ALU_OP.AND]: (a: number, b: number) => a & b,
  [ALU_OP.OR]: (a: number, b: number) => a | b,
}

/**
 * Pairs of words chosen to catch the usual wiring mistakes when checking every
 * combination would be too many: all 0s and all 1s (a missing wire), alternating
 * bits (crossed neighbours), single bits (a bit in the wrong place), and their
 * swaps. Like the hand-picked test files of nand2tetris.
 */
const WORD_PAIRS: [number, number][] = [
  [0, 0],
  [0, 15],
  [15, 0],
  [5, 10],
  [10, 5],
  [1, 8],
  [8, 1],
  [2, 4],
  [4, 2],
  [9, 6],
  [7, 9],
  [5, 5],
  [15, 1],
  [12, 3],
]

/** What each level checks, by the id of the chip it unlocks. */
export const SPECS = new Map<string, Spec>([
  ['RELAY_NAND', tableSpec(['a', 'b'], ['out'], (a, b) => [bit(!(a && b))])],
  ['NOT', tableSpec(['a'], ['out'], (a) => [bit(!a)])],
  ['AND', tableSpec(['a', 'b'], ['out'], (a, b) => [bit(a && b)])],
  ['OR', tableSpec(['a', 'b'], ['out'], (a, b) => [bit(a || b)])],
  ['XOR', tableSpec(['a', 'b'], ['out'], (a, b) => [bit(a !== b)])],
  ['HALF_ADDER', tableSpec(['a', 'b'], ['sum', 'carry'], (a, b) => [bit(a ^ b), bit(a & b)])],
  ['FULL_ADDER', tableSpec(['a', 'b', 'cin'], ['sum', 'cout'], (a, b, c) => [bit(a ^ b ^ c), bit(a + b + c >= 2)])],
  [
    'ADDER4',
    tableSpec(['a3', 'a2', 'a1', 'a0', 'b3', 'b2', 'b1', 'b0', 'cin'], ['s3', 's2', 's1', 's0', 'cout'], (...bits) => {
      const total = toNumber(bits.slice(0, 4)) + toNumber(bits.slice(4, 8)) + bits[8]
      return [bit(total & 8), bit(total & 4), bit(total & 2), bit(total & 1), bit(total & 16)]
    }),
  ],
  [
    'SR_LATCH',
    {
      inputs: ['s', 'r'],
      outputs: ['Q', 'QB'],
      steps: [
        { set: { s: 0, r: 1 }, expect: { Q: 1, QB: 0 } },
        { set: { s: 1, r: 1 }, expect: { Q: 1, QB: 0 } },
        { set: { s: 1, r: 0 }, expect: { Q: 0, QB: 1 } },
        { set: { s: 1, r: 1 }, expect: { Q: 0, QB: 1 } },
      ],
    },
  ],
  [
    'D_LATCH',
    {
      inputs: ['d', 'en'],
      outputs: ['q'],
      steps: [
        { set: { d: 1, en: 1 }, expect: { q: 1 } },
        { set: { en: 0 }, expect: { q: 1 } },
        { set: { d: 0 }, expect: { q: 1 } },
        { set: { en: 1 }, expect: { q: 0 } },
        { set: { d: 1 }, expect: { q: 1 } },
        { set: { d: 0 }, expect: { q: 0 } },
        { set: { en: 0 }, expect: { q: 0 } },
        { set: { d: 1 }, expect: { q: 0 } },
      ],
    },
  ],
  [
    'D_FLIPFLOP',
    {
      inputs: ['d', 'clk'],
      outputs: ['q'],
      steps: [
        { set: { d: 1, clk: 0 }, expect: {} },
        { set: { clk: 1 }, expect: { q: 1 } },
        { set: { d: 0 }, expect: { q: 1 } },
        { set: { clk: 0 }, expect: { q: 1 } },
        { set: { clk: 1 }, expect: { q: 0 } },
        { set: { d: 1 }, expect: { q: 0 } },
        { set: { clk: 0 }, expect: { q: 0 } },
        { set: { d: 0 }, expect: { q: 0 } },
        { set: { d: 1 }, expect: { q: 0 } },
        { set: { clk: 1 }, expect: { q: 1 } },
      ],
    },
  ],
  ['MUX', tableSpec(['a', 'b', 'sel'], ['out'], (a, b, sel) => [sel ? b : a])],
  ['DMUX', tableSpec(['in', 'sel'], ['a', 'b'], (x, sel) => [bit(x && !sel), bit(x && sel)])],
  [
    'NOT4',
    vectorSpec({
      inputs: ['in'],
      outputs: ['out'],
      widths: { in: WORD, out: WORD },
      cases: ALL_WORDS.map((n) => ({ in: n })),
      fn: (set) => ({ out: ~set.in & WORD_MASK }),
    }),
  ],
  [
    'MUX4',
    vectorSpec({
      inputs: ['a', 'b', 'sel'],
      outputs: ['out'],
      widths: { a: WORD, b: WORD, out: WORD },
      cases: WORD_PAIRS.flatMap(([a, b]) => [0, 1].map((sel) => ({ a, b, sel }))),
      fn: (set) => ({ out: set.sel ? set.b : set.a }),
    }),
  ],
  [
    'DECODER',
    vectorSpec({
      inputs: ['sel'],
      outputs: ['y0', 'y1', 'y2', 'y3'],
      widths: { sel: SEL2 },
      cases: [0, 1, 2, 3].map((sel) => ({ sel })),
      fn: (set) => ({ y0: bit(set.sel === 0), y1: bit(set.sel === 1), y2: bit(set.sel === 2), y3: bit(set.sel === 3) }),
    }),
  ],
  [
    'INC4',
    vectorSpec({
      inputs: ['in'],
      outputs: ['out'],
      widths: { in: WORD, out: WORD },
      cases: ALL_WORDS.map((n) => ({ in: n })),
      fn: (set) => ({ out: (set.in + 1) & WORD_MASK }),
    }),
  ],
  [
    'ALU4',
    vectorSpec({
      inputs: ['a', 'b', 'op'],
      outputs: ['out', 'zero'],
      widths: { a: WORD, b: WORD, op: SEL2, out: WORD },
      cases: WORD_PAIRS.flatMap(([a, b]) => Object.values(ALU_OP).map((op) => ({ a, b, op }))),
      fn: ({ a, b, op }) => {
        const out = ALU[op as keyof typeof ALU](a, b)
        return { out, zero: bit(out === 0) }
      },
    }),
  ],
])
