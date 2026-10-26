import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { problemText } from '../i18n.ts'
import type { ChipLibrary, Circuit } from '../sim/types.ts'
import { liveTable } from '../sim/verify.ts'
import type { Spec } from '../sim/verify.ts'

/**
 * Truth table of the circuit as it is now. With a combinational level spec,
 * shows the expected outputs next to the real ones and marks mismatches.
 */
export function TruthTable({ circuit, library, spec }: { circuit: Circuit; library: ChipLibrary; spec?: Spec }) {
  const { t } = useTranslation()
  const structure = JSON.stringify([circuit.nodes.map((n) => [n.id, n.kind, n.width]), circuit.wires])
  const table = useMemo(() => liveTable(circuit, library, spec), [structure, library, spec]) // eslint-disable-line react-hooks/exhaustive-deps

  if ('code' in table) return <p className="table-note">{problemText(t, table)}</p>
  if (table.inputs.length === 0) return <p className="table-note">{t('result.addInputs')}</p>

  const checked = spec?.combinational === true
  const group = (label: string, span: number) => span > 0 && <th colSpan={span}>{label}</th>

  return (
    <table className="truth-table">
      <thead>
        <tr className="groups">
          {group(t('result.inputs'), table.inputs.length)}
          {group(checked ? t('result.yours') : t('result.outputs'), table.outputs.length)}
          {checked && group(t('result.expected'), table.outputs.length)}
          {checked && <th />}
        </tr>
        <tr>
          {table.inputs.map((p) => (
            <th key={p.name}>{p.name}</th>
          ))}
          {table.outputs.map((p) => (
            <th key={p.name} className="out">
              {p.name}
            </th>
          ))}
          {checked &&
            table.outputs.map((p) => (
              <th key={p.name} className="want">
                {p.name}
              </th>
            ))}
          {checked && <th />}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, r) => {
          const want = row.expected
          const oscillating = row.status === 'oscillating'
          const bad = (i: number) => oscillating || (want !== undefined && want[i] !== row.outputs[i])
          const wrong = table.outputs.some((_, i) => bad(i))
          return (
            <tr key={r} className={wrong ? 'wrong' : ''}>
              {row.inputs.map((v, i) => (
                <td key={i}>{v}</td>
              ))}
              {row.outputs.map((v, i) => (
                <td key={i} className={`out${bad(i) ? ' bad' : ''}`}>
                  {oscillating ? '~' : v}
                </td>
              ))}
              {want?.map((v, i) => (
                <td key={i} className="want">
                  {v}
                </td>
              ))}
              {checked && (
                <td className="verdict" aria-label={wrong ? t('result.wrong') : t('result.right')}>
                  {wrong ? '✗' : '✓'}
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
