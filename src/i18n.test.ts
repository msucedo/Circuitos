// @vitest-environment jsdom
import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18N_OPTIONS, LANGUAGE_KEY } from './i18n.ts'
import { RICH_TAGS } from './richTags.ts'
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

/** Every leaf text by its full key. */
function texts(tree: object, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]): [string, string][] =>
    typeof v === 'string' ? [[`${prefix}${k}`, v]] : texts(v, `${prefix}${k}.`),
  )
}

/** Tags in order of appearance, `/x` for closing ones; anything else that looks like markup comes back as is. */
const tagsOf = (text: string) => [...text.matchAll(/<[^>]*>/g)].map((m) => m[0].match(/^<(\/?)([a-z]+)>$/)?.slice(1).join('') ?? m[0])

describe('markup in translations', () => {
  for (const [language, tree] of [['es', es], ['en', en]] as const) {
    it(`only uses the allowed tags, without attributes and well closed (${language})`, () => {
      for (const [key, text] of texts(tree)) {
        const open: string[] = []
        for (const tag of tagsOf(text)) {
          const name = tag.replace('/', '')
          expect(RICH_TAGS as readonly string[], `${key}: ${tag}`).toContain(name)
          if (tag.startsWith('/')) expect(open.pop(), `${key}: ${tag}`).toBe(name)
          else open.push(name)
        }
        expect(open, key).toEqual([])
      }
    })
  }

  it('names the same pins in Spanish and English', () => {
    const pins = (text: string) => [...text.matchAll(/<pin>(.*?)<\/pin>/g)].map((m) => m[1]).sort()
    const english = new Map(texts(en))
    for (const [key, text] of texts(es)) expect(pins(english.get(key) ?? ''), key).toEqual(pins(text))
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
