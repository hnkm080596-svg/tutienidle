import type { ProgressionNode } from '../../core/progression/ProgressionNode'
import { buildElementBranch } from './PhapTuNodes.builders'
import { buildBasicBranch } from './PhapTuBasicNodes'
import { buildRealmRewardNodes } from './PhapTuRealmRewardNodes'

// Phap Tu Reimagine (2026-09-26 spec sec.1.4) -- new tree shape:
// 5 mutex element roots (committed atomically by selectSpellPathElement,
// no auto-Fire, no unlocksElement), per-element ailment mastery +
// linh_ngo_<special> unlock (foundation_establishment; grants the Phap
// Trang special + linhLucHoTheCap), plus the basic lane kept to
// ailment-family nodes + capstone mutex pairs. Gone: route lanes,
// tu_the/truong_the, god-ult unlock, generic-stat growths.
//
// Cultivation Path Framework (M4) -- every node in this tree is stamped
// requiredCultivationPath 'spell' + requiredWay 'spell_pathway': the whole
// element/root/trang machinery belongs to the spell_pathway way only.
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
    // Basic-skill lane (reimagined 2026-09-26) -- ailment nodes +
    // capstones only; the The lanes and route lanes are retired.
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
  // OUTSIDE the stamping map: buildRealmRewardNodes stamps
  // requiredCultivationPath 'spell' but adds no requiredWay of its own, so
  // a hidden-way player aggregates every granted mastery (hidden_spell_-
  // pathway still cannot buy a single tree node).
  ...buildRealmRewardNodes(),
]
