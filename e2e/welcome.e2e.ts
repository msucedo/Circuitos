import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { SHOTS, fitsWithoutScroll, seedSolved, watchErrors, wrappedShortcuts } from './helpers.ts'

const levelButton = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('navigation', { name: 'Niveles' }).getByRole('button', { name })

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
