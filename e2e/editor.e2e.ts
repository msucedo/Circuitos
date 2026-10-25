import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SHOTS, addPiece, node, watchErrors, wire } from './helpers.ts'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

async function sandbox(page: Page) {
  await page.goto('/')
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
  await sandbox(page)
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
  await page.goto('/')
  await addPiece(page, 'NAND', 'nand1', { x: 380, y: 280 })
  await wire(page, ['nand1', 'out'], ['out', 'in'])
  await expect(page.locator('circle.packet').first()).toBeHidden()
})
