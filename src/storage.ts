import { levelById } from './levels/levels.ts'
import { LIMITS, byteLength, emptySave, parseSave, serializeSave } from './sim/schema.ts'
import type { SaveData } from './sim/schema.ts'
import { problem } from './sim/types.ts'
import type { Problem } from './sim/types.ts'

export const STORAGE_KEY = 'circuitos:v1'

/** The downloaded progress file: same format as the save, named by the day it was taken. */
const SAVE_FILE_PREFIX = 'circuitos-progreso'

/** localStorage can be missing or throw (private mode, blocked site data). */
function browserStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function loadSave(store = browserStorage()): { data: SaveData; warning?: Problem } {
  let raw: string | null
  try {
    raw = store ? store.getItem(STORAGE_KEY) : null
  } catch {
    return { data: emptySave(), warning: problem('storageBlocked') }
  }
  if (raw === null) return { data: emptySave() }
  try {
    return { data: parseSave(raw) }
  } catch (error) {
    console.warn('Unreadable save', error)
    // Keep the unreadable copy so the next autosave does not destroy it.
    try {
      store?.setItem(`${STORAGE_KEY}:corrupto`, raw)
    } catch {
      /* nothing else to do */
    }
    return { data: emptySave(), warning: problem('saveUnreadable') }
  }
}

/** Returns the problem when the progress could not be saved. */
export function writeSave(data: SaveData, store = browserStorage()): Problem | undefined {
  const json = serializeSave(data)
  if (byteLength(json) > LIMITS.bytes) return problem('saveTooBig', { mb: LIMITS.bytes / 1024 / 1024 })
  try {
    store?.setItem(STORAGE_KEY, json)
  } catch {
    return problem('saveFailed')
  }
}

/** Before wiping the progress, keep one copy of it next to the save. */
export function backupSave(data: SaveData, store = browserStorage()): Problem | undefined {
  try {
    store?.setItem(`${STORAGE_KEY}:respaldo`, serializeSave(data))
  } catch {
    return problem('backupFailed')
  }
}

/**
 * A progress file may come from anyone: `parseSave` checks every field and limit,
 * and only levels that exist count as solved.
 */
export function parseSaveFile(json: string): SaveData {
  const data = parseSave(json)
  return { ...data, solved: data.solved.filter((id) => levelById(id) !== undefined) }
}

const pad = (n: number) => String(n).padStart(2, '0')

export const saveFileName = (date: Date) =>
  `${SAVE_FILE_PREFIX}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`

type Persistence = Pick<StorageManager, 'persisted' | 'persist'>

/**
 * Asks the browser not to evict the progress (Safari clears unvisited sites after a week).
 * Only a hint: browsers may say no, and nothing changes if they do.
 */
export async function requestPersistence(manager: Persistence | undefined = globalThis.navigator?.storage) {
  try {
    if (manager && !(await manager.persisted())) await manager.persist()
  } catch {
    /* refused or unsupported: localStorage still works */
  }
}

/** How the interface looks for this viewer; kept apart from the progress, so wiping or exporting never touches it. */
export const PREFS_KEY = 'circuitos:ui'

export interface Prefs {
  levelsCollapsed: boolean
  piecesCollapsed: boolean
  /** Levels whose theory panel the user closed; it no longer opens by itself there. */
  theoryClosed: string[]
  /** The sound effects are off. */
  muted: boolean
}

export const DEFAULT_PREFS: Prefs = { levelsCollapsed: false, piecesCollapsed: false, theoryClosed: [], muted: false }

/** Stored data is untrusted: only known fields with the right type survive, and only ids of real levels. */
function parsePrefs(raw: string): Prefs {
  const data: unknown = JSON.parse(raw)
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return DEFAULT_PREFS
  const flag = (key: 'levelsCollapsed' | 'piecesCollapsed' | 'muted') => {
    const value = (data as Record<string, unknown>)[key]
    return typeof value === 'boolean' ? value : DEFAULT_PREFS[key]
  }
  const closed = (data as Record<string, unknown>).theoryClosed
  const ids = Array.isArray(closed) ? closed.filter((id): id is string => typeof id === 'string' && levelById(id) !== undefined) : []
  return {
    levelsCollapsed: flag('levelsCollapsed'),
    piecesCollapsed: flag('piecesCollapsed'),
    theoryClosed: [...new Set(ids)],
    muted: flag('muted'),
  }
}

export function loadPrefs(store = browserStorage()): Prefs {
  try {
    const raw = store?.getItem(PREFS_KEY)
    return raw ? parsePrefs(raw) : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

/** Losing a preference is harmless, so a failed write is ignored. */
export function writePrefs(prefs: Prefs, store = browserStorage()) {
  try {
    store?.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* nothing else to do */
  }
}
