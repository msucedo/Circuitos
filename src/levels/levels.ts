import { specWidth } from '../sim/verify.ts'
import type { Spec } from '../sim/verify.ts'
import { toLibrary } from '../sim/types.ts'
import type { ChipDef, ChipLibrary, Circuit } from '../sim/types.ts'
import { SPECS } from './specs.ts'

export interface Level {
  /** Also the id of the chip that solving the level unlocks. Its texts are `levels.<id>.*` in src/locales. */
  id: string
  spec: Spec
  /** Primitive pieces offered besides the unlocked chips; NAND when missing. */
  parts?: string[]
  /** Optional levels never lock the ones after them, so adding one keeps old progress playable. */
  optional?: boolean
  /** False when solving the level adds no chip (its circuit is already a primitive). */
  chip?: boolean
}

const level = (id: string, extra?: Partial<Level>): Level => ({ id, spec: SPECS.get(id)!, ...extra })

/** Bus levels also offer the pieces that split a bus into bits and join them back. */
const BUS_PARTS = ['NAND', 'SPLIT', 'JOIN']
/** The counter needs a constant 1 for its register's load. */
const BUS_AND_SOURCE = [...BUS_PARTS, 'VCC']

export const LEVELS: Level[] = [
  level('RELAY_NAND', { parts: ['VCC', 'RELAY', 'RELAY_NC'], optional: true, chip: false }),
  level('NOT'),
  level('AND'),
  level('OR'),
  level('XOR'),
  level('HALF_ADDER'),
  level('FULL_ADDER'),
  level('ADDER4'),
  level('SR_LATCH'),
  level('D_LATCH'),
  level('D_FLIPFLOP'),
  level('MUX'),
  level('DMUX'),
  level('NOT4', { parts: BUS_PARTS }),
  level('MUX4', { parts: BUS_PARTS }),
  level('DECODER', { parts: BUS_PARTS }),
  level('INC4', { parts: BUS_PARTS }),
  level('ALU4', { parts: BUS_PARTS }),
  level('BIT'),
  level('REGISTER4', { parts: BUS_PARTS }),
  level('COUNTER4', { parts: BUS_AND_SOURCE }),
  level('RAM4', { parts: BUS_PARTS }),
]

export const levelById = (id: string) => LEVELS.find((l) => l.id === id)

/** The level that has to be solved first: the closest earlier one that isn't optional. */
export const unlockedBy = (level: Level) => LEVELS.slice(0, LEVELS.indexOf(level)).findLast((l) => !l.optional)

export function isUnlocked(level: Level, solved: ReadonlySet<string>): boolean {
  const before = unlockedBy(level)
  return before === undefined || solved.has(before.id)
}

/** The levels that count for progress; optional ones are extras. */
export const MAIN_LEVELS = LEVELS.filter((l) => !l.optional)

/** Position among the main levels, from 1; undefined for optional levels. */
export const levelNumber = (level: Level) => (level.optional ? undefined : MAIN_LEVELS.indexOf(level) + 1)

/** The main level that solving this one opens; undefined after the last. */
export const nextLevel = (level: Level) => LEVELS.slice(LEVELS.indexOf(level) + 1).find((l) => !l.optional)

/** Where to start: the first open, unsolved level that isn't optional. */
export function firstOpenLevel(solved: ReadonlySet<string>): string {
  return (LEVELS.find((l) => !l.optional && !solved.has(l.id) && isUnlocked(l, solved)) ?? LEVELS[0]).id
}

export const levelPalette = (level: Level, library: ChipLibrary) => [...(level.parts ?? ['NAND']), ...library.keys()]

/**
 * Chips usable inside a level: only those from earlier, solved levels. This
 * keeps level chips ordered, so a solution can never end up containing itself.
 */
export function levelLibrary(level: Level, solved: ReadonlySet<string>, chips: ChipDef[]): ChipLibrary {
  const earlier = new Set(
    LEVELS.slice(0, LEVELS.indexOf(level))
      .filter((l) => l.chip !== false)
      .map((l) => l.id),
  )
  return toLibrary(chips.filter((c) => earlier.has(c.id) && solved.has(c.id)))
}

/** Starting circuit: the level's pins, already placed, buses included. */
export function levelCircuit(level: Level): Circuit {
  const column = (ids: string[], kind: string, x: number) =>
    ids.map((id, i) => {
      const width = specWidth(level.spec, id)
      return { id, kind, x, y: i * 70, ...(width > 1 ? { width } : {}) }
    })
  return { nodes: [...column(level.spec.inputs, 'INPUT', 0), ...column(level.spec.outputs, 'OUTPUT', 520)], wires: [] }
}
