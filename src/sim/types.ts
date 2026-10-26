export type Bit = 0 | 1

/** Kinds the simulator runs directly; everything else is flattened into these. */
export type GateKind = 'NAND' | 'INPUT' | 'OUTPUT' | 'CLOCK'

/** Pieces below NAND (a power source and relays); `builtins.ts` defines them in NAND. */
export const BUILTIN_KINDS = ['VCC', 'RELAY', 'RELAY_NC'] as const
export type BuiltinKind = (typeof BUILTIN_KINDS)[number]

/** Built-in kinds: gates, SPLIT/JOIN (which only rearrange the bits of a bus) and the builtins. */
export type PrimitiveKind = GateKind | 'SPLIT' | 'JOIN' | BuiltinKind

export const MAX_WIDTH = 16

/** Buses of the block 3 levels: 4-bit words, and 2-bit selectors that pick one of 4. */
export const WORD = 4
export const SELECTOR = 2

export interface CircuitNode {
  id: string
  kind: string
  label?: string
  /** Bits carried by INPUT/OUTPUT/SPLIT/JOIN; 1 when missing. */
  width?: number
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

export interface Pin {
  name: string
  width: number
}

export interface Pins {
  inputs: Pin[]
  outputs: Pin[]
}

/** Pin names of each gate; `out` is the only output pin. All gate pins are 1 bit. */
export const GATE_PINS: Record<GateKind, { inputs: string[]; outputs: string[] }> = {
  NAND: { inputs: ['a', 'b'], outputs: ['out'] },
  INPUT: { inputs: [], outputs: ['out'] },
  OUTPUT: { inputs: ['in'], outputs: [] },
  CLOCK: { inputs: [], outputs: ['out'] },
}

export function isGate(kind: string): kind is GateKind {
  return Object.hasOwn(GATE_PINS, kind)
}

export function isPrimitive(kind: string): kind is PrimitiveKind {
  return isGate(kind) || kind === 'SPLIT' || kind === 'JOIN' || (BUILTIN_KINDS as readonly string[]).includes(kind)
}

export const widthOf = (node: Pick<CircuitNode, 'width'>) => node.width ?? 1

/** Flat id of bit `i` of a node: the node itself when it is 1 bit wide. `#` can't appear in ids. */
export const bitNode = (id: string, i: number, width: number) => (width === 1 ? id : `${id}#${i}`)

/**
 * Every problem the user can be told about. The simulator stays language-free:
 * it reports a code and its values, and the UI turns them into a sentence.
 */
export type ProblemCode =
  // File and save validation (`path` says where)
  | 'notObject'
  | 'notList'
  | 'tooMany'
  | 'badId'
  | 'notText'
  | 'textLength'
  | 'notNumber'
  | 'badWidth'
  | 'duplicate'
  | 'missingNode'
  | 'badVersion'
  | 'fileTooBig'
  | 'notJson'
  | 'chipConflict'
  // Building and simulating a circuit
  | 'unknownKind'
  | 'selfContaining'
  | 'tooDeep'
  | 'nestedTooDeep'
  | 'duplicateId'
  | 'tooBig'
  | 'busTooNarrow'
  | 'missingWireNode'
  | 'noInputPin'
  | 'noOutputPin'
  | 'widthMismatch'
  | 'twoWires'
  | 'wireLoop'
  | 'noSuchInput'
  | 'noSuchOutput'
  | 'noSuchNode'
  // Checking a circuit against a level
  | 'missingInput'
  | 'missingOutput'
  | 'extraInput'
  | 'extraOutput'
  | 'inputWidth'
  | 'outputWidth'
  | 'tableTooWide'
  // Editing and saving
  | 'badName'
  | 'nameTaken'
  | 'chipNeedsOutput'
  | 'storageBlocked'
  | 'saveUnreadable'
  | 'saveTooBig'
  | 'saveFailed'
  | 'backupFailed'

export type ProblemParams = Record<string, string | number>

export interface Problem {
  code: ProblemCode
  params: ProblemParams
}

export const problem = (code: ProblemCode, params: ProblemParams = {}): Problem => ({ code, params })

/** Structural problem in a circuit. The message is for developers; the UI translates `code`. */
export class CircuitError extends Error implements Problem {
  override name = 'CircuitError'
  readonly code: ProblemCode
  readonly params: ProblemParams

  constructor(code: ProblemCode, params: ProblemParams = {}) {
    super(`${code} ${JSON.stringify(params)}`)
    this.code = code
    this.params = params
  }
}
