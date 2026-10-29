import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { copyText } from './clipboard.ts'
import { GALLERY } from './gallery/gallery.ts'
import { galleryUrl } from './share.ts'
import { useDialog } from './useDialog.ts'

interface Props {
  open: boolean
  onClose: () => void
  onOpenEntry: (slug: string) => void
}

/** The approved community circuits. Their texts are shown as plain text, never as markup. */
export function GalleryDialog({ open, onClose, onOpenEntry }: Props) {
  const { t } = useTranslation()
  const close = useRef<HTMLButtonElement>(null)
  const { dialog } = useDialog(open, onClose, close)
  const [copied, setCopied] = useState<{ slug: string; ok: boolean }>()

  return (
    <dialog ref={dialog} className="sheet gallery" aria-labelledby="gallery-title" onClose={onClose}>
      <h2 id="gallery-title">{t('gallery.title')}</h2>
      <p>{t('gallery.intro')}</p>
      {GALLERY.length === 0 ? (
        <p className="muted">{t('gallery.empty')}</p>
      ) : (
        <ul className="gallery-list">
          {GALLERY.map((entry) => (
            <li key={entry.slug}>
              <h3>{entry.name}</h3>
              <p>{entry.description}</p>
              {entry.author && <p className="muted">{t('share.by', { author: entry.author })}</p>}
              <div className="actions">
                <button type="button" className="primary" aria-label={t('gallery.openEntry', { name: entry.name })} onClick={() => onOpenEntry(entry.slug)}>
                  {t('gallery.open')}
                </button>
                <button
                  type="button"
                  aria-label={t('gallery.copyEntry', { name: entry.name })}
                  onClick={() => void copyText(galleryUrl(location.origin, entry.slug)).then((ok) => setCopied({ slug: entry.slug, ok }))}
                >
                  {t('share.copy')}
                </button>
                <span className="muted" role="status">
                  {copied?.slug === entry.slug ? (copied.ok ? t('share.copied') : galleryUrl(location.origin, entry.slug)) : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="muted">{t('gallery.howToSend')}</p>
      <div className="actions">
        <button ref={close} type="button" onClick={onClose}>
          {t('share.close')}
        </button>
      </div>
    </dialog>
  )
}
