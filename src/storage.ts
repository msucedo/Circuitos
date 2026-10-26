import { LIMITS, byteLength, emptySave, parseSave, serializeSave } from './sim/schema.ts'
import type { SaveData } from './sim/schema.ts'
import { problem } from './sim/types.ts'
import type { Problem } from './sim/types.ts'

export const STORAGE_KEY = 'circuitos:v1'

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
