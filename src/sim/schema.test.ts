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
    expect(() => parseProject('{nope')).toThrow(/notJson/)
    expect(() => parseProject(' '.repeat(LIMITS.bytes + 1))).toThrow(/fileTooBig \{"mb":2\}/)
    bad({ ...project, version: 2 }, /badVersion/)
    bad([], /notObject \{"path":"project"\}/)
  })

  it('rejects bad ids, text and numbers, with the path to the problem', () => {
    const node = (extra: object) => ({ ...project, circuit: { nodes: [{ id: 'a', kind: 'INPUT', ...extra }], wires: [] } })
    bad(node({ id: 'a/b' }), /badId \{"path":"circuit\.nodes\[0\]\.id"\}/)
    bad(node({ id: '__proto__' }), /badId/)
    bad(node({ kind: 42 }), /badId \{"path":"circuit\.nodes\[0\]\.kind"\}/)
    bad(node({ label: 'x'.repeat(LIMITS.text + 1) }), /textLength \{"path":"circuit\.nodes\[0\]\.label","max":40\}/)
    bad(node({ x: 'left' }), /notNumber \{"path":"circuit\.nodes\[0\]\.x"\}/)
    bad({ ...project, circuit: { nodes: [{ id: 'a', kind: 'INPUT' }, { id: 'a', kind: 'NAND' }], wires: [] } }, /duplicate /)
  })

  it('rejects wires to nodes that do not exist', () => {
    const wires = [{ from: { node: 'a', pin: 'out' }, to: { node: 'ghost', pin: 'in' } }]
    bad({ ...project, circuit: { nodes: [{ id: 'a', kind: 'INPUT' }], wires } }, /missingNode .*"node":"ghost"/)
  })

  it('enforces size limits', () => {
    const nodes = Array.from({ length: LIMITS.nodes + 1 }, (_, i) => ({ id: `n${i}`, kind: 'NAND' }))
    bad({ ...project, circuit: { nodes, wires: [] } }, /tooMany .*"max":5000/)
  })

  it('rejects unknown kinds, duplicate chips and chips that contain themselves', () => {
    bad({ ...project, chips: [] }, /unknownKind \{"kind":"HALF_ADDER"\}/)
    bad({ ...project, chips: [...project.chips, project.chips[0]] }, new RegExp(`duplicate \\{"path":"chips\\[${project.chips.length}\\]\\.id"`))
    bad({ ...project, chips: [{ id: 'NAND', name: 'x', circuit: { nodes: [], wires: [] } }] }, /duplicate .*"id":"NAND"/)
    const loop = { id: 'LOOP', name: 'Bucle', circuit: { nodes: [{ id: 'x', kind: 'LOOP' }], wires: [] } }
    bad({ ...project, chips: [loop] }, /selfContaining \{"name":"Bucle"\}/)
  })
})
