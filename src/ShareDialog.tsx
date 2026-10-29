import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { copyText } from './clipboard.ts'
import { encodeShare, galleryIssueUrl, nodeCount, shareUrl } from './share.ts'
import { LIMITS } from './sim/schema.ts'
import type { Project } from './sim/schema.ts'
import { useDialog } from './useDialog.ts'

interface Props {
  /** The sandbox to share, taken when the dialog opens. */
  project?: Project
  onClose: () => void
}

/** A link to the sandbox circuit, how much of a link it fills, and a way to send it to the gallery. */
export function ShareDialog({ project, onClose }: Props) {
  const { t } = useTranslation()
  const close = useRef<HTMLButtonElement>(null)
  const { dialog } = useDialog(!!project, onClose, close)
  const [shown, setShown] = useState(project)
  if (project && project !== shown) setShown(project)

  return (
    <dialog ref={dialog} className="sheet share" aria-labelledby="share-title" onClose={onClose}>
      {/* Not keyed: the name and description typed for the gallery stay for the next opening. */}
      {shown && <ShareContent project={shown} />}
      <div className="actions">
        <button ref={close} type="button" onClick={onClose}>
          {t('share.close')}
        </button>
      </div>
    </dialog>
  )
}

type Copy = { link: string; ok: boolean }

function ShareContent({ project }: { project: Project }) {
  const { t } = useTranslation()
  // Compressed once per opening, not on every change of the circuit; a result for an older project is ignored.
  const [encoded, setEncoded] = useState<{ project: Project; data: string }>()
  const [copy, setCopy] = useState<Copy>()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  useEffect(() => {
    void encodeShare(project).then((data) => setEncoded({ project, data }))
  }, [project])

  const data = encoded?.project === project ? encoded.data : undefined
  const pieces = nodeCount(project)
  const fits = data !== undefined && data.length <= LIMITS.shareChars
  const link = data && shareUrl(location.origin, data)
  const ready = fits && link && name.trim() && description.trim()

  return (
    <>
      <h2 id="share-title">{t('share.title')}</h2>
      {data === undefined ? (
        <p className="muted">{t('share.preparing')}</p>
      ) : fits && link ? (
        <>
          <div className="share-link">
            <input type="text" readOnly value={link} aria-label={t('share.linkLabel')} onFocus={(e) => e.target.select()} />
            <button type="button" className="primary" onClick={() => void copyText(link).then((ok) => setCopy({ link, ok }))}>
              {t('share.copy')}
            </button>
          </div>
          <p className="muted" role="status">
            {copy?.link !== link ? '' : copy.ok ? t('share.copied') : t('share.copyFailed')}
          </p>
          <p className="muted">{t('share.size', { percent: Math.ceil((data.length / LIMITS.shareChars) * 100) })}</p>
        </>
      ) : (
        <p className="clash" role="alert">
          {t('share.tooBig', { count: pieces, max: Math.floor((pieces * LIMITS.shareChars) / data.length) })}
        </p>
      )}

      <h3>{t('share.submitTitle')}</h3>
      <p>{t('share.submitText')}</p>
      <form className="submit-form" onSubmit={(e) => e.preventDefault()}>
        <label>
          {t('share.name')}
          <input type="text" value={name} maxLength={LIMITS.text} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {t('share.description')}
          <textarea value={description} maxLength={LIMITS.description} rows={3} onChange={(e) => setDescription(e.target.value)} />
        </label>
        {ready ? (
          <a
            className="button-link primary"
            href={galleryIssueUrl({ title: t('share.issueTitle', { name: name.trim() }), name: name.trim(), description: description.trim(), link })}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('share.submit')}
          </a>
        ) : (
          <button type="button" disabled aria-describedby="submit-needs">
            {t('share.submit')}
          </button>
        )}
        {!ready && (
          <p id="submit-needs" className="muted">
            {fits ? t('share.submitNeeds') : t('share.submitTooBig')}
          </p>
        )}
      </form>
    </>
  )
}
