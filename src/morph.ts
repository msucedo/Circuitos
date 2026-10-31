import { flushSync } from 'react-dom'

/**
 * Applies a state update as a view transition: elements sharing a `view-transition-name` before and after
 * move and resize from one into the other (the gallery card into its preview, and back). While it runs,
 * `<html>` has the `morphing` class. Without the API, or with reduced motion, the update just happens.
 */
export function morph(update: () => void) {
  if (!('startViewTransition' in document) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update()
    return
  }
  const root = document.documentElement
  root.classList.add('morphing')
  // The new state has to be on the page when the callback returns, so it is rendered at once.
  const transition = document.startViewTransition(() => flushSync(update))
  void transition.finished.finally(() => root.classList.remove('morphing'))
}
