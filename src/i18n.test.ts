// @vitest-environment jsdom
import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18N_OPTIONS, LANGUAGE_KEY } from './i18n.ts'
import en from './locales/en.json'
import es from './locales/es.json'

/** Every leaf key, with plural suffixes folded so `x_one`/`x_other` count as `x`. */
function keys(tree: object, prefix = ''): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const [k, v] of Object.entries(tree)) {
    const path = `${prefix}${k.replace(/_(zero|one|two|few|many|other)$/, '')}`
    if (typeof v === 'string') {
      const params = [...v.matchAll(/{{\s*(\w+)/g)].map((m) => m[1]).sort()
      out.set(path, [...new Set([...(out.get(path) ?? []), ...params])].sort())
    } else for (const [kk, vv] of keys(v, `${path}.`)) out.set(kk, vv)
  }
  return out
}

describe('translations', () => {
  it('have the same keys and placeholders in Spanish and English', () => {
    const spanish = keys(es)
    const english = keys(en)
    expect([...english.keys()].sort()).toEqual([...spanish.keys()].sort())
    for (const [key, params] of spanish) expect(english.get(key), key).toEqual(params)
  })
})

describe('language detection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  async function detect(languages: string[], saved?: string) {
    vi.stubGlobal('navigator', { ...navigator, languages, language: languages[0] })
    if (saved) localStorage.setItem(LANGUAGE_KEY, saved)
    const instance = i18next.createInstance()
    await instance.use(LanguageDetector).init(I18N_OPTIONS)
    return instance.resolvedLanguage
  }

  it('follows the browser, region included', async () => {
    expect(await detect(['es-MX', 'en'])).toBe('es')
    expect(await detect(['en-GB'])).toBe('en')
    expect(await detect(['fr-FR', 'es-ES'])).toBe('es')
  })

  it('falls back to English for other languages', async () => {
    expect(await detect(['fr-FR', 'de'])).toBe('en')
  })

  it('prefers the language the user picked, and detecting saves nothing', async () => {
    expect(await detect(['en-US'], 'es')).toBe('es')
    localStorage.clear()
    await detect(['es-MX'])
    expect(localStorage.getItem(LANGUAGE_KEY)).toBeNull()
  })
})
