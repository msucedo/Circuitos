import { describe, expect, it } from 'vitest'
import { exportProject } from './project.ts'
import { decodeShare, encodeShare, galleryIssueUrl, galleryUrl, nodeCount, shareUrl, sharedTarget } from './share.ts'
import { LIMITS, parseProject } from './sim/schema.ts'
import { FULL_ADDER, LIBRARY } from './sim/examples.ts'

// recursive.json is a chip that contains itself, kept to show the error.
const files = import.meta.glob<string>(['../examples/*.json', '!../examples/recursive.json'], { query: '?raw', import: 'default', eager: true })
const examples = Object.values(files).map(parseProject)

/** Compresses raw bytes the way a link does, to build hostile links by hand. */
async function deflate(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  const packed = new Uint8Array(await new Response(stream).arrayBuffer())
  return `1.${btoa(String.fromCharCode(...packed)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

describe('share links', () => {
  it('give back the same project, and fit in a link', async () => {
    for (const project of examples) {
      const data = await encodeShare(project)
      expect(data).toMatch(/^1\.[A-Za-z0-9_-]+$/)
      expect(data.length).toBeLessThanOrEqual(LIMITS.shareChars)
      await expect(decodeShare(data)).resolves.toEqual(project)
    }
  })

  it('hold a circuit of a couple hundred pieces, as the guide says', async () => {
    const project = exportProject(FULL_ADDER, LIBRARY)
    const perPiece = (await encodeShare(project)).length / nodeCount(project)
    expect(LIMITS.shareChars / perPiece).toBeGreaterThan(200)
  })

  it('refuse a link that is too long before decoding it', async () => {
    await expect(decodeShare(`1.${'A'.repeat(LIMITS.shareChars)}`)).rejects.toMatchObject({ code: 'shareTooLong' })
  })

  it('refuse damaged data', async () => {
    for (const bad of ['', '1.', '1.%%%', '2.AAAA', 'AAAA', '1.AAAA']) {
      await expect(decodeShare(bad)).rejects.toMatchObject({ code: 'shareCorrupt' })
    }
  })

  it('stop a small link that expands past the size limit', async () => {
    const bomb = await deflate(new Uint8Array(LIMITS.bytes + 1).fill(32))
    expect(bomb.length).toBeLessThanOrEqual(LIMITS.shareChars)
    await expect(decodeShare(bomb)).rejects.toMatchObject({ code: 'shareCorrupt' })
  })

  it('send valid JSON with a bad circuit through the schema', async () => {
    const data = await deflate(new TextEncoder().encode('{"version":1,"chips":[],"circuit":{"nodes":[{"id":"a","kind":"NOPE"}],"wires":[]}}'))
    await expect(decodeShare(data)).rejects.toMatchObject({ code: 'unknownKind' })
  })
})

describe('sharedTarget', () => {
  it('reads a link or a gallery entry from the hash', () => {
    expect(sharedTarget('#c=1.abc')).toEqual({ kind: 'link', data: '1.abc' })
    expect(sharedTarget('#g=xor')).toEqual({ kind: 'gallery', slug: 'xor' })
    expect(sharedTarget('')).toBeUndefined()
    expect(sharedTarget('#otra')).toBeUndefined()
  })

  it('builds the links the hash reads', () => {
    expect(sharedTarget(new URL(shareUrl('https://circuitos.io', '1.abc')).hash)).toEqual({ kind: 'link', data: '1.abc' })
    expect(sharedTarget(new URL(galleryUrl('https://circuitos.io', 'xor')).hash)).toEqual({ kind: 'gallery', slug: 'xor' })
  })
})

describe('galleryIssueUrl', () => {
  it('prefills the gallery template with every field escaped', () => {
    const url = new URL(galleryIssueUrl({ title: 'Galería: a&b', name: 'a&b', description: 'x=1 #2', link: 'https://circuitos.io/#c=1.abc' }))
    expect(`${url.origin}${url.pathname}`).toBe('https://github.com/msucedo/Circuitos/issues/new')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      template: 'galeria.yml',
      title: 'Galería: a&b',
      nombre: 'a&b',
      descripcion: 'x=1 #2',
      link: 'https://circuitos.io/#c=1.abc',
    })
  })

  it('stays under the GitHub limit with the longest link, name and description', () => {
    // A three-byte character is the longest once escaped for its length in the field.
    const name = '€'.repeat(LIMITS.text)
    const url = galleryIssueUrl({
      title: `Galería: ${name}`,
      name,
      description: '€'.repeat(LIMITS.description),
      link: shareUrl('https://circuitos.io', `1.${'A'.repeat(LIMITS.shareChars - 2)}`),
    })
    expect(url.length).toBeLessThanOrEqual(LIMITS.issueUrl)
  })
})
