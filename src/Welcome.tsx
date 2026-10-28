import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, chooseLanguage, currentLanguage } from './i18n.ts'
import type { Language } from './i18n.ts'
import { BookIcon, Logo, MutedIcon, SoundIcon } from './icons.tsx'
import { Shortcuts } from './Shortcuts.tsx'
import { play } from './sound.ts'
import { useDialog } from './useDialog.ts'

/** Each language is named in itself, so anyone can find theirs. */
const LANGUAGE_NAMES: Record<Language, string> = { es: 'Español', en: 'English' }

export const AUTHOR_URL = 'https://github.com/msucedo'
export const REPO_URL = `${AUTHOR_URL}/Circuitos`

export function Credit({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <p className={className}>
      <span className="author">
        {t('welcome.credit')}{' '}
        <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer">
          msucedo
        </a>
      </span>
      <a className="report" href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer">
        {t('welcome.report')}
      </a>
      <span className="version">v{__APP_VERSION__}</span>
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
  onExportSave: () => void
  onImportSave: (file: File) => void
  onOpenGuide: () => void
}

/** Shown on every load: how to play, progress, shortcuts and the language. */
export function Welcome({ open, hasProgress, muted, onToggleMuted, onClose, onResetAll, onExportSave, onImportSave, onOpenGuide }: Props) {
  const { t } = useTranslation()
  // The language picker comes first in the dialog; the main action keeps the focus.
  const start = useRef<HTMLButtonElement>(null)
  const { dialog } = useDialog(open, onClose, start)
  const [confirmReset, setConfirmReset] = useState(false)
  const saveFile = useRef<HTMLInputElement>(null)

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
              onClick={() => {
                if (language !== currentLanguage()) play('snap')
                chooseLanguage(language)
              }}
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
      <div className="actions">
        {hasProgress && (
          <button type="button" onClick={onExportSave}>
            {t('welcome.exportSave')}
          </button>
        )}
        <button type="button" onClick={() => saveFile.current?.click()}>
          {t('welcome.importSave')}
        </button>
        {hasProgress && (
          <button
            type="button"
            className={confirmReset ? 'danger' : ''}
            onClick={() => (confirmReset ? onResetAll() : setConfirmReset(true))}
            onBlur={() => setConfirmReset(false)}
          >
            {confirmReset ? t('welcome.confirmWipe') : t('welcome.wipe')}
          </button>
        )}
        <input
          ref={saveFile}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) onImportSave(file)
          }}
        />
      </div>

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
      </div>

      <Credit className="credit" />
    </dialog>
  )
}
