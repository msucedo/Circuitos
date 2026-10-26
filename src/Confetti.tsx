import type { CSSProperties } from 'react'

const COLORS = ['var(--on)', 'var(--accent)', 'var(--warn)', 'var(--bad)', '#c084fc']
const COUNT = 18

/** Fixed pieces fanned out upwards; the small per-piece offsets keep the burst from looking regular. */
const PIECES = Array.from({ length: COUNT }, (_, i) => {
  const angle = (-160 + (140 * i) / (COUNT - 1) + ((i * 37) % 11) - 5) * (Math.PI / 180)
  const distance = 50 + ((i * 53) % 61)
  return {
    style: {
      '--x': `${Math.round(Math.cos(angle) * distance)}px`,
      '--y': `${Math.round(Math.sin(angle) * distance)}px`,
      '--r': `${((i * 97) % 360) - 180}deg`,
      '--c': COLORS[i % COLORS.length],
      animationDelay: `${(i % 4) * 30}ms`,
    } as CSSProperties,
    round: i % 3 === 0,
  }
})

/** A small CSS-only burst of confetti; it plays once when mounted and rests invisible. */
export function Confetti() {
  return (
    <span className="confetti" aria-hidden="true">
      {PIECES.map((p, i) => (
        <i key={i} className={p.round ? 'round' : undefined} style={p.style} />
      ))}
    </span>
  )
}
