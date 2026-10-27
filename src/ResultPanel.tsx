import type { Ref } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Confetti } from './Confetti.tsx'
import { levelText, problemText } from './i18n.ts'
import { CheckIcon } from './icons.tsx'
import { nextLevel } from './levels/levels.ts'
import type { Level } from './levels/levels.ts'
import type { VerifyResult } from './sim/verify.ts'

/** Most steps a failed result lists; the rest are only counted. */
const SHOWN_STEPS = 64

interface Props {
  result: VerifyResult
  level: Level
  ref?: Ref<HTMLElement>
  /** Playing its exit animation: it stays as it was, out of reach. */
  closing?: boolean
  onClose: () => void
  onOpen: (levelId: string) => void
  onToSandbox: () => void
}

/** What the last Probar found: a celebration, or the cases that failed. */
export function ResultPanel({ result, level, ref, closing = false, onClose, onOpen, onToSandbox }: Props) {
  const { t } = useTranslation()
  const levelName = (l: Pick<Level, 'id'>) => levelText(t, l, 'name')
  const next = nextLevel(level)
  const failures = result.steps.filter((s) => !s.ok)
  // Long test lists put every failure first so none is cut off.
  const shownSteps =
    result.steps.length <= SHOWN_STEPS ? result.steps : [...failures, ...result.steps.filter((s) => s.ok)].slice(0, SHOWN_STEPS)

  return (
    <section ref={ref} className={`result ${result.passed ? 'pass' : 'fail'}${closing ? ' closing' : ''}`} inert={closing} aria-live="polite">
      <button type="button" className="close" aria-label={t('app.closeResult')} onClick={onClose}>
        ×
      </button>
      {result.passed ? (
        <p>
          <span className="pass-check">
            <CheckIcon />
          </span>
          {t('result.works')}{' '}
          {level.chip === false ? (
            t('result.levelSolved')
          ) : (
            <Trans t={t} i18nKey="result.inPalette" values={{ name: levelName(level) }} components={{ b: <strong /> }} />
          )}
          {next ? (
            <>
              <Confetti />
              <button type="button" className="primary" onClick={() => onOpen(next.id)}>
                {t('result.next', { name: levelName(next) })}
              </button>
            </>
          ) : (
            <>
              {' '}
              {t('result.allDone')}
              <Confetti />{' '}
              <button type="button" className="primary" onClick={onToSandbox}>
                {t('result.toSandbox')}
              </button>
            </>
          )}
        </p>
      ) : result.error ? (
        <p>{problemText(t, result.error)}</p>
      ) : (
        <>
          <p>{t('result.passing', { passed: result.steps.length - failures.length, count: result.steps.length })}</p>
          <table>
            <thead>
              <tr className="groups">
                <th colSpan={level.spec.inputs.length}>{t('result.inputs')}</th>
                <th colSpan={level.spec.outputs.length}>{t('result.expected')}</th>
                <th colSpan={level.spec.outputs.length}>{t('result.yours')}</th>
                <th />
              </tr>
              <tr>
                {[...level.spec.inputs, ...level.spec.outputs, ...level.spec.outputs].map((id, i) => (
                  <th key={i}>{id}</th>
                ))}
                <th>
                  <span className="sr-only">{t('result.verdict')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shownSteps.map((f, i) => (
                <tr key={i} className={f.ok ? 'ok' : 'wrong'}>
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
                      <td key={id} className={bad ? 'bad' : 'got'}>
                        {f.status === 'oscillating' ? '~' : f.actual[id]}
                      </td>
                    )
                  })}
                  <td className="verdict">{f.ok ? '✓' : '✗'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {failures.some((f) => f.status === 'oscillating') && <p className="hint">{t('result.oscillates')}</p>}
          {result.steps.length > shownSteps.length && (
            <p className="hint">{t('result.morePassing', { count: result.steps.length - shownSteps.length })}</p>
          )}
        </>
      )}
    </section>
  )
}
