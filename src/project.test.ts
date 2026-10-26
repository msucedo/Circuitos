import { describe, expect, it } from 'vitest'
import { chipIdFor, chipUsers, exportProject, importProject } from './project.ts'
import { FULL_ADDER, LIBRARY, XOR } from './sim/examples.ts'

describe('export / import', () => {
  it('exports only the chips the circuit uses, dependencies first, and imports them back unchanged', () => {
    const project = exportProject(FULL_ADDER, LIBRARY)
    expect(project.chips.map((c) => c.id)).toEqual(['XOR', 'AND', 'HALF_ADDER', 'OR'])
    const { circuit, added } = importProject(JSON.stringify(project), [])
    expect(circuit).toEqual(FULL_ADDER)
    expect(added).toEqual(project.chips)
  })

  it('skips chips the user already has with the same circuit', () => {
    const project = exportProject(FULL_ADDER, LIBRARY)
    expect(importProject(JSON.stringify(project), [...LIBRARY.values()]).added).toEqual([])
  })

  it('refuses a chip whose id the user already has with a different circuit', () => {
    const json = JSON.stringify(exportProject(FULL_ADDER, LIBRARY))
    const mine = [{ id: 'XOR', name: 'XOR', circuit: { ...XOR, wires: [] } }]
    expect(() => importProject(json, mine)).toThrow(/chipConflict \{"id":"XOR"\}/)
  })

  it('rejects invalid files through the schema', () => {
    expect(() => importProject('{"version":1}', [])).toThrow(/notList \{"path":"chips"\}/)
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
