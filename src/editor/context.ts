import { createContext, useContext } from 'react'
import type { Bit, ChipLibrary } from '../sim/types.ts'
import type { Signals } from './useSimulation.ts'

export interface EditorState {
  library: ChipLibrary
  signals: Signals
  inputs: ReadonlyMap<string, Bit>
  toggleInput: (id: string) => void
}

export const EditorContext = createContext<EditorState | undefined>(undefined)

export function useEditor(): EditorState {
  const state = useContext(EditorContext)
  if (!state) throw new Error('useEditor outside <EditorContext>')
  return state
}

export const KIND_NAMES: Record<string, string> = { INPUT: 'Entrada', OUTPUT: 'Salida', CLOCK: 'Reloj', NAND: 'NAND' }

export const kindName = (kind: string, library: ChipLibrary) => KIND_NAMES[kind] ?? library.get(kind)?.name ?? kind
