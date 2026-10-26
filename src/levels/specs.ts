import { sequentialSpec, tableSpec, vectorSpec } from '../sim/verify.ts'
import type { Spec } from '../sim/verify.ts'
import { SELECTOR, WORD } from '../sim/types.ts'
import type { Bit } from '../sim/types.ts'

const bit = (value: boolean | number): Bit => (value ? 1 : 0)
const toNumber = (bits: Bit[]) => bits.reduce<number>((n, b) => n * 2 + b, 0)

const WORD_MASK = 2 ** WORD - 1
const ALL_WORDS = Array.from({ length: 2 ** WORD }, (_, n) => n)

/** What the ALU's 2-bit `op` input selects. */
export const ALU_OP = { ADD: 0, SUB: 1, AND: 2, OR: 3 } as const
const ALU: Record<number, (a: number, b: number) => number> = {
  [ALU_OP.ADD]: (a, b) => (a + b) & WORD_MASK,
  [ALU_OP.SUB]: (a, b) => (a - b) & WORD_MASK,
  [ALU_OP.AND]: (a, b) => a & b,
  [ALU_OP.OR]: (a, b) => a | b,
}

function alu(a: number, b: number, op: number): number {
  const operation = ALU[op]
  if (!operation) throw new Error(`ALU4 spec: no operation ${op}`)
  return operation(a, b)
}

/** Words of the 4-word RAM, addressed by a 2-bit `addr`. */
const RAM_WORDS = 4
type Memory = (number | undefined)[]

/** What a register shows: nothing is known until something is stored. */
const shown = (pin: string, value: number | undefined) => (value === undefined ? {} : { [pin]: value })

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
      widths: { sel: SELECTOR },
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
      widths: { a: WORD, b: WORD, op: SELECTOR, out: WORD },
      cases: WORD_PAIRS.flatMap(([a, b]) => Object.values(ALU_OP).map((op) => ({ a, b, op }))),
      fn: ({ a, b, op }) => {
        const out = alu(a, b, op)
        return { out, zero: bit(out === 0) }
      },
    }),
  ],
  [
    'BIT',
    sequentialSpec<number | undefined>({
      inputs: ['in', 'load', 'clk'],
      outputs: ['out'],
      cycles: [
        { in: 1, load: 1 },
        { in: 0, load: 0 },
        { in: 0, load: 1 },
        { in: 1, load: 0 },
        { in: 1, load: 1 },
        { in: 0, load: 0 },
        { in: 0, load: 1 },
      ],
      initial: undefined,
      next: (state, set) => (set.load ? set.in : state),
      read: (state) => shown('out', state),
    }),
  ],
  [
    'REGISTER4',
    sequentialSpec<number | undefined>({
      inputs: ['in', 'load', 'clk'],
      outputs: ['out'],
      widths: { in: WORD, out: WORD },
      cycles: [
        { in: 5, load: 1 },
        { in: 10, load: 0 },
        { in: 10, load: 1 },
        { in: 1, load: 1 },
        { in: 8, load: 0 },
        { in: 15, load: 1 },
        { in: 0, load: 0 },
        { in: 6, load: 1 },
        { in: 9, load: 1 },
        { in: 0, load: 1 },
      ],
      initial: undefined,
      next: (state, set) => (set.load ? set.in : state),
      read: (state) => shown('out', state),
    }),
  ],
  [
    'COUNTER4',
    sequentialSpec<number | undefined>({
      inputs: ['in', 'load', 'reset', 'clk'],
      outputs: ['out'],
      widths: { in: WORD, out: WORD },
      cycles: [
        { in: 0, load: 0, reset: 1 },
        { reset: 0 },
        {},
        {},
        { in: 9, load: 1 },
        { in: 0, load: 0 },
        ...Array.from({ length: 6 }, () => ({})),
        { in: 5, load: 1, reset: 1 },
        { load: 0, reset: 0 },
        { in: 14, load: 1 },
        { load: 0 },
      ],
      initial: undefined,
      // Reset wins over load, and load over counting.
      next: (state, set) => (set.reset ? 0 : set.load ? set.in : state === undefined ? undefined : (state + 1) & WORD_MASK),
      read: (state) => shown('out', state),
    }),
  ],
  [
    'RAM4',
    sequentialSpec<Memory>({
      inputs: ['in', 'addr', 'load', 'clk'],
      outputs: ['out'],
      widths: { in: WORD, addr: SELECTOR, out: WORD },
      cycles: [
        { in: 5, addr: 0, load: 1 },
        { in: 10, addr: 1 },
        { in: 3, addr: 2 },
        { in: 12, addr: 3 },
        { in: 0, addr: 0, load: 0 },
        { addr: 1 },
        { addr: 2 },
        { addr: 3 },
        { in: 15, addr: 2, load: 1 },
        { in: 0, addr: 0, load: 0 },
        { addr: 2 },
        { addr: 3 },
      ],
      initial: Array.from({ length: RAM_WORDS }, () => undefined),
      // The addressed word is always on `out`; `load` stores `in` there on the clock edge.
      next: (memory, set) => (set.load ? memory.map((word, i) => (i === set.addr ? set.in : word)) : memory),
      read: (memory, set) => shown('out', memory[set.addr]),
    }),
  ],
])
