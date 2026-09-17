// [M13 STATUS: PARKED] Content anchor for the blocked zone-as-dot
// cutover (see the header below): the turn engine does not yet apply
// these definitions, and they are NOT registered in data/buff/buffs.ts.
// Only the module test consumes them. Kept deliberately per the
// mission's parked-modules rule.
import type { BuffDefinition } from '../../core/buff/BuffTypes'

// Completion plan Task 7 Step 1 — dot buff definition thay zone-as-dot:
//   - "Dung Nham" (thạch_hóa + bỏng, ReactionManager.spawnLavaZone →
//     HazardZoneSystem.spawnLavaZone): hệ sống spawn Lava Zone 6 tick ×
//     damagePerTick 20 CỐ ĐỊNH (ElementReaction.ts spawnsLavaZone data,
//     không might-scaling). Turn-based dot pipeline damage/tick =
//     power × dpsRatio (BuffSystem.calculateDamagePerTurn, physical
//     dùng stats.might). dpsRatio = 20/10 = 2.0 quy đổi tại baseline
//     might 10 (StatBlock.ts) — damage/tick tại baseline giữ nguyên 20.
//   - "Kiếm Trận" anchor REMOVED (Kiem Tu Reimagined spec 2026-09-15
//     §7) — the sword-zone keystone no longer exists.
//
// Duration giữ nguyên SỐ (no-rebalance policy Completion plan §Global
// Constraints): 6s × tickInterval 1s = 6 lượt.
//
// CUTOVER NOTE (Task 7 Step 3-4 BLOCKED): TurnBattleSystem/
// TurnSkillAction currently does NOT call ReactionManager (the turn
// engine has not wired real reaction/skill-effect handling) - there is
// no call site to swap. This definition is the standard anchor for when
// the real content migration wires reactions into the turn engine: at
// that point apply() these 2 definitions instead of spawning zones (see
// the roadmap's "skill-effect conversion" line - SkillEffectResolver
// retired M13).

export const DUNG_NHAM_BURN_DEFINITION: BuffDefinition = {
  id: 'dung_nham_burn',
  name: 'Dung Nham Bỏng',
  description: 'Dung Nham — nham thạch nóng chảy thiêu đốt (dot thay Lava Zone)',
  polarity: 'debuff',
  duration: 6,
  stackMode: 'refresh',
  effects: [{ type: 'dot', dpsRatio: 2.0, element: 'fire' }],
}
