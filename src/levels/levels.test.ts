import { describe, expect, it } from 'vitest'
import * as examples from '../sim/examples.ts'
import { verify } from '../sim/verify.ts'
import type { ChipDef } from '../sim/types.ts'
import { LEVELS, firstOpenLevel, isUnlocked, levelCircuit, levelLibrary, levelPalette } from './levels.ts'

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
      if (level.chip !== false) chips.push({ id: level.id, name: level.name, circuit: solution(level.id) })
    }
  })

  it('locks every level until the previous required one is solved; the optional level 0 locks nothing', () => {
    expect(LEVELS.filter((l) => isUnlocked(l, new Set())).map((l) => l.id)).toEqual(['RELAY_NAND', 'NOT'])
    expect(isUnlocked(LEVELS.find((l) => l.id === 'AND')!, new Set(['NOT']))).toBe(true)
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
    const all = LEVELS.map((l) => ({ id: l.id, name: l.name, circuit: solution(l.id) }))
    expect([...levelLibrary(not, new Set(['RELAY_NAND']), all).keys()]).toEqual([])
    expect(levelPalette(not, new Map())).toEqual(['NAND'])
  })

  it('never offers a level its own chip or a later one', () => {
    const all = LEVELS.map((l) => ({ id: l.id, name: l.name, circuit: solution(l.id) }))
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
