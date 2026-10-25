import { describe, expect, it } from 'vitest'
import { XOR } from '../sim/examples.ts'
import { canConnect, nextId, toCircuit, toFlow } from './convert.ts'

describe('convert', () => {
  it('round-trips a circuit through React Flow nodes and edges', () => {
    const placed = { ...XOR, nodes: XOR.nodes.map((n, i) => ({ ...n, x: i * 10, y: 5 })) }
    const { nodes, edges } = toFlow(placed)
    expect(toCircuit(nodes, edges)).toEqual(placed)
  })

  it('marks locked nodes as not deletable', () => {
    const { nodes } = toFlow(XOR, new Set(['a']))
    expect(nodes.find((n) => n.id === 'a')?.deletable).toBe(false)
    expect(nodes.find((n) => n.id === 'n')?.deletable).toBe(true)
  })

  it('lets an input pin take only one wire, while outputs fan out', () => {
    const { edges } = toFlow(XOR)
    expect(canConnect(edges, { source: 'b', sourceHandle: 'out', target: 'n', targetHandle: 'a' })).toBe(false)
    expect(canConnect(edges, { source: 'a', sourceHandle: 'out', target: 'out', targetHandle: 'in' })).toBe(false)
    const free = edges.filter((e) => e.target !== 'out')
    expect(canConnect(free, { source: 'a', sourceHandle: 'out', target: 'out', targetHandle: 'in' })).toBe(true)
    expect(canConnect(free, { source: 'a', sourceHandle: null, target: 'out', targetHandle: 'in' })).toBe(false)
  })

  it('creates readable ids that the schema accepts', () => {
    expect(nextId('NAND', new Set(['nand1', 'nand2']))).toBe('nand3')
    expect(nextId('HALF_ADDER', new Set())).toBe('half_adder1')
    expect(nextId('U_2X', new Set())).toBe('u_2x1')
  })
})
