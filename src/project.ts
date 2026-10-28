import { checkLibrary } from './sim/flatten.ts'
import { LIMITS, parseProject } from './sim/schema.ts'
import type { Project } from './sim/schema.ts'
import { CircuitError, isPrimitive, toLibrary } from './sim/types.ts'
import type { ChipDef, ChipLibrary, Circuit } from './sim/types.ts'

/** Reads a picked file as text, refusing one over the size limit before reading it. */
export async function readJsonFile(file: Blob): Promise<string> {
  if (file.size > LIMITS.bytes) throw new CircuitError('fileTooBig', { mb: LIMITS.bytes / 1024 / 1024 })
  return file.text()
}

/** The circuit plus every chip it uses, directly or inside other chips. */
export function exportProject(circuit: Circuit, library: ChipLibrary): Project {
  const needed = new Map<string, ChipDef>()
  const visit = (c: Circuit) => {
    for (const node of c.nodes) {
      const chip = isPrimitive(node.kind) ? undefined : library.get(node.kind)
      if (chip && !needed.has(chip.id)) {
        visit(chip.circuit)
        needed.set(chip.id, chip)
      }
    }
  }
  visit(circuit)
  return { version: 1, circuit, chips: [...needed.values()] }
}

const sameCircuit = (a: Circuit, b: Circuit) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Validates an imported file and returns the chips to add. A chip whose id the
 * user already has with a different circuit is refused rather than overwritten.
 */
export function importProject(json: string, mine: ChipDef[]): { circuit: Circuit; added: ChipDef[] } {
  const project = parseProject(json)
  const existing = toLibrary(mine)
  const added: ChipDef[] = []
  for (const chip of project.chips) {
    const current = existing.get(chip.id)
    if (!current) added.push(chip)
    else if (!sameCircuit(current.circuit, chip.circuit)) {
      throw new CircuitError('chipConflict', { id: chip.id })
    }
  }
  checkLibrary(toLibrary([...mine, ...added]))
  return { circuit: project.circuit, added }
}

/** A schema-valid, unused id derived from the chip name: "Mi sumador" → "U_MI_SUMADOR". */
export function chipIdFor(name: string, taken: ReadonlySet<string>): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  const base = `U_${slug || 'CHIP'}`
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}

/** Who uses a chip: other chips (by name) and the sandbox circuit. Empty means it can be deleted. */
export function chipUsers(id: string, chips: ChipDef[], sandbox: Circuit): { chips: ChipDef[]; sandbox: boolean } {
  const uses = (c: Circuit) => c.nodes.some((n) => n.kind === id)
  return { chips: chips.filter((c) => c.id !== id && uses(c.circuit)), sandbox: uses(sandbox) }
}
