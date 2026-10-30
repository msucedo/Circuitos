import type { Pins } from '../sim/types.ts'

/** Logic gate symbols (ANSI style) drawn on a 80×48 box. */
export const GATE_W = 80
export const GATE_H = 48

export interface GateShape {
  /** Y of each input lead, top to bottom; the handles sit there. */
  inputs: number[]
  /** Where the input leads stop (they end behind the body). */
  leadTo: number
  /** Where the output lead starts. */
  outFrom: number
  body: string
  /** Extra stroke-only path (the second curve of XOR). */
  back?: string
  /** Center x of the negation bubble. */
  bubble?: number
}

const TWO = [16, 32]

export const GATE_SHAPES: Record<string, GateShape> = {
  AND: { inputs: TWO, leadTo: 14, outFrom: 56, body: 'M14 6H38A18 18 0 0 1 38 42H14Z' },
  NAND: { inputs: TWO, leadTo: 14, outFrom: 64, body: 'M14 6H38A18 18 0 0 1 38 42H14Z', bubble: 60 },
  OR: { inputs: TWO, leadTo: 20, outFrom: 58, body: 'M12 6Q30 6 58 24Q30 42 12 42Q22 24 12 6Z' },
  XOR: { inputs: TWO, leadTo: 15, outFrom: 62, body: 'M18 6Q36 6 62 24Q36 42 18 42Q28 24 18 6Z', back: 'M11 6Q21 24 11 42' },
  NOT: { inputs: [24], leadTo: 16, outFrom: 60, body: 'M16 8L52 24L16 40Z', bubble: 56 },
}

/** The gate symbol for a piece with these pins; a chip that only shares the name (other pins) keeps the box. */
export function gateShape(kind: string, pins: Pins): GateShape | undefined {
  const shape = GATE_SHAPES[kind]
  return shape && pins.inputs.length === shape.inputs.length && pins.outputs.length === 1 ? shape : undefined
}

/** Relay symbol: switch on top (in → out), coil below (c). Same 80×48 box. */
export const RELAY_PIN_Y: Record<string, number> = { in: 14, out: 14, c: 36 }
/** Normally closed relays conduct while the coil is off. */
export const RELAY_KINDS: Record<string, { normallyClosed: boolean }> = {
  RELAY: { normallyClosed: false },
  RELAY_NC: { normallyClosed: true },
}

/** Drawings of the other basic pieces, on the same box; only the palette draws them. */
export const BASIC_SYMBOLS: Record<string, string[]> = {
  // A switch: its knob, then the output lead.
  INPUT: ['M14 14H34A10 10 0 0 1 34 34H14A10 10 0 0 1 14 14Z', 'M34 19A5 5 0 1 1 34 29A5 5 0 1 1 34 19Z', 'M44 24H80'],
  // A lamp: the input lead into a round light.
  OUTPUT: ['M0 24H34', 'M46 12A12 12 0 1 1 46 36A12 12 0 1 1 46 12Z'],
  CLOCK: ['M6 34H20V14H36V34H52V14H68V34H76'],
  // A plus sign next to the power rail, which feeds the output.
  VCC: ['M12 24H28M20 16V32', 'M40 8V40', 'M40 24H80'],
  SPLIT: ['M0 24H28', 'M28 24L50 10H80', 'M28 24H80', 'M28 24L50 38H80'],
  JOIN: ['M0 10H30L52 24', 'M0 24H52', 'M0 38H30L52 24', 'M52 24H80'],
}

const ADDER_BOX = 'M24 8H56V40H24Z'
const PLUS = 'M34 24H46M40 18V30'
/** The short slash across a lead that marks it as a bus. */
const busMark = (x: number, y: number) => `M${x - 3} ${y + 4}L${x + 3} ${y - 4}`
const MUX_BODY = 'M28 4L52 14V34L28 44Z'
const DMUX_BODY = 'M28 14L52 4V44L28 34Z'
/** Where the slanted bottom edge of either trapezoid crosses its middle; `sel` comes in there. */
const SELECT = 'M40 39V48'

/** Level chips with a standard schematic symbol; chips without one (latches, RAM, ALU…) keep the name only. */
export const CHIP_SYMBOLS: Record<string, string[]> = {
  HALF_ADDER: [ADDER_BOX, PLUS, 'M4 18H24', 'M4 30H24', 'M56 18H76', 'M56 30H76'],
  FULL_ADDER: [ADDER_BOX, PLUS, 'M4 14H24', 'M4 24H24', 'M4 34H24', 'M56 18H76', 'M56 30H76'],
  ADDER4: [ADDER_BOX, PLUS, 'M4 18H24', busMark(14, 18), 'M4 30H24', busMark(14, 30), 'M56 18H76', busMark(66, 18), 'M56 30H76'],
  MUX: [MUX_BODY, 'M4 16H28', 'M4 32H28', 'M52 24H76', SELECT],
  MUX4: [MUX_BODY, 'M4 16H28', busMark(16, 16), 'M4 32H28', busMark(16, 32), 'M52 24H76', busMark(64, 24), SELECT],
  DMUX: [DMUX_BODY, 'M4 24H28', 'M52 16H76', 'M52 32H76', SELECT],
}

/** The chips made in the sandbox: a plain IC package with its notch, so they read as the player's own. */
export const CUSTOM_CHIP_SYMBOL: string[] = [
  'M28 6H52V42H28Z',
  'M36 6A4 4 0 0 0 44 6',
  'M18 14H28',
  'M18 24H28',
  'M18 34H28',
  'M52 14H62',
  'M52 24H62',
  'M52 34H62',
]
