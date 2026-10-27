import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, chooseLanguage, currentLanguage } from './i18n.ts'
import type { Language } from './i18n.ts'
import { BookIcon, Logo, MutedIcon, SoundIcon } from './icons.tsx'
import { Shortcuts } from './Shortcuts.tsx'
import { useDialog } from './useDialog.ts'

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
  muted: boolean
  onToggleMuted: () => void
  onClose: () => void
  onResetAll: () => void
  onOpenGuide: () => void
}

/** Shown on every load: how to play, progress, shortcuts and the language. */
export function Welcome({ open, hasProgress, muted, onToggleMuted, onClose, onResetAll, onOpenGuide }: Props) {
  const { t } = useTranslation()
  // The language picker comes first in the dialog; the main action keeps the focus.
  const start = useRef<HTMLButtonElement>(null)
  const { dialog } = useDialog(open, onClose, start)
  const [confirmReset, setConfirmReset] = useState(false)

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
        <button
          type="button"
          className="icon-button sound-toggle"
          aria-pressed={muted}
          aria-label={t('welcome.mute')}
          title={muted ? t('welcome.soundOff') : t('welcome.soundOn')}
          onClick={onToggleMuted}
        >
          {muted ? <MutedIcon /> : <SoundIcon />}
        </button>
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
      <Shortcuts />

      <div className="actions">
        <button ref={start} type="button" className="primary" onClick={onClose}>
          {hasProgress ? t('welcome.continue') : t('welcome.start')}
        </button>
        <button type="button" className="with-icon" onClick={onOpenGuide}>
          <BookIcon />
          {t('guide.open')}
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
