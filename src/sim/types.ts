export type Bit = 0 | 1

export type PrimitiveKind = 'NAND' | 'INPUT' | 'OUTPUT' | 'CLOCK'

export interface CircuitNode {
  id: string
  kind: string
  label?: string
  x?: number
  y?: number
}

export interface Endpoint {
  node: string
  pin: string
}

export interface Wire {
  from: Endpoint
  to: Endpoint
}

export interface Circuit {
  nodes: CircuitNode[]
  wires: Wire[]
}

/** A saved circuit used as a block; its pins are its INPUT/OUTPUT node ids, in order. */
export interface ChipDef {
  id: string
  name: string
  circuit: Circuit
}

/** A Map, not an object, so ids like "constructor" can never hit the prototype. */
export type ChipLibrary = Map<string, ChipDef>

export const toLibrary = (chips: ChipDef[]): ChipLibrary => new Map(chips.map((chip) => [chip.id, chip]))

export interface Pins {
  inputs: string[]
  outputs: string[]
}

/** Pins of each primitive; `out` is the only output pin. */
export const PRIMITIVE_PINS: Record<PrimitiveKind, Pins> = {
  NAND: { inputs: ['a', 'b'], outputs: ['out'] },
  INPUT: { inputs: [], outputs: ['out'] },
  OUTPUT: { inputs: ['in'], outputs: [] },
  CLOCK: { inputs: [], outputs: ['out'] },
}

export function isPrimitive(kind: string): kind is PrimitiveKind {
  return Object.hasOwn(PRIMITIVE_PINS, kind)
}

/** Structural problem in a circuit; the message is shown to the user. */
export class CircuitError extends Error {
  override name = 'CircuitError'
}
