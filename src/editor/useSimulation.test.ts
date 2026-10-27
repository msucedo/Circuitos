// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { build, nand } from '../sim/build.ts'
import type { Bit } from '../sim/types.ts'
import { useSimulation } from './useSimulation.ts'

const chain = build({ inputs: ['a'], parts: { n1: nand('a', 'a'), n2: nand('n1', 'n1') }, outputs: { out: 'n2' } })
const library = new Map()

describe('useSimulation in step mode', () => {
  // One map per value: a new map is an input change.
  const inputs = (a: number) => ({ map: new Map([['a', a]]) })
  const setup = (circuit = chain) => {
    const hook = renderHook(({ map, wiring }) => useSimulation(wiring, library, map, 0 as Bit, true), {
      initialProps: { ...inputs(0), wiring: circuit },
    })
    const { result } = hook
    // Settle the start: n1 = 1, then n2 = 0.
    for (let i = 0; i < 4 && !result.current.signals.settled; i++) act(() => result.current.step())
    expect(result.current.signals.settled).toBe(true)
    const changed = () => ['a', 'n1', 'n2'].filter((id) => result.current.signals.changed(id, 'out'))
    return { ...hook, changed }
  }

  it('marks what the last event changed: an input change or a step', () => {
    const { result, rerender, changed } = setup()
    rerender({ ...inputs(1), wiring: chain })
    expect(changed()).toEqual(['a'])
    act(() => result.current.step())
    expect(changed()).toEqual(['n1'])
    act(() => result.current.step())
    expect(changed()).toEqual(['n2'])
    act(() => result.current.step())
    expect(result.current.signals.settled).toBe(true)
    expect(changed()).toEqual([])
    rerender({ ...inputs(0), wiring: chain })
    expect(changed()).toEqual(['a'])
  })

  it('marks an input change on a circuit that has not stepped yet', () => {
    const { result, rerender } = renderHook(({ map }) => useSimulation(chain, library, map, 0 as Bit, true), { initialProps: inputs(0) })
    rerender(inputs(1))
    expect(result.current.signals.changed('a', 'out')).toBe(true)
  })

  it('marks nothing when step mode starts after a change made outside it', () => {
    const on = inputs(1).map
    const { result, rerender } = renderHook(({ map, step }) => useSimulation(chain, library, map, 0 as Bit, step), {
      initialProps: { ...inputs(0), step: false },
    })
    rerender({ map: on, step: false })
    rerender({ map: on, step: true })
    expect(['a', 'n1', 'n2'].filter((id) => result.current.signals.changed(id, 'out'))).toEqual([])
  })

  it('marks nothing after the circuit itself changes', () => {
    const { rerender, changed } = setup()
    const rewired = build({ inputs: ['a'], parts: { n1: nand('a', 'a'), n2: nand('n1', 'a') }, outputs: { out: 'n2' } })
    rerender({ ...inputs(1), wiring: rewired })
    expect(changed()).toEqual([])
  })
})
