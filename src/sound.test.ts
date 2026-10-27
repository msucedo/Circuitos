import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Just enough of an AudioContext to count what each sound starts. */
class FakeContext {
  static made = 0
  static started = 0
  static gains: { linearRampToValueAtTime: ReturnType<typeof vi.fn> }[] = []
  currentTime = 0
  sampleRate = 8000
  state: AudioContextState = 'suspended'
  destination = {}
  constructor() {
    FakeContext.made++
  }
  resume = vi.fn(() => {
    this.state = 'running'
    return Promise.resolve()
  })
  private node() {
    const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() })
    return {
      frequency: param(),
      gain: param(),
      Q: param(),
      type: '',
      buffer: null,
      onended: null,
      connect: vi.fn((next: unknown) => next),
      disconnect: vi.fn(),
      start: vi.fn(() => FakeContext.started++),
      stop: vi.fn(),
    }
  }
  createOscillator = () => this.node()
  createGain = () => {
    const node = this.node()
    FakeContext.gains.push(node.gain)
    return node
  }
  createBiquadFilter = () => this.node()
  createBufferSource = () => this.node()
  createBuffer = (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) })
}

async function freshSound() {
  vi.resetModules()
  return import('./sound.ts')
}

describe('sound', () => {
  beforeEach(() => {
    FakeContext.made = 0
    FakeContext.started = 0
    FakeContext.gains = []
  })
  afterEach(() => vi.unstubAllGlobals())

  it('stays quiet without Web Audio', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const { SOUND_NAMES, play } = await freshSound()
    for (const name of SOUND_NAMES) expect(() => play(name)).not.toThrow()
  })

  it('plays every sound on a single context, made on first use', async () => {
    vi.stubGlobal('AudioContext', FakeContext)
    const { SOUND_NAMES, play } = await freshSound()
    expect(FakeContext.made).toBe(0)
    for (const name of SOUND_NAMES) {
      const before = FakeContext.started
      play(name)
      expect(FakeContext.started, name).toBeGreaterThan(before)
    }
    expect(FakeContext.made).toBe(1)
  })

  it('the delete puff swells in softly instead of clicking on', async () => {
    vi.stubGlobal('AudioContext', FakeContext)
    const { play } = await freshSound()
    play('tick')
    const [click] = FakeContext.gains.map((g) => g.linearRampToValueAtTime.mock.calls[0][1] as number)
    FakeContext.gains = []
    play('poof')
    const swells = FakeContext.gains.map((g) => g.linearRampToValueAtTime.mock.calls[0][1] as number)
    expect(Math.max(...swells)).toBeGreaterThan(click * 4)
  })

  it('makes no sound and no context while muted', async () => {
    vi.stubGlobal('AudioContext', FakeContext)
    const { play, setMuted } = await freshSound()
    setMuted(true)
    play('win')
    expect(FakeContext.made).toBe(0)
    setMuted(false)
    play('win')
    expect(FakeContext.started).toBeGreaterThan(0)
  })

  it('never throws when the browser refuses the context', async () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new DOMException('no audio', 'NotAllowedError')
        }
      },
    )
    const { play } = await freshSound()
    expect(() => play('poof')).not.toThrow()
  })
})
