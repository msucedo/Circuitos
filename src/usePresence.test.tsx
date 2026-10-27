// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { usePresence } from './usePresence.ts'

function Panel({ text }: { text?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const { shown, closing } = usePresence(text, ref)
  return shown ? (
    <p ref={ref} className={closing ? 'closing' : ''} inert={closing}>
      {shown}
    </p>
  ) : null
}

/** An exit animation that ends when the test says so. */
function animate() {
  let end = () => {}
  const finished = new Promise<void>((resolve) => (end = resolve))
  Element.prototype.getAnimations = () => [{ finished } as unknown as Animation]
  return () => act(async () => end())
}

describe('usePresence', () => {
  afterEach(() => {
    cleanup()
    delete (Element.prototype as Partial<Element>).getAnimations
  })

  it('removes the element at once when nothing animates', () => {
    const { rerender } = render(<Panel text="hola" />)
    expect(screen.getByText('hola')).toBeTruthy()
    rerender(<Panel />)
    expect(screen.queryByText('hola')).toBeNull()
  })

  it('keeps the last content, marked as closing, until the exit animation ends', async () => {
    const { rerender } = render(<Panel text="hola" />)
    const end = animate()
    rerender(<Panel />)
    const panel = screen.getByText('hola')
    expect(panel.className).toBe('closing')
    expect(panel.hasAttribute('inert')).toBe(true)
    await end()
    expect(screen.queryByText('hola')).toBeNull()
  })

  it('shows the new content when it opens again while closing', async () => {
    const { rerender } = render(<Panel text="hola" />)
    const end = animate()
    rerender(<Panel />)
    rerender(<Panel text="otra vez" />)
    const panel = screen.getByText('otra vez')
    expect(panel.className).toBe('')
    await end()
    expect(screen.getByText('otra vez')).toBeTruthy()
  })
})
