import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import type { Edge, EdgeProps } from '@xyflow/react'
import { useEffect, useMemo, useRef, useState } from 'react'

export type WireData = { value: number; width: number; animate: boolean }
export type WireFlowEdge = Edge<WireData, 'wire'>

/** Packets move at the same speed on every wire, so long wires don't look faster. */
const PX_PER_MS = 0.25
/** The packet fades out over the same time on every wire, so the fade never reads as braking. */
const FADE_MS = 120
/** While a wire carries a non-zero value, a packet leaves this often (longer wires wait for the last one). */
export const LOOP_MS = 2000
const LOOP_GAP_MS = 600

/** Real length of the drawn curve; jsdom can't measure, so it falls back to the straight distance. */
function pathLength(d: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  el.setAttribute('d', d)
  return typeof el.getTotalLength === 'function' ? el.getTotalLength() : fallback
}

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

  // Looping: cross in packetMs, then wait at the end (invisible) for the rest of the loop.
  const length = useMemo(() => pathLength(path, Math.hypot(targetX - sourceX, targetY - sourceY)), [path, sourceX, sourceY, targetX, targetY])
  const packetMs = Math.max(1, Math.round(length / PX_PER_MS))
  const loopMs = Math.max(LOOP_MS, packetMs + LOOP_GAP_MS)
  const cross = packetMs / loopMs
  const fadeStart = Math.max(0, packetMs - FADE_MS)

  // A new length restarts the packet: retiming a running SMIL animation makes it jump.
  const run = `${pulse}-${packetMs}`
  const motion = useRef<SVGAnimateMotionElement>(null)
  const fade = useRef<SVGAnimateElement>(null)
  const visible = animate && (on || pulse > 0)
  useEffect(() => {
    // Dynamically added SMIL animations start at document time 0, so start them by hand.
    if (!visible) return
    motion.current?.beginElement?.()
    fade.current?.beginElement?.()
  }, [visible, run])
  const timing = on
    ? { dur: `${loopMs}ms`, repeatCount: 'indefinite', keyTimes: `0;${cross};1` }
    : { dur: `${packetMs}ms`, repeatCount: '1', keyTimes: '0;1' }

  const cls = `wire${on ? ' on' : ''}${width > 1 ? ' bus' : ''}${selected ? ' selected' : ''}`
  return (
    <>
      <BaseEdge id={id} path={path} className={cls} />
      <path d={path} className="wire-flash" />
      {visible && (
        <circle key={run} r={width > 1 ? 5 : 4} className={`packet${on ? ' on' : ''}`} opacity={0}>
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
            keyTimes={on ? `0;${fadeStart / loopMs};${cross};1` : `0;${fadeStart / packetMs};1`}
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
