import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Editor } from './editor/Editor.tsx'
import {
  LEVELS,
  MAIN_LEVELS,
  firstOpenLevel,
  isUnlocked,
  levelById,
  levelCircuit,
  levelLibrary,
  levelNumber,
  levelPalette,
  unlockedBy,
} from './levels/levels.ts'
import type { Level } from './levels/levels.ts'
import { chipIdFor, chipUsers, exportProject, importProject, readJsonFile } from './project.ts'
import { decodeShare, sharedTarget } from './share.ts'
import type { SharedTarget } from './share.ts'
import { loadGalleryEntry } from './gallery/gallery.ts'
import { flatten } from './sim/flatten.ts'
import { LIMITS, emptySave, parseProject, serializeSave } from './sim/schema.ts'
import type { Project, SaveData } from './sim/schema.ts'
import { CircuitError, problem, toLibrary } from './sim/types.ts'
import type { ChipDef, Circuit, Problem } from './sim/types.ts'
import { verify } from './sim/verify.ts'
import type { VerifyResult } from './sim/verify.ts'
import {
  backupSave,
  clearSavedSandbox,
  loadPrefs,
  loadSave,
  loadSavedSandbox,
  parseSaveFile,
  requestPersistence,
  saveFileName,
  writePrefs,
  writeSave,
  writeSavedSandbox,
} from './storage.ts'
import type { Prefs } from './storage.ts'
import { CollapseToggle } from './CollapseToggle.tsx'
import { BookIcon, CheckIcon, HelpIcon, LockIcon, Logo } from './icons.tsx'
import { GalleryDialog } from './GalleryDialog.tsx'
import { Guide } from './Guide.tsx'
import { PreviewDialog } from './PreviewDialog.tsx'
import type { Incoming } from './PreviewDialog.tsx'
import { ResultPanel } from './ResultPanel.tsx'
import { ShareDialog } from './ShareDialog.tsx'
import { play, setMuted } from './sound.ts'
import { usePresence } from './usePresence.ts'
import { Credit, Welcome } from './Welcome.tsx'
import { chipLabel, levelText, problemText } from './i18n.ts'
import { RichText } from './RichText.tsx'
import './app.css'

const SANDBOX = 'sandbox'
const SAVE_DELAY_MS = 400
/** Info notices close by themselves after this; errors stay until closed. */
const NOTICE_MS = 4000

/** Pieces or wires of the player's own; a level's pins alone are not work to lose. */
const hasWork = (c: Circuit) => c.wires.length > 0 || c.nodes.some((n) => n.kind !== 'INPUT' && n.kind !== 'OUTPUT')

/** The text is built when rendering, so a notice follows a language change. */
type Notice = { kind: 'info' | 'warn' | 'error'; text: (t: TFunction) => string }

const problemNotice = (p: Problem): Notice => ({ kind: 'error', text: (t) => problemText(t, p) })

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

let incomingId = 0

/** Reads the shared target once and removes it, so a reload does not open it again. */
function takeSharedTarget(): SharedTarget | undefined {
  const target = sharedTarget(location.hash)
  if (target) history.replaceState(null, '', `${location.pathname}${location.search}`)
  return target
}

async function loadShared(target: SharedTarget): Promise<Incoming> {
  if (target.kind === 'link') return { project: await decodeShare(target.data), id: ++incomingId }
  const { entry, project } = await loadGalleryEntry(target.slug)
  return { project, id: ++incomingId, title: entry.name, description: entry.description, author: entry.author }
}

function Pins({ label, ids, widths }: { label: string; ids: string[]; widths?: Record<string, number> }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {ids.map((id) => (
          <code key={id} className="pin-ref">
            {widths?.[id] ? `${id}[${widths[id]}]` : id}
          </code>
        ))}
      </dd>
    </div>
  )
}

export default function App() {
  const { t } = useTranslation()
  const [loaded] = useState(loadSave)
  const [save, setSave] = useState<SaveData>(loaded.data)
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [notice, setNotice] = useState<Notice | undefined>(loaded.warning && problemNotice(loaded.warning))
  const solved = useMemo(() => new Set(save.solved), [save.solved])
  const [workspace, setWorkspace] = useState(() => firstOpenLevel(new Set(loaded.data.solved)))
  const [generation, setGeneration] = useState(0)
  const [result, setResult] = useState<VerifyResult>()
  const [chipName, setChipName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string>()
  // Reiniciar asks first: the first click arms it, the second resets.
  const [confirmReset, setConfirmReset] = useState(false)
  // The chip name field only shows after pressing "Guardar como chip".
  const [naming, setNaming] = useState(false)
  const chipFormRef = useRef<HTMLFormElement>(null)
  const chipForm = usePresence(naming, chipFormRef)
  const saveChipButton = useRef<HTMLButtonElement>(null)
  // Once the name field has rolled up, the focus goes back to the button that opened it.
  const wasNaming = useRef(false)
  useEffect(() => {
    if (wasNaming.current && !chipForm.shown) saveChipButton.current?.focus()
    wasNaming.current = !!chipForm.shown
  }, [chipForm.shown])
  // A shared link opens its preview instead of the welcome.
  const [welcome, setWelcome] = useState(() => !sharedTarget(location.hash))
  const [guide, setGuide] = useState(false)
  const [gallery, setGallery] = useState(false)
  const [incoming, setIncoming] = useState<Incoming>()
  const [sharing, setSharing] = useState<Project>()
  // The sandbox kept before opening a shared circuit; "Restaurar mi Modo libre" brings it back.
  const [savedSandbox, setSavedSandbox] = useState(() => loadSavedSandbox())
  // Bumped on every Probar so the result panel animates again.
  const [attempt, setAttempt] = useState(0)
  // Bumped by every error the player causes, so the same one shown again shakes again.
  const [errorCount, setErrorCount] = useState(0)
  // Levels the last Probar unlocked, so their buttons can celebrate once.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())
  const fileInput = useRef<HTMLInputElement>(null)
  const levelName = (l: Pick<Level, 'id'>) => levelText(t, l, 'name')
  // A level chip is always shown with its level's name in the current language, never the saved one.
  const chips = useMemo(() => save.chips.map((c): ChipDef => ({ ...c, name: chipLabel(t, c) })), [save.chips, t])
  const customChipIds = useMemo(() => new Set(save.chips.filter((c) => !levelById(c.id)).map((c) => c.id)), [save.chips])

  const level = workspace === SANDBOX ? undefined : levelById(workspace)
  // The notice and the result keep showing what they said while they animate out.
  const noticeRef = useRef<HTMLParagraphElement>(null)
  const shownNotice = usePresence(notice, noticeRef)
  const resultRef = useRef<HTMLElement>(null)
  const levelResult = useMemo(() => (result && level ? { result, level } : undefined), [result, level])
  const shownResult = usePresence(levelResult, resultRef)
  const fullLibrary = useMemo(() => toLibrary(chips), [chips])
  const library = useMemo(
    () => (level ? levelLibrary(level, solved, chips) : fullLibrary),
    [level, solved, chips, fullLibrary],
  )
  const circuit: Circuit = level ? (save.drafts.get(level.id) ?? levelCircuit(level)) : save.sandbox
  const palette = level
    ? levelPalette(level, library)
    : ['INPUT', 'OUTPUT', 'SPLIT', 'JOIN', 'CLOCK', 'NAND', 'VCC', 'RELAY', 'RELAY_NC', ...LEVELS.filter((l) => fullLibrary.has(l.id)).map((l) => l.id), ...customChipIds]
  const locked = useMemo(() => new Set(level ? [...level.spec.inputs, ...level.spec.outputs] : []), [level])

  useEffect(() => {
    const timer = setTimeout(() => {
      const failed = writeSave(save)
      if (failed) setNotice(problemNotice(failed))
    }, SAVE_DELAY_MS)
    // Leaving or reloading before the delay runs out must not lose the last change.
    const flush = () => writeSave(save)
    window.addEventListener('pagehide', flush)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pagehide', flush)
    }
  }, [save])

  /** An error from something the player did: it sounds and shakes like a failed Probar. Background ones stay quiet. */
  const showError = (text: Notice['text']) => {
    play('fail')
    setNotice({ kind: 'error', text })
    setErrorCount((c) => c + 1)
  }
  const showProblem = (p: Problem) => showError((t) => problemText(t, p))

  // A link pasted while the game is open changes only the hash.
  useEffect(() => {
    const read = () => {
      const target = takeSharedTarget()
      if (!target) return
      loadShared(target).then(setIncoming, (error: unknown) => {
        if (!(error instanceof CircuitError)) throw error
        showError((t) => t('share.openFailed', { reason: problemText(t, error) }))
      })
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  useEffect(() => writePrefs(prefs), [prefs])
  useEffect(() => setMuted(prefs.muted), [prefs.muted])
  const togglePref = (key: 'levelsCollapsed' | 'piecesCollapsed' | 'muted') => setPrefs((p) => ({ ...p, [key]: !p[key] }))
  // The theory opens by itself until the user closes it on that level.
  const setTheoryOpen = (id: string, open: boolean) =>
    setPrefs((p) => ({ ...p, theoryClosed: open ? p.theoryClosed.filter((c) => c !== id) : [...new Set([...p.theoryClosed, id])] }))

  useEffect(() => {
    if (!notice || notice.kind === 'error') return
    const timer = setTimeout(() => setNotice(undefined), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  const onChange = useCallback(
    (next: Circuit) =>
      setSave((s) =>
        workspace === SANDBOX ? { ...s, sandbox: next } : { ...s, drafts: new Map(s.drafts).set(workspace, next) },
      ),
    [workspace],
  )

  /** Every level change the player makes goes through here; loading or wiping progress does not, and stays quiet. */
  const open = (id: string) => {
    if (id !== workspace) play('deal')
    setWorkspace(id)
    setConfirmReset(false)
    setConfirmDelete(undefined)
    closeNaming()
    setResult(undefined)
    setNotice(undefined)
    setFresh(new Set())
  }

  const test = (lvl: Level) => {
    setConfirmReset(false)
    const outcome = verify(circuit, library, lvl.spec)
    setResult(outcome)
    setAttempt((a) => a + 1)
    play(outcome.passed ? 'win' : 'fail')
    if (!outcome.passed) return
    const after = new Set([...solved, lvl.id])
    const unlocked = LEVELS.filter((l) => !isUnlocked(l, solved) && isUnlocked(l, after)).map((l) => l.id)
    if (unlocked.length > 0) play('unlock')
    // Asked once there is something worth keeping, not on the first visit.
    if (solved.size === 0) void requestPersistence()
    setFresh(new Set(unlocked))
    setSave((s) => ({
      ...s,
      solved: s.solved.includes(lvl.id) ? s.solved : [...s.solved, lvl.id],
      chips: lvl.chip === false ? s.chips : [...s.chips.filter((c) => c.id !== lvl.id), { id: lvl.id, name: lvl.id, circuit }],
    }))
  }

  const askReset = (lvl: Level) => {
    if (hasWork(circuit) && !confirmReset) return setConfirmReset(true)
    setConfirmReset(false)
    reset(lvl)
  }

  const reset = (lvl: Level) => {
    play('reset')
    setSave((s) => {
      const drafts = new Map(s.drafts)
      drafts.delete(lvl.id)
      return { ...s, drafts }
    })
    setResult(undefined)
    setGeneration((g) => g + 1)
  }

  const saveChip = () => {
    const name = chipName.trim()
    if (name.length === 0 || name.length > LIMITS.text) {
      return showError((t) => t('app.chipNameLength', { max: LIMITS.text }))
    }
    if (!circuit.nodes.some((n) => n.kind === 'OUTPUT')) {
      return showProblem(problem('chipNeedsOutput'))
    }
    try {
      flatten(circuit, fullLibrary)
    } catch (error) {
      if (!(error instanceof CircuitError)) throw error
      return showProblem(error)
    }
    const id = chipIdFor(name, new Set(save.chips.map((c) => c.id)))
    setSave((s) => ({ ...s, chips: [...s.chips, { id, name, circuit }] }))
    closeNaming()
    setNotice({ kind: 'info', text: (t) => t('app.chipSaved', { name }) })
  }

  const closeNaming = () => {
    setNaming(false)
    setChipName('')
  }

  const deleteChip = (id: string) => {
    const users = chipUsers(id, chips, save.sandbox)
    if (users.chips.length > 0 || users.sandbox) {
      setConfirmDelete(undefined)
      return showError((t) =>
        t('app.chipInUse', {
          users: [...users.chips.map((c) => `"${c.name}"`), ...(users.sandbox ? [t('app.sandboxCircuit')] : [])],
        }),
      )
    }
    if (confirmDelete !== id) return setConfirmDelete(id)
    play('poof')
    setSave((s) => ({ ...s, chips: s.chips.filter((c) => c.id !== id) }))
    setConfirmDelete(undefined)
    setNotice({ kind: 'info', text: (t) => t('app.chipDeleted') })
  }

  const exportCurrent = () => {
    const project = exportProject(circuit, library)
    download(`${level ? level.id.toLowerCase() : 'circuito'}.json`, JSON.stringify(project, null, 2))
  }

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setIncoming({ project: parseProject(await readJsonFile(file)), id: ++incomingId, title: file.name })
    } catch (error) {
      if (!(error instanceof CircuitError)) throw error
      showError((t) => t('app.importFailed', { reason: problemText(t, error) }))
    }
  }

  /** The only way a file, a link or the gallery replaces the sandbox: confirmed, and after a backup. */
  const openIncoming = (project: Project, keep: boolean): Problem | undefined => {
    let imported: ReturnType<typeof importProject>
    try {
      imported = importProject(project, save.chips)
    } catch (error) {
      if (!(error instanceof CircuitError)) throw error
      return error
    }
    const failed = backupSave(save)
    if (failed) return failed
    // Kept before replacing it, or used up when it is the kept one coming back; if that fails, nothing is opened.
    const restoring = !!incoming?.restore
    const kept = keep ? exportProject(save.sandbox, fullLibrary) : undefined
    const notStored = kept ? writeSavedSandbox(kept) : restoring ? clearSavedSandbox() : undefined
    if (notStored) return notStored
    if (kept || restoring) setSavedSandbox(kept)
    const name = incoming?.title
    const added = imported.added.length
    setIncoming(undefined)
    open(SANDBOX)
    setSave((s) => ({ ...s, sandbox: imported.circuit, chips: [...s.chips, ...imported.added] }))
    setGeneration((g) => g + 1)
    setNotice({
      kind: 'info',
      text: (t) => {
        if (restoring) return t('app.sandboxRestored')
        const shown = name ?? t('share.linkTitle')
        const opened = added ? t('app.imported', { name: shown, count: added }) : t('app.importedNoChips', { name: shown })
        return kept ? `${opened} ${t('app.sandboxKept')}` : opened
      },
    })
  }

  const openGalleryEntry = (slug: string) => {
    setGallery(false)
    void loadShared({ kind: 'gallery', slug }).then(
      (next) => setIncoming({ ...next, fromGallery: true }),
      (error: unknown) => {
        if (!(error instanceof CircuitError)) throw error
        showError((t) => t('share.openFailed', { reason: problemText(t, error) }))
      },
    )
  }

  const closeWelcome = () => setWelcome(false)

  const exportSave = () => download(saveFileName(new Date()), serializeSave(save))

  /** Replaces the progress with a downloaded one, after keeping a copy of the current one. */
  const importSave = async (file: File) => {
    closeWelcome()
    let loadedSave: SaveData
    try {
      loadedSave = parseSaveFile(await readJsonFile(file))
    } catch (error) {
      if (!(error instanceof CircuitError)) throw error
      return showError((t) => t('app.importFailed', { reason: problemText(t, error) }))
    }
    const failed = backupSave(save)
    if (failed) return showProblem(failed)
    setSave(loadedSave)
    setWorkspace(firstOpenLevel(new Set(loadedSave.solved)))
    setResult(undefined)
    setGeneration((g) => g + 1)
    setNotice({ kind: 'info', text: (t) => t('app.saveImported') })
  }

  const resetAll = () => {
    // Starting over also drops the kept sandbox; both keep a copy first.
    const failed = backupSave(save) ?? clearSavedSandbox()
    if (failed) return showProblem(failed)
    setSavedSandbox(undefined)
    setSave(emptySave())
    setWorkspace(firstOpenLevel(new Set()))
    setResult(undefined)
    setGeneration((g) => g + 1)
    closeWelcome()
    setNotice({ kind: 'info', text: (t) => t('app.progressWiped') })
  }

  // Opening a level stores its pins as a draft, so only drafts with pieces or wires count.
  const hasProgress =
    save.solved.length > 0 || save.chips.length > 0 || save.sandbox.nodes.length > 0 || [...save.drafts.values()].some(hasWork)
  const solvedCount = MAIN_LEVELS.filter((l) => solved.has(l.id)).length
  const hint = level && levelText(t, level, 'hint')
  const story = level && levelText(t, level, 'story')
  const noticeText = shownNotice.shown?.text(t)

  return (
    <div className="app">
      <nav className={`levels${prefs.levelsCollapsed ? ' collapsed' : ''}`} aria-label={t('app.levels')}>
        <div className="title">
          <Logo />
          <h1>{t('app.name')}</h1>
          <div className="title-actions">
            <button type="button" className="icon-button" aria-label={t('app.about')} title={t('app.about')} onClick={() => setWelcome(true)}>
              <HelpIcon />
            </button>
            <CollapseToggle
              collapsed={prefs.levelsCollapsed}
              controls="levels-body"
              showLabel={t('app.showLevels')}
              hideLabel={t('app.hideLevels')}
              onToggle={() => togglePref('levelsCollapsed')}
            />
          </div>
        </div>
        <div id="levels-body" className="levels-body">
          <p className="tagline">{t('app.tagline')}</p>
          <div className="progress">
            <span>{t('app.solvedCount', { count: solvedCount, total: MAIN_LEVELS.length })}</span>
            <div
              className="bar"
              role="progressbar"
              aria-label={t('app.solvedLabel')}
              aria-valuemin={0}
              aria-valuemax={MAIN_LEVELS.length}
              aria-valuenow={solvedCount}
            >
              <span style={{ width: `${(solvedCount / MAIN_LEVELS.length) * 100}%` }} />
            </div>
          </div>
          <button type="button" className="guide-button with-icon" onClick={() => setGuide(true)}>
            <BookIcon />
            {t('guide.open')}
          </button>
          <button type="button" className={`sandbox${workspace === SANDBOX ? ' current' : ''}`} onClick={() => open(SANDBOX)}>
            {t('app.sandbox')}
          </button>
          <button
            type="button"
            className="gallery-button"
            onClick={() => {
              play('deal')
              setGallery(true)
            }}
          >
            {t('gallery.title')}
          </button>
          {/* Shown instead of the list on a phone. */}
          <div className="level-picker">
            <label htmlFor="level-picker">{t('app.levelPicker')}</label>
            <select id="level-picker" value={workspace} onChange={(e) => open(e.target.value)}>
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id} disabled={!isUnlocked(l, solved)}>
                  {[
                    levelName(l),
                    l.optional && t('app.tag.optional'),
                    solved.has(l.id) ? t('app.tag.solved') : !isUnlocked(l, solved) && t('app.tag.locked'),
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </option>
              ))}
              <option value={SANDBOX}>{t('app.sandbox')}</option>
            </select>
          </div>
          <ol>
            {LEVELS.map((l) => {
              const unlocked = isUnlocked(l, solved)
              const needs = unlockedBy(l)
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    className={`${workspace === l.id ? 'current' : ''}${fresh.has(l.id) ? ' fresh' : ''}`}
                    aria-disabled={!unlocked}
                    aria-current={workspace === l.id}
                    title={unlocked || !needs ? undefined : t('app.lockedTitle', { needs: levelName(needs) })}
                    onClick={() => {
                      if (unlocked) return open(l.id)
                      play('warn')
                      setNotice({
                        kind: 'warn',
                        text: (t) => t('app.lockedNotice', { name: levelText(t, l, 'name'), needs: needs && levelText(t, needs, 'name') }),
                      })
                    }}
                  >
                    <span>
                      {levelName(l)}
                      {l.optional && <small className="optional"> {t('app.optional')}</small>}
                    </span>
                    <span className="mark" aria-label={solved.has(l.id) ? t('app.solved') : unlocked ? '' : t('app.locked')}>
                      {solved.has(l.id) ? (
                        <CheckIcon />
                      ) : !unlocked ? (
                        <LockIcon />
                      ) : fresh.has(l.id) ? (
                        <span className="unlocking">
                          <LockIcon />
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          <Credit className="credit" />
        </div>
      </nav>

      <Welcome
        open={welcome}
        hasProgress={hasProgress}
        muted={prefs.muted}
        onToggleMuted={() => {
          // The effect that unmutes runs after this render; unmute now so the confirmation plays.
          if (prefs.muted) {
            setMuted(false)
            play('toggleOn')
          }
          togglePref('muted')
        }}
        onClose={closeWelcome}
        onResetAll={resetAll}
        onExportSave={exportSave}
        onImportSave={importSave}
        onOpenGuide={() => {
          closeWelcome()
          setGuide(true)
        }}
      />
      <Guide open={guide} onClose={() => setGuide(false)} />
      <GalleryDialog open={gallery} onClose={() => setGallery(false)} onOpenEntry={openGalleryEntry} />
      <PreviewDialog
        incoming={incoming}
        mine={chips}
        keepCurrent={hasWork(save.sandbox) ? { replaces: !!savedSandbox } : undefined}
        onCancel={() => {
          // Back where it was opened from.
          if (incoming?.fromGallery) setGallery(true)
          setIncoming(undefined)
        }}
        onOpen={openIncoming}
      />
      <ShareDialog project={sharing} onClose={() => setSharing(undefined)} />

      <main>
        <section className="brief">
          {level ? (
            <>
              <div className="brief-text" key={workspace}>
                <p className="eyebrow">
                  {levelNumber(level)
                    ? t('app.levelOf', { number: levelNumber(level), total: MAIN_LEVELS.length })
                    : t('app.optionalLevel')}
                </p>
                <h2>{levelName(level)}</h2>
                <div className="goal">
                  <RichText text={levelText(t, level, 'goal')} />
                </div>
                <dl className="pins">
                  <Pins label={t('app.inputs')} ids={level.spec.inputs} widths={level.spec.widths} />
                  <Pins label={t('app.outputs')} ids={level.spec.outputs} widths={level.spec.widths} />
                </dl>
                {hint && (
                  // Folded so the player tries first; the key folds it again on another level.
                  <details className="hint" key={level.id}>
                    <summary>{t('app.showHint')}</summary>
                    <RichText text={hint} />
                  </details>
                )}
              </div>
              <div className="actions">
                <button
                  type="button"
                  className={confirmReset ? 'danger' : ''}
                  onClick={() => askReset(level)}
                  onBlur={() => setConfirmReset(false)}
                >
                  {confirmReset ? t('app.confirmReset') : t('app.reset')}
                </button>
                <button type="button" onClick={exportCurrent}>
                  {t('app.export')}
                </button>
                <button type="button" className="primary big" onClick={() => test(level)}>
                  {t('app.test')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="brief-text" key={workspace}>
                <p className="eyebrow">{t('app.sandboxEyebrow')}</p>
                <h2>{t('app.sandbox')}</h2>
                <p>{t('app.sandboxGoal')}</p>
              </div>
              <div className="actions">
                {chipForm.shown ? (
                  // A form, so Enter saves; Esc gives up.
                  <form
                    ref={chipFormRef}
                    className={`chip-form${chipForm.closing ? ' closing' : ''}`}
                    inert={chipForm.closing}
                    onSubmit={(e) => {
                      e.preventDefault()
                      saveChip()
                    }}
                    onKeyDown={(e) => e.key === 'Escape' && closeNaming()}
                  >
                    <input
                      ref={(el) => el?.focus()}
                      type="text"
                      value={chipName}
                      maxLength={LIMITS.text}
                      placeholder={t('app.chipName')}
                      aria-label={t('app.chipName')}
                      onChange={(e) => setChipName(e.target.value)}
                    />
                    <button type="submit" className="primary">
                      {t('app.save')}
                    </button>
                    <button type="button" onClick={closeNaming}>
                      {t('app.cancel')}
                    </button>
                  </form>
                ) : (
                  <button ref={saveChipButton} type="button" className="primary save-chip" onClick={() => setNaming(true)}>
                    {t('app.saveChip')}
                  </button>
                )}
                {savedSandbox && (
                  <button type="button" onClick={() => setIncoming({ project: savedSandbox, id: ++incomingId, restore: true })}>
                    {t('app.restoreSandbox')}
                  </button>
                )}
                <button type="button" disabled={circuit.nodes.length === 0} onClick={() => setSharing(exportProject(circuit, library))}>
                  {t('share.open')}
                </button>
                <button type="button" onClick={exportCurrent}>
                  {t('app.export')}
                </button>
                <button type="button" onClick={() => fileInput.current?.click()}>
                  {t('app.import')}
                </button>
                <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importFile} />
              </div>
            </>
          )}
        </section>

        {shownNotice.shown && (
          <p
            key={`${noticeText}:${errorCount}`}
            ref={noticeRef}
            className={`notice ${shownNotice.shown.kind}${shownNotice.closing ? ' closing' : ''}`}
            inert={shownNotice.closing}
            role={shownNotice.shown.kind === 'error' ? 'alert' : 'status'}
          >
            {noticeText}
            <button type="button" aria-label={t('app.closeNotice')} onClick={() => setNotice(undefined)}>
              ×
            </button>
          </p>
        )}

        {shownResult.shown && (
          <ResultPanel
            key={attempt}
            ref={resultRef}
            result={shownResult.shown.result}
            level={shownResult.shown.level}
            closing={shownResult.closing}
            onClose={() => setResult(undefined)}
            onOpen={open}
            onToSandbox={() => open(SANDBOX)}
          />
        )}

        <Editor
          key={`${workspace}:${generation}`}
          initial={circuit}
          library={library}
          palette={palette}
          locked={locked}
          spec={level?.spec}
          renamePins={!level}
          theory={story ? <RichText text={story} /> : undefined}
          theoryOpen={!!level && !prefs.theoryClosed.includes(level.id)}
          onTheoryOpenChange={(open) => {
            if (!level) return
            play(open ? 'unfold' : 'fold')
            setTheoryOpen(level.id, open)
          }}
          refitKey={`${prefs.levelsCollapsed}-${prefs.piecesCollapsed}`}
          paletteCollapsed={prefs.piecesCollapsed}
          onTogglePalette={() => togglePref('piecesCollapsed')}
          clearable={!level}
          customChips={customChipIds}
          confirmingChip={confirmDelete}
          onRemoveChip={level ? undefined : deleteChip}
          onCancelRemove={() => setConfirmDelete(undefined)}
          onChange={onChange}
        />
      </main>
    </div>
  )
}
