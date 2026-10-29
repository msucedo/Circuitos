import { describe, expect, it, vi } from 'vitest'
import { chipConflicts, chipIdFor, chipUsers, exportProject, importProject, readJsonFile, renameChip } from './project.ts'
import { LIMITS, parseProject } from './sim/schema.ts'
import { FULL_ADDER, LIBRARY, XOR } from './sim/examples.ts'

describe('export / import', () => {
  it('exports only the chips the circuit uses, dependencies first, and imports them back unchanged', () => {
    const project = exportProject(FULL_ADDER, LIBRARY)
    expect(project.chips.map((c) => c.id)).toEqual(['XOR', 'AND', 'HALF_ADDER', 'OR'])
    const { circuit, added } = importProject(project, [])
    expect(circuit).toEqual(FULL_ADDER)
    expect(added).toEqual(project.chips)
  })

  it('skips chips the user already has with the same circuit', () => {
    const project = exportProject(FULL_ADDER, LIBRARY)
    expect(importProject(project, [...LIBRARY.values()]).added).toEqual([])
  })

  it('refuses a chip whose id the user already has with a different circuit', () => {
    const project = exportProject(FULL_ADDER, LIBRARY)
    const mine = [{ id: 'XOR', name: 'XOR', circuit: { ...XOR, wires: [] } }]
    expect(chipConflicts(project, mine).map((c) => c.id)).toEqual(['XOR'])
    expect(() => importProject(project, mine)).toThrow(/chipConflict \{"id":"XOR"\}/)
  })

  it('imports a conflicting chip once renamed, with every use pointing to the new id', () => {
    const project = exportProject(FULL_ADDER, LIBRARY)
    const mine = [{ id: 'XOR', name: 'XOR', circuit: { ...XOR, wires: [] } }]
    const renamed = renameChip(project, 'XOR', 'Su XOR', new Set(mine.map((c) => c.id)))
    expect(chipConflicts(renamed, mine)).toEqual([])
    const { added } = importProject(renamed, mine)
    expect(added.find((c) => c.id === 'U_SU_XOR')).toMatchObject({ name: 'Su XOR', circuit: XOR })
    const uses = (id: string) => added.flatMap((c) => c.circuit.nodes).filter((n) => n.kind === id).length
    expect(uses('XOR')).toBe(0)
    expect(uses('U_SU_XOR')).toBeGreaterThan(0)
    // Still a valid project after the rename.
    expect(parseProject(JSON.stringify(renamed))).toEqual(renamed)
  })

  it('never renames onto an id the user or the project already has', () => {
    const project = exportProject(FULL_ADDER, LIBRARY)
    const renamed = renameChip(project, 'XOR', 'x', new Set(['U_X']))
    expect(renamed.chips.map((c) => c.id)).toContain('U_X_2')
  })
})

describe('readJsonFile', () => {
  it('reads a file within the limit', async () => {
    await expect(readJsonFile(new Blob(['{"a":1}']))).resolves.toBe('{"a":1}')
  })

  it('refuses a bigger file before reading it', async () => {
    const big = new Blob([new Uint8Array(LIMITS.bytes + 1)])
    const text = vi.spyOn(big, 'text')
    await expect(readJsonFile(big)).rejects.toMatchObject({ code: 'fileTooBig' })
    expect(text).not.toHaveBeenCalled()
  })
})

describe('chipIdFor', () => {
  it('derives a valid, unused id from any name', () => {
    expect(chipIdFor('Mi sumador', new Set())).toBe('U_MI_SUMADOR')
    expect(chipIdFor('Mi sumador', new Set(['U_MI_SUMADOR']))).toBe('U_MI_SUMADOR_2')
    expect(chipIdFor('Señal ñandú', new Set())).toBe('U_SENAL_NANDU')
    expect(chipIdFor('🙂<script>', new Set())).toBe('U_SCRIPT')
    expect(chipIdFor('!!!', new Set())).toBe('U_CHIP')
  })
})

describe('chipUsers', () => {
  it('lists the chips and the sandbox that use a chip', () => {
    const chips = [...LIBRARY.values()]
    const ids = (users: ReturnType<typeof chipUsers>) => ({ chips: users.chips.map((c) => c.id), sandbox: users.sandbox })
    expect(ids(chipUsers('XOR', chips, { nodes: [], wires: [] }))).toEqual({ chips: ['HALF_ADDER'], sandbox: false })
    expect(ids(chipUsers('ADDER4', chips, FULL_ADDER))).toEqual({ chips: [], sandbox: false })
    expect(ids(chipUsers('HALF_ADDER', chips, FULL_ADDER))).toEqual({ chips: ['FULL_ADDER', 'INC4'], sandbox: true })
  })
})
