import { Background, Controls, ReactFlow, ReactFlowProvider, addEdge, useEdgesState, useNodesState, useReactFlow } from '@xyflow/react'
import type { Connection, Edge, EdgeTypes, NodeTypes, OnBeforeDelete, XYPosition } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import type { Bit, ChipLibrary, Circuit } from '../sim/types.ts'
import type { Spec } from '../sim/verify.ts'
import { ChipNode } from './ChipNode.tsx'
import { canConnect, copySelection, edgeId, nextId, pasteCircuit, pinWidth, renameNode, toCircuit, toFlow } from './convert.ts'
import type { ChipFlowNode } from './convert.ts'
import { EditorContext, KIND_NAMES, SIZED_KINDS, kindName } from './context.ts'
import { CopyIcon, PasteIcon, RedoIcon, StepIcon, TableIcon, TrashIcon, UndoIcon } from '../icons.tsx'
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

interface ToolButtonProps {
  label: string
  icon: ReactNode
  onClick: () => void
  keys?: string
  disabled?: boolean
  pressed?: boolean
}

/** Icon plus text; on a phone only the icon shows, and the label stays as the accessible name. */
function ToolButton({ label, icon, onClick, keys, disabled, pressed }: ToolButtonProps) {
  return (
    <button
      type="button"
      className="tool"
      aria-label={label}
      aria-pressed={pressed}
      title={keys ? `${label} (${keys})` : label}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span className="tool-label">{label}</span>
    </button>
  )
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

const CASCADE = 24

/** Clicking a piece several times shouldn't stack the copies exactly on top of each other. */
function freeSpot(at: XYPosition, nodes: ChipFlowNode[]): XYPosition {
  const taken = (p: XYPosition) => nodes.some((n) => Math.abs(n.position.x - p.x) < 1 && Math.abs(n.position.y - p.y) < 1)
  let spot = at
  while (taken(spot)) spot = { x: spot.x + CASCADE, y: spot.y + CASCADE }
  return spot
}

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
  const { screenToFlowPosition, deleteElements } = useReactFlow()

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
        position: freeSpot(screenToFlowPosition(point), ns),
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

  // Same path as the Delete key: locked pins stay and the change goes into the history.
  const selectedNodes = nodes.filter((n) => n.selected && n.deletable !== false)
  const selectedEdges = edges.filter((e) => e.selected)
  const canDelete = selectedNodes.length > 0 || selectedEdges.length > 0
  const deleteSelection = () => void deleteElements({ nodes: selectedNodes, edges: selectedEdges })

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
      incoming: (node: string, pin: string) => wires.find((w) => w.target === node && w.targetHandle === pin)?.data?.value ?? 0,
      inputs,
      setInput: (id: string, value: number) => setInputs((m) => new Map(m).set(id, value)),
      rename: renamePins ? rename : undefined,
    }),
    // `rename` changes with every render; it only needs the latest nodes when called.
    [library, signals, inputs, renamePins, nodes, edges], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const status = signals.error
    ? { cls: 'error', text: signals.error, help: 'El circuito tiene un problema y no se puede simular.' }
    : signals.oscillating
      ? { cls: 'warn', text: 'El circuito oscila: nunca se estabiliza', help: 'Alguna señal cambia sin parar, como un NOT conectado a sí mismo.' }
      : stepMode
        ? {
            cls: 'ok',
            text: signals.settled ? 'Paso a paso: estable' : 'Paso a paso: la señal sigue avanzando',
            help: 'Pulsa Avanzar para mover la señal una compuerta.',
          }
        : signals.hasClock
          ? { cls: 'ok', text: `Reloj: ${clock}`, help: 'El reloj cambia de 0 a 1 solo; páusalo para avanzar con Tic.' }
          : { cls: 'ok', text: 'Estable', help: 'Las salidas ya no cambian con las entradas actuales.' }

  const blank = edges.length === 0 && nodes.every((n) => n.data.kind === 'INPUT' || n.data.kind === 'OUTPUT')
  const pieceButton = (kind: string) => {
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
  }
  const basics = palette.filter((k) => k in KIND_NAMES)
  const chips = palette.filter((k) => !(k in KIND_NAMES))

  return (
    <div className="editor">
      <aside className="palette" aria-labelledby="palette-title">
        <h2 id="palette-title" className="palette-title">
          Piezas
        </h2>
        <p className="palette-help">Arrastra o haz clic para agregar.</p>
        <h3>Básicas</h3>
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
        {basics.map(pieceButton)}
        <h3>Tus chips</h3>
        {chips.length > 0 ? chips.map(pieceButton) : <p className="palette-help">Resuelve niveles para sumar chips aquí.</p>}
      </aside>
      <div className="canvas" ref={canvas} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
        <div className="toolbar" role="toolbar" aria-label="Herramientas">
          <ToolButton label="Deshacer" icon={<UndoIcon />} keys="Ctrl/⌘ + Z" onClick={undo} disabled={!history.canUndo} />
          <ToolButton label="Rehacer" icon={<RedoIcon />} keys="Ctrl/⌘ + Shift + Z" onClick={redo} disabled={!history.canRedo} />
          <ToolButton label="Copiar" icon={<CopyIcon />} keys="Ctrl/⌘ + C" onClick={copy} />
          <ToolButton label="Pegar" icon={<PasteIcon />} keys="Ctrl/⌘ + V" onClick={paste} />
          <ToolButton label="Borrar" icon={<TrashIcon />} keys="Supr o Backspace" onClick={deleteSelection} disabled={!canDelete} />
          <span className="separator" />
          <ToolButton label="Tabla" icon={<TableIcon />} pressed={showTable} onClick={() => setShowTable((v) => !v)} />
          <ToolButton label="Paso a paso" icon={<StepIcon />} pressed={stepMode} onClick={() => setStepMode((v) => !v)} />
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
        {blank && (
          <p className="canvas-guide">
            Agrega piezas desde Piezas y une los pines arrastrando de un punto a otro.
          </p>
        )}
        <div className={`status ${status.cls}`} role="status" title={status.help}>
          {status.text}
        </div>
      </div>
    </div>
  )
}
