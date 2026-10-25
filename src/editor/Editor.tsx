import { Background, Controls, ReactFlow, ReactFlowProvider, addEdge, useEdgesState, useNodesState, useReactFlow } from '@xyflow/react'
import type { Connection, Edge, EdgeTypes, NodeTypes, OnBeforeDelete } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type { Bit, ChipLibrary, Circuit } from '../sim/types.ts'
import type { Spec } from '../sim/verify.ts'
import { ChipNode } from './ChipNode.tsx'
import { canConnect, copySelection, edgeId, nextId, pasteCircuit, pinWidth, renameNode, toCircuit, toFlow } from './convert.ts'
import type { ChipFlowNode } from './convert.ts'
import { EditorContext, SIZED_KINDS, kindName } from './context.ts'
import { History } from './history.ts'
import { TruthTable } from './TruthTable.tsx'
import { useSimulation } from './useSimulation.ts'
import { WireEdge } from './WireEdge.tsx'
import type { WireFlowEdge } from './WireEdge.tsx'
import './editor.css'

const nodeTypes: NodeTypes = { chip: ChipNode }
const edgeTypes: EdgeTypes = { wire: WireEdge }
const DRAG_TYPE = 'application/x-circuitos-kind'
const CLOCK_MS = 500
const WIDTHS = [1, 2, 4, 8, 16]

/** Shared by every editor, so a selection can be pasted into another level or the sandbox. */
let clipboard: Circuit | undefined

export interface EditorProps {
  /** Read once; remount with a new `key` to load another circuit. */
  initial: Circuit
  library: ChipLibrary
  /** Kinds the user can add (and paste). */
  palette: string[]
  /** Node ids that cannot be deleted or renamed (a level's pins). */
  locked?: ReadonlySet<string>
  /** Lets the truth table show expected values. */
  spec?: Spec
  /** Allows renaming INPUT/OUTPUT pins with a double click. */
  renamePins?: boolean
  onChange: (circuit: Circuit) => void
}

export function Editor(props: EditorProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

function Canvas({ initial, library, palette, locked, spec, renamePins = false, onChange }: EditorProps) {
  const [start] = useState(() => toFlow(initial, locked))
  const [nodes, setNodes, onNodesChange] = useNodesState<ChipFlowNode>(start.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(start.edges)
  const [inputs, setInputs] = useState<ReadonlyMap<string, number>>(new Map())
  const [clock, setClock] = useState<Bit>(0)
  const [clockRunning, setClockRunning] = useState(true)
  const [stepMode, setStepMode] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const [width, setWidth] = useState(1)
  const [history] = useState(() => new History<Circuit>())
  const [, setHistoryVersion] = useState(0)
  const canvas = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

  const circuit = useMemo(() => toCircuit(nodes, edges), [nodes, edges])
  const { signals, step } = useSimulation(circuit, library, inputs, clock, stepMode)
  const allowed = useMemo(() => new Set(palette), [palette])

  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })
  useEffect(() => onChangeRef.current(circuit), [circuit])

  useEffect(() => {
    if (!signals.hasClock || !clockRunning) return
    const timer = setInterval(() => setClock((c) => (c ? 0 : 1)), CLOCK_MS)
    return () => clearInterval(timer)
  }, [signals.hasClock, clockRunning])

  // History: snapshot the circuit before every change the user makes.
  const current = useRef(circuit)
  useEffect(() => {
    current.current = circuit
  }, [circuit])
  const record = useCallback(() => {
    history.record(current.current)
    setHistoryVersion((v) => v + 1)
  }, [history])
  const restore = useCallback(
    (snapshot: Circuit | undefined) => {
      if (!snapshot) return
      const flow = toFlow(snapshot, locked)
      setNodes(flow.nodes)
      setEdges(flow.edges)
      setHistoryVersion((v) => v + 1)
    },
    [locked, setNodes, setEdges],
  )
  const undo = useCallback(() => restore(history.undo(current.current)), [history, restore])
  const redo = useCallback(() => restore(history.redo(current.current)), [history, restore])

  const copy = useCallback(() => {
    clipboard = copySelection(nodes, edges) ?? clipboard
  }, [nodes, edges])
  const paste = useCallback(() => {
    if (!clipboard) return
    const pasted = pasteCircuit(clipboard, nodes, allowed)
    if (pasted.nodes.length === 0) return
    record()
    setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), ...pasted.nodes])
    setEdges((es) => [...es, ...pasted.edges])
  }, [nodes, allowed, record, setNodes, setEdges])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || isTyping(e.target)) return
      const key = e.key.toLowerCase()
      const action =
        key === 'z' ? (e.shiftKey ? redo : undo) : key === 'y' ? redo : key === 'c' ? copy : key === 'v' ? paste : undefined
      if (!action) return
      e.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, copy, paste])

  const addNode = (kind: string, screen?: { x: number; y: number }) => {
    if (!allowed.has(kind)) return
    const sized = SIZED_KINDS.has(kind)
    if (sized && (kind === 'SPLIT' || kind === 'JOIN') && width < 2) return
    const rect = canvas.current?.getBoundingClientRect()
    const point = screen ?? { x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2, y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2 }
    record()
    setNodes((ns) => [
      ...ns,
      {
        id: nextId(kind, new Set(ns.map((n) => n.id))),
        type: 'chip',
        position: screenToFlowPosition(point),
        data: sized && width > 1 ? { kind, width } : { kind },
      },
    ])
  }

  const onConnect = (c: Connection) => {
    if (!canConnect(edges, c, nodes, library)) return
    record()
    setEdges((es) => addEdge({ ...c, id: edgeId(c) }, es))
  }

  const onBeforeDelete: OnBeforeDelete<ChipFlowNode> = async () => {
    record()
    return true
  }

  const rename = (from: string, to: string) => {
    const result = renameNode(nodes, edges, from, to)
    if (typeof result === 'string') return result
    record()
    setNodes(result.nodes)
    setEdges(result.edges)
    setInputs((m) => {
      if (!m.has(from)) return m
      const next = new Map(m)
      next.set(to, next.get(from)!)
      next.delete(from)
      return next
    })
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    addNode(event.dataTransfer.getData(DRAG_TYPE), { x: event.clientX, y: event.clientY })
  }

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const wires: WireFlowEdge[] = edges.map((e) => ({
    ...e,
    type: 'wire',
    data: {
      value: signals.pin(e.source, e.sourceHandle ?? 'out'),
      width: pinWidth(byId.get(e.source), e.sourceHandle, 'outputs', library) ?? 1,
      animate: true,
    },
  }))

  const context = useMemo(
    () => ({
      library,
      signals,
      inputs,
      setInput: (id: string, value: number) => setInputs((m) => new Map(m).set(id, value)),
      rename: renamePins ? rename : undefined,
    }),
    // `rename` changes with every render; it only needs the latest nodes when called.
    [library, signals, inputs, renamePins, nodes, edges], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const status = signals.error
    ? { cls: 'error', text: signals.error }
    : signals.oscillating
      ? { cls: 'warn', text: 'El circuito oscila: nunca se estabiliza' }
      : stepMode
        ? { cls: 'ok', text: signals.settled ? 'Paso a paso: estable' : 'Paso a paso: la señal sigue avanzando' }
        : { cls: 'ok', text: signals.hasClock ? `Reloj: ${clock}` : 'Listo' }

  return (
    <div className="editor">
      <aside className="palette" aria-label="Piezas">
        {palette.some((k) => SIZED_KINDS.has(k)) && (
          <label className="width-picker">
            Bits
            <select value={width} onChange={(e) => setWidth(Number(e.target.value))}>
              {WIDTHS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
        )}
        {palette.map((kind) => {
          const needsBus = (kind === 'SPLIT' || kind === 'JOIN') && width < 2
          return (
            <button
              key={kind}
              type="button"
              draggable={!needsBus}
              disabled={needsBus}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, kind)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onClick={() => addNode(kind)}
              title={needsBus ? 'Elige 2 o más bits' : 'Arrastra al lienzo o haz clic para agregar'}
            >
              {kindName(kind, library)}
              {SIZED_KINDS.has(kind) && width > 1 ? ` ${width}` : ''}
            </button>
          )
        })}
      </aside>
      <div className="canvas" ref={canvas} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
        <div className="toolbar" role="toolbar" aria-label="Herramientas">
          <button type="button" onClick={undo} disabled={!history.canUndo} title="Ctrl/⌘ + Z">
            Deshacer
          </button>
          <button type="button" onClick={redo} disabled={!history.canRedo} title="Ctrl/⌘ + Shift + Z">
            Rehacer
          </button>
          <button type="button" onClick={copy} title="Ctrl/⌘ + C">
            Copiar
          </button>
          <button type="button" onClick={paste} title="Ctrl/⌘ + V">
            Pegar
          </button>
          <span className="separator" />
          <button type="button" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)}>
            Tabla
          </button>
          <button type="button" aria-pressed={stepMode} onClick={() => setStepMode((v) => !v)}>
            Paso a paso
          </button>
          {stepMode && (
            <button type="button" className="primary" onClick={step} disabled={signals.settled}>
              Avanzar
            </button>
          )}
          {signals.hasClock && (
            <>
              <span className="separator" />
              <button type="button" onClick={() => setClockRunning((v) => !v)}>
                {clockRunning ? 'Pausar reloj' : 'Reanudar reloj'}
              </button>
              {!clockRunning && (
                <button type="button" onClick={() => setClock((c) => (c ? 0 : 1))}>
                  Tic
                </button>
              )}
            </>
          )}
        </div>
        <EditorContext.Provider value={context}>
          <ReactFlow
            nodes={nodes}
            edges={wires}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onBeforeDelete={onBeforeDelete}
            onNodeDragStart={record}
            isValidConnection={(c) => canConnect(edges, c, nodes, library)}
            deleteKeyCode={['Backspace', 'Delete']}
            colorMode="dark"
            fitView
            fitViewOptions={{ maxZoom: 1.2 }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </EditorContext.Provider>
        {showTable && (
          <aside className="table-panel" aria-label="Tabla de verdad">
            <TruthTable circuit={circuit} library={library} spec={spec} />
          </aside>
        )}
        <div className={`status ${status.cls}`} role="status">
          {status.text}
        </div>
      </div>
    </div>
  )
}
