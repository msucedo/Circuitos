import { useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { CircuitView } from './editor/CircuitView.tsx'
import { kindName } from './editor/context.ts'
import { PieceIcon } from './editor/PieceIcon.tsx'
import { TruthTable } from './editor/TruthTable.tsx'
import { chipLabel, problemText } from './i18n.ts'
import { levelById } from './levels/levels.ts'
import { chipConflicts, renameChip } from './project.ts'
import { nodeCount } from './share.ts'
import { LIMITS } from './sim/schema.ts'
import type { Project } from './sim/schema.ts'
import { toLibrary } from './sim/types.ts'
import type { ChipDef, Circuit, Problem } from './sim/types.ts'
import { play } from './sound.ts'
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
  /** Opened from the gallery's list: it comes in once the gallery has zoomed into the card, and going back returns there. */
  fromGallery?: true
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
  const { dialog, shown: visible } = useDialog(!!incoming, onCancel, cancel)
  // Kept while the dialog animates out, then dropped: a closed dialog runs no circuit.
  const [shown, setShown] = useState(incoming)
  if (incoming && incoming !== shown) setShown(incoming)

  return (
    <dialog ref={dialog} className={`sheet preview${shown?.fromGallery ? ' from-gallery' : ''}`} aria-labelledby="preview-title" onClose={onCancel}>
      {visible && shown && <PreviewContent key={shown.id} incoming={shown} mine={mine} keepCurrent={keepCurrent} cancel={cancel} onCancel={onCancel} onOpen={onOpen} />}
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
  const library = useMemo(() => toLibrary(project.chips), [project.chips])
  const parts = partCounts(project.circuit)

  const rename = (chip: ChipDef) => {
    const name = (names[chip.id] ?? '').trim()
    if (name.length === 0) return
    setProject((p) => renameChip(p, chip.id, name, have))
  }

  return (
    <>
      <h2 id="preview-title">{incoming.restore ? t('share.restoreTitle') : (incoming.title ?? t('share.linkTitle'))}</h2>
      {incoming.description && <p className="entry-description">{incoming.description}</p>}
      {incoming.author && <p className="muted entry-author">{t('share.by', { author: incoming.author })}</p>}
      <PreviewTabs
        diagram={
          <>
            <CircuitView live circuit={project.circuit} library={library} label={t('share.circuit')} />
            <p className="muted">{t('share.tryIt')}</p>
          </>
        }
        parts={
          <>
            {parts.length > 0 && (
              <ul className="preview-parts">
                {parts.map(([kind, count]) => {
                  const chip = project.chips.find((c) => c.id === kind)
                  return (
                    <li key={kind}>
                      <PieceIcon kind={kind} library={library} custom={!!chip && !levelById(kind)} />
                      <span>{chip ? chipLabel(t, chip) : kindName(t, kind, library)}</span>
                      <span className="muted">{t('share.partCount', { count })}</span>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="muted">{t('share.pieces', { count: nodeCount(project) })}</p>
          </>
        }
        table={
          <div className="truth-table-wrap">
            <TruthTable circuit={project.circuit} library={library} />
          </div>
        }
      />
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
      <div className="actions entry-actions">
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
          {incoming.fromGallery ? t('share.backToGallery') : t('app.cancel')}
        </button>
      </div>
    </>
  )
}

const TABS = ['diagram', 'parts', 'table'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL = { diagram: 'share.diagram', parts: 'share.parts', table: 'share.truthTable' } as const

/**
 * The circuit, its pieces and its truth table, one at a time. Only the open panel is mounted, so the
 * diagram's simulation stops while another one shows. Arrow keys, Home and End move between tabs.
 */
function PreviewTabs(panels: Record<Tab, ReactNode>) {
  const { t } = useTranslation()
  const id = useId()
  const [tab, setTab] = useState<Tab>('diagram')
  const buttons = useRef(new Map<Tab, HTMLButtonElement>())
  const select = (next: Tab) => {
    if (next === tab) return
    play('tick')
    setTab(next)
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const i = TABS.indexOf(tab)
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key]
    if (to === undefined) return
    e.preventDefault()
    const next = TABS[(to + TABS.length) % TABS.length]
    select(next)
    buttons.current.get(next)?.focus()
  }
  return (
    <div className="preview-tabs">
      <div role="tablist" aria-label={t('share.tabs')} onKeyDown={onKeyDown}>
        {TABS.map((name) => (
          <button
            key={name}
            ref={(el) => {
              if (el) buttons.current.set(name, el)
            }}
            type="button"
            role="tab"
            id={`${id}-${name}`}
            aria-selected={tab === name}
            aria-controls={`${id}-panel`}
            tabIndex={tab === name ? 0 : -1}
            onClick={() => select(name)}
          >
            {t(TAB_LABEL[name])}
          </button>
        ))}
      </div>
      {/* Keyed by the tab, so each panel fades in. */}
      <div key={tab} role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} className="tab-panel">
        {panels[tab]}
      </div>
    </div>
  )
}

/** How many of each piece the circuit uses at its top level, most used first; its inputs and outputs are left out. */
function partCounts(circuit: Circuit): [string, number][] {
  const counts = new Map<string, number>()
  for (const { kind } of circuit.nodes) if (kind !== 'INPUT' && kind !== 'OUTPUT') counts.set(kind, (counts.get(kind) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])
}
