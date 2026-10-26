import type { Circuit, CircuitNode, Wire } from './types.ts'

/** `node` (pin `out`) or `node.pin`. */
type Ref = string

export interface PartSpec {
  kind: string
  in: Record<string, Ref>
  /** Bus width of a SPLIT or JOIN. */
  width?: number
}

export function nand(a: Ref, b: Ref): PartSpec {
  return { kind: 'NAND', in: { a, b } }
}

function endpoint(ref: Ref) {
  const dot = ref.lastIndexOf('.')
  return dot === -1 ? { node: ref, pin: 'out' } : { node: ref.slice(0, dot), pin: ref.slice(dot + 1) }
}

/** Compact way to write circuits in code (tests, examples, level solutions). */
export function build(spec: {
  inputs: string[]
  parts?: Record<string, PartSpec>
  outputs: Record<string, Ref>
  /** Widths of input and output pins other than 1. */
  widths?: Record<string, number>
}): Circuit {
  const sized = (node: CircuitNode, width = spec.widths?.[node.id]): CircuitNode => (width ? { ...node, width } : node)
  const nodes: CircuitNode[] = spec.inputs.map((id) => sized({ id, kind: 'INPUT' }))
  const wires: Wire[] = []
  for (const [id, part] of Object.entries(spec.parts ?? {})) {
    nodes.push(sized({ id, kind: part.kind }, part.width))
    for (const [pin, ref] of Object.entries(part.in)) {
      wires.push({ from: endpoint(ref), to: { node: id, pin } })
    }
  }
  for (const [id, ref] of Object.entries(spec.outputs)) {
    nodes.push(sized({ id, kind: 'OUTPUT' }))
    wires.push({ from: endpoint(ref), to: { node: id, pin: 'in' } })
  }
  return { nodes, wires }
}
