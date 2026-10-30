// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { PreviewDialog } from './PreviewDialog.tsx'
import type { Incoming } from './PreviewDialog.tsx'
import { NOT } from './sim/examples.ts'

afterEach(cleanup)
vi.mock('./sound.ts', () => ({ play: vi.fn() }))
// jsdom has no modal dialogs, nor the ResizeObserver React Flow only needs to exist.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

const incoming: Incoming = { project: { version: 1, circuit: NOT, chips: [] }, id: 1, title: 'Prueba' }
const keepBox = () => screen.queryByRole('checkbox', { name: 'Guardar mi Modo libre actual para poder restaurarlo', hidden: true })
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Abrir en Modo libre', hidden: true }))

describe('PreviewDialog', () => {
  it('shows the circuit live, its pieces and its truth table in tabs', () => {
    render(<PreviewDialog incoming={incoming} mine={[]} onCancel={vi.fn()} onOpen={vi.fn()} />)
    const tab = (name: string) => screen.getByRole('tab', { name, hidden: true })
    // The diagram first: trying the inputs plays the circuit, and the NOT's output follows.
    expect(tab('Diagrama').getAttribute('aria-selected')).toBe('true')
    const view = screen.getByRole('group', { name: 'Circuito', hidden: true })
    expect(view.hasAttribute('inert')).toBe(false)
    expect(screen.getByLabelText('salida out: 1')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('entrada a: 0'))
    expect(screen.getByLabelText('salida out: 0')).toBeTruthy()
    // Only the open panel is there.
    fireEvent.click(tab('Piezas'))
    expect(screen.queryByRole('group', { name: 'Circuito', hidden: true })).toBeNull()
    expect(document.querySelector('.preview-parts')?.textContent).toBe('NAND× 1')
    fireEvent.click(tab('Tabla de verdad'))
    expect(document.querySelectorAll('.truth-table tbody tr')).toHaveLength(2)
    expect(screen.getByRole('tabpanel', { hidden: true }).getAttribute('aria-labelledby')).toBe(tab('Tabla de verdad').id)
  })

  it('moves between tabs with the arrow keys, Home and End', () => {
    render(<PreviewDialog incoming={incoming} mine={[]} onCancel={vi.fn()} onOpen={vi.fn()} />)
    const tab = (name: string) => screen.getByRole('tab', { name, hidden: true })
    const selected = () => screen.getAllByRole('tab', { hidden: true }).find((t) => t.getAttribute('aria-selected') === 'true')?.textContent
    fireEvent.keyDown(tab('Diagrama'), { key: 'ArrowRight' })
    expect(selected()).toBe('Piezas')
    fireEvent.keyDown(tab('Piezas'), { key: 'End' })
    expect(selected()).toBe('Tabla de verdad')
    fireEvent.keyDown(tab('Tabla de verdad'), { key: 'ArrowRight' })
    expect(selected()).toBe('Diagrama')
    fireEvent.keyDown(tab('Diagrama'), { key: 'ArrowLeft' })
    expect(selected()).toBe('Tabla de verdad')
    fireEvent.keyDown(tab('Tabla de verdad'), { key: 'Home' })
    expect(selected()).toBe('Diagrama')
  })

  it('goes back to the gallery when it was opened from there', () => {
    const onCancel = vi.fn()
    const { rerender } = render(<PreviewDialog incoming={{ ...incoming, fromGallery: true }} mine={[]} onCancel={onCancel} onOpen={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la galería', hidden: true }))
    expect(onCancel).toHaveBeenCalled()
    rerender(<PreviewDialog incoming={{ ...incoming, id: 2 }} mine={[]} onCancel={onCancel} onOpen={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Cancelar', hidden: true })).toBeTruthy()
  })

  it('offers to keep the current sandbox, checked by default', () => {
    const onOpen = vi.fn()
    render(<PreviewDialog incoming={incoming} mine={[]} keepCurrent={{ replaces: false }} onCancel={vi.fn()} onOpen={onOpen} />)
    expect(keepBox()).toBeTruthy()
    expect((keepBox() as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('Reemplaza lo que tienes en Modo libre.')).toBeTruthy()
    expect(screen.queryByText('Reemplaza el que ya guardaste.')).toBeNull()
    open()
    expect(onOpen).toHaveBeenCalledWith(incoming.project, true)
  })

  it('opens without keeping when unchecked, and warns when one is kept already', () => {
    const onOpen = vi.fn()
    render(<PreviewDialog incoming={incoming} mine={[]} keepCurrent={{ replaces: true }} onCancel={vi.fn()} onOpen={onOpen} />)
    expect(keepBox()?.getAttribute('aria-describedby')).toBe('keep-replaces')
    expect(screen.getByText('Reemplaza el que ya guardaste.')).toBeTruthy()
    fireEvent.click(keepBox()!)
    open()
    expect(onOpen).toHaveBeenCalledWith(incoming.project, false)
  })

  it('does not ask when the sandbox has nothing to keep', () => {
    const onOpen = vi.fn()
    render(<PreviewDialog incoming={incoming} mine={[]} onCancel={vi.fn()} onOpen={onOpen} />)
    expect(keepBox()).toBeNull()
    // Nothing there to replace, so it does not say it replaces anything.
    expect(screen.queryByText('Reemplaza lo que tienes en Modo libre.')).toBeNull()
    open()
    expect(onOpen).toHaveBeenCalledWith(incoming.project, false)
  })

  it('restoring the kept sandbox only confirms: no checkbox, and says what it does', () => {
    const onOpen = vi.fn()
    render(<PreviewDialog incoming={{ ...incoming, restore: true }} mine={[]} keepCurrent={{ replaces: true }} onCancel={vi.fn()} onOpen={onOpen} />)
    expect(screen.getByRole('heading', { name: '¿Restaurar tu Modo libre guardado?', hidden: true })).toBeTruthy()
    expect(keepBox()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sí, restaurar', hidden: true }))
    expect(onOpen).toHaveBeenCalledWith(incoming.project, false)
  })
})
