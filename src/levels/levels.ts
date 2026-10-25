import type { Spec } from '../sim/verify.ts'
import { toLibrary } from '../sim/types.ts'
import type { ChipDef, ChipLibrary, Circuit } from '../sim/types.ts'
import { SPECS } from './specs.ts'

export interface Level {
  /** Also the id of the chip that solving the level unlocks. */
  id: string
  name: string
  goal: string
  hint?: string
  spec: Spec
  /** Primitive pieces offered besides the unlocked chips; NAND when missing. */
  parts?: string[]
  /** Optional levels never lock the ones after them, so adding one keeps old progress playable. */
  optional?: boolean
  /** False when solving the level adds no chip (its circuit is already a primitive). */
  chip?: boolean
}

const level = (id: string, name: string, goal: string, hint?: string, extra?: Partial<Level>): Level => ({
  id,
  name,
  goal,
  hint,
  spec: SPECS.get(id)!,
  ...extra,
})

export const LEVELS: Level[] = [
  level(
    'RELAY_NAND',
    'Relés',
    'Nivel 0 (opcional): arma la NAND con relés. Un relé deja pasar su entrada in solo mientras su bobina c está en 1; el inverso, solo mientras está en 0.',
    'Dos relés en serie desde la fuente dan a AND b; un relé inverso, también desde la fuente, lo invierte.',
    { parts: ['VCC', 'RELAY', 'RELAY_NC'], optional: true, chip: false },
  ),
  level('NOT', 'NOT', 'Saca lo contrario de la entrada: 0 → 1 y 1 → 0.', 'NAND da 0 solo cuando sus dos entradas son 1.'),
  level('AND', 'AND', 'La salida es 1 solo si a y b son 1.', 'Es lo contrario de un NAND.'),
  level('OR', 'OR', 'La salida es 1 si a, b o ambas son 1.', 'Invierte las dos entradas antes de un NAND.'),
  level('XOR', 'XOR', 'La salida es 1 si a y b son distintas.', 'Se puede con 4 NAND.'),
  level('HALF_ADDER', 'Medio sumador', 'Suma dos bits: sum es el resultado y carry el acarreo (1 + 1 = 10).'),
  level('FULL_ADDER', 'Sumador completo', 'Suma a + b + cin, el acarreo que viene de la columna anterior.', 'Dos medios sumadores y un OR.'),
  level('ADDER4', 'Sumador de 4 bits', 'Suma dos números de 4 bits (a3..a0 y b3..b0) más cin.', 'Encadena el cout de cada sumador al cin del siguiente.'),
  level(
    'SR_LATCH',
    'Latch SR',
    'Tu primera memoria. Las entradas se activan en 0: s=0 guarda 1, r=0 guarda 0, y con ambas en 1 recuerda. Q y QB son opuestas.',
    'Dos NAND que se alimentan entre sí.',
  ),
  level('D_LATCH', 'Latch D', 'Mientras en=1, q copia a d; cuando en=0, q recuerda el último valor.'),
  level('D_FLIPFLOP', 'Flip-flop D', 'q toma el valor de d solo cuando clk sube de 0 a 1.', 'Dos latches D: uno abierto con clk=0 y otro con clk=1.'),
]

export const levelById = (id: string) => LEVELS.find((l) => l.id === id)

/** Unlocked once the closest earlier level that isn't optional is solved. */
export function isUnlocked(level: Level, solved: ReadonlySet<string>): boolean {
  const before = LEVELS.slice(0, LEVELS.indexOf(level)).findLast((l) => !l.optional)
  return before === undefined || solved.has(before.id)
}

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

/** Starting circuit: the level's pins, already placed. */
export function levelCircuit(level: Level): Circuit {
  const column = (ids: string[], kind: string, x: number) => ids.map((id, i) => ({ id, kind, x, y: i * 70 }))
  return { nodes: [...column(level.spec.inputs, 'INPUT', 0), ...column(level.spec.outputs, 'OUTPUT', 520)], wires: [] }
}
