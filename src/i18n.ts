import i18n from 'i18next'
import type { InitOptions, TFunction } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import type { Level } from './levels/levels.ts'
import type { ChipDef, Problem } from './sim/types.ts'
import en from './locales/en.json'
import es from './locales/es.json'

export const LANGUAGES = ['es', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

/** Only written when the user picks a language; otherwise the browser's preference wins on every visit. */
export const LANGUAGE_KEY = 'circuitos:idioma'

export const currentLanguage = (): Language => (i18n.resolvedLanguage === 'es' ? 'es' : 'en')

i18n.on('languageChanged', () => {
  if (typeof document !== 'undefined') document.documentElement.lang = currentLanguage()
})

export const I18N_OPTIONS: InitOptions = {
  resources: { es: { translation: es }, en: { translation: en } },
  supportedLngs: LANGUAGES,
  // es-MX → es, en-GB → en; anything else falls back to English.
  nonExplicitSupportedLngs: true,
  load: 'languageOnly',
  fallbackLng: 'en',
  // A saved choice first, then the browser's languages in order of preference. Detecting saves nothing.
  detection: { order: ['localStorage', 'navigator'], lookupLocalStorage: LANGUAGE_KEY, caches: [] },
  // React already escapes what it renders.
  interpolation: { escapeValue: false },
  // Resources are bundled, so the first render is already translated.
  initAsync: false,
}

void i18n.use(LanguageDetector).use(initReactI18next).init(I18N_OPTIONS)

export function chooseLanguage(language: Language) {
  try {
    localStorage.setItem(LANGUAGE_KEY, language)
  } catch {
    /* blocked storage: the choice lasts until the page closes */
  }
  void i18n.changeLanguage(language)
}

/** User-facing sentence for a problem reported by the simulator, the schema or storage. */
export const problemText = (t: TFunction, p: Problem) => t(`problems.${p.code}`, p.params)

/** Level texts live in the translations, keyed by level id. */
type LevelField = 'name' | 'goal' | 'hint' | 'story'
export function levelText(t: TFunction, level: Pick<Level, 'id'>, field: LevelField): string {
  const key = `levels.${level.id}.${field}`
  return i18n.exists(key) ? t(key as 'levels.NOT.name') : ''
}

/** A level chip is always shown with its level's name in the current language, never the saved one. */
export const chipLabel = (t: TFunction, chip: Pick<ChipDef, 'id' | 'name'>) => levelText(t, chip, 'name') || chip.name

export default i18n
