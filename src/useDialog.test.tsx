// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDialog } from './useDialog.ts'

afterEach(cleanup)

function Dialog({ onClose }: { onClose: () => void }) {
  const { dialog } = useDialog(false, onClose)
  return (
    <dialog ref={dialog}>
      <input type="file" />
    </dialog>
  )
}

describe('useDialog', () => {
  it('closes on the dialog’s own cancel (Esc)', () => {
    const onClose = vi.fn()
    const { container } = render(<Dialog onClose={onClose} />)
    container.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('stays open when a file picker inside it is cancelled (that cancel bubbles up)', () => {
    const onClose = vi.fn()
    const { container } = render(<Dialog onClose={onClose} />)
    container.querySelector('input')!.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true }))
    expect(onClose).not.toHaveBeenCalled()
  })
})
