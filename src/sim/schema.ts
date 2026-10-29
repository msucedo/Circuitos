import { checkLibrary } from './flatten.ts'
import { CircuitError, MAX_WIDTH, isPrimitive, toLibrary } from './types.ts'
import type { ChipDef, Circuit, CircuitNode, Endpoint, ProblemCode, ProblemParams, Wire } from './types.ts'

/**
 * Trust boundary: everything loaded from a file or localStorage goes through
 * here. Returns fresh objects with only known fields, or throws CircuitError.
 */

export const LIMITS = {
  bytes: 2 * 1024 * 1024,
  nodes: 5000,
  wires: 20_000,
  chips: 200,
  text: 40,
  levels: 100,
  /** A gallery entry's description. */
  description: 200,
  /**
   * The data of a share link, already compressed. The issue that sends it to the gallery
   * carries it plus the name and the description, and must stay under `issueUrl`.
   */
  shareChars: 5000,
  /** About the longest URL GitHub accepts to open a prefilled issue. */
  issueUrl: 8000,
}

export const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/

export interface Project {
  version: 1
  circuit: Circuit
  chips: ChipDef[]
}

const fail = (path: string, code: ProblemCode, params: ProblemParams = {}): never => {
  throw new CircuitError(code, { path, ...params })
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'notObject')
  return value as Record<string, unknown>
}

function array(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value)) fail(path, 'notList')
  const list = value as unknown[]
  if (list.length > max) fail(path, 'tooMany', { max })
  return list
}

function id(value: unknown, path: string): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) fail(path, 'badId')
  return value as string
}

function text(value: unknown, path: string, max = LIMITS.text): string {
  if (typeof value !== 'string') fail(path, 'notText')
  const s = value as string
  if (s.length === 0 || s.length > max) fail(path, 'textLength', { max })
  return s
}

function coordinate(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'notNumber')
  return value as number
}

function width(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > MAX_WIDTH) {
    fail(path, 'badWidth', { max: MAX_WIDTH })
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
    if (ids.has(node.id)) fail(`${at}.id`, 'duplicate', { id: node.id })
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
      if (!ids.has(end.node)) fail(at, 'missingNode', { node: end.node })
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
    throw new CircuitError('fileTooBig', { mb: LIMITS.bytes / 1024 / 1024 })
  }
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new CircuitError('notJson')
  }
  const o = object(data, what)
  if (o.version !== 1) fail('version', 'badVersion')
  return o
}

function parseChips(value: unknown): ChipDef[] {
  const chipIds = new Set<string>()
  const chips = array(value, 'chips', LIMITS.chips).map((raw, i): ChipDef => {
    const at = `chips[${i}]`
    const c = object(raw, at)
    const chip = { id: id(c.id, `${at}.id`), name: text(c.name, `${at}.name`), circuit: parseCircuit(c.circuit, `${at}.circuit`) }
    if (isPrimitive(chip.id) || chipIds.has(chip.id)) fail(`${at}.id`, 'duplicate', { id: chip.id })
    chipIds.add(chip.id)
    return chip
  })
  checkLibrary(toLibrary(chips))
  return chips
}

function checkKinds(circuit: Circuit, chips: ChipDef[]) {
  for (const node of circuit.nodes) {
    if (!isPrimitive(node.kind) && !chips.some((c) => c.id === node.kind)) {
      throw new CircuitError('unknownKind', { kind: node.kind })
    }
  }
}

export function parseProject(json: string): Project {
  const o = parseJson(json, 'project')
  const chips = parseChips(o.chips)
  const circuit = parseCircuit(o.circuit)
  checkKinds(circuit, chips)
  return { version: 1, circuit, chips }
}

export function parseSave(json: string): SaveData {
  const o = parseJson(json, 'save')
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

/** A circuit in the gallery; its project lives in `src/gallery/circuits/<slug>.json`. */
export interface GalleryEntry {
  slug: string
  name: string
  description: string
  /** The GitHub user who sent it, if any. */
  author?: string
}

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/
const GITHUB_USER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/

export function parseGallery(value: unknown): GalleryEntry[] {
  const slugs = new Set<string>()
  return array(value, 'gallery', LIMITS.chips).map((raw, i): GalleryEntry => {
    const at = `gallery[${i}]`
    const o = object(raw, at)
    if (typeof o.slug !== 'string' || !SLUG_PATTERN.test(o.slug)) fail(`${at}.slug`, 'badId')
    const slug = o.slug as string
    if (slugs.has(slug)) fail(`${at}.slug`, 'duplicate', { id: slug })
    slugs.add(slug)
    const entry: GalleryEntry = {
      slug,
      name: text(o.name, `${at}.name`),
      description: text(o.description, `${at}.description`, LIMITS.description),
    }
    if (o.author !== undefined) {
      if (typeof o.author !== 'string' || !GITHUB_USER.test(o.author)) fail(`${at}.author`, 'badId')
      entry.author = o.author as string
    }
    return entry
  })
}
