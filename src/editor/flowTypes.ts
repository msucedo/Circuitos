import type { EdgeTypes, NodeTypes } from '@xyflow/react'
import { ChipNode } from './ChipNode.tsx'
import { WireEdge } from './WireEdge.tsx'

/** How React Flow draws pieces and wires, shared by the editor and the read-only previews. */
export const nodeTypes: NodeTypes = { chip: ChipNode }
export const edgeTypes: EdgeTypes = { wire: WireEdge }
