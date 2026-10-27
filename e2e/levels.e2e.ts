import { expect, test } from '@playwright/test'
import { LEVELS, MAIN_LEVELS } from '../src/levels/levels.ts'
import { addPiece, levelsBefore, handle, node, openLevel, restart, seedSolved, SHOTS, start, watchErrors, wire } from './helpers.ts'

test('loads the built app with no console errors or CSP violations', async ({ page }) => {
  const errors = watchErrors(page)
  await start(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Circuitos' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'NOT' })).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/start.png` })
  expect(errors).toEqual([])
})

test('level 0: a NAND made of relays passes', async ({ page }) => {
  const errors = watchErrors(page)
  await start(page)
  await openLevel(page, 'Relés')
  const palette = page.getByRole('complementary', { name: 'Piezas' })
  await expect(palette.locator('.palette-body').getByRole('button')).toHaveText(['Fuente', 'Relé', 'Relé inverso'])

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
  await start(page)
  await addPiece(page, 'NAND', 'nand1', { x: 380, y: 280 })
  await wire(page, ['a', 'out'], ['nand1', 'a'])
  await wire(page, ['a', 'out'], ['nand1', 'b'])
  await wire(page, ['nand1', 'out'], ['out', 'in'])
  await expect(page.getByLabel('salida out: 1')).toBeVisible()
  await page.getByLabel('entrada a: 0').click()
  await expect(page.getByLabel('salida out: 0')).toBeVisible()

  await page.getByRole('button', { name: 'Probar' }).click()
  await expect(page.getByText('ya está en tu paleta')).toBeVisible()
  await expect(page.locator('.result.pass .confetti i')).toHaveCount(18)
  await expect(page.getByText(`1 de ${MAIN_LEVELS.length} resueltos`)).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Niveles' })
  await expect(nav.getByRole('button', { name: 'AND', exact: true })).toBeEnabled()
  await expect(nav.getByRole('button', { name: 'AND', exact: true })).toHaveClass(/fresh/)
  await expect(page.getByRole('progressbar', { name: 'Niveles resueltos' })).toHaveAttribute('aria-valuenow', '1')
  await page.screenshot({ path: `${SHOTS}/not-solved.png` })

  await restart(page)
  await expect(nav.getByRole('button', { name: 'NOT resuelto' })).toBeVisible()
  await openLevel(page, 'NOT')
  await expect(node(page, 'nand1')).toBeVisible()
  // "Siguiente" opens the next level; NOT now sits under "Tus chips".
  await page.getByRole('button', { name: 'Probar' }).click()
  await page.getByRole('button', { name: 'Siguiente: AND' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'AND' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'AND', exact: true })).not.toHaveClass(/fresh/)
  const palette = page.getByRole('complementary', { name: 'Piezas' })
  await expect(palette.locator('.palette-body').getByRole('button')).toHaveText(['NAND', 'NOT'])
  await expect(palette.getByRole('heading')).toHaveText(['Piezas', 'Básicas', 'Tus chips'])
  await expect(palette.locator('h3:has-text("Tus chips") ~ button')).toHaveText(['NOT'])
  expect(errors).toEqual([])
})

test('the live table of the half adder shows 1 + 1 = carry 1, sum 0', async ({ page }) => {
  await seedSolved(page, ['NOT', 'AND', 'OR', 'XOR'])
  await start(page)
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
  await start(page)
  await wire(page, ['a', 'out'], ['out', 'in'])
  await expect(node(page, 'out').locator('.react-flow__handle')).not.toHaveClass(/\bon\b/)
  await page.getByLabel('entrada a: 0').click()
  // The output's pin lights up with the wire that feeds it.
  await expect(node(page, 'out').locator('.react-flow__handle')).toHaveClass(/\bon\b/)
  await page.getByRole('button', { name: 'Probar' }).click()
  await expect(page.getByText('Pasan 0 de 2 pruebas.')).toBeVisible()
  await expect(page.locator('.result td.verdict')).toHaveText(['✗', '✗'])
  await expect(page.locator('.result td.bad')).toHaveCount(2)
  await expect(page.locator('.confetti')).toHaveCount(0)
  await page.screenshot({ path: `${SHOTS}/probar-fail.png` })
  await page.getByRole('button', { name: 'Cerrar resultado' }).click()
  await expect(page.locator('.result')).toHaveCount(0)
})

test('the level header, locked levels and the empty canvas explain themselves', async ({ page }) => {
  const errors = watchErrors(page)
  await start(page)
  const brief = page.locator('.brief')
  await expect(brief.getByText(`Nivel 1 de ${MAIN_LEVELS.length}`)).toBeVisible()
  await expect(brief.locator('.pins code')).toHaveText(['a', 'out'])
  await expect(page.getByText(`0 de ${MAIN_LEVELS.length} resueltos`)).toBeVisible()
  await expect(page.getByText('Agrega piezas desde Piezas')).toBeVisible()

  const and = page.getByRole('navigation', { name: 'Niveles' }).getByRole('button', { name: 'AND bloqueado' })
  await expect(and).toHaveAttribute('title', 'Resuelve NOT para desbloquearlo')
  await and.click({ force: true }) // aria-disabled: Playwright waits for it to be enabled, a person can click it
  const locked = page.getByText('AND está bloqueado: resuelve NOT para desbloquearlo.')
  await expect(locked).toBeVisible()
  // A warning, not a success: yellow.
  await expect(locked).toHaveClass(/\bwarn\b/)
  await expect(page.getByRole('heading', { level: 2, name: 'NOT' })).toBeVisible()

  await addPiece(page, 'NAND', 'nand1', { x: 380, y: 280 })
  await expect(page.getByText('Agrega piezas desde Piezas')).toBeHidden()
  // The visible Borrar button removes the selected piece, and undo brings it back.
  const erase = page.getByRole('toolbar', { name: 'Herramientas' }).getByRole('button', { name: 'Borrar' })
  // Dragging leaves the piece selected; clicking the empty canvas clears it.
  await page.locator('.react-flow__pane').click({ position: { x: 40, y: 300 } })
  await expect(erase).toBeDisabled()
  await node(page, 'nand1').click()
  await erase.click()
  await expect(node(page, 'nand1')).toHaveCount(0)
  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(node(page, 'nand1')).toBeVisible()
  // The level's own pins can't be deleted.
  await node(page, 'a').click()
  await expect(erase).toBeDisabled()

  await page.screenshot({ path: `${SHOTS}/level-header.png` })
  const emoji = await page.evaluate(() => /\p{Extended_Pictographic}/u.test(document.body.innerText))
  expect(emoji).toBe(false)
  expect(errors).toEqual([])
})

test('Probar lists the passing tests in green next to the failing ones', async ({ page }) => {
  await seedSolved(page, ['NOT'])
  await start(page)
  await expect(page.getByRole('heading', { level: 2, name: 'AND' })).toBeVisible()
  // out = a: right for 3 of the 4 rows of AND.
  await wire(page, ['a', 'out'], ['out', 'in'])
  await page.getByRole('button', { name: 'Probar' }).click()
  await expect(page.getByText('Pasan 3 de 4 pruebas.')).toBeVisible()
  await expect(page.locator('.result tbody tr.ok')).toHaveCount(3)
  await expect(page.locator('.result tbody tr.wrong td.bad')).toHaveCount(1)
  await expect(page.locator('.result tr.ok .verdict').first()).toHaveCSS('color', 'rgb(74, 222, 128)')
  await page.screenshot({ path: `${SHOTS}/probar-mixed.png` })
})

test('the hint starts folded and folds again on another level; the ? button is square', async ({ page }) => {
  await seedSolved(page, ['NOT'])
  await start(page)
  const hint = page.getByText('Es lo contrario de un NAND.')
  await expect(hint).toBeHidden()
  await page.getByText('Ver pista').click()
  await expect(hint).toBeVisible()
  await openLevel(page, 'NOT')
  await expect(page.getByText('NAND da 0 solo cuando sus dos entradas son 1.')).toBeHidden()
  // Same square as the fold buttons next to it.
  const about = page.getByRole('button', { name: 'Acerca de Circuitos' })
  const fold = page.getByRole('button', { name: 'Ocultar niveles' })
  const [a, f] = [await about.boundingBox(), await fold.boundingBox()]
  expect(a && f && a.width === a.height && a.width === f.width).toBe(true)
  await expect(about).toHaveCSS('border-radius', await fold.evaluate((el) => getComputedStyle(el).borderRadius))
})

test('bus levels start with bus pins and a live table of the cases Probar checks', async ({ page }) => {
  const errors = watchErrors(page)
  await seedSolved(page, levelsBefore('ALU4'))
  await start(page)
  await openLevel(page, 'ALU de 4 bits')
  await expect(page.getByLabel('entrada a (4 bits)')).toBeVisible()
  await expect(page.getByLabel('entrada op (2 bits)')).toBeVisible()
  const palette = page.getByRole('complementary', { name: 'Piezas' })
  await expect(palette.getByRole('button', { name: 'Separar', exact: true })).toBeVisible()
  await expect(palette.getByRole('button', { name: 'Multiplexor de 4 bits', exact: true })).toBeVisible()

  // 10 input bits: too many for every combination, so the table lists the level's cases.
  await page.getByRole('button', { name: 'Tabla' }).click()
  const table = page.getByRole('complementary', { name: 'Tabla de verdad' })
  const cases = LEVELS.find((l) => l.id === 'ALU4')!.spec.steps.length
  await expect(table.locator('tbody tr')).toHaveCount(cases)
  await page.screenshot({ path: `${SHOTS}/alu4.png` })
  expect(errors).toEqual([])
})

test('memory levels: the counter offers a constant 1 and the RAM starts with a 2-bit address', async ({ page }) => {
  const errors = watchErrors(page)
  await seedSolved(page, levelsBefore('RAM4'))
  await start(page)
  await openLevel(page, 'Contador')
  const palette = page.getByRole('complementary', { name: 'Piezas' })
  await expect(palette.getByRole('button', { name: 'Fuente', exact: true })).toBeVisible()
  await expect(palette.getByRole('button', { name: 'Registro de 4 bits', exact: true })).toBeVisible()
  await openLevel(page, 'RAM')
  await expect(page.getByLabel('entrada addr (2 bits)')).toBeVisible()
  await expect(page.getByText(`Nivel ${MAIN_LEVELS.length} de ${MAIN_LEVELS.length}`)).toBeVisible()
  expect(errors).toEqual([])
})
