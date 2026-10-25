// Prints the truth table of the combinational examples: `npm run sim:demo`.
import { ADDER4, AND, FULL_ADDER, HALF_ADDER, LIBRARY, NOT, OR, XOR } from '../src/sim/examples.ts'
import { flatten } from '../src/sim/flatten.ts'
import { truthTable } from '../src/sim/simulate.ts'

for (const [name, circuit] of Object.entries({ NOT, AND, OR, XOR, HALF_ADDER, FULL_ADDER })) {
  const flat = flatten(circuit, LIBRARY)
  const ids = (kind: string) => circuit.nodes.filter((n) => n.kind === kind).map((n) => n.id).join(' ')
  console.log(`\n${name}  (${flat.nodes.filter((n) => n.kind === 'NAND').length} NAND)`)
  console.log(`${ids('INPUT')} | ${ids('OUTPUT')}`)
  for (const row of truthTable(flat)) console.log(`${row.inputs.join(' ')} | ${row.outputs.join(' ')}`)
}

const adder = flatten(ADDER4, LIBRARY)
const rows = truthTable(adder)
const sample = rows[0b0111_0101_1]
console.log(`\nADDER4  (${adder.nodes.filter((n) => n.kind === 'NAND').length} NAND, ${rows.length} filas)`)
console.log(`0111 + 0101 + 1 = ${sample.outputs.slice(0, 4).join('')} acarreo ${sample.outputs[4]}  (7 + 5 + 1 = 13)`)
