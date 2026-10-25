import { describe, expect, it } from 'vitest'
import { FULL_ADDER, LIBRARY } from './examples.ts'
import { LIMITS, parseProject } from './schema.ts'
import type { Project } from './schema.ts'

const project: Project = { version: 1, circuit: FULL_ADDER, chips: [...LIBRARY.values()] }
const json = (value: unknown) => JSON.stringify(value)
const bad = (value: unknown, message: RegExp) => expect(() => parseProject(json(value))).toThrow(message)

describe('parseProject', () => {
  it('accepts a valid project and returns the same data', () => {
    expect(parseProject(json(project))).toEqual(project)
  })

  it('keeps only known fields', () => {
    const extra = { ...project, evil: true, circuit: { ...project.circuit, extra: 1 } }
    const parsed = parseProject(json(extra))
    expect(parsed).not.toHaveProperty('evil')
    expect(parsed.circuit).not.toHaveProperty('extra')
    const proto = parseProject('{"version":1,"chips":[],"circuit":{"nodes":[],"wires":[]},"__proto__":{"x":1}}')
    expect(Object.getPrototypeOf(proto)).toBe(Object.prototype)
  })

  it('rejects files that are not JSON, too big, or another version', () => {
    expect(() => parseProject('{nope')).toThrow(/no es JSON/)
    expect(() => parseProject(' '.repeat(LIMITS.bytes + 1))).toThrow(/pesa más de 2 MB/)
    bad({ ...project, version: 2 }, /versión no soportada/)
    bad([], /proyecto: debe ser un objeto/)
  })

  it('rejects bad ids, text and numbers, with the path to the problem', () => {
    const node = (extra: object) => ({ ...project, circuit: { nodes: [{ id: 'a', kind: 'INPUT', ...extra }], wires: [] } })
    bad(node({ id: 'a/b' }), /circuit\.nodes\[0\]\.id: id inválido/)
    bad(node({ id: '__proto__' }), /id inválido/)
    bad(node({ kind: 42 }), /\.kind: id inválido/)
    bad(node({ label: 'x'.repeat(LIMITS.text + 1) }), /\.label: debe tener de 1 a 40/)
    bad(node({ x: 'left' }), /\.x: debe ser un número/)
    bad({ ...project, circuit: { nodes: [{ id: 'a', kind: 'INPUT' }, { id: 'a', kind: 'NAND' }], wires: [] } }, /repetido/)
  })

  it('rejects wires to nodes that do not exist', () => {
    const wires = [{ from: { node: 'a', pin: 'out' }, to: { node: 'ghost', pin: 'in' } }]
    bad({ ...project, circuit: { nodes: [{ id: 'a', kind: 'INPUT' }], wires } }, /"ghost" no existe/)
  })

  it('enforces size limits', () => {
    const nodes = Array.from({ length: LIMITS.nodes + 1 }, (_, i) => ({ id: `n${i}`, kind: 'NAND' }))
    bad({ ...project, circuit: { nodes, wires: [] } }, /más de 5000 elementos/)
  })

  it('rejects unknown kinds, duplicate chips and chips that contain themselves', () => {
    bad({ ...project, chips: [] }, /Tipo desconocido: "HALF_ADDER"/)
    bad({ ...project, chips: [...project.chips, project.chips[0]] }, /chips\[7\]\.id: repetido/)
    bad({ ...project, chips: [{ id: 'NAND', name: 'x', circuit: { nodes: [], wires: [] } }] }, /repetido \("NAND"\)/)
    const loop = { id: 'LOOP', name: 'Bucle', circuit: { nodes: [{ id: 'x', kind: 'LOOP' }], wires: [] } }
    bad({ ...project, chips: [loop] }, /"Bucle" se contiene a sí mismo/)
  })
})
