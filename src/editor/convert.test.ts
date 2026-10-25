import { describe, expect, it } from 'vitest'
import { LIBRARY, XOR } from '../sim/examples.ts'
import type { Circuit } from '../sim/types.ts'
import { canConnect, copySelection, nextId, pasteCircuit, renameNode, toCircuit, toFlow } from './convert.ts'

const BUS: Circuit = {
  nodes: [
    { id: 'a', kind: 'INPUT', width: 4 },
    { id: 's', kind: 'SPLIT', width: 4 },
    { id: 'j', kind: 'JOIN', width: 8 },
    { id: 'n', kind: 'NAND' },
  ],
  wires: [],
}

describe('convert', () => {
  it('round-trips a circuit, widths included, through React Flow nodes and edges', () => {
    for (const circuit of [XOR, BUS]) {
      const placed = { ...circuit, nodes: circuit.nodes.map((n, i) => ({ ...n, x: i * 10, y: 5 })) }
      const { nodes, edges } = toFlow(placed)
      expect(toCircuit(nodes, edges)).toEqual(placed)
    }
  })

  it('marks locked nodes as not deletable', () => {
    const { nodes } = toFlow(XOR, new Set(['a']))
    expect(nodes.find((n) => n.id === 'a')?.deletable).toBe(false)
    expect(nodes.find((n) => n.id === 'n')?.deletable).toBe(true)
  })

  it('lets an input pin take only one wire, while outputs fan out', () => {
    const { nodes, edges } = toFlow(XOR)
    const can = (es: typeof edges, source: string, target: string, targetHandle: string) =>
      canConnect(es, { source, sourceHandle: 'out', target, targetHandle }, nodes, LIBRARY)
    expect(can(edges, 'b', 'n', 'a')).toBe(false)
    expect(can(edges, 'a', 'out', 'in')).toBe(false)
    const free = edges.filter((e) => e.target !== 'out')
    expect(can(free, 'a', 'out', 'in')).toBe(true)
    expect(canConnect(free, { source: 'a', sourceHandle: null, target: 'out', targetHandle: 'in' }, nodes, LIBRARY)).toBe(false)
  })

  it('only connects pins of the same width', () => {
    const { nodes } = toFlow(BUS)
    const can = (source: string, sourceHandle: string, target: string, targetHandle: string) =>
      canConnect([], { source, sourceHandle, target, targetHandle }, nodes, LIBRARY)
    expect(can('a', 'out', 's', 'in')).toBe(true)
    expect(can('a', 'out', 'n', 'a')).toBe(false)
    expect(can('s', 'b2', 'n', 'a')).toBe(true)
    expect(can('s', 'b2', 'j', 'b7')).toBe(true)
    expect(can('a', 'out', 'j', 'b0')).toBe(false)
  })

  it('creates readable ids that the schema accepts', () => {
    expect(nextId('NAND', new Set(['nand1', 'nand2']))).toBe('nand3')
    expect(nextId('HALF_ADDER', new Set())).toBe('half_adder1')
    expect(nextId('U_2X', new Set())).toBe('u_2x1')
  })
})

describe('renameNode', () => {
  it('renames a pin and rewires it', () => {
    const { nodes, edges } = toFlow(XOR)
    const result = renameNode(nodes, edges, 'a', 'p')
    if (typeof result === 'string') throw new Error(result)
    const circuit = toCircuit(result.nodes, result.edges)
    expect(circuit.nodes.map((n) => n.id)).toEqual(['p', 'b', 'n', 'x', 'y', 'z', 'out'])
    expect(circuit.wires.filter((w) => w.from.node === 'p')).toHaveLength(2)
    expect(result.edges.every((e) => !e.id.includes('a.out'))).toBe(true)
  })

  it('refuses invalid or taken names', () => {
    const { nodes, edges } = toFlow(XOR)
    expect(renameNode(nodes, edges, 'a', 'b')).toBe('Ya existe "b"')
    expect(renameNode(nodes, edges, 'a', '1x')).toMatch(/empezando con letra/)
    expect(renameNode(nodes, edges, 'a', 'a/b')).toMatch(/letras, números/)
  })
})

describe('copy and paste', () => {
  it('copies the selection with its inner wires and pastes it with fresh ids', () => {
    const { nodes, edges } = toFlow(XOR)
    const selected = nodes.map((n) => ({ ...n, selected: ['a', 'n', 'x'].includes(n.id) }))
    const clip = copySelection(selected, edges)!
    expect(clip.nodes.map((n) => n.id)).toEqual(['a', 'n', 'x'])
    expect(clip.wires).toHaveLength(3) // a→n.a, a→x.a, n→x.b
    const pasted = pasteCircuit(clip, nodes, new Set(['INPUT', 'NAND']))
    expect(pasted.nodes.map((n) => n.id)).toEqual(['input1', 'nand1', 'nand2'])
    expect(pasted.nodes.every((n) => n.selected)).toBe(true)
    expect(pasted.edges.map((e) => `${e.source}>${e.target}.${e.targetHandle}`)).toEqual([
      'input1>nand1.a',
      'input1>nand2.a',
      'nand1>nand2.b',
    ])
  })

  it('leaves out kinds the palette does not offer, and their wires', () => {
    const { nodes, edges } = toFlow(XOR)
    const clip = copySelection(nodes.map((n) => ({ ...n, selected: true })), edges)!
    const pasted = pasteCircuit(clip, nodes, new Set(['NAND']))
    expect(pasted.nodes.map((n) => n.data.kind)).toEqual(['NAND', 'NAND', 'NAND', 'NAND'])
    expect(pasted.edges).toHaveLength(4) // n→x, n→y, x→z, y→z
  })

  it('copies nothing when nothing is selected', () => {
    const { nodes, edges } = toFlow(XOR)
    expect(copySelection(nodes, edges)).toBeUndefined()
  })
})
