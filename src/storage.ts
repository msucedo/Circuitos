import { LIMITS, byteLength, emptySave, parseSave, serializeSave } from './sim/schema.ts'
import type { SaveData } from './sim/schema.ts'

export const STORAGE_KEY = 'circuitos:v1'

/** localStorage can be missing or throw (private mode, blocked site data). */
function browserStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function loadSave(store = browserStorage()): { data: SaveData; warning?: string } {
  let raw: string | null
  try {
    raw = store ? store.getItem(STORAGE_KEY) : null
  } catch {
    return { data: emptySave(), warning: 'El navegador no deja guardar datos: tu progreso no se guardará.' }
  }
  if (raw === null) return { data: emptySave() }
  try {
    return { data: parseSave(raw) }
  } catch (error) {
    // Keep the unreadable copy so the next autosave does not destroy it.
    try {
      store?.setItem(`${STORAGE_KEY}:corrupto`, raw)
    } catch {
      /* nothing else to do */
    }
    const reason = error instanceof Error ? error.message : String(error)
    return { data: emptySave(), warning: `No se pudo leer tu progreso (${reason}). Se guardó una copia y empiezas de cero.` }
  }
}

/** Returns a message when the progress could not be saved. */
export function writeSave(data: SaveData, store = browserStorage()): string | undefined {
  const json = serializeSave(data)
  if (byteLength(json) > LIMITS.bytes) return 'Tu progreso pasa de 2 MB y ya no se guarda. Borra circuitos grandes.'
  try {
    store?.setItem(STORAGE_KEY, json)
  } catch {
    return 'No se pudo guardar tu progreso en el navegador.'
  }
}

/** Before wiping the progress, keep one copy of it next to the save. */
export function backupSave(data: SaveData, store = browserStorage()): string | undefined {
  try {
    store?.setItem(`${STORAGE_KEY}:respaldo`, serializeSave(data))
  } catch {
    return 'No se pudo guardar una copia de tu progreso, así que no se borró.'
  }
}
