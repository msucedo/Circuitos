import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useState } from 'react'
import { nodePins } from '../sim/flatten.ts'
import { isPrimitive, widthOf } from '../sim/types.ts'
import type { Pin, Pins } from '../sim/types.ts'
import type { ChipFlowNode } from './convert.ts'
import { binary, kindName, useEditor } from './context.ts'

const NO_PINS: Pins = { inputs: [], outputs: [] }

const handleClass = (pin: Pin, on: boolean) => `${pin.width > 1 ? 'bus' : ''}${on ? ' on' : ''}`

/** Pin name of an INPUT/OUTPUT; double-click renames it when allowed. */
function PinName({ id, locked }: { id: string; locked: boolean }) {
  const { rename } = useEditor()
  const [draft, setDraft] = useState<string>()
  const [error, setError] = useState<string>()
  if (!rename || locked) return <span className="pin-name">{id}</span>
  if (draft === undefined) {
    return (
      <span className="pin-name renamable" title="Doble clic para renombrar" onDoubleClick={() => setDraft(id)}>
        {id}
      </span>
    )
  }
  const commit = () => {
    const problem = rename(id, draft.trim())
    if (problem) setError(problem)
    else setDraft(undefined)
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
          if (e.key === 'Escape') setDraft(undefined)
        }}
        onBlur={() => setDraft(undefined)}
      />
      {error && <span className="rename-error">{error}</span>}
    </span>
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
