import { Background, Controls, ReactFlow, ReactFlowProvider, addEdge, useEdgesState, useNodesState, useReactFlow } from '@xyflow/react'
import type { Connection, Edge, NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type { Bit, ChipLibrary, Circuit } from '../sim/types.ts'
import { ChipNode } from './ChipNode.tsx'
import { canConnect, edgeId, nextId, toCircuit, toFlow } from './convert.ts'
import type { ChipFlowNode } from './convert.ts'
import { EditorContext, kindName } from './context.ts'
import { useSimulation } from './useSimulation.ts'
import './editor.css'

const nodeTypes: NodeTypes = { chip: ChipNode }
const DRAG_TYPE = 'application/x-circuitos-kind'
const CLOCK_MS = 500

export interface EditorProps {
  /** Read once; remount with a new `key` to load another circuit. */
  initial: Circuit
  library: ChipLibrary
  /** Kinds the user can add. */
  palette: string[]
  /** Node ids that cannot be deleted (a level's pins). */
  locked?: ReadonlySet<string>
  onChange: (circuit: Circuit) => void
}

export function Editor(props: EditorProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}

function Canvas({ initial, library, palette, locked, onChange }: EditorProps) {
  const [start] = useState(() => toFlow(initial, locked))
  const [nodes, setNodes, onNodesChange] = useNodesState<ChipFlowNode>(start.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(start.edges)
  const [inputs, setInputs] = useState<ReadonlyMap<string, Bit>>(new Map())
  const [clock, setClock] = useState<Bit>(0)
  const canvas = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

  const circuit = useMemo(() => toCircuit(nodes, edges), [nodes, edges])
  const signals = useSimulation(circuit, library, inputs, clock)

  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })
  useEffect(() => onChangeRef.current(circuit), [circuit])

  useEffect(() => {
    if (!signals.hasClock) return
    const timer = setInterval(() => setClock((c) => (c ? 0 : 1)), CLOCK_MS)
    return () => clearInterval(timer)
  }, [signals.hasClock])

  const addNode = (kind: string, screen?: { x: number; y: number }) => {
    if (!palette.includes(kind)) return
    const rect = canvas.current?.getBoundingClientRect()
    const point = screen ?? { x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2, y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2 }
    setNodes((ns) => [
      ...ns,
      { id: nextId(kind, new Set(ns.map((n) => n.id))), type: 'chip', position: screenToFlowPosition(point), data: { kind } },
    ])
  }

  const onConnect = (c: Connection) => setEdges((es) => (canConnect(es, c) ? addEdge({ ...c, id: edgeId(c) }, es) : es))

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    addNode(event.dataTransfer.getData(DRAG_TYPE), { x: event.clientX, y: event.clientY })
  }

  const wires = edges.map((e) => ({ ...e, className: signals.pin(e.source, e.sourceHandle ?? 'out') ? 'wire on' : 'wire' }))

  const context = useMemo(
    () => ({
      library,
      signals,
      inputs,
      toggleInput: (id: string) =>
        setInputs((current) => new Map(current).set(id, current.get(id) ? 0 : 1)),
    }),
    [library, signals, inputs],
  )

  const status = signals.error
    ? { cls: 'error', text: signals.error }
    : signals.oscillating
      ? { cls: 'warn', text: 'El circuito oscila: nunca se estabiliza' }
      : { cls: 'ok', text: signals.hasClock ? `Reloj: ${clock}` : 'Listo' }

  return (
    <div className="editor">
      <aside className="palette" aria-label="Piezas">
        {palette.map((kind) => (
          <button
            key={kind}
            type="button"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_TYPE, kind)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onClick={() => addNode(kind)}
            title="Arrastra al lienzo o haz clic para agregar"
          >
            {kindName(kind, library)}
          </button>
        ))}
      </aside>
      <div className="canvas" ref={canvas} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
        <EditorContext.Provider value={context}>
          <ReactFlow
            nodes={nodes}
            edges={wires}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={(c) => canConnect(edges, c)}
            deleteKeyCode={['Backspace', 'Delete']}
            colorMode="dark"
            fitView
            fitViewOptions={{ maxZoom: 1.2 }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </EditorContext.Provider>
        <div className={`status ${status.cls}`} role="status">
          {status.text}
        </div>
      </div>
    </div>
  )
}
