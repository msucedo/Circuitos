import { nodePins } from '../sim/flatten.ts'
import { isPrimitive } from '../sim/types.ts'
import type { ChipLibrary } from '../sim/types.ts'
import { BASIC_SYMBOLS, CHIP_SYMBOLS, RELAY_KINDS, gateShape } from './gates.ts'
import { BasicSymbol, GateSymbol, RelaySymbol } from './symbols.tsx'

const CLASS = 'piece-icon'

/** The piece's symbol, drawn small next to its name; none for chips without one (latches, RAM, ALU…). */
export function PieceIcon({ kind, library }: { kind: string; library: ChipLibrary }) {
  // Same rule as the canvas: only a known piece whose pins fit the gate gets its symbol. Sandbox
  // chips have their own ids (U_…), so a level chip's symbol never goes to one that shares its name.
  const known = isPrimitive(kind) || library.has(kind)
  if (!known) return null
  const shape = gateShape(kind, nodePins({ kind }, library))
  if (shape) return <GateSymbol shape={shape} className={CLASS} />
  const relay = RELAY_KINDS[kind]
  if (relay) return <RelaySymbol closed={relay.normallyClosed} className={CLASS} />
  const paths = BASIC_SYMBOLS[kind] ?? CHIP_SYMBOLS[kind]
  return paths ? <BasicSymbol paths={paths} className={CLASS} /> : null
}
