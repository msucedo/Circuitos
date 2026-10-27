import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import type { Connection, Edge, EdgeTypes, FitViewOptions, NodeTypes, OnBeforeDelete, XYPosition } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, DragEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { problemText } from '../i18n.ts'
import type { Bit, ChipLibrary, Circuit } from '../sim/types.ts'
import type { Spec } from '../sim/verify.ts'
import { ChipNode } from './ChipNode.tsx'
import { canConnect, copySelection, edgeId, nextId, pasteCircuit, pinWidth, renameNode, toCircuit, toFlow } from './convert.ts'
import type { ChipFlowNode } from './convert.ts'
import { EditorContext, SIZED_KINDS, isBasicKind, kindName } from './context.ts'
import { CollapseToggle } from '../CollapseToggle.tsx'
import { BookIcon, CopyIcon, PasteIcon, RedoIcon, StepIcon, TableIcon, TrashIcon, UndoIcon } from '../icons.tsx'
import { History } from './history.ts'
import { PieceIcon } from './PieceIcon.tsx'
import { play } from '../sound.ts'
import { usePresence } from '../usePresence.ts'
import { TruthTable } from './TruthTable.tsx'
import { useSimulation } from './useSimulation.ts'
import { WireEdge } from './WireEdge.tsx'
import type { WireFlowEdge } from './WireEdge.tsx'
import './editor.css'

const nodeTypes: NodeTypes = { chip: ChipNode }
const edgeTypes: EdgeTypes = { wire: WireEdge }
const DRAG_TYPE = 'application/x-circuitos-kind'
const CLOCK_MS = 500
/** Theory panel size in px; app.css reads it through --theory-width and --panel-margin. */
export const THEORY_WIDTH = 320
export const PANEL_MARGIN = 10
const WIDTHS = [1, 2, 4, 8, 16]
/** On touch screens a one-finger drag keeps moving the canvas; box selection is for mouse and trackpad. */
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

/** Matches the phone layout in app.css: the side panels cover the whole canvas there. */
const NARROW = typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches
const FIT_PADDING = 0.1
/** Width of the theory panel plus its margins; the first fit leaves that room so the panel covers no piece. */
const THEORY_ROOM = `${THEORY_WIDTH + 2 * PANEL_MARGIN}px` as const
const MAX_FIT_ZOOM = 1.2
/** Fits the pieces in view, leaving room for the theory panel when it is beside them. */
const fitOptions = (theoryRoom: boolean): FitViewOptions => ({
  maxZoom: MAX_FIT_ZOOM,
  padding: { x: FIT_PADDING, y: FIT_PADDING, ...(theoryRoom ? { right: THEORY_ROOM } : {}) },
})
/** The view keeps following the canvas a little after the fold transition, for the last frames. */
const FOLD_SLACK_MS = 150
/** How long a column takes to fold, from `--fold` in index.css (so CSS stays the single source). */
function foldMs(): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--fold').trim()
  return value.endsWith('ms') ? parseFloat(value) : (parseFloat(value) || 0) * 1000
}

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
  /** The level's history and theory, shown in a side panel; adds a toolbar button when given. */
  theory?: ReactNode
  theoryOpen?: boolean
  onTheoryOpenChange?: (open: boolean) => void
  /** Changes when a side column folds or opens; the view then follows the canvas and ends framed. */
  refitKey?: string
  /** The pieces column is folded; it shows a fold button only when `onTogglePalette` is given. */
  paletteCollapsed?: boolean
  onTogglePalette?: () => void
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

function Canvas({
  initial,
  library,
  palette,
  locked,
  spec,
  renamePins = false,
  theory,
  theoryOpen = false,
  onTheoryOpenChange,
  refitKey,
  paletteCollapsed = false,
  onTogglePalette,
  onChange,
}: EditorProps) {
  const { t } = useTranslation()
  const [start] = useState(() => toFlow(initial, locked))
  const [nodes, setNodes, onNodesChange] = useNodesState<ChipFlowNode>(start.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(start.edges)
  const [inputs, setInputs] = useState<ReadonlyMap<string, number>>(new Map())
  const [clock, setClock] = useState<Bit>(0)
  const [clockRunning, setClockRunning] = useState(true)
  const [stepMode, setStepMode] = useState(false)
  const [showTable, setShowTable] = useState(false)
  // Both side panels slide out before they go.
  const tableRef = useRef<HTMLDivElement>(null)
  const table = usePresence(showTable, tableRef)
  const theoryRef = useRef<HTMLDivElement>(null)
  const theoryPanel = usePresence(theoryOpen ? theory : undefined, theoryRef)
  // While pieces move, wire lengths change every frame and would restart their packets.
  const [dragging, setDragging] = useState(false)
  const [width, setWidth] = useState(1)
  const [history] = useState(() => new History<Circuit>())
  const [, setHistoryVersion] = useState(0)
  const canvas = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, deleteElements, fitView } = useReactFlow()

  // Read once: React Flow fits the view only when it mounts, and the pieces stay where that fit put them.
  const [theoryRoom] = useState(() => !!theory && theoryOpen && !NARROW)
  const [mountFit] = useState(() => fitOptions(theoryRoom))

  // Folding a column resizes the canvas. While it moves the view follows it, and it ends framed.
  // Only then: resizing the window keeps the user's own zoom.
  const lastRefitKey = useRef(refitKey)
  const besideTheory = !!theory && theoryOpen && !NARROW
  useEffect(() => {
    const el = canvas.current
    if (refitKey === lastRefitKey.current || !el) return
    lastRefitKey.current = refitKey
    const options = fitOptions(besideTheory)
    let frame = 0
    // A frame later, so React Flow has measured the new size first.
    const refit = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => void fitView(options))
    }
    const observer = new ResizeObserver(refit)
    observer.observe(el)
    const stop = setTimeout(() => {
      observer.disconnect()
      refit()
    }, foldMs() + FOLD_SLACK_MS)
    return () => {
      observer.disconnect()
      clearTimeout(stop)
    }
  }, [refitKey, besideTheory, fitView])
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
  const undo = useCallback(() => {
    const snapshot = history.undo(current.current)
    if (snapshot) play('undo')
    restore(snapshot)
  }, [history, restore])
  const redo = useCallback(() => {
    const snapshot = history.redo(current.current)
    if (snapshot) play('redo')
    restore(snapshot)
  }, [history, restore])

  const copy = useCallback(() => {
    clipboard = copySelection(nodes, edges) ?? clipboard
  }, [nodes, edges])
  const paste = useCallback(() => {
    if (!clipboard) return
    const pasted = pasteCircuit(clipboard, nodes, allowed)
    if (pasted.nodes.length === 0) return
    record()
    play('drop')
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
    play('drop')
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
    play('connect')
    setEdges((es) => addEdge({ ...c, id: edgeId(c) }, es))
  }

  const startDrag = () => {
    record()
    setDragging(true)
  }
  const stopDrag = () => setDragging(false)

  // React Flow only hands over what can be deleted, so the level's locked pins never make a sound.
  const onBeforeDelete: OnBeforeDelete<ChipFlowNode> = async ({ nodes: removed }) => {
    record()
    if (removed.length > 0) play('poof')
    return true
  }

  // Same path as the Delete key: locked pins stay and the change goes into the history.
  const selectedNodes = nodes.filter((n) => n.selected && n.deletable !== false)
  const selectedEdges = edges.filter((e) => e.selected)
  const canDelete = selectedNodes.length > 0 || selectedEdges.length > 0
  const deleteSelection = () => void deleteElements({ nodes: selectedNodes, edges: selectedEdges })

  const rename = (from: string, to: string) => {
    const result = renameNode(nodes, edges, from, to)
    if ('code' in result) return result
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
      animate: !dragging,
      changed: stepMode && signals.changed(e.source, e.sourceHandle ?? 'out'),
    },
  }))

  const context = useMemo(
    () => ({
      library,
      signals,
      incoming: (node: string, pin: string) => wires.find((w) => w.target === node && w.targetHandle === pin)?.data?.value ?? 0,
      inputs,
      setInput: (id: string, value: number) => {
        play(value ? 'toggleOn' : 'toggleOff')
        setInputs((m) => new Map(m).set(id, value))
      },
      rename: renamePins ? rename : undefined,
    }),
    // `rename` changes with every render; it only needs the latest nodes when called.
    [library, signals, inputs, renamePins, nodes, edges], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const status = signals.error
    ? { cls: 'error', text: problemText(t, signals.error), help: t('editor.status.error') }
    : signals.oscillating
      ? { cls: 'warn', text: t('editor.status.oscillating'), help: t('editor.status.oscillatingHelp') }
      : stepMode
        ? {
            cls: 'ok',
            text: signals.settled ? t('editor.status.stepSettled') : t('editor.status.stepMoving'),
            help: t('editor.status.stepHelp'),
          }
        : signals.hasClock
          ? { cls: 'ok', text: t('editor.status.clock', { value: clock }), help: t('editor.status.clockHelp') }
          : { cls: 'ok', text: t('editor.status.stable'), help: t('editor.status.stableHelp') }

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
        title={needsBus ? t('editor.pickBus') : t('editor.addPiece')}
      >
        <PieceIcon kind={kind} library={library} />
        {kindName(t, kind, library)}
        {SIZED_KINDS.has(kind) && width > 1 ? ` ${width}` : ''}
      </button>
    )
  }
  const basics = palette.filter(isBasicKind)
  const chips = palette.filter((k) => !isBasicKind(k))

  return (
    <div className="editor" style={{ '--theory-width': `${THEORY_WIDTH}px`, '--panel-margin': `${PANEL_MARGIN}px` } as CSSProperties}>
      <aside className={`palette${paletteCollapsed ? ' collapsed' : ''}`} aria-labelledby="palette-title">
        <div className="palette-head">
          <h2 id="palette-title" className="palette-title">
            {t('editor.pieces')}
          </h2>
          {onTogglePalette && (
            <CollapseToggle
              collapsed={paletteCollapsed}
              controls="palette-body"
              showLabel={t('editor.showPieces')}
              hideLabel={t('editor.hidePieces')}
              onToggle={onTogglePalette}
            />
          )}
        </div>
        <div id="palette-body" className="palette-body">
          <p className="palette-help">{t('editor.piecesHelp')}</p>
          <h3>{t('editor.basics')}</h3>
          {palette.some((k) => SIZED_KINDS.has(k)) && (
            <label className="width-picker">
              {t('editor.bits')}
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
          <h3>{t('editor.yourChips')}</h3>
          {chips.length > 0 ? chips.map(pieceButton) : <p className="palette-help">{t('editor.noChips')}</p>}
        </div>
      </aside>
      <div className={`canvas${theoryRoom ? ' theory-room' : ''}`} ref={canvas} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
        <div className="toolbar" role="toolbar" aria-label={t('editor.tools')}>
          <ToolButton label={t('editor.undo')} icon={<UndoIcon />} keys="Ctrl/⌘ + Z" onClick={undo} disabled={!history.canUndo} />
          <ToolButton label={t('editor.redo')} icon={<RedoIcon />} keys="Ctrl/⌘ + Shift + Z" onClick={redo} disabled={!history.canRedo} />
          <ToolButton label={t('editor.copy')} icon={<CopyIcon />} keys="Ctrl/⌘ + C" onClick={copy} />
          <ToolButton label={t('editor.paste')} icon={<PasteIcon />} keys="Ctrl/⌘ + V" onClick={paste} />
          <ToolButton label={t('editor.delete')} icon={<TrashIcon />} keys={t('editor.deleteKeys')} onClick={deleteSelection} disabled={!canDelete} />
          <span className="separator" />
          <ToolButton label={t('editor.table')} icon={<TableIcon />} pressed={showTable} onClick={() => setShowTable((v) => !v)} />
          {theory && (
            <ToolButton label={t('editor.theory')} icon={<BookIcon />} pressed={theoryOpen} onClick={() => onTheoryOpenChange?.(!theoryOpen)} />
          )}
          <ToolButton label={t('editor.stepMode')} icon={<StepIcon />} pressed={stepMode} onClick={() => setStepMode((v) => !v)} />
          {stepMode && (
            <button
              type="button"
              className="primary"
              onClick={() => {
                play('tick')
                step()
              }}
              disabled={signals.settled}
            >
              {t('editor.advance')}
            </button>
          )}
          {signals.hasClock && (
            <>
              <span className="separator" />
              <button type="button" onClick={() => setClockRunning((v) => !v)}>
                {clockRunning ? t('editor.pauseClock') : t('editor.resumeClock')}
              </button>
              {!clockRunning && (
                <button
                  type="button"
                  onClick={() => {
                    play('tick')
                    setClock((c) => (c ? 0 : 1))
                  }}
                >
                  {t('editor.tick')}
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
            onNodeDragStart={startDrag}
            onNodeDragStop={stopDrag}
            onSelectionDragStart={startDrag}
            onSelectionDragStop={stopDrag}
            isValidConnection={(c) => canConnect(edges, c, nodes, library)}
            deleteKeyCode={['Backspace', 'Delete']}
            // Like most apps: drag on empty space draws a selection box; the canvas pans with
            // scroll, Space + drag or the middle/right button.
            selectionOnDrag={!TOUCH}
            panOnDrag={TOUCH ? true : [1, 2]}
            panOnScroll={!TOUCH}
            selectionMode={SelectionMode.Partial}
            colorMode="dark"
            fitView
            fitViewOptions={mountFit}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </EditorContext.Provider>
        <div className="side-panels">
          {/* Each panel sits in a slot that grows and shrinks, so the other one slides to its new place. */}
          {table.shown && (
            <div ref={tableRef} className={`panel-slot${table.closing ? ' closing' : ''}`} inert={table.closing}>
              <aside className="table-panel" aria-label={t('editor.truthTable')}>
                <TruthTable circuit={circuit} library={library} spec={spec} />
              </aside>
            </div>
          )}
          {theoryPanel.shown && (
            <div ref={theoryRef} className={`panel-slot${theoryPanel.closing ? ' closing' : ''}`} inert={theoryPanel.closing}>
              <aside className="theory-panel" aria-labelledby="theory-title">
                <div className="theory-head">
                  <h2 id="theory-title">{t('editor.theoryTitle')}</h2>
                  <button type="button" aria-label={t('editor.closeTheory')} onClick={() => onTheoryOpenChange?.(false)}>
                    ×
                  </button>
                </div>
                {theoryPanel.shown}
              </aside>
            </div>
          )}
        </div>
        {blank && (
          <p className="canvas-guide">
            {t('editor.guide')}
          </p>
        )}
        <div className={`status ${status.cls}`} role="status" title={status.help}>
          {status.text}
        </div>
      </div>
    </div>
  )
}
