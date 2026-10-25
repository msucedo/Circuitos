import { build, nand } from './build.ts'
import type { BuiltinKind, ChipDef } from './types.ts'

/**
 * Pieces for the level below NAND. They behave like chips whose insides the
 * player never sees, so the simulator still only runs NAND gates.
 */
export const BUILTINS = new Map<string, ChipDef>(
  (
    [
      // A NAND with nothing connected reads 0 and 0, so it always gives 1.
      ['VCC', build({ inputs: [], parts: { n: { kind: 'NAND', in: {} } }, outputs: { out: 'n' } })],
      // Normally open: `in` passes through only while the coil `c` is on.
      ['RELAY', build({ inputs: ['c', 'in'], parts: { n: nand('c', 'in'), y: nand('n', 'n') }, outputs: { out: 'y' } })],
      // Normally closed: `in` passes through only while the coil `c` is off.
      [
        'RELAY_NC',
        build({
          inputs: ['c', 'in'],
          parts: { nc: nand('c', 'c'), n: nand('nc', 'in'), y: nand('n', 'n') },
          outputs: { out: 'y' },
        }),
      ],
    ] satisfies [BuiltinKind, ChipDef['circuit']][]
  ).map(([id, circuit]) => [id, { id, name: id, circuit }]),
)
