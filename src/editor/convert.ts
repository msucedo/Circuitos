import type { Connection, Edge, Node } from '@xyflow/react'
import { nodePins } from '../sim/flatten.ts'
import { ID_PATTERN } from '../sim/schema.ts'
import { problem } from '../sim/types.ts'
import type { ChipLibrary, Circuit, Problem } from '../sim/types.ts'

export interface ChipData extends Record<string, unknown> {
  kind: string
  label?: string
  width?: number
}

export type ChipFlowNode = Node<ChipData, 'chip'>

type Ends = { source: string; sourceHandle?: string | null; target: string; targetHandle?: string | null }

export const edgeId = (c: Ends) => `${c.source}.${c.sourceHandle}->${c.target}.${c.targetHandle}`

function nodeData(n: Circuit['nodes'][number]): ChipData {
  const data: ChipData = { kind: n.kind }
  if (n.label !== undefined) data.label = n.label
  if (n.width !== undefined && n.width !== 1) data.width = n.width
  return data
}

export function toFlow(circuit: Circuit, locked: ReadonlySet<string> = new Set()) {
  const nodes: ChipFlowNode[] = circuit.nodes.map((n) => ({
    id: n.id,
    type: 'chip',
    position: { x: n.x ?? 0, y: n.y ?? 0 },
    data: nodeData(n),
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
      ...(n.data.width === undefined ? {} : { width: n.data.width }),
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
    })),
    wires: edges.map((e) => ({
      from: { node: e.source, pin: e.sourceHandle ?? 'out' },
      to: { node: e.target, pin: e.targetHandle ?? 'in' },
    })),
  }
}

/** Width of a pin, or undefined if the node or pin doesn't exist. */
export function pinWidth(
  node: ChipFlowNode | undefined,
  pin: string | null | undefined,
  side: 'inputs' | 'outputs',
  library: ChipLibrary,
): number | undefined {
  if (!node || !pin) return undefined
  try {
    return nodePins(node.data, library)[side].find((p) => p.name === pin)?.width
  } catch {
    return undefined
  }
}

/** An input pin takes a single wire of its own width; an output can feed any number of inputs. */
export function canConnect(edges: Edge[], c: Connection | Edge, nodes: ChipFlowNode[], library: ChipLibrary): boolean {
  if (!c.sourceHandle || !c.targetHandle) return false
  if (edges.some((e) => e.target === c.target && e.targetHandle === c.targetHandle)) return false
  const byId = (id: string) => nodes.find((n) => n.id === id)
  const from = pinWidth(byId(c.source), c.sourceHandle, 'outputs', library)
  return from !== undefined && from === pinWidth(byId(c.target), c.targetHandle, 'inputs', library)
}

/** First free id like `nand1`, `xor3`: valid for the schema (starts with a letter). */
export function nextId(kind: string, taken: ReadonlySet<string>): string {
  const prefix = kind.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'n'
  const base = /^[a-z]/.test(prefix) ? prefix : `n${prefix}`
  let i = 1
  while (taken.has(`${base}${i}`)) i++
  return `${base}${i}`
}

/** Renames a node (a pin name, for INPUT/OUTPUT) and its wires; returns the problem if the name is not usable. */
export function renameNode(
  nodes: ChipFlowNode[],
  edges: Edge[],
  from: string,
  to: string,
): { nodes: ChipFlowNode[]; edges: Edge[] } | Problem {
  if (to === from) return { nodes, edges }
  if (!ID_PATTERN.test(to)) return problem('badName')
  if (nodes.some((n) => n.id === to)) return problem('nameTaken', { name: to })
  const swap = (id: string) => (id === from ? to : id)
  return {
    nodes: nodes.map((n) => (n.id === from ? { ...n, id: to } : n)),
    edges: edges.map((e) => {
      const c = { source: swap(e.source), sourceHandle: e.sourceHandle, target: swap(e.target), targetHandle: e.targetHandle }
      return { ...e, ...c, id: edgeId(c) }
    }),
  }
}

/** Selected nodes and the wires between them. */
export function copySelection(nodes: ChipFlowNode[], edges: Edge[]): Circuit | undefined {
  const picked = nodes.filter((n) => n.selected)
  if (picked.length === 0) return undefined
  const ids = new Set(picked.map((n) => n.id))
  return toCircuit(
    picked,
    edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
  )
}

export const PASTE_OFFSET = 40

/**
 * Copies of the clipboard nodes with fresh ids, shifted and selected. Kinds the
 * current palette doesn't offer (a level's pins, a locked chip) are left out.
 */
export function pasteCircuit(
  clip: Circuit,
  existing: ChipFlowNode[],
  allowed: ReadonlySet<string>,
): { nodes: ChipFlowNode[]; edges: Edge[] } {
  const taken = new Set(existing.map((n) => n.id))
  const rename = new Map<string, string>()
  const nodes: ChipFlowNode[] = []
  for (const n of clip.nodes) {
    if (!allowed.has(n.kind)) continue
    const id = nextId(n.kind, taken)
    taken.add(id)
    rename.set(n.id, id)
    nodes.push({
      id,
      type: 'chip',
      position: { x: (n.x ?? 0) + PASTE_OFFSET, y: (n.y ?? 0) + PASTE_OFFSET },
      data: nodeData(n),
      selected: true,
    })
  }
  const edges: Edge[] = clip.wires.flatMap(({ from, to }) => {
    const source = rename.get(from.node)
    const target = rename.get(to.node)
    if (!source || !target) return []
    const c = { source, sourceHandle: from.pin, target, targetHandle: to.pin }
    return [{ id: edgeId(c), ...c }]
  })
  return { nodes, edges }
}
