// [M13 STATUS: PARKED] Content anchor for the blocked zone-as-dot
// cutover (see the header below): the turn engine does not yet apply
// these definitions, and they are NOT registered in data/buff/buffs.ts.
// Only the module test consumes them. Kept deliberately per the
// mission's parked-modules rule.
import type { BuffDefinition } from '../../core/buff/BuffTypes'

// Completion plan Task 7 Step 1 — 2 dot buff definition thay zone-as-dot:
//   - "Dung Nham" (thạch_hóa + bỏng, ReactionManager.spawnLavaZone →
//     HazardZoneSystem.spawnLavaZone): hệ sống spawn Lava Zone 6 tick ×
//     damagePerTick 20 CỐ ĐỊNH (ElementReaction.ts spawnsLavaZone data,
//     không might-scaling). Turn-based dot pipeline damage/tick =
//     power × dpsRatio (BuffSystem.calculateDamagePerTurn, physical
//     dùng stats.might). dpsRatio = 20/10 = 2.0 quy đổi tại baseline
//     might 10 (StatBlock.ts) — damage/tick tại baseline giữ nguyên 20.
//   - "Kiếm Trận" (Kiếm Tu keystone, SkillEffect.grantsSwordZone →
//     HazardZoneSystem.spawnSwordZone): hệ sống damagePerTick =
//     multiplier × 0.3 × might, 3 charges. dpsRatio 0.3 quy đổi 1:1
//     (đã might-scaled sẵn); charges 3 → duration 3 lượt.
//
// Duration giữ nguyên SỐ (no-rebalance policy Completion plan §Global
// Constraints): 6s × tickInterval 1s = 6 lượt; 3 charges = 3 lượt.
//
// LƯU Ý CUTOVER (Task 7 Step 3-4 BLOCKED): TurnBattleSystem/TurnSkillAction
// hiện KHÔNG gọi ReactionManager/SkillEffectSystem (engine turn chưa wire
// reaction/skill-effect thật) — không có call site nào để swap. Definition
// này là neo chuẩn cho lúc content migration thật wire reaction vào turn
// engine: lúc đó chỉ cần apply() 2 definition này thay spawn zone (xem
// roadmap dòng "skill-effect conversion" (SkillEffectResolver retired M13)).

export const DUNG_NHAM_BURN_DEFINITION: BuffDefinition = {
  id: 'dung_nham_burn',
  name: 'Dung Nham Bỏng',
  description: 'Dung Nham — nham thạch nóng chảy thiêu đốt (dot thay Lava Zone)',
  polarity: 'debuff',
  duration: 6,
  stackMode: 'refresh',
  effects: [{ type: 'dot', dpsRatio: 2.0, element: 'fire' }],
}

export const KIEM_TRAN_BURN_DEFINITION: BuffDefinition = {
  id: 'kiem_tran_burn',
  name: 'Kiếm Trận Xuyên Tâm',
  description: 'Kiếm Trận — vung kiếm trận địa xuyên phá (dot thay Sword Zone)',
  polarity: 'buff',
  duration: 3,
  stackMode: 'refresh',
  effects: [{ type: 'dot', dpsRatio: 0.3, element: 'metal' }],
}
