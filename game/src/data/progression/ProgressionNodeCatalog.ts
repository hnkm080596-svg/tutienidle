import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import { PHAP_TU_NODES } from './PhapTuNodes'
import { PHAP_TU_AN_NODES } from './PhapTuAnNodes'
import { KIEM_TU_NODES } from './KiemTuNodes'
import { THE_TU_NODES } from './TheTuNodes'
import { THE_TU_AN_NODES } from './TheTuAnNodes'
import { SKILL_CORE_NODES } from './SkillCoreNodes'

// Single catalog of every registered progression node - saveShapeValidation
// and any ownership-checking consumer share this map instead of rebuilding
// the union locally.
export const ALL_PROGRESSION_NODES: readonly ProgressionNode[] = [
  ...PHAP_TU_NODES,
  ...PHAP_TU_AN_NODES,
  ...KIEM_TU_NODES,
  ...THE_TU_NODES,
  ...THE_TU_AN_NODES,
  ...SKILL_CORE_NODES,
]

export const PROGRESSION_NODE_BY_ID: ReadonlyMap<string, ProgressionNode> = new Map(
  ALL_PROGRESSION_NODES.map((node) => [node.id, node]),
)
