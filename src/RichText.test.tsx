// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RichText } from './RichText.tsx'

afterEach(cleanup)

describe('RichText', () => {
  it('styles pins and values, and splits paragraphs on blank lines', () => {
    const { container } = render(<RichText text={'La salida es <v>1</v> solo si <pin>a</pin> y <pin>b</pin> son <v>1</v>.\n\nOtro: <b>párrafo</b>. Ver levels.AND.goal.'} />)
    const paragraphs = [...container.querySelectorAll('p')]
    expect(paragraphs.map((p) => p.textContent)).toEqual(['La salida es 1 solo si a y b son 1.', 'Otro: párrafo. Ver levels.AND.goal.'])
    expect([...container.querySelectorAll('code.pin-ref')].map((e) => e.textContent)).toEqual(['a', 'b'])
    expect([...container.querySelectorAll('.bit')].map((e) => e.textContent)).toEqual(['1', '1'])
    expect(container.querySelector('strong')?.textContent).toBe('párrafo')
  })

  it('never turns other markup into elements', () => {
    const { container } = render(<RichText text={'<img src=x onerror="alert(1)"> <a href="javascript:alert(1)">x</a> <pin onclick="x">a</pin>'} />)
    expect(container.querySelector('img, a, [onclick], [onerror]')).toBeNull()
  })
})
