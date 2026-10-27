import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/**
 * Shows a native modal dialog while `open` is true: the browser traps focus and
 * hides the page behind it. `focus` gets the focus on opening. Closing (also with
 * Esc, which asks `onClose`) first plays the `.closing` animation from the CSS;
 * `shown` stays true until it ends, so the content can stay until then.
 */
export function useDialog(open: boolean, onClose: () => void, focus?: RefObject<HTMLElement | null>) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [closing, setClosing] = useState(false)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Esc would close at once; ask the owner instead, so the exit animates like the close button.
  useEffect(() => {
    const el = dialog.current
    if (!el) return
    const cancel = (event: Event) => {
      event.preventDefault()
      onCloseRef.current()
    }
    el.addEventListener('cancel', cancel)
    return () => el.removeEventListener('cancel', cancel)
  }, [])

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open) {
      if (!el.open) {
        el.showModal()
        focus?.current?.focus()
      }
      return
    }
    if (!el.open) return
    let cancelled = false
    el.classList.add('closing')
    setClosing(true)
    const finish = () => {
      if (cancelled) return
      el.classList.remove('closing')
      el.close()
      setClosing(false)
    }
    // Reading the animations applies the new class first. None (reduced motion, or no browser support): close now.
    const animations = el.getAnimations?.() ?? []
    if (animations.length === 0) finish()
    else void Promise.all(animations.map((a) => a.finished)).then(finish, finish)
    // Opened again before the exit ended: stop it where it is.
    return () => {
      cancelled = true
      el.classList.remove('closing')
      setClosing(false)
    }
  }, [open, focus])

  return { dialog, shown: open || closing }
}
