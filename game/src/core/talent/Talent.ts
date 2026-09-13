export type TalentRarity = 'pham' | 'linh' | 'dia' | 'thien' | 'di'

export type TalentTag =
  | 'cultivation'
  | 'combat'
  | 'defense'
  | 'resource'
  | 'crafting'
  | 'element'
  | 'skill'
  | 'risk_reward'
  | 'mechanic'

// Thiên Phú = quyết định chọn HƯỚNG ĐẠO duy nhất của nhân vật
// (talent-direction-choice-plan.md). Mỗi kind effect là một "ngoại lệ của
// luật chơi" được tiêu thụ tại đúng một điểm hook — xem
// core/talent/TalentEffects.ts cho getter tập trung theo kind. KHÔNG thêm
// kind cộng chỉ số thuần (nguyên tắc thiết kế đã chốt với tác giả).
// Catalog v4 (spec 2026-09-03-talent-catalog-v4-design.md): nhóm combat
// dùng combat_passive (hidden passive skill theo E2); tu luyện/sản xuất
// (M2/M3) thêm kind luật-bẻ riêng tại hệ thống sở hữu.
export type TalentEffect =
  | { kind: 'cultivation_speed'; percent: number }
  | { kind: 'insight_gain'; percent: number }
  | { kind: 'insight_per_cultivation'; cultivationPerInsight: number }
  | { kind: 'spirit_stone_gain'; percent: number }
  | { kind: 'equipment_drop_chance'; percent: number }
  | { kind: 'body_refinement_progress'; percent: number }
  | { kind: 'survive_lethal'; usesPerBattle: number }
  | { kind: 'reaction_keep_chance'; percent: number }
  | { kind: 'heal_on_kill'; maxHpPercent: number }
  // Talent v4 — talent cấp 1 hidden passive skill (data/skill/
  // TalentPassives.ts); GameManager grant/revoke theo talent đang chọn.
  | { kind: 'combat_passive'; passiveSkillId: string }
  // M2 (spec §4.3) — Hai Nap: cultivation overflow past the level cap
  // banks into PlayerData.cultivationOvercharge instead of being lost.
  | { kind: 'cultivation_overflow_bank' }
  // M2 — Hau Tich Bat Phat: cultivation rate curve per realm level.
  // multiplier = max(0.01, 1 + startOffset + perRealmLevel * (realmLevel - 1)).
  | { kind: 'cultivation_ramp'; startOffset: number; perRealmLevel: number }
  // M2 — Loi Kiep: tribulation lightning intensity multiplier +
  // permanent all-attribute percent granted per tribulation victory.
  | { kind: 'tribulation_challenge'; intensityMultiplier: number; victoryAllStatsPercent: number }
  // M2 — Van Dao: chance a node purchase/upgrade waives its insight
  // cost; waived amounts are recorded in nodeFreePurchaseRecord so
  // refunds pay back only what was actually paid.
  | { kind: 'node_cost_free_chance'; chance: number }
  // M2 — Pha Giap carry: a fraction of the bound passive's stacks bank
  // at battle end into phaGiapCarryStacks and re-seed the next battle;
  // decays when realmId changes.
  | { kind: 'passive_stack_carry'; passiveSkillId: string; fraction: number }
  // M3 (spec §4.2) — Hoa Hau Thong Than: successful alchemy jobs yield
  // yieldMultiplier pills; consumed profession pills gain potencyMultiplier
  // effectiveness; each job costs costMultiplier fuel wood + spirit stone.
  | { kind: 'alchemy_double_pill'; yieldMultiplier: number; potencyMultiplier: number; costMultiplier: number }
  // M3 — Bach Luyen Thanh Khi: enhance never fails; each attempt costs
  // costMultiplier materials + spirit stone vs a normal player.
  | { kind: 'enhance_guaranteed'; costMultiplier: number }

export interface TalentDefinition {
  id: string
  name: string
  description: string
  rarity: TalentRarity
  weight: number
  tags: TalentTag[]
  effects: TalentEffect[]
}

export const TALENT_RARITY_LABELS: Record<TalentRarity, string> = {
  pham: 'Phàm',
  linh: 'Linh',
  dia: 'Địa',
  thien: 'Thiên',
  di: 'Dị',
}
