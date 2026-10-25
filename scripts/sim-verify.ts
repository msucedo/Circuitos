// Checks a saved project against a level: `npm run sim:verify -- file.json XOR`.
import { readFileSync, statSync } from 'node:fs'
import { SPECS } from '../src/levels/specs.ts'
import { LIMITS, parseProject } from '../src/sim/schema.ts'
import { CircuitError, toLibrary } from '../src/sim/types.ts'
import { verify } from '../src/sim/verify.ts'

const [file, level] = process.argv.slice(2)
const spec = level === undefined ? undefined : SPECS.get(level)
if (file === undefined || spec === undefined) {
  console.error(`Uso: npm run sim:verify -- archivo.json NIVEL\nNiveles: ${[...SPECS.keys()].join(', ')}`)
  process.exit(2)
}

try {
  if (statSync(file).size > LIMITS.bytes) throw new CircuitError('El archivo pesa más de 2 MB')
  const project = parseProject(readFileSync(file, 'utf8'))
  const result = verify(project.circuit, toLibrary(project.chips), spec)
  if (result.error) throw new CircuitError(result.error)

  const bits = (values: Record<string, number>, names: string[]) => names.map((n) => values[n] ?? '-').join(' ')
  console.log(`${spec.inputs.join(' ')} | esperado | obtenido`)
  for (const { step, actual, status, ok } of result.steps) {
    const expected = spec.outputs.map((n) => step.expect[n] ?? '-').join(' ')
    const note = status === 'oscillating' ? '  (oscila)' : ''
    console.log(`${bits(step.set, spec.inputs)} | ${expected} | ${bits(actual, spec.outputs)}  ${ok ? '✓' : '✗'}${note}`)
  }
  const failed = result.steps.filter((s) => !s.ok).length
  console.log(failed === 0 ? `\n✓ ${level}: pasa` : `\n✗ ${level}: ${failed} fila(s) fallan`)
  process.exit(failed === 0 ? 0 : 1)
} catch (error) {
  const unreadable = error instanceof Error && 'code' in error
  if (!(error instanceof CircuitError) && !unreadable) throw error
  console.error(`✗ ${unreadable ? `No se pudo leer "${file}"` : error.message}`)
  process.exit(1)
}
