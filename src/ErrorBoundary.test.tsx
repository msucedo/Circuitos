// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary.tsx'

afterEach(cleanup)

function Broken(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  it('shows its children while nothing fails', () => {
    render(<ErrorBoundary><p>todo bien</p></ErrorBoundary>)
    expect(screen.getByText('todo bien')).toBeTruthy()
  })

  it('replaces a crashed tree with a message and a reload button', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Broken /></ErrorBoundary>)
    expect(screen.getByRole('alert').textContent).toContain('Algo salió mal')
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeTruthy()
    quiet.mockRestore()
  })
})
