import { describe, expect, it } from 'vitest'
import { SPECS } from '../levels/specs.ts'
import { build, nand } from './build.ts'
import * as examples from './examples.ts'
import { LIBRARY, OR } from './examples.ts'
import { verify } from './verify.ts'

describe('verify', () => {
  it.each([...SPECS.keys()])('the reference %s passes its spec', (id) => {
    const circuit = examples[id as keyof typeof examples]
    if (!circuit || circuit instanceof Map) throw new Error(`missing example ${id}`)
    const result = verify(circuit, LIBRARY, SPECS.get(id)!)
    expect(result.error).toBeUndefined()
    expect(result.steps.filter((s) => !s.ok)).toEqual([])
    expect(result.passed).toBe(true)
  })

  it('reports the failing rows of a wrong circuit', () => {
    const result = verify(OR, LIBRARY, SPECS.get('XOR')!)
    expect(result.passed).toBe(false)
    expect(result.steps.filter((s) => !s.ok).map((s) => s.step.set)).toEqual([{ a: 1, b: 1 }])
  })

  it('reports missing or extra pins instead of rows', () => {
    const notGate = build({ inputs: ['x'], parts: { n: nand('x', 'x') }, outputs: { out: 'n' } })
    expect(verify(notGate, LIBRARY, SPECS.get('NOT')!)).toEqual({ passed: false, error: { code: 'missingInput', params: { name: 'a' } }, steps: [] })
  })

  it('turns structural errors into a problem', () => {
    const broken = build({ inputs: ['a'], parts: { x: { kind: 'NOPE', in: {} } }, outputs: { out: 'a' } })
    expect(verify(broken, LIBRARY, SPECS.get('NOT')!).error?.code).toBe('unknownKind')
  })

  it('fails a step that oscillates even if the output happens to match', () => {
    const ring = build({ inputs: ['a'], parts: { n: nand('n', 'a') }, outputs: { out: 'n' } })
    const result = verify(ring, LIBRARY, SPECS.get('NOT')!)
    expect(result.steps.map((s) => s.status)).toEqual(['stable', 'oscillating'])
    expect(result.passed).toBe(false)
  })
})
