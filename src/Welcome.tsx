import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { LANGUAGES, chooseLanguage, currentLanguage } from './i18n.ts'
import type { Language } from './i18n.ts'
import { Logo } from './icons.tsx'
import type es from './locales/es.json'

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'

type KeyName = keyof (typeof es)['welcome']['keys']
type ActionName = keyof (typeof es)['welcome']['actions']

/** Literal keys stay as they are; named ones (`{ name }`) are translated. */
const SHORTCUTS: [keys: (string | { name: KeyName })[], action: ActionName][] = [
  [[MOD, 'Z'], 'undo'],
  [[MOD, 'Shift', 'Z'], 'redo'],
  [[MOD, 'C'], 'copy'],
  [[MOD, 'V'], 'paste'],
  [[{ name: 'delete' }], 'delete'],
  [[MOD, { name: 'click' }], 'multiSelect'],
  [[{ name: 'drag' }], 'boxSelect'],
  [[{ name: 'space' }, { name: 'dragLower' }], 'pan'],
  [[MOD, { name: 'scroll' }], 'zoom'],
  [[{ name: 'doubleClick' }], 'rename'],
]

const keyLabel = (t: TFunction, key: string | { name: KeyName }) => (typeof key === 'string' ? key : t(`welcome.keys.${key.name}`))

/** Each language is named in itself, so anyone can find theirs. */
const LANGUAGE_NAMES: Record<Language, string> = { es: 'Español', en: 'English' }

export const AUTHOR_URL = 'https://github.com/msucedo'

export function Credit({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <p className={className}>
      {t('welcome.credit')}{' '}
      <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer">
        msucedo
      </a>
    </p>
  )
}

interface Props {
  open: boolean
  hasProgress: boolean
  onClose: () => void
  onResetAll: () => void
}

/** Native modal dialog: the browser traps focus, closes it on Esc and hides the page behind it. */
export function Welcome({ open, hasProgress, onClose, onResetAll }: Props) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const start = useRef<HTMLButtonElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      // The language picker comes first in the dialog; the main action keeps the focus.
      start.current?.focus()
    }
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      className="welcome"
      aria-labelledby="welcome-title"
      onClose={() => {
        setConfirmReset(false)
        onClose()
      }}
    >
      <div className="welcome-title">
        <Logo size={36} />
        <h2 id="welcome-title">{t('app.name')}</h2>
        <div className="language" role="group" aria-label={t('welcome.language')}>
          {LANGUAGES.map((language) => (
            <button
              key={language}
              type="button"
              lang={language}
              aria-pressed={currentLanguage() === language}
              onClick={() => chooseLanguage(language)}
            >
              {LANGUAGE_NAMES[language]}
            </button>
          ))}
        </div>
      </div>
      <p>{t('welcome.intro')}</p>

      <h3>{t('welcome.howTo')}</h3>
      <ol>
        <li>{t('welcome.step1')}</li>
        <li>{t('welcome.step2')}</li>
        <li>{t('welcome.step3')}</li>
      </ol>
      <p>{t('welcome.sandbox')}</p>

      <h3>{t('welcome.progress')}</h3>
      <p>{t('welcome.progressText')}</p>

      <h3>{t('welcome.shortcuts')}</h3>
      <dl className="shortcuts">
        {SHORTCUTS.map(([keys, action]) => (
          <div key={action}>
            <dt>
              {keys.map((k, i) => (
                <kbd key={i}>{keyLabel(t, k)}</kbd>
              ))}
            </dt>
            <dd>{t(`welcome.actions.${action}`)}</dd>
          </div>
        ))}
      </dl>

      <div className="actions">
        <button ref={start} type="button" className="primary" onClick={onClose}>
          {hasProgress ? t('welcome.continue') : t('welcome.start')}
        </button>
        {hasProgress && (
          <button
            type="button"
            className={confirmReset ? 'danger' : ''}
            onClick={() => (confirmReset ? onResetAll() : setConfirmReset(true))}
          >
            {confirmReset ? t('welcome.confirmWipe') : t('welcome.wipe')}
          </button>
        )}
      </div>

      <Credit className="credit" />
    </dialog>
  )
}
