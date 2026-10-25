import { tableSpec } from '../sim/verify.ts'
import type { Spec } from '../sim/verify.ts'
import type { Bit } from '../sim/types.ts'

const bit = (value: boolean | number): Bit => (value ? 1 : 0)
const toNumber = (bits: Bit[]) => bits.reduce<number>((n, b) => n * 2 + b, 0)

/** What each level checks, by the id of the chip it unlocks. */
export const SPECS = new Map<string, Spec>([
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
])
