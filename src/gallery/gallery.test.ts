import { describe, expect, it } from 'vitest'
import { encodeShare } from '../share.ts'
import { LIMITS } from '../sim/schema.ts'
import { toLibrary } from '../sim/types.ts'
import { tableSpec, verify } from '../sim/verify.ts'
import { GALLERY, circuitPath, loadGalleryEntry } from './gallery.ts'

describe('gallery', () => {
  it('has exactly one circuit file per entry', () => {
    const files = Object.keys(import.meta.glob('./circuits/*'))
    expect(files.sort()).toEqual(GALLERY.map((e) => circuitPath(e.slug)).sort())
  })

  it('every entry is a valid project that fits in a share link', async () => {
    for (const { slug } of GALLERY) {
      const { project } = await loadGalleryEntry(slug)
      expect((await encodeShare(project)).length).toBeLessThanOrEqual(LIMITS.shareChars)
    }
  })

  it('refuses a slug it does not list', async () => {
    await expect(loadGalleryEntry('../gallery')).rejects.toMatchObject({ code: 'shareCorrupt' })
    await expect(loadGalleryEntry('no-existe')).rejects.toMatchObject({ code: 'shareCorrupt' })
  })

  it('the majority circuit does what its description says', async () => {
    const { project } = await loadGalleryEntry('mayoria-de-3')
    const spec = tableSpec(['a', 'b', 'c'], ['out'], (a, b, c) => [a + b + c >= 2 ? 1 : 0])
    expect(verify(project.circuit, toLibrary(project.chips), spec).passed).toBe(true)
  })

  it('the half adder does what its description says', async () => {
    const { project } = await loadGalleryEntry('medio-sumador')
    const spec = tableSpec(['a', 'b'], ['suma', 'acarreo'], (a, b) => [a === b ? 0 : 1, a && b])
    expect(verify(project.circuit, toLibrary(project.chips), spec).passed).toBe(true)
  })
})
