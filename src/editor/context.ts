import { createContext, useContext } from 'react'
import type { ChipLibrary } from '../sim/types.ts'
import type { Signals } from './useSimulation.ts'

export interface EditorState {
  library: ChipLibrary
  signals: Signals
  inputs: ReadonlyMap<string, number>
  setInput: (id: string, value: number) => void
  /** Undefined when pins can't be renamed (levels); otherwise returns an error message or undefined. */
  rename?: (from: string, to: string) => string | undefined
}

export const EditorContext = createContext<EditorState | undefined>(undefined)

export function useEditor(): EditorState {
  const state = useContext(EditorContext)
  if (!state) throw new Error('useEditor outside <EditorContext>')
  return state
}

export const KIND_NAMES: Record<string, string> = {
  INPUT: 'Entrada',
  OUTPUT: 'Salida',
  CLOCK: 'Reloj',
  NAND: 'NAND',
  SPLIT: 'Separar',
  JOIN: 'Juntar',
}

export const kindName = (kind: string, library: ChipLibrary) => KIND_NAMES[kind] ?? library.get(kind)?.name ?? kind

/** Kinds whose width the user picks when adding them. */
export const SIZED_KINDS = new Set(['INPUT', 'OUTPUT', 'SPLIT', 'JOIN'])

export const binary = (value: number, width: number) => value.toString(2).padStart(width, '0')
