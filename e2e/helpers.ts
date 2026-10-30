import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { LEVELS } from '../src/levels/levels.ts'

/** Screenshots go here so they can be reviewed by hand; set SHOTS to change it. */
export const SHOTS = process.env.SHOTS ?? 'test-results/shots'

// On the editor's canvas: previews draw circuits with the same pieces.
export const node = (page: Page, id: string) => page.locator(`.canvas .react-flow__node[data-id="${id}"]`)
export const handle = (page: Page, nodeId: string, pin: string) =>
  page.locator(`.canvas .react-flow__handle[data-nodeid="${nodeId}"][data-handleid="${pin}"]`)

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

/** True when a scrollable element shows all its content. */
export const fitsWithoutScroll = (locator: Locator) => locator.evaluate((el) => el.scrollHeight <= el.clientHeight)

/** Shortcut descriptions in the welcome that wrap onto a second line. */
export const wrappedShortcuts = (welcome: Locator) =>
  welcome.locator('.shortcuts dd').evaluateAll((items) =>
    items.filter((dd) => dd.getBoundingClientRect().height > parseFloat(getComputedStyle(dd).lineHeight) * 1.5).map((dd) => dd.textContent),
  )

/**
 * The welcome opens on every load; these get past it. The theory panel starts
 * closed on every level so it covers no piece; `theory: true` keeps the real first visit.
 */
export async function start(page: Page, { theory = false } = {}) {
  if (!theory) await closeTheory(page)
  await page.goto('/')
  await closeWelcome(page)
}

/** Stores the preference "theory closed" for every level before the first load (only once, like `seedSolved`). */
async function closeTheory(page: Page) {
  const { PREFS_KEY, DEFAULT_PREFS } = await import('../src/storage.ts')
  const raw = JSON.stringify({ ...DEFAULT_PREFS, theoryClosed: LEVELS.map((l) => l.id) })
  await page.addInitScript(([key, value]) => {
    if (!sessionStorage.getItem('prefs-seeded')) {
      localStorage.setItem(key, value)
      sessionStorage.setItem('prefs-seeded', '1')
    }
  }, [PREFS_KEY, raw] as const)
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

/**
 * A level's button by its name; the accessible name may add " opcional", " resuelto" or " bloqueado",
 * but "NOT" must not match "NOT de 4 bits".
 */
export const levelButton = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: 'Niveles' })
    .getByRole('button', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( opcional)?( resuelto| bloqueado)?$`) })

export async function openLevel(page: Page, name: string) {
  await levelButton(page, name).click()
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

/** Ids of every level that comes before `id`, to seed the progress that opens it. */
export const levelsBefore = (id: string) => LEVELS.slice(0, LEVELS.findIndex((l) => l.id === id)).map((l) => l.id)

/** Starts the app with these levels already solved, using the reference solutions as their chips. */
export async function seedSolved(page: Page, ids: string[]) {
  const { LEVELS } = await import('../src/levels/levels.ts')
  const examples: Record<string, unknown> = await import('../src/sim/examples.ts')
  const { emptySave, serializeSave } = await import('../src/sim/schema.ts')
  const { STORAGE_KEY } = await import('../src/storage.ts')
  const chips = LEVELS.filter((l) => ids.includes(l.id) && l.chip !== false).map((l) => ({
    id: l.id,
    name: l.id,
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

/**
 * Waits for the animations inside `selector` to start and freezes them at half their duration.
 * Sampling after a fixed wait instead lands anywhere on a slow machine. `resume` lets them finish.
 */
export async function freezeHalfway(page: Page, selector: string) {
  await page.evaluate(async (sel) => {
    const inside = () =>
      document.getAnimations().filter((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target
        return target instanceof Element && target.closest(sel) !== null
      })
    while (inside().length === 0) await new Promise(requestAnimationFrame)
    for (const a of inside()) {
      a.pause()
      const duration = a.effect?.getComputedTiming().duration
      if (typeof duration === 'number') a.currentTime = duration / 2
    }
  }, selector)
}

/** Lets the frozen animations go on and waits until they end. */
export const resumeAnimations = (page: Page) =>
  page.evaluate(async () => {
    const paused = document.getAnimations().filter((a) => a.playState === 'paused')
    paused.forEach((a) => a.play())
    await Promise.all(paused.map((a) => a.finished.catch(() => undefined)))
  })

type SoundLog = { __sounds: string[] }

/** Records every sound source the app starts: an oscillator by its wave, or 'noise'. */
export async function recordSounds(page: Page) {
  await page.addInitScript(() => {
    const log: string[] = []
    ;(window as unknown as SoundLog).__sounds = log
    const tone = OscillatorNode.prototype.start
    OscillatorNode.prototype.start = function (...args) {
      log.push(this.type)
      return tone.apply(this, args)
    }
    const noise = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) {
      log.push('noise')
      return noise.apply(this, args)
    }
  })
}

/** The sources started since the last call. */
export const sounds = (page: Page) => page.evaluate(() => (window as unknown as SoundLog).__sounds.splice(0))
