import type { Connection, Edge, Node } from '@xyflow/react'
import type { Circuit } from '../sim/types.ts'

export interface ChipData extends Record<string, unknown> {
  kind: string
  label?: string
}

export type ChipFlowNode = Node<ChipData, 'chip'>

export const edgeId = (c: Pick<Connection, 'source' | 'sourceHandle' | 'target' | 'targetHandle'>) =>
  `${c.source}.${c.sourceHandle}->${c.target}.${c.targetHandle}`

export function toFlow(circuit: Circuit, locked: ReadonlySet<string> = new Set()) {
  const nodes: ChipFlowNode[] = circuit.nodes.map((n) => ({
    id: n.id,
    type: 'chip',
    position: { x: n.x ?? 0, y: n.y ?? 0 },
    data: n.label === undefined ? { kind: n.kind } : { kind: n.kind, label: n.label },
    deletable: !locked.has(n.id),
  }))
  const edges: Edge[] = circuit.wires.map(({ from, to }) => {
    const c = { source: from.node, sourceHandle: from.pin, target: to.node, targetHandle: to.pin }
    return { id: edgeId(c), ...c }
  })
  return { nodes, edges }
}

export function toCircuit(nodes: ChipFlowNode[], edges: Edge[]): Circuit {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      kind: n.data.kind,
      ...(n.data.label === undefined ? {} : { label: n.data.label }),
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
    })),
    wires: edges.map((e) => ({
      from: { node: e.source, pin: e.sourceHandle ?? 'out' },
      to: { node: e.target, pin: e.targetHandle ?? 'in' },
    })),
  }
}

/** An input pin takes a single wire; an output can feed any number of inputs. */
export function canConnect(edges: Edge[], c: Connection | Edge): boolean {
  if (!c.sourceHandle || !c.targetHandle) return false
  return !edges.some((e) => e.target === c.target && e.targetHandle === c.targetHandle)
}

/** First free id like `nand1`, `xor3`: valid for the schema (starts with a letter). */
export function nextId(kind: string, taken: ReadonlySet<string>): string {
  const prefix = kind.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'n'
  const base = /^[a-z]/.test(prefix) ? prefix : `n${prefix}`
  let i = 1
  while (taken.has(`${base}${i}`)) i++
  return `${base}${i}`
}
