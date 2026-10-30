import { expect, test } from '@playwright/test'
import { SHOTS, addPiece, freezeHalfway, handle, levelButton, levelsBefore, node, recordSounds, restart, resumeAnimations, seedSolved, sounds, start, watchErrors, wire } from './helpers.ts'


test('the main actions make their sound, and Probar sounds different when it passes or fails', async ({ page }) => {
  const errors = watchErrors(page)
  await recordSounds(page)
  await start(page)

  await page.getByRole('button', { name: 'Probar' }).click()
  // The fail buzz is the only square wave.
  expect(await sounds(page)).toContain('square')

  await addPiece(page, 'NAND', 'nand1', { x: 380, y: 280 })
  expect(await sounds(page)).toContain('sine')
  await wire(page, ['a', 'out'], ['nand1', 'a'])
  await wire(page, ['a', 'out'], ['nand1', 'b'])
  await wire(page, ['nand1', 'out'], ['out', 'in'])
  expect(await sounds(page)).toContain('noise')
  await page.getByLabel('entrada a: 0').click()
  expect((await sounds(page)).length).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Probar' }).click()
  await expect(page.locator('.result.pass')).toBeVisible()
  const win = await sounds(page)
  // The jingle, then the unlock chime for AND.
  expect(win).toContain('triangle')
  expect(win).toContain('sine')
  expect(win).not.toContain('square')

  await page.keyboard.press('ControlOrMeta+z')
  expect(await sounds(page)).toEqual(['noise'])
  await node(page, 'nand1').click()
  await page.keyboard.press('Delete')
  await expect(node(page, 'nand1')).toHaveCount(0)
  // The puff of air over its low thump.
  expect(await sounds(page)).toEqual(['noise', 'sine'])

  // Nothing of the player's is left, so Reiniciar resets at once.
  await page.getByRole('button', { name: 'Reiniciar' }).click()
  expect(await sounds(page)).toEqual(['triangle', 'triangle'])
  expect(errors).toEqual([])
})

test('changing level deals a card: from the levels column, Siguiente and Modo libre, not the level already open', async ({ page }) => {
  await recordSounds(page)
  await start(page)
  const deal = ['triangle', 'triangle']

  await addPiece(page, 'NAND', 'nand1', { x: 380, y: 280 })
  await wire(page, ['a', 'out'], ['nand1', 'a'])
  await wire(page, ['a', 'out'], ['nand1', 'b'])
  await wire(page, ['nand1', 'out'], ['out', 'in'])
  await page.getByRole('button', { name: 'Probar' }).click()
  await expect(page.locator('.result.pass')).toBeVisible()
  await sounds(page)
  await page.locator('.result').getByRole('button', { name: /^Siguiente/ }).click()
  await expect(levelButton(page, 'AND')).toHaveAttribute('aria-current', 'true')
  expect(await sounds(page)).toEqual(deal)

  await levelButton(page, 'AND').click()
  expect(await sounds(page)).toEqual([])
  await levelButton(page, 'NOT').click()
  expect(await sounds(page)).toEqual(deal)
  await page.getByRole('button', { name: 'Modo libre' }).click()
  expect(await sounds(page)).toEqual(deal)
})

test('the welcome mutes the sounds, and the choice survives a reload', async ({ page }) => {
  await recordSounds(page)
  await start(page)
  await page.getByRole('button', { name: 'Acerca de Circuitos' }).click()
  const welcome = page.getByRole('dialog', { name: 'Circuitos' })
  const mute = welcome.getByRole('button', { name: 'Silenciar sonidos' })
  await expect(mute).toHaveAttribute('aria-pressed', 'false')
  await mute.click()
  await expect(mute).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: `${SHOTS}/welcome-muted.png`, animations: 'disabled' })
  await page.keyboard.press('Escape')
  await expect(welcome).toBeHidden()

  await page.getByRole('button', { name: 'Probar' }).click()
  await expect(page.locator('.result.fail')).toBeVisible()
  expect(await sounds(page)).toEqual([])
  await restart(page)
  await page.getByRole('button', { name: 'Acerca de Circuitos' }).click()
  await expect(mute).toHaveAttribute('aria-pressed', 'true')
})

test('the hint, theory and result fold away instead of vanishing', async ({ page }) => {
  await start(page, { theory: true })
  await page.getByText('Ver pista').click()
  const hint = page.getByText('NAND da 0 solo cuando sus dos entradas son 1.')
  await expect(hint).toBeVisible()
  await page.getByText('Ver pista').click()
  await expect(hint).toBeHidden()

  const theory = page.getByRole('complementary', { name: 'Historia y teoría' })
  await theory.getByRole('button', { name: 'Cerrar teoría' }).click()
  // It stays for its exit animation, out of reach, then goes.
  const slot = page.locator('.panel-slot', { has: theory })
  await expect(slot).toHaveClass(/closing/)
  await expect(slot).toHaveAttribute('inert')
  await expect(theory).toHaveCount(0)

  await page.getByRole('button', { name: 'Probar' }).click()
  const result = page.locator('.result')
  await page.getByRole('button', { name: 'Cerrar resultado' }).click()
  await expect(result).toHaveClass(/closing/)
  await expect(result).toHaveCount(0)
})

test('pieces pop in when added and shrink away when deleted, with their wires', async ({ page }) => {
  await start(page)
  await addPiece(page, 'NAND', 'nand1', { x: 380, y: 280 })
  // Gates pop in like the other chips.
  expect(await node(page, 'nand1').locator('.gate').evaluate((el) => getComputedStyle(el).animationName)).toBe('pop')
  await wire(page, ['a', 'out'], ['nand1', 'a'])

  await node(page, 'nand1').click()
  await page.keyboard.press('Delete')
  // It stays, out of reach, while it shrinks; its wire fades with it.
  await freezeHalfway(page, '.react-flow__node.leaving')
  await expect(node(page, 'nand1')).toHaveClass(/leaving/)
  await expect(page.locator('.react-flow__edge.leaving')).toHaveCount(1)
  await resumeAnimations(page)
  await expect(node(page, 'nand1')).toHaveCount(0)
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)

  // Undo brings it back without the exit class.
  await page.keyboard.press('ControlOrMeta+z')
  await expect(node(page, 'nand1')).not.toHaveClass(/leaving/)
})

test('after a piece pops in, its wires still meet the middle of its pins', async ({ page }) => {
  await start(page)
  await addPiece(page, 'NAND', 'nand1', { x: 380, y: 280 })
  await wire(page, ['a', 'out'], ['nand1', 'a'])
  await wire(page, ['a', 'out'], ['nand1', 'b'])
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
  for (const pin of ['a', 'b']) {
    const edge = page.getByTestId(`rf__edge-a.out->nand1.${pin}`).locator('.react-flow__edge-path')
    // Where the drawn wire starts and ends, on the screen.
    const ends = await edge.evaluate((el) => {
      const path = el as SVGPathElement
      const ctm = path.getScreenCTM()!
      const at = (length: number) => new DOMPoint(path.getPointAtLength(length).x, path.getPointAtLength(length).y).matrixTransform(ctm)
      const start = at(0)
      const end = at(path.getTotalLength())
      return { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } }
    })
    for (const [point, [nodeId, handleId]] of [
      [ends.start, ['a', 'out']],
      [ends.end, ['nand1', pin]],
    ] as const) {
      const box = (await handle(page, nodeId, handleId).boundingBox())!
      expect(Math.abs(point.y - (box.y + box.height / 2))).toBeLessThanOrEqual(1)
      expect(point.x).toBeGreaterThanOrEqual(box.x - 1)
      expect(point.x).toBeLessThanOrEqual(box.x + box.width + 1)
    }
  }
})

test('reduced motion: a deleted piece goes at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await start(page)
  await addPiece(page, 'NAND', 'nand1', { x: 380, y: 280 })
  await node(page, 'nand1').click()
  await page.keyboard.press('Delete')
  await expect(node(page, 'nand1')).toHaveCount(0)
})

test('reduced motion: panels close at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await start(page, { theory: true })
  const theory = page.getByRole('complementary', { name: 'Historia y teoría' })
  await theory.getByRole('button', { name: 'Cerrar teoría' }).click()
  expect(await page.locator('.theory-panel').count()).toBe(0)
})

test('the palette shows each basic piece and gate with its symbol, and plain chips without one', async ({ page }) => {
  await seedSolved(page, levelsBefore('NOT4'))
  await start(page)
  await page.getByRole('button', { name: 'Modo libre' }).click()
  const palette = page.getByRole('complementary', { name: 'Piezas' })
  const icon = (name: string) => palette.getByRole('button', { name, exact: true }).locator('svg.piece-icon')
  const withSymbol = ['Entrada', 'Salida', 'NAND', 'NOT', 'AND', 'OR', 'XOR', 'Medio sumador', 'Sumador completo', 'Sumador de 4 bits']
  for (const name of [...withSymbol, 'Multiplexor', 'Demultiplexor']) await expect(icon(name), name).toBeVisible()
  await expect(icon('Latch SR')).toHaveCount(0)
  await palette.screenshot({ path: `${SHOTS}/palette-icons.png` })
  // Tall enough to see every chip at once.
  await page.setViewportSize({ width: 1280, height: 1400 })
  await palette.screenshot({ path: `${SHOTS}/palette-chip-icons.png` })
})

test('the guide shows the same icons as the palette and the toolbar', async ({ page }) => {
  await page.goto('/')
  const welcome = page.getByRole('dialog', { name: 'Circuitos' })
  await welcome.getByRole('button', { name: 'Guía', exact: true }).click()
  const guide = page.getByRole('dialog', { name: 'Guía' })
  const term = (name: string) => guide.getByRole('term').filter({ hasText: new RegExp(`^${name}$`) })
  for (const name of ['Entrada', 'Salida', 'NAND', 'Reloj', 'Separar', 'Juntar', 'Fuente', 'Relé']) {
    await expect(term(name).first().locator('svg.piece-icon'), name).toHaveCount(1)
  }
  for (const name of ['Tabla', 'Teoría', 'Paso a paso', 'Plegar columnas']) await expect(term(name).locator('svg.icon'), name).toHaveCount(1)
  await expect(term('NAND universal').locator('svg')).toHaveCount(1)
  await expect(term('Bit').locator('svg')).toHaveCount(0)
  await expect(term('Probar').locator('svg')).toHaveCount(0)
  await guide.getByRole('navigation', { name: 'Índice' }).getByRole('button', { name: 'Piezas' }).click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/guide-pieces.png`, animations: 'disabled' })
})

test('the theory slides to its new place when the table opens or closes above it', async ({ page }) => {
  await start(page, { theory: true })
  const theory = page.locator('.theory-panel')
  const top = async () => (await theory.boundingBox())!.y
  const alone = await top()
  const table = page.getByRole('toolbar', { name: 'Herramientas' }).getByRole('button', { name: 'Tabla' })

  await table.click()
  await freezeHalfway(page, '.panel-slot')
  const opening = await top()
  await resumeAnimations(page)
  await expect(page.locator('.panel-slot.closing')).toHaveCount(0)
  const below = await top()
  expect(below).toBeGreaterThan(alone + 20)
  // Halfway through it is somewhere between, not already at either end.
  expect(opening).toBeGreaterThan(alone + 1)
  expect(opening).toBeLessThan(below - 1)
  await page.screenshot({ path: `${SHOTS}/panels-both.png` })

  await table.click()
  await freezeHalfway(page, '.panel-slot.closing')
  const closing = await top()
  await resumeAnimations(page)
  expect(closing).toBeGreaterThan(alone + 1)
  expect(closing).toBeLessThan(below - 1)
  await expect(page.locator('.panel-slot')).toHaveCount(1)
  expect(await top()).toBeCloseTo(alone, 0)
})

test('the hint marker is drawn about as big as the text', async ({ page }) => {
  await start(page)
  const summary = page.getByText('Ver pista')
  const marker = await summary.evaluate((el) => {
    const before = getComputedStyle(el, '::before')
    return { width: parseFloat(before.width), font: parseFloat(getComputedStyle(el).fontSize) }
  })
  expect(marker.width).toBeGreaterThanOrEqual(marker.font * 0.55)
  await summary.click()
  await page.waitForTimeout(600)
  await page.locator('.brief').screenshot({ path: `${SHOTS}/hint-open.png` })
})
