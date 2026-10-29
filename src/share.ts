import { REPO_URL } from './links.ts'
import { LIMITS, parseProject } from './sim/schema.ts'
import type { Project } from './sim/schema.ts'
import { CircuitError } from './sim/types.ts'

/**
 * Share links carry the whole project in the URL fragment, which never reaches
 * the server: `#c=<version>.<deflate-raw, base64url>`. Gallery links only name
 * the entry: `#g=<slug>`. Everything read from a link goes through `parseProject`.
 */

/** Bumped if the format changes, so older links can still be told apart. */
const FORMAT = '1'
const LINK_PARAM = 'c'
const GALLERY_PARAM = 'g'
const COMPRESSION = 'deflate-raw'
const GALLERY_TEMPLATE = 'galeria.yml'

export type SharedTarget = { kind: 'link'; data: string } | { kind: 'gallery'; slug: string }

const corrupt = () => new CircuitError('shareCorrupt')

const toBase64Url = (bytes: Uint8Array) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (text: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw corrupt()
  try {
    return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
  } catch {
    throw corrupt()
  }
}

export async function encodeShare(project: Project): Promise<string> {
  const stream = new Blob([JSON.stringify(project)]).stream().pipeThrough(new CompressionStream(COMPRESSION))
  return `${FORMAT}.${toBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()))}`
}

/** Inflates, giving up as soon as the result passes the file limit (a tiny link can expand a lot). */
async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(COMPRESSION)).getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > LIMITS.bytes) {
        void reader.cancel()
        throw corrupt()
      }
      chunks.push(value)
    }
  } catch {
    throw corrupt()
  }
  return new TextDecoder().decode(await new Blob(chunks).arrayBuffer())
}

export async function decodeShare(data: string): Promise<Project> {
  if (data.length > LIMITS.shareChars) throw new CircuitError('shareTooLong')
  const [format, payload, ...rest] = data.split('.')
  if (format !== FORMAT || !payload || rest.length > 0) throw corrupt()
  const json = await inflate(fromBase64Url(payload))
  try {
    return parseProject(json)
  } catch (error) {
    throw error instanceof CircuitError && error.code === 'notJson' ? corrupt() : error
  }
}

/** Pieces in the circuit and inside its chips: what makes a link long. */
export const nodeCount = (project: Project) =>
  project.circuit.nodes.length + project.chips.reduce((sum, c) => sum + c.circuit.nodes.length, 0)

export const shareUrl = (origin: string, data: string) => `${origin}/#${new URLSearchParams({ [LINK_PARAM]: data })}`
export const galleryUrl = (origin: string, slug: string) => `${origin}/#${new URLSearchParams({ [GALLERY_PARAM]: slug })}`

export function sharedTarget(hash: string): SharedTarget | undefined {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const data = params.get(LINK_PARAM)
  if (data !== null) return { kind: 'link', data }
  const slug = params.get(GALLERY_PARAM)
  if (slug !== null) return { kind: 'gallery', slug }
}

interface Submission {
  title: string
  name: string
  description: string
  link: string
}

/** A new issue on the repository with the gallery form already filled in; the field names match the template. */
export function galleryIssueUrl({ title, name, description, link }: Submission): string {
  const params = new URLSearchParams({ template: GALLERY_TEMPLATE, title, nombre: name, descripcion: description, link })
  return `${REPO_URL}/issues/new?${params}`
}
