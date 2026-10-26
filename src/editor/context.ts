import { createContext, useContext } from 'react'
import type { TFunction } from 'i18next'
import type { ChipLibrary, Problem } from '../sim/types.ts'
import type { Signals } from './useSimulation.ts'

export interface EditorState {
  library: ChipLibrary
  signals: Signals
  /** Value arriving at an input pin through its wire; 0 when unconnected. */
  incoming: (node: string, pin: string) => number
  inputs: ReadonlyMap<string, number>
  setInput: (id: string, value: number) => void
  /** Undefined when pins can't be renamed (levels); otherwise returns the problem, if any. */
  rename?: (from: string, to: string) => Problem | undefined
}

export const EditorContext = createContext<EditorState | undefined>(undefined)

export function useEditor(): EditorState {
  const state = useContext(EditorContext)
  if (!state) throw new Error('useEditor outside <EditorContext>')
  return state
}

/** Built-in pieces; their names are `kinds.<KIND>` in src/locales. */
export const BASIC_KINDS = ['INPUT', 'OUTPUT', 'CLOCK', 'NAND', 'SPLIT', 'JOIN', 'VCC', 'RELAY', 'RELAY_NC'] as const
type BasicKind = (typeof BASIC_KINDS)[number]
export const isBasicKind = (kind: string): kind is BasicKind => (BASIC_KINDS as readonly string[]).includes(kind)

export const kindName = (t: TFunction, kind: string, library: ChipLibrary) =>
  isBasicKind(kind) ? t(`kinds.${kind}`) : (library.get(kind)?.name ?? kind)

/** Kinds whose width the user picks when adding them. */
export const SIZED_KINDS = new Set(['INPUT', 'OUTPUT', 'SPLIT', 'JOIN'])

export const binary = (value: number, width: number) => value.toString(2).padStart(width, '0')
