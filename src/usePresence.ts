import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/**
 * Calls `done` once every animation running on `el` itself ends, or at once when
 * there is none (reduced motion, or no browser support). Returns a cancel function.
 */
export function afterAnimations(el: Element, done: () => void) {
  let cancelled = false
  const finish = () => {
    if (!cancelled) done()
  }
  // Reading the animations applies the latest classes first.
  const animations = el.getAnimations?.() ?? []
  if (animations.length === 0) finish()
  else void Promise.all(animations.map((a) => a.finished)).then(finish, finish)
  return () => {
    cancelled = true
  }
}

/**
 * Keeps an element on the page while it plays its exit animation. Shown while `value`
 * is truthy; when it turns falsy, `shown` keeps the last value and `closing` is true
 * until the `.closing` animation from the CSS ends on `ref`, the animated element.
 */
export function usePresence<V>(value: V, ref: RefObject<Element | null>) {
  const [last, setLast] = useState<V | undefined>(value || undefined)
  const [closing, setClosing] = useState(false)
  const open = !!value
  // Derived from the props during render, so the closing element never unmounts for a frame.
  if (open && value !== last) setLast(value)
  if (open && closing) setClosing(false)
  if (!open && last !== undefined && !closing) setClosing(true)

  useEffect(() => {
    if (!closing) return
    const done = () => {
      setClosing(false)
      setLast(undefined)
    }
    const el = ref.current
    if (!el) return done()
    return afterAnimations(el, done)
  }, [closing, ref])

  return { shown: open ? value : last, closing }
}
