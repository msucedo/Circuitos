import { parseGallery, parseProject } from '../sim/schema.ts'
import type { GalleryEntry, Project } from '../sim/schema.ts'
import { CircuitError } from '../sim/types.ts'
import list from './gallery.json'

/**
 * Circuits approved from the issues (`npm run gallery:add`). The list is small and
 * ships with the app; each project is its own chunk, read as text and validated
 * like any shared link when it is opened.
 */
export const GALLERY: GalleryEntry[] = parseGallery(list)

const circuits = import.meta.glob<string>('./circuits/*.json', { query: '?raw', import: 'default' })
export const circuitPath = (slug: string) => `./circuits/${slug}.json`

export async function loadGalleryEntry(slug: string): Promise<{ entry: GalleryEntry; project: Project }> {
  const entry = GALLERY.find((e) => e.slug === slug)
  const load = entry && circuits[circuitPath(entry.slug)]
  if (!entry || !load) throw new CircuitError('shareCorrupt')
  return { entry, project: parseProject(await load()) }
}
