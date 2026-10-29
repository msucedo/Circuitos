// Adds an approved circuit to the gallery:
// `npm run gallery:add -- "<link del issue>" --name "Nombre" --description "Qué hace" [--author usuario] [--slug nombre]`.
// It reads the link the same way the game does, checks that it builds, and writes
// src/gallery/circuits/<slug>.json plus its entry in src/gallery/gallery.json.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { decodeShare, nodeCount, sharedTarget } from '../src/share.ts'
import { flatten } from '../src/sim/flatten.ts'
import { parseGallery } from '../src/sim/schema.ts'
import type { GalleryEntry } from '../src/sim/schema.ts'
import { CircuitError, toLibrary } from '../src/sim/types.ts'

const LIST = 'src/gallery/gallery.json'
const circuitFile = (slug: string) => `src/gallery/circuits/${slug}.json`
const MAX_SLUG = 40

/** "Mayoría de 3" → "mayoria-de-3". */
const slugFor = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { name: { type: 'string' }, description: { type: 'string' }, author: { type: 'string' }, slug: { type: 'string' } },
})
const [link] = positionals
const { name, description, author } = values
if (link === undefined || name === undefined || description === undefined) {
  console.error('Uso: npm run gallery:add -- "<link>" --name "Nombre" --description "Qué hace" [--author usuario] [--slug nombre]')
  process.exit(2)
}

try {
  const target = URL.canParse(link) ? sharedTarget(new URL(link).hash) : undefined
  if (target?.kind !== 'link') throw new CircuitError('shareCorrupt')
  const project = await decodeShare(target.data)
  // Opening it in the game would fail the same way.
  flatten(project.circuit, toLibrary(project.chips))

  const entry: GalleryEntry = { slug: values.slug ?? slugFor(name), name, description, ...(author ? { author } : {}) }
  const list = parseGallery([...parseGallery(JSON.parse(readFileSync(LIST, 'utf8'))), entry])
  if (existsSync(circuitFile(entry.slug))) throw new CircuitError('duplicate', { path: 'slug', id: entry.slug })

  writeFileSync(circuitFile(entry.slug), `${JSON.stringify(project, null, 2)}\n`)
  writeFileSync(LIST, `${JSON.stringify(list, null, 2)}\n`)
  console.log(`✓ ${entry.slug}: ${nodeCount(project)} piezas, chips: ${project.chips.map((c) => c.name).join(', ') || 'ninguno'}`)
  console.log(`  ${circuitFile(entry.slug)} y ${LIST}. Pruébalo con npm run dev antes del commit.`)
} catch (error) {
  if (!(error instanceof CircuitError)) throw error
  console.error(`✗ ${error.code} ${JSON.stringify(error.params)}`)
  process.exit(1)
}
