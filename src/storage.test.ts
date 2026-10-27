import { describe, expect, it } from 'vitest'
import { emptySave, serializeSave } from './sim/schema.ts'
import { LIBRARY, NOT } from './sim/examples.ts'
import { DEFAULT_PREFS, PREFS_KEY, STORAGE_KEY, backupSave, loadPrefs, loadSave, writePrefs, writeSave } from './storage.ts'

class MemoryStorage {
  items = new Map<string, string>()
  getItem = (key: string) => this.items.get(key) ?? null
  setItem = (key: string, value: string) => void this.items.set(key, value)
}
const memory = () => new MemoryStorage() as unknown as Storage & MemoryStorage

describe('storage', () => {
  it('saves and loads progress', () => {
    const store = memory()
    const data = { ...emptySave(), solved: ['NOT'], chips: [...LIBRARY.values()], drafts: new Map([['AND', NOT]]), sandbox: NOT }
    expect(writeSave(data, store)).toBeUndefined()
    expect(loadSave(store)).toEqual({ data })
  })

  it('starts clean when nothing is stored', () => {
    expect(loadSave(memory())).toEqual({ data: emptySave() })
    expect(loadSave(undefined)).toEqual({ data: emptySave() })
  })

  it('starts clean on corrupted data and keeps a copy of it', () => {
    const store = memory()
    store.items.set(STORAGE_KEY, '{"version":1,"solved":"nope"}')
    const { data, warning } = loadSave(store)
    expect(data).toEqual(emptySave())
    expect(warning?.code).toBe('saveUnreadable')
    expect(store.items.get(`${STORAGE_KEY}:corrupto`)).toBe('{"version":1,"solved":"nope"}')
  })

  it('does not crash when the browser blocks storage', () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
    } as unknown as Storage
    expect(loadSave(blocked).warning?.code).toBe('storageBlocked')
    expect(writeSave(emptySave(), blocked)?.code).toBe('saveFailed')
  })

  it('refuses to wipe progress when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
    } as unknown as Storage
    expect(backupSave(emptySave(), blocked)?.code).toBe('backupFailed')
  })

  it('keeps a copy of the progress before wiping it', () => {
    const store = memory()
    const data = { ...emptySave(), solved: ['NOT'], sandbox: NOT }
    expect(backupSave(data, store)).toBeUndefined()
    expect(store.items.get(`${STORAGE_KEY}:respaldo`)).toBe(serializeSave(data))
  })

  it('refuses to write progress bigger than the load limit', () => {
    const big = { ...emptySave(), sandbox: { nodes: [{ id: 'a', kind: 'INPUT', label: 'x'.repeat(40) }], wires: [] } }
    big.sandbox.nodes = Array.from({ length: 30_000 }, (_, i) => ({ id: `n${i}`, kind: 'NAND', label: 'x'.repeat(40) }))
    expect(writeSave(big, memory())?.code).toBe('saveTooBig')
  })
})

describe('interface preferences', () => {
  it('saves and loads them apart from the progress', () => {
    const store = memory()
    const prefs = { levelsCollapsed: true, piecesCollapsed: false, theoryClosed: ['NOT', 'AND'] }
    writePrefs(prefs, store)
    expect(store.items.has(STORAGE_KEY)).toBe(false)
    expect(loadPrefs(store)).toEqual(prefs)
  })

  it('falls back to the defaults on missing, broken or blocked storage', () => {
    expect(loadPrefs(memory())).toEqual(DEFAULT_PREFS)
    expect(loadPrefs(undefined)).toEqual(DEFAULT_PREFS)
    const store = memory()
    store.items.set(PREFS_KEY, '{nope')
    expect(loadPrefs(store)).toEqual(DEFAULT_PREFS)
    const blocked = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
    } as unknown as Storage
    expect(loadPrefs(blocked)).toEqual(DEFAULT_PREFS)
    expect(() => writePrefs(DEFAULT_PREFS, blocked)).not.toThrow()
  })

  it('keeps only valid fields and known levels', () => {
    const store = memory()
    store.items.set(PREFS_KEY, JSON.stringify({ levelsCollapsed: 'yes', piecesCollapsed: true, theoryClosed: ['NOT', 'NOT', 'HACK', 7] }))
    expect(loadPrefs(store)).toEqual({ ...DEFAULT_PREFS, piecesCollapsed: true, theoryClosed: ['NOT'] })
    store.items.set(PREFS_KEY, JSON.stringify(['not', 'an', 'object']))
    expect(loadPrefs(store)).toEqual(DEFAULT_PREFS)
  })
})
