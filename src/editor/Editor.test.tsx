// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { build, nand } from '../sim/build.ts'
import { LIBRARY, MUX, NOT, SR_LATCH } from '../sim/examples.ts'
import { SPECS } from '../levels/specs.ts'
import type { Circuit } from '../sim/types.ts'
import { Editor } from './Editor.tsx'
import type { EditorProps } from './Editor.tsx'
import { play } from '../sound.ts'

vi.mock('../sound.ts', () => ({ play: vi.fn() }))

beforeAll(() => {
  // jsdom has no ResizeObserver; React Flow only needs it to exist.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(() => {
  cleanup()
  vi.mocked(play).mockClear()
})

// Unmeasured React Flow nodes stay `visibility: hidden` in jsdom, so role queries skip them; labels still work.
const byLabel = (name: string) => screen.getByLabelText(name)
const button = (name: string) => screen.getByRole('button', { name })

const setup = (initial: Circuit, props: Partial<EditorProps> = {}) => {
  const onChange = vi.fn<(c: Circuit) => void>()
  render(<Editor initial={initial} library={new Map()} palette={['NAND']} onChange={onChange} {...props} />)
  return { last: () => onChange.mock.lastCall![0] }
}
const nandIds = (c: Circuit) => c.nodes.filter((n) => n.kind === 'NAND').map((n) => n.id)

describe('Editor', () => {
  it('toggles an input and lights the output live', () => {
    setup(NOT)
    expect(byLabel('salida out: 1')).toBeTruthy()
    fireEvent.click(byLabel('entrada a: 0'))
    expect(byLabel('salida out: 0')).toBeTruthy()
    expect(byLabel('entrada a: 1').getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps latch state between input changes', () => {
    setup(SR_LATCH)
    fireEvent.click(byLabel('entrada r: 0')) // r=1, s=0 → set
    expect(byLabel('salida Q: 1')).toBeTruthy()
    fireEvent.click(byLabel('entrada s: 0')) // both 1 → hold
    expect(byLabel('salida Q: 1')).toBeTruthy()
    expect(byLabel('salida QB: 0')).toBeTruthy()
  })

  it('adds a piece from the palette, then undoes and redoes it', () => {
    const { last } = setup(NOT)
    expect(button('Deshacer').hasAttribute('disabled')).toBe(true)
    fireEvent.click(button('NAND'))
    expect(nandIds(last())).toEqual(['n', 'nand1'])
    fireEvent.click(button('Deshacer'))
    expect(nandIds(last())).toEqual(['n'])
    fireEvent.click(button('Rehacer'))
    expect(nandIds(last())).toEqual(['n', 'nand1'])
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(nandIds(last())).toEqual(['n'])
  })

  it('guides an empty level until the first piece is added', () => {
    const pins = { nodes: NOT.nodes.filter((n) => n.kind !== 'NAND'), wires: [] }
    setup(pins)
    expect(screen.queryByText(/Agrega piezas desde Piezas/)).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Estable')
    expect(button('Borrar').hasAttribute('disabled')).toBe(true)
    fireEvent.click(button('NAND'))
    expect(screen.queryByText(/Agrega piezas desde Piezas/)).toBeNull()
  })

  it('splits the palette into basic pieces and your chips', () => {
    setup(NOT, { palette: ['NAND', 'NOT'], library: new Map([['NOT', { id: 'NOT', name: 'NOT', circuit: NOT }]]) })
    const palette = screen.getByRole('complementary', { name: 'Piezas' })
    expect([...palette.querySelectorAll('h3, button')].map((e) => e.textContent)).toEqual(['Básicas', 'NAND', 'Tus chips', 'NOT'])
  })

  it('draws logic gates with their symbol and keeps other chips as boxes', () => {
    const nodes = ['NAND', 'NOT', 'AND', 'OR', 'XOR', 'HALF_ADDER'].map((kind) => ({ id: kind.toLowerCase(), kind }))
    const { container } = render(<Editor initial={{ nodes, wires: [] }} library={LIBRARY} palette={[]} onChange={() => {}} />)
    const gates = [...container.querySelectorAll('.gate')]
    expect(gates.map((g) => g.getAttribute('aria-label'))).toEqual([
      'Compuerta NAND',
      'Compuerta NOT',
      'Compuerta AND',
      'Compuerta OR',
      'Compuerta XOR',
    ])
    expect(gates.every((g) => g.querySelector('svg'))).toBe(true)
    const handles = (id: string) => [...container.querySelectorAll(`[data-nodeid="${id}"]`)].map((h) => h.getAttribute('data-handleid'))
    expect(handles('nand')).toEqual(['a', 'b', 'out'])
    expect(handles('not')).toEqual(['a', 'out'])
    expect(container.querySelector('.chip.kind-half_adder .chip-title')).toBeTruthy()
  })

  it('draws relays with a switch that closes while the coil is on (or off, when inverted)', () => {
    const nodes = [
      { id: 'c', kind: 'INPUT' },
      { id: 'no', kind: 'RELAY' },
      { id: 'nc', kind: 'RELAY_NC' },
    ]
    const wires = ['no', 'nc'].map((node) => ({ from: { node: 'c', pin: 'out' }, to: { node, pin: 'c' } }))
    const { container } = render(<Editor initial={{ nodes, wires }} library={new Map()} palette={[]} onChange={() => {}} />)
    const blade = (id: string) => container.querySelector(`.kind-relay${id === 'nc' ? '_nc' : ''} .relay-blade`)?.getAttribute('d')
    const [open, closed] = ['M24 14L52 3', 'M24 14L55 14']
    expect([blade('no'), blade('nc')]).toEqual([open, closed])
    fireEvent.click(byLabel('entrada c: 0'))
    expect([blade('no'), blade('nc')]).toEqual([closed, open])
  })

  it('shows the symbol of gates and basic pieces next to their name, and none on other chips', () => {
    const palette = ['INPUT', 'NAND', 'NOT', 'D_LATCH']
    setup(NOT, { palette, library: LIBRARY })
    const pieces = [...screen.getByRole('complementary', { name: 'Piezas' }).querySelectorAll('button')]
    expect(pieces.map((b) => !!b.querySelector('svg.piece-icon'))).toEqual([true, true, true, false])
  })

  it('a chip that only shares a gate name gets no gate icon', () => {
    setup(NOT, { palette: ['NOT'], library: new Map() })
    expect(button('NOT').querySelector('svg.piece-icon')).toBeNull()
  })

  it('draws the adders and multiplexers with their symbol, and other chips without one', () => {
    const palette = ['HALF_ADDER', 'FULL_ADDER', 'ADDER4', 'MUX', 'MUX4', 'D_LATCH']
    setup(NOT, { palette, library: LIBRARY })
    const pieces = [...screen.getByRole('complementary', { name: 'Piezas' }).querySelectorAll('button')]
    expect(pieces.map((b) => !!b.querySelector('svg.piece-icon'))).toEqual([true, true, true, true, true, false])
  })

  it('a sandbox chip named like a level chip gets no symbol', () => {
    setup(NOT, { palette: ['U_MUX'], library: new Map([['U_MUX', { id: 'U_MUX', name: 'MUX', circuit: MUX }]]) })
    expect(button('MUX').querySelector('svg.piece-icon')).toBeNull()
  })

  it('draws the sandbox chips with the standard chip icon', () => {
    const library = new Map([['U_MUX', { id: 'U_MUX', name: 'MUX', circuit: MUX }]])
    setup(NOT, { palette: ['U_MUX'], library, customChips: new Set(['U_MUX']) })
    expect(button('MUX').querySelector('svg.piece-icon.custom-chip')).toBeTruthy()
  })

  describe('editing the sandbox chips', () => {
    const library = new Map([
      ['U_MUX', { id: 'U_MUX', name: 'Mi mux', circuit: MUX }],
      ['NOT', { id: 'NOT', name: 'NOT', circuit: NOT }],
    ])
    const editable = (props: Partial<EditorProps> = {}) => {
      const onRemoveChip = vi.fn()
      const onCancelRemove = vi.fn()
      setup(NOT, { palette: ['NAND', 'NOT', 'U_MUX'], library, customChips: new Set(['U_MUX']), onRemoveChip, onCancelRemove, ...props })
      return { onRemoveChip, onCancelRemove }
    }
    const remove = () => screen.queryByRole('button', { name: 'Borrar Mi mux' })

    it('shows a delete button only on the sandbox chips while editing', () => {
      const { onRemoveChip } = editable()
      expect(remove()).toBeNull()
      fireEvent.click(button('Editar'))
      expect(button('Listo').getAttribute('aria-pressed')).toBe('true')
      expect(play).toHaveBeenLastCalledWith('edit')
      // The chips that can go pulse.
      expect(document.querySelector('.removable-piece.editing .piece')).toBe(button('Mi mux'))
      expect(remove()).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Borrar NOT' })).toBeNull()
      fireEvent.click(remove()!)
      expect(onRemoveChip).toHaveBeenCalledWith('U_MUX')
    })

    it('asks to confirm on the chip being deleted, and leaving its button gives up', () => {
      const { onCancelRemove } = editable({ confirmingChip: 'U_MUX' })
      fireEvent.click(button('Editar'))
      const confirm = button('Confirmar borrar Mi mux')
      expect(confirm.textContent).toBe('¿Borrar?')
      expect(confirm.classList.contains('danger')).toBe(true)
      // It takes the chip's place: the chip is out of reach meanwhile.
      expect(document.querySelector('.removable-piece.confirming .piece')?.hasAttribute('inert')).toBe(true)
      fireEvent.blur(confirm)
      expect(onCancelRemove).toHaveBeenCalled()
    })

    it('stops editing on a click outside the chips or when a chip is added', () => {
      const { onCancelRemove } = editable()
      fireEvent.click(button('Editar'))
      fireEvent.pointerDown(document.body)
      expect(remove()).toBeNull()
      expect(onCancelRemove).toHaveBeenCalled()
      fireEvent.click(button('Editar'))
      fireEvent.click(button('Mi mux'))
      expect(remove()).toBeNull()
      // Tabbing out of the chips ends it too; moving between them does not.
      fireEvent.click(button('Editar'))
      fireEvent.blur(button('Listo'), { relatedTarget: remove() })
      expect(remove()).toBeTruthy()
      fireEvent.blur(remove()!, { relatedTarget: document.body })
      expect(remove()).toBeNull()
    })

    it('keeps the same chip element in and out of editing, so it does not blink', () => {
      editable({ confirmingChip: 'U_MUX' })
      const chip = button('Mi mux')
      fireEvent.click(button('Editar'))
      expect(document.querySelector('.removable-piece .piece')).toBe(chip)
      fireEvent.click(button('Listo'))
      expect(button('Mi mux')).toBe(chip)
      expect(chip.hasAttribute('inert')).toBe(false)
    })

    it('offers no editing without sandbox chips', () => {
      editable({ customChips: new Set() })
      expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    })
  })

  it('plays a sound for adding, toggling, undoing, redoing and stepping', () => {
    setup(NOT, { palette: ['NAND'] })
    fireEvent.click(button('NAND'))
    expect(play).toHaveBeenLastCalledWith('drop')
    fireEvent.click(byLabel('entrada a: 0'))
    expect(play).toHaveBeenLastCalledWith('toggleOn')
    fireEvent.click(byLabel('entrada a: 1'))
    expect(play).toHaveBeenLastCalledWith('toggleOff')
    fireEvent.click(button('Deshacer'))
    expect(play).toHaveBeenLastCalledWith('undo')
    fireEvent.click(button('Rehacer'))
    expect(play).toHaveBeenLastCalledWith('redo')
    fireEvent.click(button('Paso a paso'))
    fireEvent.click(button('Avanzar'))
    expect(play).toHaveBeenLastCalledWith('tick')
  })

  it('plays a sound for the zoom and fit buttons', () => {
    setup(NOT)
    fireEvent.click(button('Zoom In'))
    expect(play).toHaveBeenLastCalledWith('zoomIn')
    fireEvent.click(button('Zoom Out'))
    expect(play).toHaveBeenLastCalledWith('zoomOut')
    fireEvent.click(button('Fit View'))
    expect(play).toHaveBeenLastCalledWith('tick')
  })

  it('stays quiet when there is nothing to undo', () => {
    setup(NOT)
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(play).not.toHaveBeenCalled()
  })

  it('goes poof when a piece is deleted', async () => {
    const { last } = setup(NOT)
    fireEvent.click(document.querySelector('.react-flow__node[data-id="n"]')!)
    await act(async () => fireEvent.click(button('Borrar')))
    expect(play).toHaveBeenLastCalledWith('poof')
    // It stays for its exit animation, then goes.
    expect(document.querySelector('.react-flow__node[data-id="n"]')?.classList.contains('leaving')).toBe(true)
    await waitFor(() => expect(nandIds(last())).toEqual([]))
  })

  it('clears the whole sandbox after a confirmation, and undo brings it back', async () => {
    const { last } = setup(NOT, { clearable: true })
    fireEvent.click(button('Limpiar'))
    // The first click only asks; leaving the button gives up.
    expect(nandIds(last())).toEqual(['n'])
    fireEvent.blur(button('¿Seguro? Limpiar'))
    expect(button('Limpiar')).toBeTruthy()
    fireEvent.click(button('Limpiar'))
    await act(async () => fireEvent.click(button('¿Seguro? Limpiar')))
    await waitFor(() => expect(last().nodes).toEqual([]))
    expect(last().wires).toEqual([])
    expect(play).toHaveBeenLastCalledWith('poof')
    expect(button('Limpiar').hasAttribute('disabled')).toBe(true)
    fireEvent.click(button('Deshacer'))
    expect(last().nodes.map((n) => n.id)).toEqual(NOT.nodes.map((n) => n.id))
    expect(last().wires).toHaveLength(NOT.wires.length)
  })

  it('keeps a level\'s locked pins when clearing, and only offers it when asked', async () => {
    setup(NOT)
    expect(screen.queryByRole('button', { name: 'Limpiar' })).toBeNull()
    cleanup()
    const { last } = setup(NOT, { clearable: true, locked: new Set(['a', 'out']) })
    fireEvent.click(button('Limpiar'))
    await act(async () => fireEvent.click(button('¿Seguro? Limpiar')))
    await waitFor(() => expect(last().nodes.map((n) => n.id)).toEqual(['a', 'out']))
    expect(last().wires).toEqual([])
  })

  it('shows structural problems in the status bar', () => {
    setup({ nodes: [{ id: 'x', kind: 'MISSING' }], wires: [] })
    expect(screen.getByRole('status').textContent).toMatch(/Tipo desconocido/)
  })

  it('ticks the clock, and can pause it and tick by hand', () => {
    vi.useFakeTimers()
    setup({ nodes: [{ id: 'c', kind: 'CLOCK' }], wires: [] })
    expect(screen.getByRole('status').textContent).toBe('Reloj: 0')
    act(() => vi.advanceTimersByTime(500))
    expect(screen.getByRole('status').textContent).toBe('Reloj: 1')
    fireEvent.click(button('Pausar reloj'))
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByRole('status').textContent).toBe('Reloj: 1')
    fireEvent.click(button('Tic'))
    expect(screen.getByRole('status').textContent).toBe('Reloj: 0')
    vi.useRealTimers()
  })

  it('drives bus inputs with numbers and shows bus outputs as numbers', () => {
    setup({
      nodes: [
        { id: 'a', kind: 'INPUT', width: 4 },
        { id: 'o', kind: 'OUTPUT', width: 4 },
      ],
      wires: [{ from: { node: 'a', pin: 'out' }, to: { node: 'o', pin: 'in' } }],
    })
    fireEvent.change(byLabel('entrada a (4 bits)'), { target: { value: '9' } })
    expect(byLabel('salida o: 9').textContent).toContain('1001')
    fireEvent.change(byLabel('entrada a (4 bits)'), { target: { value: '99' } })
    expect(byLabel('salida o: 15')).toBeTruthy()
  })

  it('in step mode, moves the signal one gate per click', () => {
    const chain = build({ inputs: ['a'], parts: { n1: nand('a', 'a'), n2: nand('n1', 'n1'), n3: nand('n2', 'n2') }, outputs: { out: 'n3' } })
    setup(chain)
    fireEvent.click(button('Paso a paso'))
    fireEvent.click(byLabel('entrada a: 0'))
    expect(screen.getByRole('status').textContent).toBe('Paso a paso: la señal sigue avanzando')
    expect(byLabel('salida out: 1')).toBeTruthy()
    fireEvent.click(button('Avanzar'))
    fireEvent.click(button('Avanzar'))
    expect(byLabel('salida out: 1')).toBeTruthy()
    fireEvent.click(button('Avanzar'))
    expect(byLabel('salida out: 0')).toBeTruthy()
    fireEvent.click(button('Avanzar'))
    expect(screen.getByRole('status').textContent).toBe('Paso a paso: estable')
    expect(button('Avanzar').hasAttribute('disabled')).toBe(true)
  })

  it('shows the level theory in a side panel that can be closed and reopened', () => {
    const onTheoryOpenChange = vi.fn<(open: boolean) => void>()
    const props = { theory: <p>Historia</p>, onTheoryOpenChange }
    setup(NOT, { ...props, theoryOpen: true })
    expect(screen.getByRole('complementary', { name: 'Historia y teoría' }).textContent).toContain('Historia')
    expect(button('Teoría').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(button('Cerrar teoría'))
    expect(onTheoryOpenChange).toHaveBeenLastCalledWith(false)
    cleanup()
    setup(NOT, { ...props, theoryOpen: false })
    expect(screen.queryByRole('complementary', { name: 'Historia y teoría' })).toBeNull()
    fireEvent.click(button('Teoría'))
    expect(onTheoryOpenChange).toHaveBeenLastCalledWith(true)
  })

  it('shows a live truth table with the expected values of a level', () => {
    // Input wired straight to the output: right for a=0? no (expects 1); right for a=1? no (expects 0).
    const wire = { from: { node: 'a', pin: 'out' }, to: { node: 'out', pin: 'in' } }
    setup({ nodes: NOT.nodes.filter((n) => n.kind !== 'NAND'), wires: [wire] }, { spec: SPECS.get('NOT') })
    fireEvent.click(button('Tabla'))
    const rows = [...screen.getByRole('table').querySelectorAll('tbody tr')]
    // a | tu circuito: out | esperado: out | ✓/✗
    expect(rows.map((r) => r.textContent)).toEqual(['001✗', '110✗'])
    expect(rows.map((r) => r.className)).toEqual(['wrong', 'wrong'])
    expect(rows.map((r) => r.querySelector('td.bad')?.textContent)).toEqual(['0', '1'])
  })

  it('renames a pin with a double click when allowed', () => {
    const { last } = setup(NOT, { renamePins: true })
    fireEvent.doubleClick(screen.getByText('a'))
    const field = byLabel('Nuevo nombre para a')
    fireEvent.change(field, { target: { value: '9' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(screen.getByText(/empezando con letra/)).toBeTruthy()
    fireEvent.change(field, { target: { value: 'entrada' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(last().nodes[0].id).toBe('entrada')
    expect(last().wires.filter((w) => w.from.node === 'entrada')).toHaveLength(2) // feeds both NAND pins
  })

  it('keeps the new name when the field loses focus, and Escape cancels', () => {
    const { last } = setup(NOT, { renamePins: true })
    fireEvent.doubleClick(screen.getByText('a'))
    fireEvent.change(byLabel('Nuevo nombre para a'), { target: { value: 'x' } })
    fireEvent.keyDown(byLabel('Nuevo nombre para a'), { key: 'Escape' })
    expect(last().nodes[0].id).toBe('a')

    fireEvent.doubleClick(screen.getByText('a'))
    fireEvent.change(byLabel('Nuevo nombre para a'), { target: { value: '9' } })
    fireEvent.blur(byLabel('Nuevo nombre para a'))
    expect(screen.getByText(/empezando con letra/)).toBeTruthy()
    fireEvent.change(byLabel('Nuevo nombre para a'), { target: { value: 'clave' } })
    fireEvent.blur(byLabel('Nuevo nombre para a'))
    expect(last().nodes[0].id).toBe('clave')
  })

  it('does not rename locked pins', () => {
    setup(NOT, { renamePins: true, locked: new Set(['a']) })
    fireEvent.doubleClick(screen.getByText('a'))
    expect(screen.queryByLabelText('Nuevo nombre para a')).toBeNull()
  })
})
