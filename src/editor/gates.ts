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
