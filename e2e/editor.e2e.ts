import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { addPiece, node, restart, seedSolved, SHOTS, start, watchErrors, wire } from './helpers.ts'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

async function sandbox(page: Page) {
  await start(page)
  await page.getByRole('button', { name: 'Modo libre' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Modo libre' })).toBeVisible()
}

test('undo, redo, copy and paste from the keyboard', async ({ page }) => {
  await sandbox(page)
  await addPiece(page, 'NAND', 'nand1', { x: 300, y: 200 })
  // First undo puts the piece back where it was added, the second removes it.
  await page.keyboard.press(`${mod}+z`)
  await page.keyboard.press(`${mod}+z`)
  await expect(node(page, 'nand1')).toHaveCount(0)
  await page.keyboard.press(`${mod}+Shift+z`)
  await expect(node(page, 'nand1')).toBeVisible()
  await node(page, 'nand1').click()
  await page.keyboard.press(`${mod}+c`)
  await page.keyboard.press(`${mod}+v`)
  await expect(node(page, 'nand2')).toBeVisible()
  await page.keyboard.press('Delete')
  await expect(node(page, 'nand2')).toHaveCount(0)
})

test('a 4-bit bus split and joined again keeps its value', async ({ page }) => {
  const errors = watchErrors(page)
  await sandbox(page)
  await page.getByLabel('Bits').selectOption('4')
  await addPiece(page, 'Entrada 4', 'input1', { x: 120, y: 250 })
  await addPiece(page, 'Separar 4', 'split1', { x: 320, y: 250 })
  await addPiece(page, 'Juntar 4', 'join1', { x: 520, y: 250 })
  await addPiece(page, 'Salida 4', 'output1', { x: 720, y: 250 })
  await wire(page, ['input1', 'out'], ['split1', 'in'])
  for (const b of ['b0', 'b1', 'b2', 'b3']) await wire(page, ['split1', b], ['join1', b])
  await wire(page, ['join1', 'out'], ['output1', 'in'])
  await page.getByLabel('entrada input1 (4 bits)').fill('13')
  await expect(page.getByLabel('salida output1: 13')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/bus.png` })
  expect(errors).toEqual([])
})

test('importing an invalid file shows an error; exporting downloads valid JSON', async ({ page }) => {
  await sandbox(page)
  await page.locator('input[type=file]').setInputFiles({ name: 'malo.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,') })
  await expect(page.getByRole('alert')).toContainText('No se pudo importar')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar' }).click()
  const file = await (await download).path()
  const { readFileSync } = await import('node:fs')
  expect(JSON.parse(readFileSync(file, 'utf8')).version).toBe(1)
})

test('phone width: no horizontal scroll and the palette still works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await start(page)
  // On a phone the levels are a compact picker, so the canvas shows without scrolling.
  await expect(page.getByRole('navigation', { name: 'Niveles' }).getByRole('list')).toBeHidden()
  const canvas = await page.locator('.react-flow').boundingBox()
  expect(canvas && canvas.y < 844).toBe(true)
  await page.getByLabel('Nivel', { exact: true }).selectOption('sandbox')
  await expect(page.getByRole('heading', { level: 2, name: 'Modo libre' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  const nand = page.getByRole('complementary', { name: 'Piezas' }).getByRole('button', { name: 'NAND', exact: true })
  await nand.click()
  await nand.click()
  await expect(node(page, 'nand1')).toBeVisible()
  // The second copy lands next to the first one, not on top of it.
  const [a, b] = [await node(page, 'nand1').boundingBox(), await node(page, 'nand2').boundingBox()]
  expect(a && b && (a.x !== b.x || a.y !== b.y)).toBe(true)
  await page.screenshot({ path: `${SHOTS}/phone.png`, fullPage: true })
})

test('reduced motion: no packets travel along the wires', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await start(page)
  await addPiece(page, 'NAND', 'nand1', { x: 380, y: 280 })
  await wire(page, ['nand1', 'out'], ['out', 'in'])
  await expect(page.locator('circle.packet').first()).toBeHidden()
})

test('the status badge does not cover the zoom controls', async ({ page }) => {
  const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await start(page)
    const status = await page.locator('.editor .status').boundingBox()
    for (const button of await page.locator('.react-flow__controls-button').all()) {
      const box = await button.boundingBox()
      expect(box && status && overlaps(box, status), `${viewport.width}px`).toBe(false)
    }
  }
  await page.getByRole('button', { name: 'Fit View' }).click()
})

test('logic gates show their real symbol on the canvas', async ({ page }) => {
  await seedSolved(page, ['NOT', 'AND', 'OR', 'XOR', 'HALF_ADDER'])
  await sandbox(page)
  const spots: [string, string, { x: number; y: number }][] = [
    ['NAND', 'nand1', { x: 160, y: 140 }],
    ['NOT', 'not1', { x: 160, y: 300 }],
    ['AND', 'and1', { x: 360, y: 140 }],
    ['OR', 'or1', { x: 360, y: 300 }],
    ['XOR', 'xor1', { x: 560, y: 140 }],
    ['Medio sumador', 'half_adder1', { x: 560, y: 300 }],
  ]
  for (const [label, id, to] of spots) await addPiece(page, label, id, to)
  await expect(page.locator('.gate')).toHaveCount(5)
  await wire(page, ['nand1', 'out'], ['and1', 'a'])
  await page.locator('.react-flow__pane').click({ position: { x: 40, y: 500 } })
  await page.screenshot({ path: `${SHOTS}/gates.png` })
})

test('dragging on the empty canvas draws a selection box', async ({ page }) => {
  await sandbox(page)
  await addPiece(page, 'NAND', 'nand1', { x: 300, y: 250 })
  await addPiece(page, 'NAND', 'nand2', { x: 420, y: 330 })
  const canvas = await page.locator('.react-flow').boundingBox()
  if (!canvas) throw new Error('no canvas')
  await page.locator('.react-flow__pane').click({ position: { x: 40, y: 500 } })
  await page.mouse.move(canvas.x + 200, canvas.y + 150)
  await page.mouse.down()
  await page.mouse.move(canvas.x + 560, canvas.y + 450, { steps: 10 })
  await page.mouse.up()
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2)
  await page.getByRole('toolbar', { name: 'Herramientas' }).getByRole('button', { name: 'Borrar' }).click()
  await expect(page.locator('.gate')).toHaveCount(0)
})

test('packets move at the same speed on short and long wires', async ({ page }) => {
  await start(page)
  await addPiece(page, 'NAND', 'nand1', { x: 200, y: 280 })
  await wire(page, ['a', 'out'], ['nand1', 'a'])
  await wire(page, ['nand1', 'out'], ['out', 'in'])
  await page.getByLabel('entrada a: 0').click() // a=1: both wires change, so both send a packet
  const speeds = await page.evaluate(() =>
    [...document.querySelectorAll('.react-flow__edge')].map((edge) => {
      const path = edge.querySelector<SVGPathElement>('path.wire')!
      const motion = edge.querySelector('animateMotion')!
      const loop = parseFloat(motion.getAttribute('dur')!)
      const cross = Number(motion.getAttribute('keyTimes')!.split(';')[1] ?? 1)
      return path.getTotalLength() / (loop * cross)
    }),
  )
  expect(speeds).toHaveLength(2)
  expect(Math.abs(speeds[0] - speeds[1])).toBeLessThan(0.01)
})

test('packets pause while a piece is dragged and come back when it is dropped', async ({ page }) => {
  await start(page)
  await addPiece(page, 'NAND', 'nand1', { x: 300, y: 280 })
  await wire(page, ['nand1', 'out'], ['out', 'in']) // NAND of two 0s is 1: the wire carries a packet
  const packets = page.locator('circle.packet')
  await expect(packets).toHaveCount(1)
  const canvas = await page.locator('.react-flow').boundingBox()
  const title = await node(page, 'nand1').locator('.chip-title, .pin-name').first().boundingBox()
  if (!canvas || !title) throw new Error('not visible')
  await page.mouse.move(title.x + title.width / 2, title.y + title.height / 2)
  await page.mouse.down()
  await page.mouse.move(canvas.x + 360, canvas.y + 200, { steps: 6 })
  await expect(packets).toHaveCount(0)
  await page.mouse.move(canvas.x + 380, canvas.y + 180, { steps: 4 })
  await expect(packets).toHaveCount(0)
  await page.mouse.up()
  await expect(packets).toHaveCount(1)
})

test('step mode marks the wires the last step changed', async ({ page }) => {
  await start(page)
  await addPiece(page, 'NAND', 'nand1', { x: 380, y: 280 })
  await wire(page, ['a', 'out'], ['nand1', 'a'])
  await wire(page, ['a', 'out'], ['nand1', 'b'])
  await wire(page, ['nand1', 'out'], ['out', 'in'])
  const toolbar = page.getByRole('toolbar', { name: 'Herramientas' })
  await toolbar.getByRole('button', { name: 'Paso a paso' }).click()
  const marked = page.locator('.wire.just-changed')
  await expect(marked).toHaveCount(0)
  // Turning the input on marks its two wires; the next step marks only the NAND's.
  await page.getByLabel('entrada a: 0').click()
  await expect(marked).toHaveCount(2)
  await toolbar.getByRole('button', { name: 'Avanzar' }).click()
  const nandWire = page.getByTestId('rf__edge-nand1.out->out.in')
  await expect(nandWire.locator('.wire.just-changed')).toHaveCount(1)
  await expect(marked).toHaveCount(1)
  // Solid red, with a red packet travelling along it.
  const red = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bad').trim())
  const toRgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`
  await expect(nandWire.locator('.wire')).toHaveCSS('stroke', toRgb(red))
  await expect(nandWire.locator('.wire')).toHaveCSS('filter', 'none')
  await expect(nandWire.locator('circle.packet.changed')).toHaveCount(1)
  await page.screenshot({ path: `${SHOTS}/step-changed.png`, animations: 'disabled' })
})

test('the levels and pieces columns fold on their own and stay folded after a reload', async ({ page }) => {
  await start(page)
  const levels = page.getByRole('navigation', { name: 'Niveles' })
  const pieces = page.getByRole('complementary', { name: 'Piezas' })
  const canvasWidth = async () => (await page.locator('.react-flow').boundingBox())?.width ?? 0
  const before = await canvasWidth()

  await levels.getByRole('button', { name: 'Ocultar niveles' }).click()
  await expect(levels.getByRole('list')).toBeHidden()
  await expect(levels.getByRole('button', { name: 'Mostrar niveles' })).toHaveAttribute('aria-expanded', 'false')
  await expect(pieces.getByRole('button', { name: 'NAND', exact: true })).toBeVisible()

  await pieces.getByRole('button', { name: 'Ocultar piezas' }).click()
  await expect(pieces.getByRole('button', { name: 'NAND', exact: true })).toBeHidden()
  // Both columns end up as narrow rails once their transition ends.
  const width = (locator: typeof levels) => locator.evaluate((el) => el.getBoundingClientRect().width)
  await expect.poll(() => width(pieces)).toBeLessThan(60)
  await expect.poll(() => width(levels)).toBeLessThan(60)
  expect(await canvasWidth()).toBeGreaterThan(before)
  await page.screenshot({ path: `${SHOTS}/collapsed.png` })

  await restart(page)
  await expect(levels.getByRole('list')).toBeHidden()
  await expect(pieces.getByRole('button', { name: 'NAND', exact: true })).toBeHidden()
  await levels.getByRole('button', { name: 'Mostrar niveles' }).click()
  await pieces.getByRole('button', { name: 'Mostrar piezas' }).click()
  await expect(levels.getByRole('list')).toBeVisible()
  await expect(pieces.getByRole('button', { name: 'NAND', exact: true })).toBeVisible()
  // The content fades in once the column is open, keeping its width so the text does not rewrap.
  const opacity = (locator: typeof levels) => locator.evaluate((el) => Number(getComputedStyle(el).opacity))
  await expect.poll(() => opacity(levels.locator('.levels-body'))).toBe(1)
  await expect.poll(() => width(levels)).toBeGreaterThan(150)
  // Opening the columns narrows the canvas; the view follows, so both pins stay whole on screen.
  const inside = async (id: string) => {
    const [pin, area] = [await node(page, id).boundingBox(), await page.locator('.react-flow').boundingBox()]
    return !!pin && !!area && pin.x >= area.x && pin.x + pin.width <= area.x + area.width
  }
  await expect.poll(() => inside('a')).toBe(true)
  await expect.poll(() => inside('out')).toBe(true)
  // Both fold buttons keep the same gap to the right edge of their column.
  const gap = async (column: typeof levels, name: string) => {
    const [button, box] = [await column.getByRole('button', { name }).boundingBox(), await column.boundingBox()]
    return box!.x + box!.width - (button!.x + button!.width)
  }
  const levelsGap = await gap(levels, 'Ocultar niveles')
  expect(levelsGap).toBeGreaterThanOrEqual(8)
  expect(Math.abs(levelsGap - (await gap(pieces, 'Ocultar piezas')))).toBeLessThanOrEqual(3)
  // Free mode sits right under the guide, above every level.
  const order = await levels.locator('.levels-body button:visible').allTextContents()
  expect(order.slice(0, 3).map((t) => t.trim())).toEqual(['Guía', 'Modo libre', 'Relés opcional'])
  await page.screenshot({ path: `${SHOTS}/expanded.png` })
})

test('the theory panel opens the first time, stays closed once closed, and leaves the pins in view', async ({ page }) => {
  await start(page, { theory: true })
  const theory = page.getByRole('complementary', { name: 'Historia y teoría' })
  await expect(theory).toContainText('NOT')
  // The first fit leaves room for the panel, so it covers no pin.
  const panel = await theory.boundingBox()
  const out = await node(page, 'out').boundingBox()
  expect(panel && out && out.x + out.width < panel.x).toBe(true)
  await page.screenshot({ path: `${SHOTS}/theory.png` })

  await theory.getByRole('button', { name: 'Cerrar teoría' }).click()
  await expect(theory).toBeHidden()
  await restart(page)
  await expect(theory).toBeHidden()
  const toggle = page.getByRole('toolbar', { name: 'Herramientas' }).getByRole('button', { name: 'Teoría' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(theory).toBeVisible()
})
