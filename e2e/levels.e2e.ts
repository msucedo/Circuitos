import { expect, test } from '@playwright/test'
import { SHOTS, addPiece, handle, node, openLevel, seedSolved, watchErrors, wire } from './helpers.ts'

test('loads the built app with no console errors or CSP violations', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Circuitos' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'NOT' })).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/start.png` })
  expect(errors).toEqual([])
})

test('level 0: a NAND made of relays passes', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await openLevel(page, 'Relés')
  const palette = page.getByRole('complementary', { name: 'Piezas' })
  await expect(palette.getByRole('button')).toHaveText(['Fuente', 'Relé', 'Relé inverso'])

  // The level's pins sit at the left (a, b) and right (out) of the canvas.
  await addPiece(page, 'Fuente', 'vcc1', { x: 260, y: 520 })
  await addPiece(page, 'Relé', 'relay1', { x: 300, y: 150 })
  await addPiece(page, 'Relé', 'relay2', { x: 450, y: 250 })
  await addPiece(page, 'Relé inverso', 'relay_nc1', { x: 610, y: 420 })
  await wire(page, ['a', 'out'], ['relay1', 'c'])
  await wire(page, ['vcc1', 'out'], ['relay1', 'in'])
  await wire(page, ['b', 'out'], ['relay2', 'c'])
  await wire(page, ['relay1', 'out'], ['relay2', 'in'])
  await wire(page, ['relay2', 'out'], ['relay_nc1', 'c'])
  await wire(page, ['vcc1', 'out'], ['relay_nc1', 'in'])
  await wire(page, ['relay_nc1', 'out'], ['out', 'in'])

  await expect(page.getByLabel('salida out: 1')).toBeVisible()
  await page.getByLabel('entrada a: 0').click()
  await page.getByLabel('entrada b: 0').click()
  await expect(page.getByLabel('salida out: 0')).toBeVisible()
  // Input pins light up with the wire that feeds them.
  await expect(handle(page, 'relay1', 'c')).toHaveClass(/\bon\b/)
  await page.getByLabel('entrada a: 1').click()
  await expect(handle(page, 'relay1', 'c')).not.toHaveClass(/\bon\b/)
  await page.getByLabel('entrada a: 0').click()
  await page.screenshot({ path: `${SHOTS}/relays.png` })

  await page.getByRole('button', { name: 'Probar' }).click()
  await expect(page.getByText('¡Funciona! Nivel resuelto.')).toBeVisible()
  await expect(node(page, 'relay1')).toBeVisible()
  expect(errors).toEqual([])
})

test('NOT by hand: the LED follows the input, Probar unlocks AND, and progress survives a reload', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await addPiece(page, 'NAND', 'nand1', { x: 380, y: 280 })
  await wire(page, ['a', 'out'], ['nand1', 'a'])
  await wire(page, ['a', 'out'], ['nand1', 'b'])
  await wire(page, ['nand1', 'out'], ['out', 'in'])
  await expect(page.getByLabel('salida out: 1')).toBeVisible()
  await page.getByLabel('entrada a: 0').click()
  await expect(page.getByLabel('salida out: 0')).toBeVisible()

  await page.getByRole('button', { name: 'Probar' }).click()
  await expect(page.getByText('ya está en tu paleta')).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Niveles' })
  await expect(nav.getByRole('button', { name: 'AND', exact: true })).toBeEnabled()
  await page.screenshot({ path: `${SHOTS}/not-solved.png` })

  await page.reload()
  await expect(nav.getByRole('button', { name: /^NOT/ })).toContainText('✓')
  await openLevel(page, 'NOT')
  await expect(node(page, 'nand1')).toBeVisible()
  await openLevel(page, 'AND')
  await expect(page.getByRole('complementary', { name: 'Piezas' }).getByRole('button')).toHaveText(['NAND', 'NOT'])
  expect(errors).toEqual([])
})

test('the live table of the half adder shows 1 + 1 = carry 1, sum 0', async ({ page }) => {
  await seedSolved(page, ['NOT', 'AND', 'OR', 'XOR'])
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 2, name: 'Medio sumador' })).toBeVisible()
  await addPiece(page, 'XOR', 'xor1', { x: 380, y: 200 })
  await addPiece(page, 'AND', 'and1', { x: 380, y: 420 })
  await wire(page, ['a', 'out'], ['xor1', 'a'])
  await wire(page, ['b', 'out'], ['xor1', 'b'])
  await wire(page, ['a', 'out'], ['and1', 'a'])
  await wire(page, ['b', 'out'], ['and1', 'b'])
  await wire(page, ['xor1', 'out'], ['sum', 'in'])
  await wire(page, ['and1', 'out'], ['carry', 'in'])
  await page.getByRole('button', { name: 'Tabla' }).click()
  const table = page.getByRole('complementary', { name: 'Tabla de verdad' })
  await expect(table.locator('tbody tr')).toHaveCount(4)
  // a b | sum carry (tu circuito) | sum carry (esperado) | ✓
  await expect(table.locator('tbody tr').last().locator('td')).toHaveText(['1', '1', '0', '1', '0', '1', '✓'])
  await expect(table.locator('tr.wrong')).toHaveCount(0)
  await page.screenshot({ path: `${SHOTS}/half-adder-table.png` })
})

test('a failing Probar says how many pass and marks the wrong outputs', async ({ page }) => {
  await page.goto('/')
  await wire(page, ['a', 'out'], ['out', 'in'])
  await expect(node(page, 'out').locator('.react-flow__handle')).not.toHaveClass(/\bon\b/)
  await page.getByLabel('entrada a: 0').click()
  // The output's pin lights up with the wire that feeds it.
  await expect(node(page, 'out').locator('.react-flow__handle')).toHaveClass(/\bon\b/)
  await page.getByRole('button', { name: 'Probar' }).click()
  await expect(page.getByText('Pasan 0 de 2 pruebas. Estas fallan:')).toBeVisible()
  await expect(page.locator('.result td.bad')).toHaveCount(2)
  await page.screenshot({ path: `${SHOTS}/probar-fail.png` })
})
