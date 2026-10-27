import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { problemText } from '../i18n.ts'
import { nodePins } from '../sim/flatten.ts'
import { isPrimitive, widthOf } from '../sim/types.ts'
import type { Pin, Pins, Problem } from '../sim/types.ts'
import type { ChipFlowNode } from './convert.ts'
import { binary, kindName, useEditor } from './context.ts'
import { GATE_H, RELAY_KINDS, RELAY_PIN_Y, gateShape } from './gates.ts'
import { GateSymbol, RelaySymbol } from './symbols.tsx'

const NO_PINS: Pins = { inputs: [], outputs: [] }

const handleClass = (pin: Pin, on: boolean) => `${pin.width > 1 ? 'bus' : ''}${on ? ' on' : ''}`

/** Pin name of an INPUT/OUTPUT; double-click renames it when allowed. */
function PinName({ id, locked }: { id: string; locked: boolean }) {
  const { t } = useTranslation()
  const { rename } = useEditor()
  const [draft, setDraft] = useState<string>()
  const [error, setError] = useState<Problem>()
  // Enter or Escape already decided; the blur that follows must not commit again.
  const settled = useRef(false)
  if (!rename || locked) return <span className="pin-name">{id}</span>
  if (draft === undefined) {
    return (
      <span
        className="pin-name renamable"
        title={t('editor.rename')}
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
        aria-label={t('editor.newName', { id })}
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
      {error && <span className="rename-error">{problemText(t, error)}</span>}
    </span>
  )
}

export function ChipNode({ id, data, selected, deletable }: NodeProps<ChipFlowNode>) {
  const { t } = useTranslation()
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
            aria-label={t('editor.input', { id, value })}
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
              aria-label={t('editor.busInput', { id, width })}
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
          <span className={`led${value ? ' on' : ''}`} role="img" aria-label={t('editor.output', { id, value })} />
        ) : (
          <output className="bus-value" aria-label={t('editor.output', { id, value })}>
            <strong>{value}</strong>
            <small>{binary(value, width)}</small>
          </output>
        )}
        <PinName id={id} locked={locked} />
      </div>
    )
  }

  const title = data.label ?? kindName(t, data.kind, library)
  const shape = known && width === 1 ? gateShape(data.kind, pins) : undefined
  if (shape) {
    const out = pins.outputs[0]
    const inputsOn = pins.inputs.map((pin) => incoming(id, pin.name) > 0)
    const outputOn = signals.pin(id, out.name) > 0
    return (
      <div className={`gate kind-${data.kind.toLowerCase()}${selected ? ' selected' : ''}`} aria-label={t('editor.gate', { name: title })}>
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
