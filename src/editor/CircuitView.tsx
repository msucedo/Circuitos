import { ReactFlow, ReactFlowProvider, useNodesInitialized, useNodesState, useReactFlow, useStore } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, useState } from 'react'
import type { ChipLibrary, Circuit } from '../sim/types.ts'
import { play } from '../sound.ts'
import { EditorContext } from './context.ts'
import type { EditorState } from './context.ts'
import { toFlow, toWires } from './convert.ts'
import { edgeTypes, nodeTypes } from './flowTypes.ts'
import { useSimulation } from './useSimulation.ts'
import './editor.css'

const NO_INPUTS: ReadonlyMap<string, number> = new Map()
/** React Flow's own hints say how to select, move and delete pieces; none of that works here. */
const NO_HINTS = {
  'node.a11yDescription.default': '',
  'node.a11yDescription.keyboardDisabled': '',
  'edge.a11yDescription.default': '',
}
/** The whole circuit in view, however big: below React Flow's default minimum zoom if need be. */
const FIT = { padding: 0.1, minZoom: 0.05, maxZoom: 1 }

interface Props {
  circuit: Circuit
  library: ChipLibrary
  /** The inputs can be toggled; otherwise the view is a picture, left out of focus and of the accessibility tree. */
  live?: boolean
  /** Names the live view for screen readers. */
  label?: string
}

/** A circuit drawn with the editor's own pieces, read-only: nothing moves, connects or gets deleted. The clock stays at 0. */
export function CircuitView({ circuit, library, live = false, label }: Props) {
  // Every node locked: no delete, no rename.
  const flow = useMemo(() => toFlow(circuit, new Set(circuit.nodes.map((n) => n.id))), [circuit])
  // Kept in state so React Flow can store their measured size, which the fit needs.
  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes)
  useEffect(() => setNodes(flow.nodes), [flow, setNodes])
  const byId = useMemo(() => new Map(flow.nodes.map((n) => [n.id, n])), [flow])
  const [inputs, setInputs] = useState(NO_INPUTS)
  const { signals } = useSimulation(circuit, library, inputs, 0, false)
  // A picture keeps still: no packets travelling on its wires.
  const wires = toWires(flow.edges, byId, signals, library, { animate: live, stepMode: false })
  const context = useMemo(
    (): EditorState => ({
      library,
      signals,
      incoming: (node, pin) => wires.find((w) => w.target === node && w.targetHandle === pin)?.data?.value ?? 0,
      inputs,
      setInput: (id, value) => {
        if (!live) return
        play(value ? 'toggleOn' : 'toggleOff')
        setInputs((m) => new Map(m).set(id, value))
      },
    }),
    // `wires` is new every render; it only changes with the flow and the signals.
    [library, signals, inputs, live, flow], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div
      className={`circuit-view${live ? ' live' : ''}`}
      role={live ? 'group' : undefined}
      aria-label={live ? label : undefined}
      aria-hidden={live ? undefined : true}
      inert={!live}
    >
      <ReactFlowProvider>
        <EditorContext.Provider value={context}>
          <ReactFlow
            nodes={nodes}
            onNodesChange={onNodesChange}
            edges={wires}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            elementsSelectable={false}
            panOnDrag={false}
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            preventScrolling={false}
            deleteKeyCode={null}
            colorMode="dark"
            minZoom={FIT.minZoom}
            ariaLabelConfig={NO_HINTS}
          >
            <FitOnResize />
          </ReactFlow>
        </EditorContext.Provider>
      </ReactFlowProvider>
    </div>
  )
}

/** Fits the circuit whenever the view changes size: a dialog lays it out at 0×0 before it shows. */
function FitOnResize() {
  const { fitView } = useReactFlow()
  const ready = useNodesInitialized()
  const size = useStore((s) => `${s.width}x${s.height}`)
  useEffect(() => {
    if (ready) void fitView(FIT)
  }, [ready, size, fitView])
  return null
}
