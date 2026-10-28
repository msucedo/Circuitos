/**
 * Sound effects, made with Web Audio: no files to load, so the CSP stays as it is.
 * The context is made on the first sound, which always follows a click or a key,
 * so the browser lets it play. Without Web Audio, or while muted, nothing happens.
 */

/** Timing and loudness shared by every layer; times are in seconds from the start. */
interface Shape {
  at: number
  length: number
  gain: number
  /** How long it takes to reach its gain; `ATTACK` when not given. */
  attack?: number
}

/** One part of a sound: a tone, or a burst of filtered noise. */
type Layer =
  | (Shape & { tone: OscillatorType; from: number; to?: number })
  | (Shape & { noise: BiquadFilterType; from: number; to?: number; q?: number })

/** Loudness of everything; each layer's gain is relative to it. */
const MASTER_GAIN = 0.25
/** How long a layer takes to reach its gain; short enough to sound immediate, long enough not to click. */
const ATTACK = 0.005
/** Exponential ramps cannot reach 0, so they end here. */
const SILENT = 0.0001
/** A puff of air swells in instead of starting at once. */
const PUFF_ATTACK = 0.04
/** Length of the noise buffer every noise layer reuses. */
const NOISE_SECONDS = 1

/** Note frequencies in Hz. */
const NOTE = { G3: 196, D3: 146.83, D4: 293.66, A4: 440, E5: 659.25, C5: 523.25, G5: 783.99, C6: 1046.5, D6: 1174.66 }

const WIN: Layer[] = [
  { tone: 'triangle', from: NOTE.C5, at: 0, length: 0.12, gain: 0.7 },
  { tone: 'triangle', from: NOTE.E5, at: 0.09, length: 0.12, gain: 0.7 },
  { tone: 'triangle', from: NOTE.G5, at: 0.18, length: 0.12, gain: 0.7 },
  { tone: 'triangle', from: NOTE.C6, at: 0.27, length: 0.4, gain: 0.7 },
]

const end = (layers: Layer[]) => Math.max(...layers.map((l) => l.at + l.length))
const after = (layers: Layer[], start: number) => layers.map((l) => ({ ...l, at: l.at + start }))

const RECIPES = {
  // A soft puff of air, like a piece vanishing in smoke: muffled noise that swells and sinks,
  // over a faint low thump.
  poof: [
    { noise: 'bandpass', from: 1400, to: 350, q: 0.7, at: 0, length: 0.32, gain: 0.6, attack: PUFF_ATTACK },
    { tone: 'sine', from: 160, to: 70, at: 0, length: 0.22, gain: 0.25, attack: PUFF_ATTACK / 2 },
  ],
  reset: [
    { tone: 'triangle', from: NOTE.E5, at: 0, length: 0.1, gain: 0.6 },
    { tone: 'triangle', from: NOTE.A4, at: 0.08, length: 0.14, gain: 0.6 },
  ],
  win: WIN,
  fail: [
    { tone: 'square', from: NOTE.G3, at: 0, length: 0.16, gain: 0.25 },
    { tone: 'square', from: NOTE.D3, at: 0.16, length: 0.26, gain: 0.25 },
  ],
  // A gentle "not yet": two short, equal beeps, softer than a failed test.
  warn: [
    { tone: 'triangle', from: NOTE.A4, at: 0, length: 0.07, gain: 0.5 },
    { tone: 'triangle', from: NOTE.A4, at: 0.11, length: 0.09, gain: 0.5 },
  ],
  // Starts once the win jingle ends, so both can be asked for at once.
  unlock: after(
    [
      { tone: 'sine', from: NOTE.G5, at: 0, length: 0.16, gain: 0.6 },
      { tone: 'sine', from: NOTE.D6, at: 0.11, length: 0.3, gain: 0.6 },
    ],
    end(WIN),
  ),
  drop: [{ tone: 'sine', from: 260, to: 620, at: 0, length: 0.08, gain: 0.7 }],
  // These repeat a lot, so they are short and quieter.
  connect: [
    { noise: 'bandpass', from: 4200, q: 6, at: 0, length: 0.03, gain: 0.6 },
    { tone: 'sine', from: 1900, at: 0, length: 0.04, gain: 0.15 },
  ],
  toggleOn: [
    { noise: 'highpass', from: 2500, at: 0, length: 0.02, gain: 0.4 },
    { tone: 'sine', from: 900, at: 0, length: 0.03, gain: 0.2 },
  ],
  toggleOff: [
    { noise: 'highpass', from: 2500, at: 0, length: 0.02, gain: 0.4 },
    { tone: 'sine', from: 600, at: 0, length: 0.03, gain: 0.2 },
  ],
  tick: [{ noise: 'highpass', from: 3500, at: 0, length: 0.015, gain: 0.5 }],
  undo: [{ noise: 'bandpass', from: 2600, to: 700, q: 1.5, at: 0, length: 0.12, gain: 0.5 }],
  redo: [{ noise: 'bandpass', from: 700, to: 2600, q: 1.5, at: 0, length: 0.12, gain: 0.5 }],
  // A finger snap: a sharp, bright crack over a tiny body.
  snap: [
    { noise: 'bandpass', from: 2800, to: 1800, q: 1.2, at: 0, length: 0.05, gain: 0.9, attack: 0.001 },
    { tone: 'sine', from: 320, to: 180, at: 0, length: 0.04, gain: 0.2, attack: 0.001 },
  ],
  // A slot machine credit as another level opens, kept to its bones: a low leap up a fifth.
  // Far lower than the win jingle, so it never reads as a win.
  deal: [
    { tone: 'triangle', from: NOTE.D4, at: 0, length: 0.06, gain: 0.7 },
    { tone: 'triangle', from: NOTE.A4, at: 0.06, length: 0.22, gain: 0.7 },
  ],
  // A swoosh as a column, the table or the theory folds away or opens; lower than undo/redo.
  fold: [{ noise: 'lowpass', from: 2400, to: 500, at: 0, length: 0.2, gain: 0.9, attack: PUFF_ATTACK }],
  unfold: [{ noise: 'lowpass', from: 500, to: 2400, at: 0, length: 0.2, gain: 0.9, attack: PUFF_ATTACK }],
} satisfies Record<string, Layer[]>

export type SoundName = keyof typeof RECIPES
export const SOUND_NAMES = Object.keys(RECIPES) as SoundName[]

let muted = false
let context: AudioContext | undefined
let noise: AudioBuffer | undefined
/** Set once the browser refused a context, so it is not asked again on every sound. */
let unavailable = false

export function setMuted(value: boolean) {
  muted = value
}

function audio() {
  if (context || unavailable) return context
  try {
    if (typeof AudioContext === 'undefined') throw new Error('no Web Audio')
    context = new AudioContext()
    const buffer = context.createBuffer(1, Math.round(context.sampleRate * NOISE_SECONDS), context.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
    noise = buffer
  } catch {
    unavailable = true
    context = undefined
  }
  return context
}

/** Plays one layer; its nodes disconnect themselves when it ends. */
function layer(ctx: AudioContext, l: Layer, now: number) {
  const start = now + l.at
  const stop = start + l.length
  const envelope = ctx.createGain()
  envelope.gain.setValueAtTime(SILENT, start)
  envelope.gain.linearRampToValueAtTime(l.gain * MASTER_GAIN, start + (l.attack ?? ATTACK))
  envelope.gain.exponentialRampToValueAtTime(SILENT, stop)
  envelope.connect(ctx.destination)

  let source: AudioScheduledSourceNode
  let shaped: AudioNode[] = []
  if ('tone' in l) {
    const osc = ctx.createOscillator()
    osc.type = l.tone
    osc.frequency.setValueAtTime(l.from, start)
    if (l.to) osc.frequency.exponentialRampToValueAtTime(l.to, stop)
    osc.connect(envelope)
    source = osc
  } else {
    const filter = ctx.createBiquadFilter()
    filter.type = l.noise
    filter.frequency.setValueAtTime(l.from, start)
    if (l.to) filter.frequency.exponentialRampToValueAtTime(l.to, stop)
    if (l.q) filter.Q.value = l.q
    filter.connect(envelope)
    const buffer = ctx.createBufferSource()
    buffer.buffer = noise ?? null
    buffer.connect(filter)
    source = buffer
    shaped = [filter]
  }
  source.onended = () => {
    source.disconnect()
    for (const node of shaped) node.disconnect()
    envelope.disconnect()
  }
  source.start(start)
  source.stop(stop)
}

export function play(name: SoundName) {
  if (muted) return
  const ctx = audio()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') void ctx.resume()
    for (const l of RECIPES[name]) layer(ctx, l, ctx.currentTime)
  } catch {
    // A sound is never worth breaking the app for.
  }
}
