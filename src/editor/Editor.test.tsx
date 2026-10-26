// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { build, nand } from '../sim/build.ts'
import { LIBRARY, NOT, SR_LATCH } from '../sim/examples.ts'
import { SPECS } from '../levels/specs.ts'
import type { Circuit } from '../sim/types.ts'
import { Editor } from './Editor.tsx'
import type { EditorProps } from './Editor.tsx'

beforeAll(() => {
  // jsdom has no ResizeObserver; React Flow only needs it to exist.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(cleanup)

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
