import { nodePins } from '../sim/flatten.ts'
import { isPrimitive } from '../sim/types.ts'
import type { ChipLibrary } from '../sim/types.ts'
import { BASIC_SYMBOLS, CHIP_SYMBOLS, CUSTOM_CHIP_SYMBOL, RELAY_KINDS, gateShape } from './gates.ts'
import { BasicSymbol, GateSymbol, RelaySymbol } from './symbols.tsx'

const CLASS = 'piece-icon'

/**
 * The piece's symbol, drawn small next to its name; none for level chips without one (latches, RAM, ALU…).
 * `custom` marks a chip the player saved in the sandbox, drawn with the standard chip icon.
 */
export function PieceIcon({ kind, library, custom = false }: { kind: string; library: ChipLibrary; custom?: boolean }) {
  if (custom) return <BasicSymbol paths={CUSTOM_CHIP_SYMBOL} className={`${CLASS} custom-chip`} />
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
