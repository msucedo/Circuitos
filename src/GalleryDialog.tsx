import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { copyText } from './clipboard.ts'
import { CircuitView } from './editor/CircuitView.tsx'
import { GALLERY, loadGalleryEntry } from './gallery/gallery.ts'
import { galleryUrl } from './share.ts'
import { toLibrary } from './sim/types.ts'
import type { ChipLibrary, Circuit } from './sim/types.ts'
import { useDialog } from './useDialog.ts'

interface Props {
  open: boolean
  onClose: () => void
  onOpenEntry: (slug: string) => void
  /** An entry's preview is open on top: its card turned into it, and the gallery stays under it to come back to. */
  covered?: boolean
}

/** The approved community circuits. Their texts are shown as plain text, never as markup. */
export function GalleryDialog({ open, onClose, onOpenEntry, covered = false }: Props) {
  const { t } = useTranslation()
  const close = useRef<HTMLButtonElement>(null)
  const { dialog, shown } = useDialog(open, onClose, close)
  const [copied, setCopied] = useState<{ slug: string; ok: boolean }>()
  const thumbnails = useThumbnails(open)
  // The entry last opened: its card turns into the preview and back, so it carries the shared names (`.morph-source`).
  const [chosen, setChosen] = useState<string>()

  return (
    <dialog ref={dialog} className={`sheet gallery${covered ? ' covered' : ''}`} aria-labelledby="gallery-title" onClose={onClose}>
      <header className="sheet-head">
        <h2 id="gallery-title">{t('gallery.title')}</h2>
        <button ref={close} type="button" aria-label={t('gallery.close')} onClick={onClose}>
          ×
        </button>
      </header>
      <p>{t('gallery.intro')}</p>
      {GALLERY.length === 0 ? (
        <p className="muted">{t('gallery.empty')}</p>
      ) : (
        <ul className="gallery-list">
          {GALLERY.map((entry) => {
            const thumbnail = thumbnails.get(entry.slug)
            return (
              // Only while it shows: the preview carries the same names on top of it.
              <li key={entry.slug} className={entry.slug === chosen && !covered ? 'morph-source' : undefined}>
                {/* Its box is there while the circuit loads, so the card does not grow when it arrives. */}
                {shown && (thumbnail ? <CircuitView circuit={thumbnail.circuit} library={thumbnail.library} /> : <div className="circuit-view" aria-hidden />)}
                <h3>{entry.name}</h3>
                <p className="entry-description">{entry.description}</p>
                {entry.author && <p className="muted entry-author">{t('share.by', { author: entry.author })}</p>}
                <div className="actions entry-actions">
                  <button
                    type="button"
                    className="primary"
                    aria-label={t('gallery.openEntry', { name: entry.name })}
                    onClick={() => {
                      setChosen(entry.slug)
                      onOpenEntry(entry.slug)
                    }}
                  >
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
            )
          })}
        </ul>
      )}
      <p className="muted">{t('gallery.howToSend')}</p>
    </dialog>
  )
}

type Thumbnail ={ circuit: Circuit; library: ChipLibrary }

/**
 * The entries' projects, loaded (and validated, like any link) the first time the gallery opens,
 * so a closed gallery costs nothing and the views first draw while visible. One that fails gets no thumbnail.
 */
function useThumbnails(open: boolean): ReadonlyMap<string, Thumbnail> {
  const [thumbnails, setThumbnails] = useState<ReadonlyMap<string, Thumbnail>>(new Map())
  const wanted = open || thumbnails.size > 0
  useEffect(() => {
    if (!wanted) return
    let cancelled = false
    for (const { slug } of GALLERY) {
      loadGalleryEntry(slug).then(
        ({ project }) => {
          if (cancelled) return
          const thumbnail = { circuit: project.circuit, library: toLibrary(project.chips) }
          setThumbnails((m) => (m.has(slug) ? m : new Map(m).set(slug, thumbnail)))
        },
        () => {},
      )
    }
    return () => {
      cancelled = true
    }
  }, [wanted])
  return thumbnails
}
