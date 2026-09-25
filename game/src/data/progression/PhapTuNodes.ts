import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import { buildElementBranch } from './PhapTuNodes.builders'
import { buildBasicBranch } from './PhapTuBasicNodes'
import { buildRealmRewardNodes } from './PhapTuRealmRewardNodes'

// Phap Tu Reimagined (2026-09-15 plan, Task 6) -- new tree shape:
// 5 mutex element roots (committed atomically by selectSpellPathElement,
// no auto-Fire, no unlocksElement), per-element growth + special/god-ult
// unlock + The lanes + route-tagged specialization (3 'dot' + 3 'no' +
// truong_the). The old keystoneReaction/keystonePure XOR, lap_dao_thuan,
// reaction_path_unlock, B/D-position chains and The Man nodes are gone.
//
// Cultivation Path Framework (M4) -- every node in this tree is stamped
// requiredCultivationPath 'spell' + requiredWay 'spell_pathway': the whole
// element/root/route/The machinery belongs to the spell_pathway way only.
// hidden_spell_pathway owns NO tree of its own (PhapTuAnNodes.ts stays
// an empty stub), and a Ngo Dao player can never purchase or aggregate
// these requiredWay-stamped nodes even if a dirty spellPath slice
// leaks into their state. Way-LESS rewardOnly grant nodes (appended
// below) are the deliberate exception: they aggregate on either spell
// way once granted.
export const PHAP_TU_NODES: ProgressionNode[] = [
  ...[
    ...buildElementBranch('fire'),
    ...buildElementBranch('water'),
    ...buildElementBranch('wood'),
    ...buildElementBranch('metal'),
    ...buildElementBranch('earth'),
    // Three-path design (2026-09-25, ruling #1-#8) -- the basic-skill lane
    // beside the existing special/ult/route lanes.
    ...buildBasicBranch('fire'),
    ...buildBasicBranch('water'),
    ...buildBasicBranch('wood'),
    ...buildBasicBranch('metal'),
    ...buildBasicBranch('earth'),
  ].map((node) => ({
    ...node,
    requiredCultivationPath: 'spell' as const,
    requiredWay: 'spell_pathway' as const,
  })),
  // Three-path design (2026-09-25, sec.4-b) -- realm-reward grant nodes sit
  // OUTSIDE the stamping map: buildRealmRewardNodes already stamps
  // requiredCultivationPath 'spell' but no requiredWay, so both spell ways
  // aggregate them once granted (hidden_spell_pathway still cannot buy a
  // single tree node).
  ...buildRealmRewardNodes(),
]
