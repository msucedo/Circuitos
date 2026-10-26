import { expect, test } from '@playwright/test'
import { start, watchErrors } from './helpers.ts'

test.use({ locale: 'en-US' })

test('an English browser gets the app in English, and the welcome switches it to Spanish', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  const welcome = page.getByRole('dialog', { name: 'Circuitos' })
  await expect(welcome).toContainText('Build a computer starting from a single NAND gate.')
  const language = welcome.getByRole('group', { name: 'Language' })
  await expect(language.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')

  await language.getByRole('button', { name: 'Español' }).click()
  // Switches in place: no reload, the dialog stays open.
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  await expect(welcome).toContainText('Arma una computadora empezando por una sola compuerta NAND.')
  await expect(welcome.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'Español' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await welcome.getByRole('button', { name: 'Empezar' }).click()
  await expect(page.getByRole('button', { name: 'Probar' })).toBeVisible()

  // The choice is remembered over the browser's language.
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  await expect(page.getByRole('heading', { level: 2, name: 'NOT' })).toBeVisible()
  expect(errors).toEqual([])
})

test('levels, pieces and the result read in English', async ({ page }) => {
  await start(page)
  await expect(page.getByText('Level 1 of 10')).toBeVisible()
  await expect(page.getByText('Output the opposite of the input: 0 → 1 and 1 → 0.')).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Pieces' })).toBeVisible()
  // aria-disabled: Playwright waits for it to be enabled, a person can click it.
  await page.getByRole('navigation', { name: 'Levels' }).getByRole('button', { name: 'Half adder locked' }).click({ force: true })
  await expect(page.getByText('Half adder is locked: solve XOR to unlock it.')).toBeVisible()
  await page.getByRole('button', { name: 'Test' }).click()
  await expect(page.getByText(/^\d of 2 tests pass\.$/)).toBeVisible()
})
