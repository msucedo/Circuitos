import { CircuitError, PRIMITIVE_PINS, isPrimitive } from './types.ts'
import type { ChipLibrary, Circuit, CircuitNode, Endpoint, Pins, Wire } from './types.ts'

export const MAX_DEPTH = 16
export const MAX_FLAT_NODES = 200_000

export function chipPins(circuit: Circuit): Pins {
  const ids = (kind: string) => circuit.nodes.filter((n) => n.kind === kind).map((n) => n.id)
  return { inputs: ids('INPUT'), outputs: ids('OUTPUT') }
}

export function pinsOf(kind: string, library: ChipLibrary): Pins {
  if (isPrimitive(kind)) return PRIMITIVE_PINS[kind]
  const chip = library.get(kind)
  if (!chip) throw new CircuitError(`Tipo desconocido: "${kind}"`)
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
  /** For every top-level wire source (`pinKey`), the gate that really drives it; undefined if nothing does. */
  probes: Map<string, Endpoint | undefined>
}

/**
 * Expands every chip into its NAND/CLOCK gates so one simulator handles any
 * circuit. A chip's inner INPUT/OUTPUT nodes become aliases that are wired
 * straight through; node ids inside a chip are prefixed with `chipId/`.
 */
export function flatten(circuit: Circuit, library: ChipLibrary): FlatCircuit {
  const nodes: CircuitNode[] = []
  const aliases = new Set<string>()
  const drivers = new Map<string, Wire>()
  const topSources = new Map<string, Endpoint>()
  let count = 0

  const expand = (current: Circuit, prefix: string, chain: string[]) => {
    const kindOf = new Map<string, string>()
    for (const node of current.nodes) {
      if (kindOf.has(node.id)) throw new CircuitError(`Id repetido: "${node.id}"`)
      kindOf.set(node.id, node.kind)
      if (++count > MAX_FLAT_NODES) {
        throw new CircuitError(`El circuito es demasiado grande (más de ${MAX_FLAT_NODES} piezas)`)
      }
      const id = prefix + node.id
      if (isPrimitive(node.kind)) {
        if (prefix && (node.kind === 'INPUT' || node.kind === 'OUTPUT')) aliases.add(id)
        else nodes.push({ ...node, id })
        continue
      }
      const chip = library.get(node.kind)
      if (!chip) throw new CircuitError(`Tipo desconocido: "${node.kind}"`)
      if (chain.includes(node.kind)) throw new CircuitError(`El chip "${chip.name}" se contiene a sí mismo`)
      if (chain.length >= MAX_DEPTH) throw new CircuitError(`Más de ${MAX_DEPTH} niveles de chips anidados`)
      expand(chip.circuit, `${id}/`, [...chain, node.kind])
    }

    const end = (ep: Endpoint, side: 'inputs' | 'outputs'): Endpoint => {
      const kind = kindOf.get(ep.node)
      if (kind === undefined) throw new CircuitError(`Cable a un nodo que no existe: "${ep.node}"`)
      if (!pinsOf(kind, library)[side].includes(ep.pin)) {
        const what = side === 'inputs' ? 'entrada' : 'salida'
        throw new CircuitError(`"${ep.node}" no tiene ${what} "${ep.pin}"`)
      }
      if (isPrimitive(kind)) return { node: prefix + ep.node, pin: ep.pin }
      // A chip pin is the alias of the matching INPUT/OUTPUT node inside the chip.
      return { node: `${prefix}${ep.node}/${ep.pin}`, pin: side === 'inputs' ? 'in' : 'out' }
    }

    for (const wire of current.wires) {
      const to = end(wire.to, 'inputs')
      const key = pinKey(to.node, to.pin)
      if (drivers.has(key)) {
        throw new CircuitError(`La entrada "${wire.to.pin}" de "${wire.to.node}" tiene dos cables`)
      }
      const from = end(wire.from, 'outputs')
      drivers.set(key, { from, to })
      if (!prefix) topSources.set(pinKey(wire.from.node, wire.from.pin), from)
    }
  }
  expand(circuit, '', [])

  /** Follows aliases back to a real gate; undefined means the pin is unconnected. */
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
  const probes = new Map([...topSources].map(([key, from]) => [key, resolve(from)]))
  return { nodes, wires, probes }
}
