import { expect, test } from '@playwright/test'
import { SHOTS, seedSolved, watchErrors } from './helpers.ts'

test.use({ storageState: { cookies: [], origins: [] } })

const levelButton = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('navigation', { name: 'Niveles' }).getByRole('button', { name })

test('the welcome shows on the first visit only', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  const welcome = page.getByRole('dialog', { name: 'Circuitos' })
  await expect(welcome).toBeVisible()
  await expect(welcome).toContainText('No necesitas cuenta')
  await expect(welcome.getByRole('link', { name: 'msucedo' })).toHaveAttribute('href', 'https://github.com/msucedo')
  await page.screenshot({ path: `${SHOTS}/welcome.png` })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${SHOTS}/welcome-phone.png` })

  await welcome.getByRole('button', { name: 'Empezar' }).click()
  await expect(welcome).toBeHidden()
  await page.reload()
  await expect(page.getByRole('heading', { level: 2, name: 'NOT' })).toBeVisible()
  await expect(welcome).toBeHidden()
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
  await page.reload()
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
  await expect(page.getByText('Progreso borrado. Se guardó una copia en el navegador.')).toBeVisible()
  await expect(levelButton(page, 'NOT')).toHaveAccessibleName('NOT')
  await expect(levelButton(page, 'AND')).toBeDisabled()
  const backup = await page.evaluate(() => localStorage.getItem('circuitos:v1:respaldo'))
  expect(JSON.parse(backup ?? '{}').solved).toEqual(['NOT'])
})
