import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { pinsOf } from '../sim/flatten.ts'
import { isPrimitive } from '../sim/types.ts'
import type { Pins } from '../sim/types.ts'
import type { ChipFlowNode } from './convert.ts'
import { kindName, useEditor } from './context.ts'

const NO_PINS: Pins = { inputs: [], outputs: [] }

export function ChipNode({ id, data, selected }: NodeProps<ChipFlowNode>) {
  const { library, signals, inputs, toggleInput } = useEditor()
  const known = isPrimitive(data.kind) || library.has(data.kind)
  const pins = known ? pinsOf(data.kind, library) : NO_PINS
  const title = data.label ?? (data.kind === 'INPUT' || data.kind === 'OUTPUT' ? id : kindName(data.kind, library))
  const cls = `chip kind-${known ? data.kind.toLowerCase() : 'missing'}${selected ? ' selected' : ''}`

  if (data.kind === 'INPUT') {
    const on = inputs.get(id) ?? 0
    return (
      <div className={cls}>
        <button
          type="button"
          className={`switch nodrag${on ? ' on' : ''}`}
          aria-pressed={on === 1}
          aria-label={`entrada ${title}: ${on}`}
          onClick={() => toggleInput(id)}
        >
          {on}
        </button>
        <span className="pin-name">{title}</span>
        <Handle type="source" position={Position.Right} id="out" className={on ? 'on' : ''} />
      </div>
    )
  }

  if (data.kind === 'OUTPUT') {
    const on = signals.pin(id, 'in')
    return (
      <div className={cls}>
        <Handle type="target" position={Position.Left} id="in" />
        <span className={`led${on ? ' on' : ''}`} role="img" aria-label={`salida ${title}: ${on}`} />
        <span className="pin-name">{title}</span>
      </div>
    )
  }

  return (
    <div className={cls}>
      <div className="chip-title">{known ? title : `¿${data.kind}?`}</div>
      <div className="chip-pins">
        <div className="pins-in">
          {pins.inputs.map((pin) => (
            <div className="pin" key={pin}>
              <Handle type="target" position={Position.Left} id={pin} />
              {pins.inputs.length > 1 && data.kind !== 'NAND' ? pin : ''}
            </div>
          ))}
        </div>
        <div className="pins-out">
          {pins.outputs.map((pin) => (
            <div className="pin" key={pin}>
              {pins.outputs.length > 1 ? pin : ''}
              <Handle type="source" position={Position.Right} id={pin} className={signals.pin(id, pin) ? 'on' : ''} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
