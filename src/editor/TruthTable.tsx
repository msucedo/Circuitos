import { useMemo } from 'react'
import type { ChipLibrary, Circuit } from '../sim/types.ts'
import { liveTable } from '../sim/verify.ts'
import type { Spec } from '../sim/verify.ts'

/**
 * Truth table of the circuit as it is now. With a combinational level spec,
 * shows the expected outputs next to the real ones and marks mismatches.
 */
export function TruthTable({ circuit, library, spec }: { circuit: Circuit; library: ChipLibrary; spec?: Spec }) {
  const structure = JSON.stringify([circuit.nodes.map((n) => [n.id, n.kind, n.width]), circuit.wires])
  const table = useMemo(() => liveTable(circuit, library), [structure, library]) // eslint-disable-line react-hooks/exhaustive-deps

  if (typeof table === 'string') return <p className="table-note">{table}</p>
  if (table.inputs.length === 0) return <p className="table-note">Agrega entradas para ver la tabla.</p>

  const expected = (inputs: number[]) => {
    if (!spec?.combinational) return undefined
    const step = spec.steps.find((s) => table.inputs.every((p, i) => s.set[p.name] === inputs[i]))
    return step && table.outputs.map((p) => step.expect[p.name])
  }

  const checked = spec?.combinational === true
  const group = (label: string, span: number) => span > 0 && <th colSpan={span}>{label}</th>

  return (
    <table className="truth-table">
      <thead>
        <tr className="groups">
          {group('entradas', table.inputs.length)}
          {group(checked ? 'tu circuito' : 'salidas', table.outputs.length)}
          {checked && group('esperado', table.outputs.length)}
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
          const want = expected(row.inputs)
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
                <td className="verdict" aria-label={wrong ? 'mal' : 'bien'}>
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
