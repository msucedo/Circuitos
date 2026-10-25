import type { Circuit, CircuitNode, Wire } from './types.ts'

/** `node` (pin `out`) or `node.pin`. */
type Ref = string

export interface PartSpec {
  kind: string
  in: Record<string, Ref>
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
}): Circuit {
  const nodes: CircuitNode[] = spec.inputs.map((id) => ({ id, kind: 'INPUT' }))
  const wires: Wire[] = []
  for (const [id, part] of Object.entries(spec.parts ?? {})) {
    nodes.push({ id, kind: part.kind })
    for (const [pin, ref] of Object.entries(part.in)) {
      wires.push({ from: endpoint(ref), to: { node: id, pin } })
    }
  }
  for (const [id, ref] of Object.entries(spec.outputs)) {
    nodes.push({ id, kind: 'OUTPUT' })
    wires.push({ from: endpoint(ref), to: { node: id, pin: 'in' } })
  }
  return { nodes, wires }
}
