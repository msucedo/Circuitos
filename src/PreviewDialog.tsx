import { useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { chipLabel, problemText } from './i18n.ts'
import { chipConflicts, renameChip } from './project.ts'
import { nodeCount } from './share.ts'
import { LIMITS } from './sim/schema.ts'
import type { Project } from './sim/schema.ts'
import type { ChipDef, Problem } from './sim/types.ts'
import { useDialog } from './useDialog.ts'

/** A project from a link, the gallery or a file, waiting for the player to open it. */
export interface Incoming {
  project: Project
  /** Bumped for every new one, so a second link starts the preview over. */
  id: number
  /** The file or gallery entry name; a link has none. */
  title?: string
  /** The kept sandbox coming back: one use, so there is nothing to keep in exchange. */
  restore?: true
  description?: string
  author?: string
}

interface Props {
  incoming?: Incoming
  mine: ChipDef[]
  onCancel: () => void
  /** Opens the project in the sandbox, or says why it could not. */
  /** Present when the sandbox has work: offers to keep it; `replaces` says one is kept already. */
  keepCurrent?: { replaces: boolean }
  /** Opens the project in the sandbox, keeping the current one first if `keep`, or says why it could not. */
  onOpen: (project: Project, keep: boolean) => Problem | undefined
}

/** Shows what a shared circuit brings before it replaces the sandbox; chips that clash can be renamed here. */
export function PreviewDialog({ incoming, mine, keepCurrent, onCancel, onOpen }: Props) {
  const cancel = useRef<HTMLButtonElement>(null)
  const { dialog } = useDialog(!!incoming, onCancel, cancel)
  // Kept while the dialog animates out.
  const [shown, setShown] = useState(incoming)
  if (incoming && incoming !== shown) setShown(incoming)

  return (
    <dialog ref={dialog} className="sheet preview" aria-labelledby="preview-title" onClose={onCancel}>
      {shown && <PreviewContent key={shown.id} incoming={shown} mine={mine} keepCurrent={keepCurrent} cancel={cancel} onCancel={onCancel} onOpen={onOpen} />}
    </dialog>
  )
}

function PreviewContent({ incoming, mine, keepCurrent, cancel, onCancel, onOpen }: Omit<Props, 'incoming'> & { incoming: Incoming; cancel: RefObject<HTMLButtonElement | null> }) {
  const { t } = useTranslation()
  const [project, setProject] = useState(incoming.project)
  const [names, setNames] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState<Problem>()
  // Keeping is the default, so nothing is lost by not looking.
  const [keep, setKeep] = useState(true)
  const offerKeep = !!keepCurrent && !incoming.restore
  const conflicts = new Set(chipConflicts(project, mine).map((c) => c.id))
  const have = new Set(mine.map((c) => c.id))

  const rename = (chip: ChipDef) => {
    const name = (names[chip.id] ?? '').trim()
    if (name.length === 0) return
    setProject((p) => renameChip(p, chip.id, name, have))
  }

  return (
    <>
      <h2 id="preview-title">{incoming.restore ? t('share.restoreTitle') : (incoming.title ?? t('share.linkTitle'))}</h2>
      {incoming.description && <p>{incoming.description}</p>}
      {incoming.author && <p className="muted">{t('share.by', { author: incoming.author })}</p>}
      <p>{t('share.pieces', { count: nodeCount(project) })}</p>
      {project.chips.length > 0 && (
        <>
          <h3>{t('share.chips')}</h3>
          <ul className="preview-chips">
            {project.chips.map((chip) => {
              const label = chipLabel(t, chip)
              return (
                <li key={chip.id}>
                  <span>{label}</span>
                  <small className={conflicts.has(chip.id) ? 'clash' : 'muted'}>
                    {conflicts.has(chip.id) ? t('share.chipConflict') : have.has(chip.id) ? t('share.chipKept') : t('share.chipNew')}
                  </small>
                  {conflicts.has(chip.id) && (
                    <form
                      className="chip-rename"
                      onSubmit={(e) => {
                        e.preventDefault()
                        rename(chip)
                      }}
                    >
                      <input
                        type="text"
                        value={names[chip.id] ?? ''}
                        maxLength={LIMITS.text}
                        aria-label={t('share.newName', { name: label })}
                        placeholder={t('share.newNamePlaceholder')}
                        onChange={(e) => setNames((n) => ({ ...n, [chip.id]: e.target.value }))}
                      />
                      <button type="submit" disabled={!(names[chip.id] ?? '').trim()}>
                        {t('share.rename')}
                      </button>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
      {/* An empty sandbox has nothing to replace. */}
      {(incoming.restore || keepCurrent) && <p className="muted">{incoming.restore ? t('share.restoreText') : t('share.replaces')}</p>}
      {offerKeep && (
        <>
          <label className="keep-current">
            <input
              type="checkbox"
              checked={keep}
              aria-describedby={keepCurrent.replaces ? 'keep-replaces' : undefined}
              onChange={(e) => setKeep(e.target.checked)}
            />
            {t('share.keepCurrent')}
          </label>
          {keepCurrent.replaces && (
            <p id="keep-replaces" className="muted">
              {t('share.keepReplaces')}
            </p>
          )}
        </>
      )}
      {conflicts.size > 0 && (
        <p id="preview-blocked" className="clash">
          {t('share.resolveFirst')}
        </p>
      )}
      {failed && (
        <p className="clash" role="alert">
          {problemText(t, failed)}
        </p>
      )}
      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={conflicts.size > 0}
          aria-describedby={conflicts.size > 0 ? 'preview-blocked' : undefined}
          onClick={() => setFailed(onOpen(project, offerKeep && keep))}
        >
          {incoming.restore ? t('share.confirmRestore') : t('share.openInSandbox')}
        </button>
        <button ref={cancel} type="button" onClick={onCancel}>
          {t('app.cancel')}
        </button>
      </div>
    </>
  )
}
