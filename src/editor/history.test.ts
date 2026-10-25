import { describe, expect, it } from 'vitest'
import { History } from './history.ts'

describe('History', () => {
  it('undoes and redoes in order, and a new change drops the redo stack', () => {
    const h = new History<number>()
    h.record(1) // 1 → 2
    h.record(2) // 2 → 3
    expect(h.undo(3)).toBe(2)
    expect(h.undo(2)).toBe(1)
    expect(h.undo(1)).toBeUndefined()
    expect(h.redo(1)).toBe(2)
    h.record(2) // 2 → 9
    expect(h.canRedo).toBe(false)
    expect(h.undo(9)).toBe(2)
  })

  it('keeps at most `limit` snapshots', () => {
    const h = new History<number>(3)
    for (let i = 0; i < 10; i++) h.record(i)
    expect([h.undo(10), h.undo(9), h.undo(8), h.undo(7)]).toEqual([9, 8, 7, undefined])
  })
})
