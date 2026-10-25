import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import type { Edge, EdgeProps } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'

export type WireData = { value: number; width: number; animate: boolean }
export type WireFlowEdge = Edge<WireData, 'wire'>

/** How long a packet takes to cross a wire. */
const PACKET_MS = 800
/** While a wire carries a non-zero value, a packet leaves this often. */
export const LOOP_MS = 2000

/**
 * A wire coloured by its value. While it carries something other than 0, a
 * packet travels from source to target every LOOP_MS; when it drops to 0, one
 * last grey packet goes through. Hidden by CSS when the user prefers reduced motion.
 */
export function WireEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps<WireFlowEdge>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const value = data?.value ?? 0
  const width = data?.width ?? 1
  const animate = data?.animate ?? false
  const on = value !== 0

  // Counting changes while rendering (not in an effect) avoids an extra render per wire.
  const [seen, setSeen] = useState(value)
  const [pulse, setPulse] = useState(0)
  if (seen !== value) {
    setSeen(value)
    setPulse(pulse + 1)
  }

  const motion = useRef<SVGAnimateMotionElement>(null)
  const fade = useRef<SVGAnimateElement>(null)
  const visible = animate && (on || pulse > 0)
  useEffect(() => {
    // Dynamically added SMIL animations start at document time 0, so start them by hand.
    if (!visible) return
    motion.current?.beginElement?.()
    fade.current?.beginElement?.()
  }, [visible, pulse])

  // Looping: cross in PACKET_MS, then wait at the end (invisible) for the rest of LOOP_MS.
  const cross = PACKET_MS / LOOP_MS
  const timing = on
    ? { dur: `${LOOP_MS}ms`, repeatCount: 'indefinite', keyTimes: `0;${cross};1` }
    : { dur: `${PACKET_MS}ms`, repeatCount: '1', keyTimes: '0;1' }

  const cls = `wire${on ? ' on' : ''}${width > 1 ? ' bus' : ''}${selected ? ' selected' : ''}`
  return (
    <>
      <BaseEdge id={id} path={path} className={cls} />
      {visible && (
        <circle key={pulse} r={width > 1 ? 5 : 4} className={`packet${on ? ' on' : ''}`} opacity={0}>
          <animateMotion
            ref={motion}
            begin="indefinite"
            path={path}
            calcMode="linear"
            keyPoints={on ? '0;1;1' : '0;1'}
            fill="freeze"
            {...timing}
          />
          <animate
            ref={fade}
            attributeName="opacity"
            begin="indefinite"
            calcMode="linear"
            values={on ? '1;1;0;0' : '1;1;0'}
            keyTimes={on ? `0;${cross * 0.8};${cross};1` : '0;0.8;1'}
            dur={timing.dur}
            repeatCount={timing.repeatCount}
            fill="freeze"
          />
        </circle>
      )}
      {width > 1 && (
        <EdgeLabelRenderer>
          <div className="bus-label nodrag nopan" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
            {value}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
