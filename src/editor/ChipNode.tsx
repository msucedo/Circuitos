import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useRef, useState } from 'react'
import { nodePins } from '../sim/flatten.ts'
import { isPrimitive, widthOf } from '../sim/types.ts'
import type { Pin, Pins } from '../sim/types.ts'
import type { ChipFlowNode } from './convert.ts'
import { binary, kindName, useEditor } from './context.ts'
import { GATE_H, GATE_SHAPES, GATE_W, RELAY_KINDS, RELAY_PIN_Y } from './gates.ts'
import type { GateShape } from './gates.ts'

const NO_PINS: Pins = { inputs: [], outputs: [] }

const handleClass = (pin: Pin, on: boolean) => `${pin.width > 1 ? 'bus' : ''}${on ? ' on' : ''}`

/** Pin name of an INPUT/OUTPUT; double-click renames it when allowed. */
function PinName({ id, locked }: { id: string; locked: boolean }) {
  const { rename } = useEditor()
  const [draft, setDraft] = useState<string>()
  const [error, setError] = useState<string>()
  // Enter or Escape already decided; the blur that follows must not commit again.
  const settled = useRef(false)
  if (!rename || locked) return <span className="pin-name">{id}</span>
  if (draft === undefined) {
    return (
      <span
        className="pin-name renamable"
        title="Doble clic para renombrar"
        onDoubleClick={() => {
          settled.current = false
          setDraft(id)
        }}
      >
        {id}
      </span>
    )
  }
  const close = () => {
    settled.current = true
    setDraft(undefined)
  }
  const commit = () => {
    const name = draft.trim()
    if (name === id) return close()
    const problem = rename(id, name)
    if (problem) setError(problem)
    else close()
  }
  return (
    <span className="rename">
      <input
        className="nodrag"
        autoFocus
        value={draft}
        maxLength={64}
        aria-label={`Nuevo nombre para ${id}`}
        aria-invalid={error !== undefined}
        onChange={(e) => {
          setDraft(e.target.value)
          setError(undefined)
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') close()
        }}
        // Clicking elsewhere keeps the name, like Enter; an invalid one stays open with its error.
        onBlur={() => settled.current || commit()}
      />
      {error && <span className="rename-error">{error}</span>}
    </span>
  )
}

function GateSymbol({ shape, inputsOn, outputOn }: { shape: GateShape; inputsOn: boolean[]; outputOn: boolean }) {
  return (
    <svg className="gate-svg" width={GATE_W} height={GATE_H} viewBox={`0 0 ${GATE_W} ${GATE_H}`} aria-hidden="true">
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

interface RelayState {
  /** The contact touches: in passes to out. */
  closed: boolean
  coilOn: boolean
  inOn: boolean
  outOn: boolean
}

/** The blade moves with the coil, so the player sees the switch close or open. */
function RelaySymbol({ closed, coilOn, inOn, outOn }: RelayState) {
  return (
    <svg className="gate-svg" width={GATE_W} height={GATE_H} viewBox={`0 0 ${GATE_W} ${GATE_H}`} aria-hidden="true">
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

export function ChipNode({ id, data, selected, deletable }: NodeProps<ChipFlowNode>) {
  const { library, signals, incoming, inputs, setInput } = useEditor()
  const known = isPrimitive(data.kind) || library.has(data.kind)
  const pins = known ? nodePins(data, library) : NO_PINS
  const width = widthOf(data)
  const locked = deletable === false
  const cls = `chip kind-${known ? data.kind.toLowerCase() : 'missing'}${selected ? ' selected' : ''}`

  if (data.kind === 'INPUT') {
    const value = inputs.get(id) ?? 0
    const max = 2 ** width - 1
    return (
      <div className={cls}>
        {width === 1 ? (
          <button
            type="button"
            className={`switch nodrag${value ? ' on' : ''}`}
            aria-pressed={value === 1}
            aria-label={`entrada ${id}: ${value}`}
            onClick={() => setInput(id, value ? 0 : 1)}
          >
            {value}
          </button>
        ) : (
          <span className="bus-value">
            <input
              className="nodrag"
              type="number"
              min={0}
              max={max}
              value={value}
              aria-label={`entrada ${id} (${width} bits)`}
              onChange={(e) => setInput(id, Math.min(max, Math.max(0, Math.trunc(Number(e.target.value) || 0))))}
            />
            <small>{binary(value, width)}</small>
          </span>
        )}
        <PinName id={id} locked={locked} />
        <Handle type="source" position={Position.Right} id="out" className={handleClass(pins.outputs[0], value > 0)} />
      </div>
    )
  }

  if (data.kind === 'OUTPUT') {
    const value = signals.pin(id, 'in')
    return (
      <div className={cls}>
        <Handle type="target" position={Position.Left} id="in" className={handleClass(pins.inputs[0], value > 0)} />
        {width === 1 ? (
          <span className={`led${value ? ' on' : ''}`} role="img" aria-label={`salida ${id}: ${value}`} />
        ) : (
          <output className="bus-value" aria-label={`salida ${id}: ${value}`}>
            <strong>{value}</strong>
            <small>{binary(value, width)}</small>
          </output>
        )}
        <PinName id={id} locked={locked} />
      </div>
    )
  }

  const title = data.label ?? kindName(data.kind, library)
  const shape = known ? GATE_SHAPES[data.kind] : undefined
  // A chip that only shares the name (different pins) keeps the box.
  if (shape && width === 1 && pins.inputs.length === shape.inputs.length && pins.outputs.length === 1) {
    const out = pins.outputs[0]
    const inputsOn = pins.inputs.map((pin) => incoming(id, pin.name) > 0)
    const outputOn = signals.pin(id, out.name) > 0
    return (
      <div className={`gate kind-${data.kind.toLowerCase()}${selected ? ' selected' : ''}`} aria-label={`Compuerta ${title}`}>
        <div className="gate-frame">
          <GateSymbol shape={shape} inputsOn={inputsOn} outputOn={outputOn} />
          {pins.inputs.map((pin, i) => (
            <Handle
              key={pin.name}
              type="target"
              position={Position.Left}
              id={pin.name}
              className={handleClass(pin, inputsOn[i])}
              style={{ top: `${(shape.inputs[i] / GATE_H) * 100}%` }}
            />
          ))}
          <Handle type="source" position={Position.Right} id={out.name} className={handleClass(out, outputOn)} />
        </div>
        <div className="chip-title">{title}</div>
      </div>
    )
  }
  const relay = RELAY_KINDS[data.kind]
  if (relay) {
    const coilOn = incoming(id, 'c') > 0
    const outOn = signals.pin(id, 'out') > 0
    return (
      <div className={`gate kind-${data.kind.toLowerCase()}${selected ? ' selected' : ''}`} aria-label={title}>
        <div className="gate-frame">
          <RelaySymbol closed={coilOn !== relay.normallyClosed} coilOn={coilOn} inOn={incoming(id, 'in') > 0} outOn={outOn} />
          {pins.inputs.map((pin) => (
            <Handle
              key={pin.name}
              type="target"
              position={Position.Left}
              id={pin.name}
              className={handleClass(pin, incoming(id, pin.name) > 0)}
              style={{ top: `${(RELAY_PIN_Y[pin.name] / GATE_H) * 100}%` }}
            />
          ))}
          <Handle
            type="source"
            position={Position.Right}
            id="out"
            className={handleClass(pins.outputs[0], outOn)}
            style={{ top: `${(RELAY_PIN_Y.out / GATE_H) * 100}%` }}
          />
        </div>
        <div className="chip-title">{title}</div>
      </div>
    )
  }
  const showNames = (list: Pin[]) => list.length > 1 && data.kind !== 'NAND'
  return (
    <div className={cls}>
      <div className="chip-title">
        {known ? title : `¿${data.kind}?`}
        {width > 1 && <small> {width}</small>}
      </div>
      <div className="chip-pins">
        <div className="pins-in">
          {pins.inputs.map((pin) => (
            <div className="pin" key={pin.name}>
              <Handle type="target" position={Position.Left} id={pin.name} className={handleClass(pin, incoming(id, pin.name) > 0)} />
              {showNames(pins.inputs) ? pin.name : ''}
            </div>
          ))}
        </div>
        <div className="pins-out">
          {pins.outputs.map((pin) => (
            <div className="pin" key={pin.name}>
              {showNames(pins.outputs) ? pin.name : ''}
              <Handle
                type="source"
                position={Position.Right}
                id={pin.name}
                className={handleClass(pin, signals.pin(id, pin.name) > 0)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
