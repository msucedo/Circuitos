// Unit tests read the Spanish texts; jsdom reports an English browser, so pick Spanish explicitly.
import i18n from './i18n.ts'

await i18n.changeLanguage('es')
