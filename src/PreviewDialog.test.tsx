// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { PreviewDialog } from './PreviewDialog.tsx'
import type { Incoming } from './PreviewDialog.tsx'
import { NOT } from './sim/examples.ts'

afterEach(cleanup)
// jsdom has no modal dialogs.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

const incoming: Incoming = { project: { version: 1, circuit: NOT, chips: [] }, id: 1, title: 'Prueba' }
const keepBox = () => screen.queryByRole('checkbox', { name: 'Guardar mi Modo libre actual para poder restaurarlo', hidden: true })
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Abrir en Modo libre', hidden: true }))

describe('PreviewDialog', () => {
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
