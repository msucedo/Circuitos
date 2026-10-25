import { describe, expect, it } from 'vitest'
import * as examples from '../sim/examples.ts'
import { verify } from '../sim/verify.ts'
import type { ChipDef } from '../sim/types.ts'
import { LEVELS, isUnlocked, levelCircuit, levelLibrary } from './levels.ts'

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
      chips.push({ id: level.id, name: level.name, circuit: solution(level.id) })
    }
  })

  it('locks every level after the first until the previous one is solved', () => {
    expect(LEVELS.filter((l) => isUnlocked(l, new Set())).map((l) => l.id)).toEqual(['NOT'])
    expect(isUnlocked(LEVELS[1], new Set(['NOT']))).toBe(true)
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
