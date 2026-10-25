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

  return (
    <table className="truth-table">
      <thead>
        <tr>
          {table.inputs.map((p) => (
            <th key={p.name}>{p.name}</th>
          ))}
          {table.outputs.map((p) => (
            <th key={p.name} className="out">
              {p.name}
            </th>
          ))}
          {spec?.combinational && <th>esperado</th>}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, r) => {
          const want = expected(row.inputs)
          const wrong = want !== undefined && want.some((v, i) => v !== row.outputs[i])
          return (
            <tr key={r} className={wrong || row.status === 'oscillating' ? 'wrong' : ''}>
              {row.inputs.map((v, i) => (
                <td key={i}>{v}</td>
              ))}
              {row.outputs.map((v, i) => (
                <td key={i} className="out">
                  {row.status === 'oscillating' ? '~' : v}
                </td>
              ))}
              {want && <td>{want.join(' ')}</td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
