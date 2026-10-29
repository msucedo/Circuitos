import { describe, expect, it } from 'vitest'
import vercel from '../vercel.json'

const rule = (source: string) => Object.fromEntries(vercel.headers.find((r) => r.source === source)?.headers.map((h) => [h.key, h.value]) ?? [])

/** vercel.json is where the production headers are written; a slip there should fail here, not in production. */
describe('production headers', () => {
  it('send a strict CSP that also forbids framing, plus the other hardening headers', () => {
    const page = rule('/(.*)')
    const csp = page['Content-Security-Policy']?.split(';').map((d) => d.trim())
    expect(csp).toEqual(expect.arrayContaining(["default-src 'self'", "script-src 'self'", "object-src 'none'", "frame-ancestors 'none'"]))
    expect(page).toMatchObject({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' })
    expect(page['Permissions-Policy']).toBeTruthy()
  })

  it('cache the hashed assets for good', () => {
    expect(rule('/assets/(.*)')['Cache-Control']).toBe('public, max-age=31536000, immutable')
  })
})
