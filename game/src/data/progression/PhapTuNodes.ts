import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import { buildElementBranch } from './PhapTuNodes.builders'

// Phap Tu Reimagined (2026-09-15 plan, Task 6) — new tree shape:
// 5 mutex element roots (committed atomically by selectSpellPathElement,
// no auto-Fire, no unlocksElement), per-element growth + special/god-ult
// unlock + The lanes + route-tagged specialization (3 'dot' + 3 'no' +
// truong_the). The old keystoneReaction/keystonePure XOR, lap_dao_thuan,
// reaction_path_unlock, B/D-position chains and The Man nodes are gone.
//
// Cultivation Path Framework (M4) — every node in this tree is stamped
// requiredCultivationPath 'spell' + requiredWay 'spell_pathway': the whole
// element/root/route/The machinery belongs to the spell_pathway way only.
// hidden_spell_pathway owns NO tree at all — its way
// has no progression nodes (PhapTuAnNodes.ts stays an empty stub), so a
// Ngo Dao player can never purchase or aggregate these nodes even if a
// dirty spellPath slice leaks into their state.
export const PHAP_TU_NODES: ProgressionNode[] = [
  ...buildElementBranch('fire'),
  ...buildElementBranch('water'),
  ...buildElementBranch('wood'),
  ...buildElementBranch('metal'),
  ...buildElementBranch('earth'),
].map((node) => ({
  ...node,
  requiredCultivationPath: 'spell',
  requiredWay: 'spell_pathway',
}))
