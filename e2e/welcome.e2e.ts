import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { SHOTS, fitsWithoutScroll, levelButton, seedSolved, watchErrors, wrappedShortcuts } from './helpers.ts'

/** Shortcuts sharing the first row's top edge = number of columns. */
const shortcutColumns = (welcome: Locator) =>
  welcome.locator('.shortcuts > div').evaluateAll((rows) => {
    const tops = rows.map((r) => Math.round(r.getBoundingClientRect().top))
    return tops.filter((top) => top === tops[0]).length
  })

test('the welcome shows on every load', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  const welcome = page.getByRole('dialog', { name: 'Circuitos' })
  await expect(welcome).toBeVisible()
  await expect(welcome).toContainText('No necesitas cuenta')
  await expect(welcome.getByRole('link', { name: 'msucedo' })).toHaveAttribute('href', 'https://github.com/msucedo')
  await expect(welcome.getByRole('link', { name: 'Reportar un problema' })).toHaveAttribute('href', 'https://github.com/msucedo/Circuitos/issues')
  await expect(welcome).toContainText('no hay cookies ni analítica')
  await expect(welcome.locator('.credit .version')).toHaveText(/^v\d+\.\d+\.\d+$/)
  await page.screenshot({ path: `${SHOTS}/welcome.png`, animations: 'disabled' })
  // On a laptop screen everything fits without scrolling, with the shortcuts in columns.
  expect(await fitsWithoutScroll(welcome)).toBe(true)
  expect(await shortcutColumns(welcome)).toBe(2)
  expect(await wrappedShortcuts(welcome)).toEqual([])
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.screenshot({ path: `${SHOTS}/welcome-wide.png`, animations: 'disabled' })
  expect(await shortcutColumns(welcome)).toBe(2)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${SHOTS}/welcome-phone.png`, animations: 'disabled' })
  expect(await shortcutColumns(welcome)).toBe(1)

  await expect(welcome.getByRole('button', { name: 'Empezar' })).toBeFocused()
  await welcome.getByRole('button', { name: 'Empezar' }).click()
  await expect(welcome).toBeHidden()
  await page.reload()
  await expect(welcome).toBeVisible()
  expect(errors).toEqual([])
})

test('the ? button reopens it and Esc closes it', async ({ page }) => {
  await page.goto('/')
  const welcome = page.getByRole('dialog', { name: 'Circuitos' })
  await expect(welcome).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(welcome).toBeHidden()
  await page.getByRole('button', { name: 'Acerca de Circuitos' }).click()
  await expect(welcome).toBeVisible()
  await expect(welcome.getByRole('button', { name: 'Borrar mi progreso' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(welcome).toBeHidden()
})

test('wiping the progress keeps a copy and starts over', async ({ page }) => {
  await seedSolved(page, ['NOT'])
  await page.goto('/')
  const welcome = page.getByRole('dialog', { name: 'Circuitos' })
  await expect(levelButton(page, 'NOT')).toHaveAccessibleName('NOT resuelto')

  await welcome.getByRole('button', { name: 'Borrar mi progreso' }).click()
  await welcome.getByRole('button', { name: '¿Seguro? Borrar todo' }).click()
  await expect(welcome).toBeHidden()
  const notice = page.getByText('Progreso borrado. Se guardó una copia en el navegador.')
  await expect(notice).toBeVisible()
  await expect(levelButton(page, 'NOT')).toHaveAccessibleName('NOT')
  await expect(levelButton(page, 'AND')).toBeDisabled()
  const backup = await page.evaluate(() => localStorage.getItem('circuitos:v1:respaldo'))
  expect(JSON.parse(backup ?? '{}').solved).toEqual(['NOT'])
  // Info notices close by themselves.
  await expect(notice).toBeHidden({ timeout: 6000 })
})

test('the guide opens from the levels column and from the welcome, and its index jumps to each section', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  const welcome = page.getByRole('dialog', { name: 'Circuitos' })
  const guide = page.getByRole('dialog', { name: 'Guía' })
  await welcome.getByRole('button', { name: 'Guía', exact: true }).click()
  await expect(welcome).toBeHidden()
  await expect(guide).toBeVisible()
  await expect(guide.getByRole('heading', { name: 'Cómo resolver un nivel' })).toBeVisible()
  await expect(guide.locator('.pin-ref').first()).toBeVisible()

  const index = guide.getByRole('navigation', { name: 'Índice' })
  await expect(index.getByRole('button', { name: 'Cómo resolver un nivel' })).toHaveAttribute('aria-current', 'true')
  const pieces = guide.getByRole('heading', { name: 'Piezas' })
  await expect(pieces).not.toBeInViewport()
  await index.getByRole('button', { name: 'Piezas' }).click()
  await expect(pieces).toBeInViewport()
  // The jump leaves some air above the title instead of pinning it to the top edge.
  const air = () => pieces.evaluate((h) => h.getBoundingClientRect().top - h.closest('.guide-content')!.getBoundingClientRect().top)
  // Measured once the smooth scroll has stopped moving.
  await expect
    .poll(async () => {
      const first = await air()
      await page.waitForTimeout(100)
      return first === (await air())
    })
    .toBe(true)
  expect(await air()).toBeGreaterThanOrEqual(12)
  expect(await air()).toBeLessThan(40)
  await expect(index.getByRole('button', { name: 'Piezas' })).toHaveAttribute('aria-current', 'true')
  // Scrolling by hand moves the mark along with the reading.
  await guide.getByRole('heading', { name: 'Comandos' }).evaluate((h) => h.scrollIntoView({ block: 'start' }))
  await expect(index.getByRole('button', { name: 'Comandos' })).toHaveAttribute('aria-current', 'true')
  await expect(index.getByRole('button', { name: 'Piezas' })).toHaveAttribute('aria-current', 'false')
  await guide.getByRole('heading', { name: 'Piezas' }).evaluate((h) => h.scrollIntoView({ block: 'start' }))
  await expect(guide.getByRole('definition').filter({ hasText: 'Siempre da 1' })).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/guide.png`, animations: 'disabled' })

  // Esc plays the exit and then closes.
  await page.keyboard.press('Escape')
  await expect(guide).toHaveClass(/closing/)
  await expect(guide).toBeHidden()
  await expect(page.locator('dialog.guide')).not.toHaveClass(/closing/)
  await page.getByRole('navigation', { name: 'Niveles' }).getByRole('button', { name: 'Guía' }).click()
  await expect(guide).toBeVisible()
  await guide.getByRole('button', { name: 'Cerrar guía' }).click()
  await expect(guide).toBeHidden()

  // On a phone the guide button stays reachable and nothing scrolls sideways.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('navigation', { name: 'Niveles' }).getByRole('button', { name: 'Guía' }).click()
  await expect(guide).toBeVisible()
  expect(await guide.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: `${SHOTS}/guide-phone.png`, animations: 'disabled' })
  expect(errors).toEqual([])
})
