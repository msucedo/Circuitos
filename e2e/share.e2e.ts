import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { encodeShare, shareUrl } from '../src/share.ts'
import { emptySave, serializeSave } from '../src/sim/schema.ts'
import type { Project } from '../src/sim/schema.ts'
import { STORAGE_KEY } from '../src/storage.ts'
import { SHOTS, addPiece, node, restart, start, watchErrors } from './helpers.ts'

async function sandbox(page: Page) {
  await start(page)
  await page.getByRole('button', { name: 'Modo libre' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Modo libre' })).toBeVisible()
}

/** Waits until a dialog has finished coming in, so its screenshot is not caught halfway. */
const settled = (dialog: Locator) => dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))

const preview = (page: Page) => page.getByRole('dialog', { name: /Circuito compartido|Mayoría de 3/ })

/** A chip that only passes its input through; `twice` makes a different circuit under the same id. */
const passChip = (twice: boolean) => ({
  id: 'U_MI_CHIP',
  name: 'Mi chip',
  circuit: {
    nodes: [{ id: 'in', kind: 'INPUT' }, ...(twice ? [{ id: 'n', kind: 'NAND' }] : []), { id: 'out', kind: 'OUTPUT' }],
    wires: [{ from: { node: 'in', pin: 'out' }, to: { node: 'out', pin: 'in' } }],
  },
})

test('a share link opens in another browser after a preview, with the same pieces', async ({ page, browser }) => {
  const errors = watchErrors(page)
  await sandbox(page)
  await addPiece(page, 'NAND', 'nand1', { x: 300, y: 200 })
  await page.getByRole('button', { name: 'Compartir', exact: true }).click()
  const share = page.getByRole('dialog', { name: 'Compartir circuito' })
  await expect(share.getByText(/El link usa el \d+ % del tamaño máximo/)).toBeVisible()
  const link = await share.getByRole('textbox', { name: 'Link para compartir' }).inputValue()
  expect(link).toMatch(/^http:\/\/localhost:4173\/#c=1\./)

  // Sending to the gallery opens a prefilled issue once there is a name and a description.
  await expect(share.getByRole('button', { name: 'Abrir el envío en GitHub' })).toBeDisabled()
  await share.getByRole('textbox', { name: 'Nombre' }).fill('Un NAND')
  await share.getByRole('textbox', { name: 'Qué hace' }).fill('Solo una compuerta.')
  const submit = share.getByRole('link', { name: 'Abrir el envío en GitHub' })
  const href = new URL((await submit.getAttribute('href')) ?? '')
  expect(`${href.origin}${href.pathname}`).toBe('https://github.com/msucedo/Circuitos/issues/new')
  expect(href.searchParams.get('template')).toBe('galeria.yml')
  expect(href.searchParams.get('nombre')).toBe('Un NAND')
  expect(href.searchParams.get('link')).toBe(link)
  expect(await submit.getAttribute('rel')).toBe('noopener noreferrer')
  await settled(share)
  await page.screenshot({ path: `${SHOTS}/share.png` })
  await share.getByRole('button', { name: 'Cerrar' }).click()
  await expect(share).toBeHidden()

  // Someone else, with nothing saved, opens it: the preview comes instead of the welcome.
  const other = await (await browser.newContext({ locale: 'es-MX' })).newPage()
  const otherErrors = watchErrors(other)
  await other.goto(link)
  await expect(preview(other)).toBeVisible()
  await expect(other.getByRole('dialog', { name: 'Circuitos' })).toBeHidden()
  await preview(other).getByRole('tab', { name: 'Piezas' }).click()
  await expect(preview(other)).toContainText('1 pieza')
  await preview(other).getByRole('button', { name: 'Abrir en Modo libre' }).click()
  await expect(other.getByRole('heading', { level: 2, name: 'Modo libre' })).toBeVisible()
  await expect(node(other, 'nand1')).toBeVisible()
  // The link leaves the address bar, so a reload does not ask again.
  expect(new URL(other.url()).hash).toBe('')
  expect(errors).toEqual([])
  expect(otherErrors).toEqual([])
})

test('cancelling the preview keeps the sandbox as it was', async ({ page }) => {
  await sandbox(page)
  await addPiece(page, 'NAND', 'nand1', { x: 300, y: 200 })
  await page.goto('/#g=mayoria-de-3')
  await preview(page).getByRole('button', { name: 'Cancelar' }).click()
  await expect(preview(page)).toBeHidden()
  await expect(node(page, 'nand1')).toBeVisible()
  await expect(node(page, 'mayoria')).toHaveCount(0)
})

test('a damaged link says so and the game goes on', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/#c=1.AAAA')
  await expect(page.getByRole('alert')).toContainText('No se pudo abrir el link: El link está dañado o incompleto')
  await page.getByRole('button', { name: 'Modo libre' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Modo libre' })).toBeVisible()
  expect(errors).toEqual([])
})

test('the gallery opens an entry in the sandbox', async ({ page }) => {
  const errors = watchErrors(page)
  await start(page)
  await page.getByRole('button', { name: 'Galería' }).click()
  const gallery = page.getByRole('dialog', { name: 'Galería' })
  await expect(gallery.getByRole('heading', { name: 'Mayoría de 3' })).toBeVisible()
  // Each entry shows its circuit, a picture that takes no focus.
  await expect(gallery.locator('.circuit-view')).toHaveCount(2)
  await expect(gallery.locator('.circuit-view').first().locator('.react-flow__node')).toHaveCount(10)
  // Its pieces do not pop in, so the wires never shift once they are drawn.
  await expect(gallery.locator('.circuit-view .gate').first()).toHaveCSS('animation-name', 'none')
  await settled(gallery)
  await page.screenshot({ path: `${SHOTS}/gallery.png` })
  // The × at the top right closes it.
  await gallery.getByRole('button', { name: 'Cerrar galería' }).click()
  await expect(gallery).toBeHidden()
  await page.getByRole('button', { name: 'Galería' }).click()
  await expect(gallery.getByRole('heading', { level: 3 })).toHaveText(['Mayoría de 3', 'Medio sumador'])
  await gallery.getByRole('button', { name: 'Abrir Mayoría de 3' }).click()
  await expect(preview(page)).toContainText('de msucedo')
  // The diagram tab runs the circuit: two votes make it 1.
  const live = preview(page).getByRole('group', { name: 'Circuito' })
  await expect(live.getByLabel('salida out: 0')).toBeVisible()
  await live.getByRole('button', { name: 'entrada a: 0' }).click()
  await live.getByRole('button', { name: 'entrada b: 0' }).click()
  await expect(live.getByLabel('salida out: 1')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/gallery-preview.png` })
  // The other tabs, also with the keyboard.
  const tab = (name: string) => preview(page).getByRole('tab', { name })
  await tab('Piezas').click()
  await expect(preview(page).locator('.preview-parts')).toContainText('NAND× 6')
  await page.keyboard.press('ArrowRight')
  await expect(tab('Tabla de verdad')).toBeFocused()
  await expect(preview(page).locator('.truth-table tbody tr')).toHaveCount(8)
  await page.screenshot({ path: `${SHOTS}/gallery-preview-table.png` })
  // Going back returns to the gallery, and an entry still opens from there.
  await preview(page).getByRole('button', { name: 'Volver a la galería' }).click()
  await expect(gallery).toBeVisible()
  await expect(preview(page)).toBeHidden()
  await gallery.getByRole('button', { name: 'Abrir Mayoría de 3' }).click()
  await preview(page).getByRole('button', { name: 'Abrir en Modo libre' }).click()
  await expect(node(page, 'mayoria')).toBeVisible()
  await expect(page.locator('.notice')).toContainText('"Mayoría de 3" está en Modo libre')
  expect(errors).toEqual([])
})

test('a chip that clashes with one of yours has to be renamed before opening', async ({ page }) => {
  const project: Project = {
    version: 1,
    circuit: { nodes: [{ id: 'c', kind: 'U_MI_CHIP' }], wires: [] },
    chips: [passChip(true)],
  }
  const raw = serializeSave({ ...emptySave(), chips: [passChip(false)] })
  await page.addInitScript(([key, value]) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem(key, value)
      sessionStorage.setItem('seeded', '1')
    }
  }, [STORAGE_KEY, raw] as const)
  await page.goto(shareUrl('', await encodeShare(project)))

  const open = preview(page).getByRole('button', { name: 'Abrir en Modo libre' })
  await expect(preview(page)).toContainText('ya tienes uno distinto con este nombre')
  await expect(open).toBeDisabled()
  await settled(preview(page))
  await page.screenshot({ path: `${SHOTS}/preview-clash.png` })
  await preview(page).getByRole('textbox', { name: 'Nuevo nombre para Mi chip' }).fill('Su chip')
  await preview(page).getByRole('button', { name: 'Renombrar' }).click()
  await expect(open).toBeEnabled()
  await open.click()
  await expect(page.getByRole('group', { name: 'Tus chips' })).toContainText('Su chip')
  await expect(page.getByRole('group', { name: 'Tus chips' })).toContainText('Mi chip')
})

test('the sandbox kept before opening comes back once with Restaurar, and keeps the chips saved meanwhile', async ({ page }) => {
  const errors = watchErrors(page)
  await sandbox(page)
  await expect(page.getByRole('button', { name: 'Restaurar mi Modo libre' })).toHaveCount(0)
  await addPiece(page, 'NAND', 'nand1', { x: 300, y: 200 })

  await page.goto('/#g=mayoria-de-3')
  const keep = preview(page).getByRole('checkbox', { name: 'Guardar mi Modo libre actual para poder restaurarlo' })
  await expect(keep).toBeChecked()
  await preview(page).getByRole('button', { name: 'Abrir en Modo libre' }).click()
  await expect(node(page, 'mayoria')).toBeVisible()
  await expect(page.locator('.notice')).toContainText('Tu Modo libre anterior se guardó')

  await page.getByRole('button', { name: 'Guardar como chip' }).click()
  await page.getByRole('textbox', { name: 'Nombre del chip' }).fill('Mayoría')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('group', { name: 'Tus chips' })).toContainText('Mayoría')

  // Still there after a reload.
  await restart(page)
  await page.getByRole('button', { name: 'Modo libre', exact: true }).click()
  await page.getByRole('button', { name: 'Restaurar mi Modo libre' }).click()
  const restore = page.getByRole('dialog', { name: '¿Restaurar tu Modo libre guardado?' })
  // Only a confirmation: nothing to keep in exchange.
  await expect(restore.getByRole('checkbox')).toHaveCount(0)
  await restore.getByRole('button', { name: 'Sí, restaurar' }).click()
  await expect(node(page, 'nand1')).toBeVisible()
  await expect(node(page, 'mayoria')).toHaveCount(0)
  await expect(page.locator('.notice')).toContainText('Restauraste tu Modo libre.')
  await expect(page.getByRole('group', { name: 'Tus chips' })).toContainText('Mayoría')
  // Used up, also after a reload.
  await expect(page.getByRole('button', { name: 'Restaurar mi Modo libre' })).toHaveCount(0)
  await restart(page)
  await page.getByRole('button', { name: 'Modo libre', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Restaurar mi Modo libre' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('wiping the progress also drops the kept sandbox', async ({ page }) => {
  await sandbox(page)
  await addPiece(page, 'NAND', 'nand1', { x: 300, y: 200 })
  await page.goto('/#g=mayoria-de-3')
  await preview(page).getByRole('button', { name: 'Abrir en Modo libre' }).click()
  await expect(page.getByRole('button', { name: 'Restaurar mi Modo libre' })).toBeVisible()

  await page.getByRole('button', { name: 'Acerca de Circuitos' }).click()
  const welcome = page.getByRole('dialog', { name: 'Circuitos' })
  await welcome.getByRole('button', { name: 'Borrar mi progreso' }).click()
  await welcome.getByRole('button', { name: '¿Seguro? Borrar todo' }).click()
  await page.getByRole('button', { name: 'Modo libre', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Restaurar mi Modo libre' })).toHaveCount(0)
})

test('nothing is offered to keep when the sandbox is empty, nor kept when unchecked', async ({ page }) => {
  await sandbox(page)
  await page.goto('/#g=mayoria-de-3')
  await expect(preview(page).getByRole('checkbox')).toHaveCount(0)
  await preview(page).getByRole('button', { name: 'Abrir en Modo libre' }).click()
  await expect(node(page, 'mayoria')).toBeVisible()

  await page.goto('/#g=mayoria-de-3')
  await preview(page).getByRole('checkbox', { name: 'Guardar mi Modo libre actual para poder restaurarlo' }).uncheck()
  await preview(page).getByRole('button', { name: 'Abrir en Modo libre' }).click()
  await expect(page.getByRole('button', { name: 'Restaurar mi Modo libre' })).toHaveCount(0)
})
