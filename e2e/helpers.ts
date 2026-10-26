import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/** Screenshots go here so they can be reviewed by hand; set SHOTS to change it. */
export const SHOTS = process.env.SHOTS ?? 'test-results/shots'

export const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`)
export const handle = (page: Page, nodeId: string, pin: string) =>
  page.locator(`.react-flow__handle[data-nodeid="${nodeId}"][data-handleid="${pin}"]`)

async function center(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('not visible')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Collects console errors and CSP violations for the whole test. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

/** The welcome opens on every load; these get past it. */
export async function start(page: Page) {
  await page.goto('/')
  await closeWelcome(page)
}

export async function restart(page: Page) {
  await page.reload()
  await closeWelcome(page)
}

async function closeWelcome(page: Page) {
  const welcome = page.getByRole('dialog', { name: 'Circuitos' })
  await expect(welcome).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(welcome).toBeHidden()
}

export async function openLevel(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Niveles' }).getByRole('button', { name }).click()
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible()
}

/** Clicks a palette piece; it appears in the middle of the canvas, so drag it to `to` (relative to the canvas). */
export async function addPiece(page: Page, label: string, id: string, to: { x: number; y: number }) {
  await page.getByRole('complementary', { name: 'Piezas' }).getByRole('button', { name: label, exact: true }).click()
  await moveNode(page, id, to)
}

export async function moveNode(page: Page, id: string, to: { x: number; y: number }) {
  const canvas = await page.locator('.react-flow').boundingBox()
  if (!canvas) throw new Error('no canvas')
  const title = node(page, id).locator('.chip-title, .pin-name').first()
  const from = await center(title)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(canvas.x + to.x, canvas.y + to.y, { steps: 8 })
  await page.mouse.up()
}

export async function wire(page: Page, from: [string, string], to: [string, string]) {
  const a = await center(handle(page, ...from))
  const b = await center(handle(page, ...to))
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 10 })
  await page.mouse.up()
  await expect(page.getByTestId(`rf__edge-${from.join('.')}->${to.join('.')}`)).toHaveCount(1)
}

/** Starts the app with these levels already solved, using the reference solutions as their chips. */
export async function seedSolved(page: Page, ids: string[]) {
  const { LEVELS } = await import('../src/levels/levels.ts')
  const examples: Record<string, unknown> = await import('../src/sim/examples.ts')
  const { emptySave, serializeSave } = await import('../src/sim/schema.ts')
  const { STORAGE_KEY } = await import('../src/storage.ts')
  const chips = LEVELS.filter((l) => ids.includes(l.id) && l.chip !== false).map((l) => ({
    id: l.id,
    name: l.name,
    circuit: examples[l.id] as ReturnType<typeof emptySave>['sandbox'],
  }))
  const raw = serializeSave({ ...emptySave(), solved: ids, chips })
  await page.addInitScript(([key, value]) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem(key, value)
      sessionStorage.setItem('seeded', '1')
    }
  }, [STORAGE_KEY, raw] as const)
}
