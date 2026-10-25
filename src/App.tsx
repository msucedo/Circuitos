import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Editor } from './editor/Editor.tsx'
import { LEVELS, firstOpenLevel, isUnlocked, levelById, levelCircuit, levelLibrary, levelPalette } from './levels/levels.ts'
import type { Level } from './levels/levels.ts'
import { chipIdFor, chipUsers, exportProject, importProject } from './project.ts'
import { flatten } from './sim/flatten.ts'
import { LIMITS } from './sim/schema.ts'
import type { SaveData } from './sim/schema.ts'
import { CircuitError, toLibrary } from './sim/types.ts'
import type { Circuit } from './sim/types.ts'
import { verify } from './sim/verify.ts'
import type { VerifyResult } from './sim/verify.ts'
import { loadSave, writeSave } from './storage.ts'
import './app.css'

const SANDBOX = 'sandbox'
const SAVE_DELAY_MS = 400
const SHOWN_FAILURES = 12

type Notice = { kind: 'info' | 'error'; text: string }

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const [loaded] = useState(loadSave)
  const [save, setSave] = useState<SaveData>(loaded.data)
  const [notice, setNotice] = useState<Notice | undefined>(loaded.warning ? { kind: 'error', text: loaded.warning } : undefined)
  const solved = useMemo(() => new Set(save.solved), [save.solved])
  const [workspace, setWorkspace] = useState(() => firstOpenLevel(new Set(loaded.data.solved)))
  const [generation, setGeneration] = useState(0)
  const [result, setResult] = useState<VerifyResult>()
  const [chipName, setChipName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string>()
  const customChips = save.chips.filter((c) => !levelById(c.id))
  const fileInput = useRef<HTMLInputElement>(null)

  const level = workspace === SANDBOX ? undefined : levelById(workspace)
  const fullLibrary = useMemo(() => toLibrary(save.chips), [save.chips])
  const library = useMemo(
    () => (level ? levelLibrary(level, solved, save.chips) : fullLibrary),
    [level, solved, save.chips, fullLibrary],
  )
  const circuit: Circuit = level ? (save.drafts.get(level.id) ?? levelCircuit(level)) : save.sandbox
  const palette = level
    ? levelPalette(level, library)
    : ['INPUT', 'OUTPUT', 'SPLIT', 'JOIN', 'CLOCK', 'NAND', 'VCC', 'RELAY', 'RELAY_NC', ...LEVELS.filter((l) => fullLibrary.has(l.id)).map((l) => l.id), ...save.chips.filter((c) => !levelById(c.id)).map((c) => c.id)]
  const locked = useMemo(() => new Set(level ? [...level.spec.inputs, ...level.spec.outputs] : []), [level])

  useEffect(() => {
    const timer = setTimeout(() => {
      const problem = writeSave(save)
      if (problem) setNotice({ kind: 'error', text: problem })
    }, SAVE_DELAY_MS)
    // Leaving or reloading before the delay runs out must not lose the last change.
    const flush = () => writeSave(save)
    window.addEventListener('pagehide', flush)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pagehide', flush)
    }
  }, [save])

  const onChange = useCallback(
    (next: Circuit) =>
      setSave((s) =>
        workspace === SANDBOX ? { ...s, sandbox: next } : { ...s, drafts: new Map(s.drafts).set(workspace, next) },
      ),
    [workspace],
  )

  const open = (id: string) => {
    setWorkspace(id)
    setResult(undefined)
    setNotice(undefined)
  }

  const test = (lvl: Level) => {
    const outcome = verify(circuit, library, lvl.spec)
    setResult(outcome)
    if (!outcome.passed) return
    setSave((s) => ({
      ...s,
      solved: s.solved.includes(lvl.id) ? s.solved : [...s.solved, lvl.id],
      chips: lvl.chip === false ? s.chips : [...s.chips.filter((c) => c.id !== lvl.id), { id: lvl.id, name: lvl.name, circuit }],
    }))
  }

  const reset = (lvl: Level) => {
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
      return setNotice({ kind: 'error', text: `El nombre debe tener de 1 a ${LIMITS.text} caracteres.` })
    }
    if (!circuit.nodes.some((n) => n.kind === 'OUTPUT')) {
      return setNotice({ kind: 'error', text: 'El chip necesita al menos una salida.' })
    }
    try {
      flatten(circuit, fullLibrary)
    } catch (error) {
      if (!(error instanceof CircuitError)) throw error
      return setNotice({ kind: 'error', text: error.message })
    }
    const id = chipIdFor(name, new Set(save.chips.map((c) => c.id)))
    setSave((s) => ({ ...s, chips: [...s.chips, { id, name, circuit }] }))
    setChipName('')
    setNotice({ kind: 'info', text: `Chip "${name}" guardado: ya está en la paleta.` })
  }

  const deleteChip = (id: string) => {
    const users = chipUsers(id, save.chips, save.sandbox)
    if (users.length > 0) {
      setConfirmDelete(undefined)
      return setNotice({ kind: 'error', text: `No se puede borrar: lo usa ${users.join(', ')}.` })
    }
    if (confirmDelete !== id) return setConfirmDelete(id)
    setSave((s) => ({ ...s, chips: s.chips.filter((c) => c.id !== id) }))
    setConfirmDelete(undefined)
    setNotice({ kind: 'info', text: 'Chip borrado.' })
  }

  const exportCurrent = () => {
    const project = exportProject(circuit, library)
    download(`${level ? level.id.toLowerCase() : 'circuito'}.json`, JSON.stringify(project, null, 2))
  }

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > LIMITS.bytes) return setNotice({ kind: 'error', text: 'El archivo pesa más de 2 MB.' })
    try {
      const { circuit: imported, added } = importProject(await file.text(), save.chips)
      setSave((s) => ({ ...s, sandbox: imported, chips: [...s.chips, ...added] }))
      setWorkspace(SANDBOX)
      setResult(undefined)
      setGeneration((g) => g + 1)
      setNotice({ kind: 'info', text: `Importado "${file.name}"${added.length ? ` con ${added.length} chip(s) nuevos` : ''}.` })
    } catch (error) {
      if (!(error instanceof CircuitError)) throw error
      setNotice({ kind: 'error', text: `No se pudo importar: ${error.message}` })
    }
  }

  const failures = result?.steps.filter((s) => !s.ok) ?? []

  return (
    <div className="app">
      <nav className="levels" aria-label="Niveles">
        <h1>Circuitos</h1>
        <p className="tagline">De NAND a computadora</p>
        <ol>
          {LEVELS.map((l) => {
            const unlocked = isUnlocked(l, solved)
            return (
              <li key={l.id}>
                <button
                  type="button"
                  className={workspace === l.id ? 'current' : ''}
                  disabled={!unlocked}
                  aria-current={workspace === l.id}
                  onClick={() => open(l.id)}
                >
                  <span>
                    {l.name}
                    {l.optional && <small className="optional"> opcional</small>}
                  </span>
                  <span className="mark" aria-label={solved.has(l.id) ? 'resuelto' : unlocked ? '' : 'bloqueado'}>
                    {solved.has(l.id) ? '✓' : unlocked ? '' : '🔒'}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        <button type="button" className={workspace === SANDBOX ? 'current' : ''} onClick={() => open(SANDBOX)}>
          Modo libre
        </button>
      </nav>

      <main>
        <section className="brief">
          {level ? (
            <>
              <div>
                <h2>{level.name}</h2>
                <p>{level.goal}</p>
                {level.hint && <p className="hint">Pista: {level.hint}</p>}
              </div>
              <div className="actions">
                <button type="button" className="primary" onClick={() => test(level)}>
                  Probar
                </button>
                <button type="button" onClick={() => reset(level)}>
                  Reiniciar
                </button>
                <button type="button" onClick={exportCurrent}>
                  Exportar
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2>Modo libre</h2>
                <p>Arma lo que quieras con las piezas que has desbloqueado y guárdalo como chip.</p>
              </div>
              <div className="actions">
                <input
                  type="text"
                  value={chipName}
                  maxLength={LIMITS.text}
                  placeholder="Nombre del chip"
                  aria-label="Nombre del chip"
                  onChange={(e) => setChipName(e.target.value)}
                />
                <button type="button" className="primary" onClick={saveChip}>
                  Guardar como chip
                </button>
                <button type="button" onClick={exportCurrent}>
                  Exportar
                </button>
                <button type="button" onClick={() => fileInput.current?.click()}>
                  Importar
                </button>
                <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importFile} />
              </div>
              {customChips.length > 0 && (
                <ul className="my-chips" aria-label="Mis chips">
                  {customChips.map((c) => (
                    <li key={c.id}>
                      <span>{c.name}</span>
                      <button
                        type="button"
                        className={confirmDelete === c.id ? 'danger' : ''}
                        aria-label={confirmDelete === c.id ? `Confirmar borrar ${c.name}` : `Borrar ${c.name}`}
                        onClick={() => deleteChip(c.id)}
                      >
                        {confirmDelete === c.id ? '¿Borrar?' : '×'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {notice && (
          <p className={`notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
            {notice.text}
            <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice(undefined)}>
              ×
            </button>
          </p>
        )}

        {result && level && (
          <section className={`result ${result.passed ? 'pass' : 'fail'}`} aria-live="polite">
            {result.passed ? (
              <p>
                ¡Funciona!{' '}
                {level.chip === false ? (
                  'Nivel resuelto.'
                ) : (
                  <>
                    <strong>{level.name}</strong> ya está en tu paleta.
                  </>
                )}
              </p>
            ) : result.error ? (
              <p>{result.error}</p>
            ) : (
              <>
                <p>
                  Pasan {result.steps.length - failures.length} de {result.steps.length} pruebas. Estas fallan:
                </p>
                <table>
                  <thead>
                    <tr className="groups">
                      <th colSpan={level.spec.inputs.length}>entradas</th>
                      <th colSpan={level.spec.outputs.length}>esperado</th>
                      <th colSpan={level.spec.outputs.length}>tu circuito</th>
                    </tr>
                    <tr>
                      {[...level.spec.inputs, ...level.spec.outputs, ...level.spec.outputs].map((id, i) => (
                        <th key={i}>{id}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {failures.slice(0, SHOWN_FAILURES).map((f, i) => (
                      <tr key={i}>
                        {level.spec.inputs.map((id) => (
                          <td key={id}>{f.step.set[id] ?? '·'}</td>
                        ))}
                        {level.spec.outputs.map((id) => (
                          <td key={id}>{f.step.expect[id] ?? '·'}</td>
                        ))}
                        {level.spec.outputs.map((id) => {
                          const want = f.step.expect[id]
                          const bad = f.status === 'oscillating' || (want !== undefined && want !== f.actual[id])
                          return (
                            <td key={id} className={bad ? 'bad' : ''}>
                              {f.status === 'oscillating' ? '~' : f.actual[id]}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {failures.some((f) => f.status === 'oscillating') && <p className="hint">~ = el circuito oscila: nunca se estabiliza.</p>}
                {failures.length > SHOWN_FAILURES && <p className="hint">…y {failures.length - SHOWN_FAILURES} más.</p>}
              </>
            )}
          </section>
        )}

        <Editor
          key={`${workspace}:${generation}`}
          initial={circuit}
          library={library}
          palette={palette}
          locked={locked}
          spec={level?.spec}
          renamePins={!level}
          onChange={onChange}
        />
      </main>
    </div>
  )
}
