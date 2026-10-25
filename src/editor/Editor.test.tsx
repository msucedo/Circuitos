// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { NOT, SR_LATCH } from '../sim/examples.ts'
import type { Circuit } from '../sim/types.ts'
import { Editor } from './Editor.tsx'

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
const led = (name: string) => screen.getByLabelText(name)
const toggle = (name: string) => screen.getByLabelText(name)

const setup = (initial: Circuit, palette = ['NAND']) => {
  const onChange = vi.fn<(c: Circuit) => void>()
  render(<Editor initial={initial} library={new Map()} palette={palette} onChange={onChange} />)
  return { onChange, last: () => onChange.mock.lastCall![0] }
}

describe('Editor', () => {
  it('toggles an input and lights the output live', () => {
    setup(NOT)
    expect(led('salida out: 1')).toBeTruthy()
    fireEvent.click(toggle('entrada a: 0'))
    expect(led('salida out: 0')).toBeTruthy()
    expect(toggle('entrada a: 1').getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps latch state between input changes', () => {
    setup(SR_LATCH)
    fireEvent.click(toggle('entrada r: 0')) // r=1, s=0 → set
    expect(led('salida Q: 1')).toBeTruthy()
    fireEvent.click(toggle('entrada s: 0')) // both 1 → hold
    expect(led('salida Q: 1')).toBeTruthy()
    expect(led('salida QB: 0')).toBeTruthy()
  })

  it('adds a piece from the palette and reports the new circuit', () => {
    const { last } = setup(NOT)
    fireEvent.click(screen.getByRole('button', { name: 'NAND' }))
    expect(last().nodes.filter((n) => n.kind === 'NAND').map((n) => n.id)).toEqual(['n', 'nand1'])
  })

  it('shows structural problems in the status bar', () => {
    setup({ nodes: [{ id: 'x', kind: 'MISSING' }], wires: [] })
    expect(screen.getByRole('status').textContent).toMatch(/Tipo desconocido/)
  })

  it('ticks the clock when the circuit has one', () => {
    vi.useFakeTimers()
    setup({ nodes: [{ id: 'c', kind: 'CLOCK' }], wires: [] })
    expect(screen.getByRole('status').textContent).toBe('Reloj: 0')
    act(() => vi.advanceTimersByTime(500))
    expect(screen.getByRole('status').textContent).toBe('Reloj: 1')
    vi.useRealTimers()
  })
})
