import { BUILTINS } from './builtins.ts'
import { CircuitError, bitNode, isPrimitive, widthOf } from './types.ts'
import type { ChipDef, ChipLibrary, Circuit, CircuitNode, Endpoint, Pin, Pins, Wire } from './types.ts'

export const MAX_DEPTH = 16
export const MAX_FLAT_NODES = 200_000

const one = (name: string): Pin => ({ name, width: 1 })
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

/** Builtins first: the schema already keeps user chips from taking a builtin's id. */
const chipOf = (kind: string, library: ChipLibrary): ChipDef | undefined => BUILTINS.get(kind) ?? library.get(kind)

/** Pins of a chip: its INPUT/OUTPUT nodes, in order, with their widths. */
export function chipPins(circuit: Circuit): Pins {
  const pins = (kind: string) =>
    circuit.nodes.filter((n) => n.kind === kind).map((n) => ({ name: n.id, width: widthOf(n) }))
  return { inputs: pins('INPUT'), outputs: pins('OUTPUT') }
}

/** Pins of a node; the bus kinds depend on the node's width. */
export function nodePins(node: Pick<CircuitNode, 'kind' | 'width'>, library: ChipLibrary): Pins {
  const width = widthOf(node)
  const bits = range(width).map((i) => one(`b${i}`))
  switch (node.kind) {
    case 'NAND':
      return { inputs: [one('a'), one('b')], outputs: [one('out')] }
    case 'CLOCK':
      return { inputs: [], outputs: [one('out')] }
    case 'INPUT':
      return { inputs: [], outputs: [{ name: 'out', width }] }
    case 'OUTPUT':
      return { inputs: [{ name: 'in', width }], outputs: [] }
    case 'SPLIT':
      return { inputs: [{ name: 'in', width }], outputs: bits }
    case 'JOIN':
      return { inputs: bits, outputs: [{ name: 'out', width }] }
  }
  const chip = chipOf(node.kind, library)
  if (!chip) throw new CircuitError(`Tipo desconocido: "${node.kind}"`)
  return chipPins(chip.circuit)
}

/** Rejects unknown chips, chips that contain themselves and nesting deeper than MAX_DEPTH. */
export function checkLibrary(library: ChipLibrary) {
  const depthOf = new Map<string, number>()
  const visiting = new Set<string>()
  const visit = (id: string): number => {
    const known = depthOf.get(id)
    if (known !== undefined) return known
    const chip = library.get(id)
    if (!chip) throw new CircuitError(`Tipo desconocido: "${id}"`)
    if (visiting.has(id)) throw new CircuitError(`El chip "${chip.name}" se contiene a sí mismo`)
    visiting.add(id)
    let depth = 1
    for (const node of chip.circuit.nodes) {
      if (!isPrimitive(node.kind)) depth = Math.max(depth, 1 + visit(node.kind))
    }
    visiting.delete(id)
    if (depth > MAX_DEPTH) throw new CircuitError(`"${chip.name}" anida más de ${MAX_DEPTH} niveles de chips`)
    depthOf.set(id, depth)
    return depth
  }
  for (const id of library.keys()) visit(id)
}

export const pinKey = (node: string, pin: string) => `${node}\0${pin}`

export interface FlatCircuit extends Circuit {
  /** For every top-level wire source (`pinKey`), the gate driving each bit (LSB first); undefined if nothing does. */
  probes: Map<string, (Endpoint | undefined)[]>
}

/**
 * Expands chips and buses into single-bit NAND/CLOCK gates so one simulator
 * handles any circuit. Bit `i` of a bus node becomes `id#i`. A chip's inner
 * INPUT/OUTPUT nodes and every SPLIT/JOIN bit become aliases wired straight
 * through; node ids inside a chip are prefixed with `chipId/`.
 */
export function flatten(circuit: Circuit, library: ChipLibrary): FlatCircuit {
  const nodes: CircuitNode[] = []
  const aliases = new Set<string>()
  const drivers = new Map<string, Wire>()
  const topSources = new Map<string, Endpoint[]>()
  let count = 0

  const expand = (current: Circuit, prefix: string, chain: string[]) => {
    const byId = new Map<string, CircuitNode>()
    for (const node of current.nodes) {
      if (byId.has(node.id)) throw new CircuitError(`Id repetido: "${node.id}"`)
      byId.set(node.id, node)
      const id = prefix + node.id
      const width = widthOf(node)
      count += width
      if (count > MAX_FLAT_NODES) {
        throw new CircuitError(`El circuito es demasiado grande (más de ${MAX_FLAT_NODES} piezas)`)
      }
      switch (node.kind) {
        case 'NAND':
        case 'CLOCK':
          nodes.push({ id, kind: node.kind })
          continue
        case 'INPUT':
        case 'OUTPUT':
          for (const i of range(width)) {
            if (prefix) aliases.add(bitNode(id, i, width))
            else nodes.push({ id: bitNode(id, i, width), kind: node.kind })
          }
          continue
        case 'SPLIT':
        case 'JOIN':
          if (width < 2) throw new CircuitError(`"${node.id}" necesita un bus de al menos 2 bits`)
          for (const i of range(width)) aliases.add(bitNode(id, i, width))
          continue
      }
      const chip = chipOf(node.kind, library)
      if (!chip) throw new CircuitError(`Tipo desconocido: "${node.kind}"`)
      if (chain.includes(node.kind)) throw new CircuitError(`El chip "${chip.name}" se contiene a sí mismo`)
      if (chain.length >= MAX_DEPTH) throw new CircuitError(`Más de ${MAX_DEPTH} niveles de chips anidados`)
      expand(chip.circuit, `${id}/`, [...chain, node.kind])
    }

    /** The flat single-bit endpoints behind a pin, LSB first. */
    const bits = (ep: Endpoint, side: 'inputs' | 'outputs'): Endpoint[] => {
      const node = byId.get(ep.node)
      if (!node) throw new CircuitError(`Cable a un nodo que no existe: "${ep.node}"`)
      const pin = nodePins(node, library)[side].find((p) => p.name === ep.pin)
      if (!pin) throw new CircuitError(`"${ep.node}" no tiene ${side === 'inputs' ? 'entrada' : 'salida'} "${ep.pin}"`)
      const id = prefix + node.id
      const width = widthOf(node)
      const all = (pinName: string) => range(width).map((i) => ({ node: bitNode(id, i, width), pin: pinName }))
      const bitOf = (pinName: string) => [{ node: bitNode(id, Number(ep.pin.slice(1)), width), pin: pinName }]
      switch (node.kind) {
        case 'NAND':
        case 'CLOCK':
          return [{ node: id, pin: ep.pin }]
        case 'INPUT':
        case 'OUTPUT':
          return all(ep.pin)
        case 'SPLIT':
          return side === 'inputs' ? all('in') : bitOf('out')
        case 'JOIN':
          return side === 'inputs' ? bitOf('in') : all('out')
      }
      // A chip pin is the alias of the matching INPUT/OUTPUT node inside the chip.
      const inner = `${id}/${ep.pin}`
      return range(pin.width).map((i) => ({ node: bitNode(inner, i, pin.width), pin: side === 'inputs' ? 'in' : 'out' }))
    }

    for (const wire of current.wires) {
      const to = bits(wire.to, 'inputs')
      const from = bits(wire.from, 'outputs')
      if (to.length !== from.length) {
        throw new CircuitError(
          `Un cable de ${from.length} bit(s) no entra en "${wire.to.pin}" de "${wire.to.node}", que es de ${to.length}`,
        )
      }
      to.forEach((t, i) => {
        const key = pinKey(t.node, t.pin)
        if (drivers.has(key)) {
          throw new CircuitError(`La entrada "${wire.to.pin}" de "${wire.to.node}" tiene dos cables`)
        }
        drivers.set(key, { from: from[i], to: t })
      })
      if (!prefix) topSources.set(pinKey(wire.from.node, wire.from.pin), from)
    }
  }
  expand(circuit, '', [])

  /** Follows aliases back to a real gate; undefined means the bit is unconnected. */
  const resolve = (from: Endpoint): Endpoint | undefined => {
    const seen = new Set<string>()
    while (aliases.has(from.node)) {
      if (seen.has(from.node)) throw new CircuitError('Hay un bucle de cables sin ninguna compuerta')
      seen.add(from.node)
      const wire = drivers.get(pinKey(from.node, 'in'))
      if (!wire) return undefined
      from = wire.from
    }
    return from
  }

  const wires: Wire[] = []
  for (const wire of drivers.values()) {
    if (aliases.has(wire.to.node)) continue
    const from = resolve(wire.from)
    if (from) wires.push({ from, to: wire.to })
  }
  const probes = new Map([...topSources].map(([key, from]) => [key, from.map(resolve)]))
  return { nodes, wires, probes }
}
