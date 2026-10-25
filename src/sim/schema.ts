import { checkLibrary } from './flatten.ts'
import { CircuitError, MAX_WIDTH, isPrimitive, toLibrary } from './types.ts'
import type { ChipDef, Circuit, CircuitNode, Endpoint, Wire } from './types.ts'

/**
 * Trust boundary: everything loaded from a file or localStorage goes through
 * here. Returns fresh objects with only known fields, or throws CircuitError.
 */

export const LIMITS = { bytes: 2 * 1024 * 1024, nodes: 5000, wires: 20_000, chips: 200, text: 40, levels: 100 }

export const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/

export interface Project {
  version: 1
  circuit: Circuit
  chips: ChipDef[]
}

const fail = (path: string, problem: string): never => {
  throw new CircuitError(`${path}: ${problem}`)
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'debe ser un objeto')
  return value as Record<string, unknown>
}

function array(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value)) fail(path, 'debe ser una lista')
  const list = value as unknown[]
  if (list.length > max) fail(path, `tiene más de ${max} elementos`)
  return list
}

function id(value: unknown, path: string): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) fail(path, 'id inválido (letras, números, "_" o "-")')
  return value as string
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'debe ser texto')
  const s = value as string
  if (s.length === 0 || s.length > LIMITS.text) fail(path, `debe tener de 1 a ${LIMITS.text} caracteres`)
  return s
}

function coordinate(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'debe ser un número')
  return value as number
}

function width(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > MAX_WIDTH) {
    fail(path, `debe ser un entero de 1 a ${MAX_WIDTH}`)
  }
  return value as number
}

function endpoint(value: unknown, path: string): Endpoint {
  const o = object(value, path)
  return { node: id(o.node, `${path}.node`), pin: id(o.pin, `${path}.pin`) }
}

export function parseCircuit(value: unknown, path = 'circuit'): Circuit {
  const o = object(value, path)
  const ids = new Set<string>()
  const nodes = array(o.nodes, `${path}.nodes`, LIMITS.nodes).map((raw, i): CircuitNode => {
    const at = `${path}.nodes[${i}]`
    const n = object(raw, at)
    const node: CircuitNode = { id: id(n.id, `${at}.id`), kind: id(n.kind, `${at}.kind`) }
    if (ids.has(node.id)) fail(`${at}.id`, `repetido ("${node.id}")`)
    ids.add(node.id)
    if (n.label !== undefined) node.label = text(n.label, `${at}.label`)
    if (n.width !== undefined) node.width = width(n.width, `${at}.width`)
    if (n.x !== undefined) node.x = coordinate(n.x, `${at}.x`)
    if (n.y !== undefined) node.y = coordinate(n.y, `${at}.y`)
    return node
  })
  const wires = array(o.wires, `${path}.wires`, LIMITS.wires).map((raw, i): Wire => {
    const at = `${path}.wires[${i}]`
    const w = object(raw, at)
    const wire = { from: endpoint(w.from, `${at}.from`), to: endpoint(w.to, `${at}.to`) }
    for (const end of [wire.from, wire.to]) {
      if (!ids.has(end.node)) fail(at, `el nodo "${end.node}" no existe`)
    }
    return wire
  })
  return { nodes, wires }
}

/** Progress kept in localStorage. */
export interface SaveData {
  version: 1
  solved: string[]
  chips: ChipDef[]
  drafts: Map<string, Circuit>
  sandbox: Circuit
}

export const emptySave = (): SaveData => ({
  version: 1,
  solved: [],
  chips: [],
  drafts: new Map(),
  sandbox: { nodes: [], wires: [] },
})

export const byteLength = (text: string) => new TextEncoder().encode(text).length

function parseJson(json: string, what: string): Record<string, unknown> {
  if (byteLength(json) > LIMITS.bytes) {
    throw new CircuitError(`El archivo pesa más de ${LIMITS.bytes / 1024 / 1024} MB`)
  }
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new CircuitError('El archivo no es JSON válido')
  }
  const o = object(data, what)
  if (o.version !== 1) fail('version', 'versión no soportada')
  return o
}

function parseChips(value: unknown): ChipDef[] {
  const chipIds = new Set<string>()
  const chips = array(value, 'chips', LIMITS.chips).map((raw, i): ChipDef => {
    const at = `chips[${i}]`
    const c = object(raw, at)
    const chip = { id: id(c.id, `${at}.id`), name: text(c.name, `${at}.name`), circuit: parseCircuit(c.circuit, `${at}.circuit`) }
    if (isPrimitive(chip.id) || chipIds.has(chip.id)) fail(`${at}.id`, `repetido ("${chip.id}")`)
    chipIds.add(chip.id)
    return chip
  })
  checkLibrary(toLibrary(chips))
  return chips
}

function checkKinds(circuit: Circuit, chips: ChipDef[]) {
  for (const node of circuit.nodes) {
    if (!isPrimitive(node.kind) && !chips.some((c) => c.id === node.kind)) {
      throw new CircuitError(`Tipo desconocido: "${node.kind}"`)
    }
  }
}

export function parseProject(json: string): Project {
  const o = parseJson(json, 'proyecto')
  const chips = parseChips(o.chips)
  const circuit = parseCircuit(o.circuit)
  checkKinds(circuit, chips)
  return { version: 1, circuit, chips }
}

export function parseSave(json: string): SaveData {
  const o = parseJson(json, 'progreso')
  const chips = parseChips(o.chips)
  const solved = array(o.solved, 'solved', LIMITS.levels).map((value, i) => id(value, `solved[${i}]`))
  const drafts = new Map<string, Circuit>()
  array(o.drafts, 'drafts', LIMITS.levels).forEach((raw, i) => {
    const d = object(raw, `drafts[${i}]`)
    drafts.set(id(d.level, `drafts[${i}].level`), parseCircuit(d.circuit, `drafts[${i}].circuit`))
  })
  const sandbox = parseCircuit(o.sandbox, 'sandbox')
  for (const circuit of [sandbox, ...drafts.values()]) checkKinds(circuit, chips)
  return { version: 1, solved, chips, drafts, sandbox }
}

export function serializeSave(save: SaveData): string {
  const drafts = [...save.drafts].map(([level, circuit]) => ({ level, circuit }))
  return JSON.stringify({ version: 1, solved: save.solved, chips: save.chips, drafts, sandbox: save.sandbox })
}
