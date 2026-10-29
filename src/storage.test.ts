import { describe, expect, it, vi } from 'vitest'
import { LIMITS, emptySave, serializeSave } from './sim/schema.ts'
import type { Project } from './sim/schema.ts'
import { LIBRARY, NOT } from './sim/examples.ts'
import { CircuitError } from './sim/types.ts'
import {
  DEFAULT_PREFS,
  PREFS_KEY,
  SAVED_SANDBOX_KEY,
  STORAGE_KEY,
  backupSave,
  clearSavedSandbox,
  loadPrefs,
  loadSave,
  loadSavedSandbox,
  parseSaveFile,
  requestPersistence,
  saveFileName,
  writePrefs,
  writeSave,
  writeSavedSandbox,
} from './storage.ts'

class MemoryStorage {
  items = new Map<string, string>()
  getItem = (key: string) => this.items.get(key) ?? null
  setItem = (key: string, value: string) => void this.items.set(key, value)
  removeItem = (key: string) => void this.items.delete(key)
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

describe('progress file', () => {
  it('loads a downloaded progress file, keeping only levels that exist', () => {
    const data = { ...emptySave(), solved: ['NOT', 'HACK', 'AND'], chips: [...LIBRARY.values()], sandbox: NOT }
    expect(parseSaveFile(serializeSave(data))).toEqual({ ...data, solved: ['NOT', 'AND'] })
  })

  it('refuses a file that is not a valid save', () => {
    expect(() => parseSaveFile('{nope')).toThrow(CircuitError)
    expect(() => parseSaveFile('{"version":1,"solved":"nope"}')).toThrow(CircuitError)
    expect(() => parseSaveFile('{"version":2,"solved":[],"chips":[],"drafts":[],"sandbox":{"nodes":[],"wires":[]}}')).toThrow(CircuitError)
  })

  it('names the file after the local date', () => {
    expect(saveFileName(new Date(2026, 0, 5, 23, 59))).toBe('circuitos-progreso-2026-01-05.json')
  })
})

describe('persistent storage', () => {
  it('asks for it only when the browser has not granted it yet', async () => {
    const persist = vi.fn(async () => true)
    await requestPersistence({ persisted: async () => false, persist })
    expect(persist).toHaveBeenCalledOnce()
    persist.mockClear()
    await requestPersistence({ persisted: async () => true, persist })
    expect(persist).not.toHaveBeenCalled()
  })

  it('never fails: missing API or a refusal are fine', async () => {
    await expect(requestPersistence(undefined)).resolves.toBeUndefined()
    await expect(requestPersistence({ persisted: async () => false, persist: async () => Promise.reject(new Error('no')) })).resolves.toBeUndefined()
  })
})

describe('interface preferences', () => {
  it('saves and loads them apart from the progress', () => {
    const store = memory()
    const prefs = { levelsCollapsed: true, piecesCollapsed: false, theoryClosed: ['NOT', 'AND'], muted: true }
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
    store.items.set(PREFS_KEY, JSON.stringify({ levelsCollapsed: 'yes', piecesCollapsed: true, theoryClosed: ['NOT', 'NOT', 'HACK', 7], muted: 1 }))
    expect(loadPrefs(store)).toEqual({ ...DEFAULT_PREFS, piecesCollapsed: true, theoryClosed: ['NOT'] })
    // Saved before the sound existed: the field is missing and the sound stays on.
    store.items.set(PREFS_KEY, JSON.stringify({ levelsCollapsed: true }))
    expect(loadPrefs(store)).toEqual({ ...DEFAULT_PREFS, levelsCollapsed: true, muted: false })
    store.items.set(PREFS_KEY, JSON.stringify(['not', 'an', 'object']))
    expect(loadPrefs(store)).toEqual(DEFAULT_PREFS)
  })
})

describe('saved sandbox', () => {
  const project: Project = { version: 1, circuit: NOT, chips: [] }

  it('keeps the sandbox apart from the progress and reads it back', () => {
    const store = memory()
    expect(writeSavedSandbox(project, store)).toBeUndefined()
    expect(store.items.has(STORAGE_KEY)).toBe(false)
    expect(loadSavedSandbox(store)).toEqual(project)
  })

  it('has nothing to restore without storage or without a saved one', () => {
    expect(loadSavedSandbox(undefined)).toBeUndefined()
    expect(loadSavedSandbox(memory())).toBeUndefined()
  })

  it('drops a damaged copy instead of failing', () => {
    const store = memory()
    store.setItem(SAVED_SANDBOX_KEY, '{"version":1,"chips":[],"circuit":{"nodes":[{"id":"a","kind":"NOPE"}],"wires":[]}}')
    expect(loadSavedSandbox(store)).toBeUndefined()
    expect(store.items.has(SAVED_SANDBOX_KEY)).toBe(false)
  })

  it('clears it only after keeping a copy, and not at all if the copy fails', () => {
    const store = memory()
    expect(clearSavedSandbox(store)).toBeUndefined()
    expect(store.items.size).toBe(0)

    writeSavedSandbox(project, store)
    const json = store.getItem(SAVED_SANDBOX_KEY)
    expect(clearSavedSandbox(store)).toBeUndefined()
    expect(store.items.has(SAVED_SANDBOX_KEY)).toBe(false)
    expect(store.getItem(`${SAVED_SANDBOX_KEY}:respaldo`)).toBe(json)

    const full = memory()
    writeSavedSandbox(project, full)
    full.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    expect(clearSavedSandbox(full)).toMatchObject({ code: 'backupFailed' })
    expect(full.items.has(SAVED_SANDBOX_KEY)).toBe(true)
  })

  it('refuses one over the size limit, and says when the browser refuses to store it', () => {
    const big: Project = { ...project, circuit: { ...NOT, nodes: NOT.nodes.map((n) => ({ ...n, label: 'x'.repeat(LIMITS.bytes) })) } }
    expect(writeSavedSandbox(big, memory())).toMatchObject({ code: 'saveTooBig' })
    const full = memory()
    full.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    expect(writeSavedSandbox(project, full)).toMatchObject({ code: 'saveFailed' })
  })
})
