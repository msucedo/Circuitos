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
import { chipIdFor, chipUsers, exportProject, importProject } from './project.ts'
import { flatten } from './sim/flatten.ts'
import { LIMITS, emptySave } from './sim/schema.ts'
import type { SaveData } from './sim/schema.ts'
import { CircuitError, problem, toLibrary } from './sim/types.ts'
import type { ChipDef, Circuit, Problem } from './sim/types.ts'
import { verify } from './sim/verify.ts'
import type { VerifyResult } from './sim/verify.ts'
import { backupSave, loadPrefs, loadSave, writePrefs, writeSave } from './storage.ts'
import type { Prefs } from './storage.ts'
import { CollapseToggle } from './CollapseToggle.tsx'
import { BookIcon, CheckIcon, HelpIcon, LockIcon, Logo } from './icons.tsx'
import { Guide } from './Guide.tsx'
import { ResultPanel } from './ResultPanel.tsx'
import { play, setMuted } from './sound.ts'
import { usePresence } from './usePresence.ts'
import { Credit, Welcome } from './Welcome.tsx'
import { levelText, problemText } from './i18n.ts'
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
  const [welcome, setWelcome] = useState(true)
  const [guide, setGuide] = useState(false)
  // Bumped on every Probar so the result panel animates again.
  const [attempt, setAttempt] = useState(0)
  // Levels the last Probar unlocked, so their buttons can celebrate once.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())
  const fileInput = useRef<HTMLInputElement>(null)
  const levelName = (l: Pick<Level, 'id'>) => levelText(t, l, 'name')
  // A level chip is always shown with its level's name in the current language, never the saved one.
  const chips = useMemo(
    () => save.chips.map((c): ChipDef => (levelById(c.id) ? { ...c, name: levelText(t, c, 'name') } : c)),
    [save.chips, t],
  )
  const customChips = chips.filter((c) => !levelById(c.id))

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
    : ['INPUT', 'OUTPUT', 'SPLIT', 'JOIN', 'CLOCK', 'NAND', 'VCC', 'RELAY', 'RELAY_NC', ...LEVELS.filter((l) => fullLibrary.has(l.id)).map((l) => l.id), ...save.chips.filter((c) => !levelById(c.id)).map((c) => c.id)]
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

  const open = (id: string) => {
    setWorkspace(id)
    setConfirmReset(false)
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
      return setNotice({ kind: 'error', text: (t) => t('app.chipNameLength', { max: LIMITS.text }) })
    }
    if (!circuit.nodes.some((n) => n.kind === 'OUTPUT')) {
      return setNotice(problemNotice(problem('chipNeedsOutput')))
    }
    try {
      flatten(circuit, fullLibrary)
    } catch (error) {
      if (!(error instanceof CircuitError)) throw error
      return setNotice(problemNotice(error))
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
      return setNotice({
        kind: 'error',
        text: (t) =>
          t('app.chipInUse', {
            users: [...users.chips.map((c) => `"${c.name}"`), ...(users.sandbox ? [t('app.sandboxCircuit')] : [])],
          }),
      })
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
    if (file.size > LIMITS.bytes) return setNotice(problemNotice(problem('fileTooBig', { mb: LIMITS.bytes / 1024 / 1024 })))
    try {
      const { circuit: imported, added } = importProject(await file.text(), save.chips)
      setSave((s) => ({ ...s, sandbox: imported, chips: [...s.chips, ...added] }))
      setWorkspace(SANDBOX)
      setResult(undefined)
      setGeneration((g) => g + 1)
      setNotice({
        kind: 'info',
        text: (t) =>
          added.length ? t('app.imported', { file: file.name, count: added.length }) : t('app.importedNoChips', { file: file.name }),
      })
    } catch (error) {
      if (!(error instanceof CircuitError)) throw error
      setNotice({ kind: 'error', text: (t) => t('app.importFailed', { reason: problemText(t, error) }) })
    }
  }

  const closeWelcome = () => setWelcome(false)

  const resetAll = () => {
    const failed = backupSave(save)
    if (failed) return setNotice(problemNotice(failed))
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
        onOpenGuide={() => {
          closeWelcome()
          setGuide(true)
        }}
      />
      <Guide open={guide} onClose={() => setGuide(false)} />

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
                <button type="button" onClick={exportCurrent}>
                  {t('app.export')}
                </button>
                <button type="button" onClick={() => fileInput.current?.click()}>
                  {t('app.import')}
                </button>
                <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importFile} />
              </div>
              {customChips.length > 0 && (
                <ul className="my-chips" aria-label={t('app.myChips')}>
                  {customChips.map((c) => (
                    <li key={c.id}>
                      <span>{c.name}</span>
                      <button
                        type="button"
                        className={confirmDelete === c.id ? 'danger' : ''}
                        aria-label={
                          confirmDelete === c.id ? t('app.confirmDeleteChip', { name: c.name }) : t('app.deleteChip', { name: c.name })
                        }
                        onClick={() => deleteChip(c.id)}
                      >
                        {confirmDelete === c.id ? t('app.confirmDeleteShort') : '×'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {shownNotice.shown && (
          <p
            key={noticeText}
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
          onChange={onChange}
        />
      </main>
    </div>
  )
}
