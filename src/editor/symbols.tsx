import { GATE_H, GATE_W } from './gates.ts'
import type { GateShape } from './gates.ts'

/** Every symbol is drawn on the same 80×48 box, so the canvas and the palette icons share one drawing. */
const VIEW_BOX = `0 0 ${GATE_W} ${GATE_H}`

interface SymbolProps {
  /** `gate-svg` on the canvas; the palette passes its own to draw it small. */
  className?: string
}

interface GateProps extends SymbolProps {
  shape: GateShape
  inputsOn?: boolean[]
  outputOn?: boolean
}

export function GateSymbol({ shape, inputsOn = [], outputOn = false, className = 'gate-svg' }: GateProps) {
  return (
    <svg className={className} width={GATE_W} height={GATE_H} viewBox={VIEW_BOX} aria-hidden="true">
      {shape.inputs.map((y, i) => (
        <path key={y} className={`lead${inputsOn[i] ? ' on' : ''}`} d={`M0 ${y}H${shape.leadTo}`} />
      ))}
      <path className={`lead${outputOn ? ' on' : ''}`} d={`M${shape.outFrom} 24H${GATE_W}`} />
      {shape.back && <path className="gate-line" d={shape.back} />}
      <path className="gate-body" d={shape.body} />
      {shape.bubble !== undefined && <circle className="gate-body" cx={shape.bubble} cy="24" r="4" />}
    </svg>
  )
}

interface RelayProps extends SymbolProps {
  /** The contact touches: in passes to out. */
  closed: boolean
  coilOn?: boolean
  inOn?: boolean
  outOn?: boolean
}

/** The blade moves with the coil, so the player sees the switch close or open. */
export function RelaySymbol({ closed, coilOn = false, inOn = false, outOn = false, className = 'gate-svg' }: RelayProps) {
  return (
    <svg className={className} width={GATE_W} height={GATE_H} viewBox={VIEW_BOX} aria-hidden="true">
      <path className={`lead${inOn ? ' on' : ''}`} d="M0 14H22" />
      <path className={`lead${outOn ? ' on' : ''}`} d="M58 14H80" />
      <path className={`lead${coilOn ? ' on' : ''}`} d="M0 36H20" />
      <path className="relay-link" d={closed ? 'M30 30V15' : 'M30 30V12'} />
      <path className={`relay-blade${outOn ? ' on' : ''}`} d={closed ? 'M24 14L55 14' : 'M24 14L52 3'} />
      <circle className="relay-contact" cx="24" cy="14" r="2.5" />
      <circle className="relay-contact" cx="56" cy="14" r="2.5" />
      <rect className={`gate-body relay-coil${coilOn ? ' on' : ''}`} x="20" y="30" width="22" height="12" rx="1" />
      <path className="gate-line" d="M20 42L42 30" />
    </svg>
  )
}

export function BasicSymbol({ paths, className }: SymbolProps & { paths: string[] }) {
  return (
    <svg className={className} width={GATE_W} height={GATE_H} viewBox={VIEW_BOX} aria-hidden="true">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
