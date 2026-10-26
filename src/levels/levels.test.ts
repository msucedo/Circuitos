import { describe, expect, it } from 'vitest'
import * as examples from '../sim/examples.ts'
import { verify } from '../sim/verify.ts'
import type { ChipDef, Circuit } from '../sim/types.ts'
import en from '../locales/en.json'
import es from '../locales/es.json'
import { ALU_OP } from './specs.ts'
import { LEVELS, MAIN_LEVELS, firstOpenLevel, isUnlocked, levelById, levelCircuit, levelLibrary, levelNumber, levelPalette, nextLevel, unlockedBy } from './levels.ts'

const solution = (id: string) => examples[id as keyof typeof examples] as typeof examples.NOT

describe('levels', () => {
  it('can be played in order: each reference solution passes using only the chips unlocked before it', () => {
    const solved = new Set<string>()
    const chips: ChipDef[] = []
    for (const level of LEVELS) {
      expect(isUnlocked(level, solved)).toBe(true)
      const result = verify(solution(level.id), levelLibrary(level, solved, chips), level.spec)
      expect(result.error, level.id).toBeUndefined()
      expect(result.passed, level.id).toBe(true)
      solved.add(level.id)
      if (level.chip !== false) chips.push({ id: level.id, name: level.id, circuit: solution(level.id) })
    }
  })

  it('locks every level until the previous required one is solved; the optional level 0 locks nothing', () => {
    expect(LEVELS.filter((l) => isUnlocked(l, new Set())).map((l) => l.id)).toEqual(['RELAY_NAND', 'NOT'])
    expect(isUnlocked(LEVELS.find((l) => l.id === 'AND')!, new Set(['NOT']))).toBe(true)
  })

  it('numbers the main levels, says what unlocks each one and which comes next', () => {
    const at = (id: string) => levelById(id)!
    expect(MAIN_LEVELS).toHaveLength(LEVELS.length - 1)
    expect([levelNumber(at('RELAY_NAND')), levelNumber(at('NOT')), levelNumber(at('AND'))]).toEqual([undefined, 1, 2])
    expect([unlockedBy(at('RELAY_NAND')), unlockedBy(at('NOT'))]).toEqual([undefined, undefined])
    expect(unlockedBy(at('AND'))?.id).toBe('NOT')
    expect([nextLevel(at('RELAY_NAND'))?.id, nextLevel(at('NOT'))?.id]).toEqual(['NOT', 'AND'])
    expect(nextLevel(LEVELS.at(-1)!)).toBeUndefined()
  })

  it('keeps old progress (saved before level 0 existed) where it was', () => {
    const old = new Set(['NOT', 'AND', 'OR', 'XOR'])
    expect(LEVELS.filter((l) => l.id !== 'RELAY_NAND').map((l) => isUnlocked(l, old))).toEqual(
      LEVELS.filter((l) => l.id !== 'RELAY_NAND').map((l) => old.has(l.id) || l.id === 'HALF_ADDER'),
    )
    expect(firstOpenLevel(old)).toBe('HALF_ADDER')
    expect(firstOpenLevel(new Set())).toBe('NOT')
  })

  it('level 0 offers relays instead of NAND and adds no chip', () => {
    const relays = LEVELS[0]
    expect(levelPalette(relays, new Map())).toEqual(['VCC', 'RELAY', 'RELAY_NC'])
    const not = LEVELS.find((l) => l.id === 'NOT')!
    const all = LEVELS.map((l) => ({ id: l.id, name: l.id, circuit: solution(l.id) }))
    expect([...levelLibrary(not, new Set(['RELAY_NAND']), all).keys()]).toEqual([])
    expect(levelPalette(not, new Map())).toEqual(['NAND'])
  })

  it('never offers a level its own chip or a later one', () => {
    const all = LEVELS.map((l) => ({ id: l.id, name: l.id, circuit: solution(l.id) }))
    const solvedAll = new Set(LEVELS.map((l) => l.id))
    const xor = LEVELS.find((l) => l.id === 'XOR')!
    expect([...levelLibrary(xor, solvedAll, all).keys()]).toEqual(['NOT', 'AND', 'OR'])
  })

  it('starts with exactly the pins the spec checks', () => {
    for (const level of LEVELS) {
      const ids = (kind: string) => levelCircuit(level).nodes.filter((n) => n.kind === kind).map((n) => n.id)
      expect(ids('INPUT')).toEqual(level.spec.inputs)
      expect(ids('OUTPUT')).toEqual(level.spec.outputs)
      expect(verify(levelCircuit(level), new Map(), level.spec).passed).toBe(false)
    }
  })
})

/** Verifying runs every step, so specs stay small enough to check instantly in the browser. */
const MAX_SPEC_STEPS = 1024

describe('block 3 levels', () => {
  const spec = (id: string) => levelById(id)!.spec
  const expected = (id: string, set: Record<string, number>) => spec(id).steps.find((s) => Object.entries(set).every(([k, v]) => s.set[k] === v))?.expect

  it('compute what each case expects', () => {
    expect(expected('ALU4', { a: 7, b: 9, op: ALU_OP.SUB })).toEqual({ out: 14, zero: 0 })
    expect(expected('ALU4', { a: 5, b: 5, op: ALU_OP.SUB })).toEqual({ out: 0, zero: 1 })
    expect(expected('ALU4', { a: 15, b: 1, op: ALU_OP.ADD })).toEqual({ out: 0, zero: 1 })
    expect(expected('ALU4', { a: 5, b: 10, op: ALU_OP.OR })).toEqual({ out: 15, zero: 0 })
    expect(expected('INC4', { in: 15 })).toEqual({ out: 0 })
    expect(expected('DECODER', { sel: 2 })).toEqual({ y0: 0, y1: 0, y2: 1, y3: 0 })
    expect(expected('MUX4', { a: 5, b: 10, sel: 1 })).toEqual({ out: 10 })
  })

  it('catch a circuit with two crossed bits', () => {
    // Same as the reference, but bits 0 and 1 of the result swap places.
    const crossed = (circuit: Circuit, join: string): Circuit => ({
      ...circuit,
      wires: circuit.wires.map((w) =>
        w.to.node !== join ? w : { ...w, to: { ...w.to, pin: w.to.pin === 'b0' ? 'b1' : w.to.pin === 'b1' ? 'b0' : w.to.pin } },
      ),
    })
    const all = new Set(LEVELS.map((l) => l.id))
    const chips = LEVELS.filter((l) => l.chip !== false).map((l) => ({ id: l.id, name: l.id, circuit: solution(l.id) }))
    for (const [id, join] of [['MUX4', 'j'], ['NOT4', 'j'], ['INC4', 'j'], ['ALU4', 'arith'], ['REGISTER4', 'j']]) {
      const library = levelLibrary(levelById(id)!, all, chips)
      expect(verify(crossed(solution(id), join), library, spec(id)).passed, id).toBe(false)
    }
  })

  it('memory levels follow their model: count, wrap, reset first, and read the addressed word', () => {
    const outs = (id: string) => spec(id).steps.filter((s) => s.set.clk === 1).map((s) => s.expect.out)
    expect(outs('COUNTER4')).toEqual([0, 1, 2, 3, 9, 10, 11, 12, 13, 14, 15, 0, 0, 1, 14, 15])
    expect(outs('RAM4')).toEqual([5, 10, 3, 12, 5, 10, 3, 12, 15, 5, 15, 12])
    expect(outs('BIT')).toEqual([1, 1, 0, 0, 1, 1, 0])
  })

  it('tell a flip-flop from a latch: a BIT that follows the clock level fails', () => {
    const library = levelLibrary(levelById('BIT')!, new Set(LEVELS.map((l) => l.id)), LEVELS.map((l) => ({ id: l.id, name: l.id, circuit: solution(l.id) })))
    const latched: Circuit = {
      ...solution('BIT'),
      nodes: solution('BIT').nodes.map((n) => (n.kind === 'D_FLIPFLOP' ? { ...n, kind: 'D_LATCH' } : n)),
      wires: solution('BIT').wires.map((w) =>
        w.to.node === 'd' && w.to.pin === 'clk' ? { ...w, to: { ...w.to, pin: 'en' } } : w,
      ),
    }
    expect(verify(latched, library, spec('BIT')).passed).toBe(false)
  })

  it('keep every spec small', () => {
    for (const level of LEVELS) expect(level.spec.steps.length, level.id).toBeLessThanOrEqual(MAX_SPEC_STEPS)
  })

  it('start with bus pins already as wide as the spec says', () => {
    const pins = levelCircuit(levelById('ALU4')!).nodes.map((n) => [n.id, n.width ?? 1])
    expect(pins).toEqual([['a', 4], ['b', 4], ['op', 2], ['out', 4], ['zero', 1]])
    expect(levelPalette(levelById('ALU4')!, new Map())).toEqual(['NAND', 'SPLIT', 'JOIN'])
  })

  it('have a name and a goal in every language', () => {
    for (const [language, texts] of Object.entries({ es, en })) {
      const levels: Record<string, { name?: string; goal?: string }> = texts.levels
      for (const level of LEVELS) {
        expect(levels[level.id]?.name, `${language} ${level.id}`).toBeTruthy()
        expect(levels[level.id]?.goal, `${language} ${level.id}`).toBeTruthy()
      }
    }
  })
})
