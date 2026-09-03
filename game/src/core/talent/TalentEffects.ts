import type { TalentEffect } from './Talent'
import { getTalentDefinition } from '@/data/talent/Talents'

// Getter tập trung theo kind effect (talent-direction-choice-plan.md §6).
// Mọi nơi tiêu thụ gọi đúng getter của kind mình — KHÔNG nơi nào tự lặp
// vòng lặp đọc effect. Id lạ trong save cũ bị bỏ qua an toàn
// (getTalentDefinition trả undefined).
//
// Catalog v4 (spec 2026-09-03 §3.2) — mỗi nhân vật sở hữu ĐÚNG 1 talent
// cả đời; save edit/cũ chứa nhiều id KHÔNG được phép cộng dồn effect
// (vượt ngân sách ngoài ý định). collectTalentEffects chỉ đọc id ĐẦU
// TIÊN — hành vi có chủ đích, test TalentsV4Wiring khóa.

export function collectTalentEffects(
  selectedTalentIds: readonly string[] | undefined,
): TalentEffect[] {
  const effects: TalentEffect[] = []

  const [firstTalentId] = selectedTalentIds ?? []

  if (firstTalentId !== undefined) {
    const talent = getTalentDefinition(firstTalentId)

    if (talent) {
      effects.push(...talent.effects)
    }
  }

  return effects
}

/** Talent v4 — helper dùng chung: player có talent id này không. */
export function hasTalent(
  selectedTalentIds: readonly string[] | undefined,
  talentId: string,
): boolean {
  return (selectedTalentIds ?? []).includes(talentId)
}

/**
 * Talent v4 — id hidden passive skill (data/skill/TalentPassives.ts) của
 * talent combat đang chọn, undefined nếu talent không có/không phải
 * combat. GameManager grant/revoke passive theo id này khi vào game.
 */
export function getTalentCombatPassiveSkillId(
  selectedTalentIds: readonly string[] | undefined,
): string | undefined {
  for (const effect of collectTalentEffects(selectedTalentIds)) {
    if (effect.kind === 'combat_passive') {
      return effect.passiveSkillId
    }
  }

  return undefined
}

function sumPercent(
  selectedTalentIds: readonly string[] | undefined,
  kind: TalentEffect['kind'],
): number {
  let percent = 0

  for (const effect of collectTalentEffects(selectedTalentIds)) {
    if (effect.kind === kind && 'percent' in effect) {
      percent += effect.percent
    }
  }

  return percent
}

export function getCultivationSpeedPercent(selectedTalentIds: readonly string[] | undefined): number {
  return sumPercent(selectedTalentIds, 'cultivation_speed')
}

export function getCultivationSpeedMultiplier(selectedTalentIds: readonly string[] | undefined): number {
  // Guard: Phàm Cốt (−75%) là percent âm hợp lệ duy nhất hiện nay, nhưng
  // save cũ nhiều thiên phú không được phép kéo multiplier về ≤ 0.
  return Math.max(0.01, 1 + getCultivationSpeedPercent(selectedTalentIds))
}

export function getInsightGainMultiplier(selectedTalentIds: readonly string[] | undefined): number {
  return Math.max(0, 1 + sumPercent(selectedTalentIds, 'insight_gain'))
}

// Ngộ Đạo — nguồn Cảm Ngộ từ tu luyện. Trả về ngưỡng tu vi/điểm Cảm Ngộ,
// undefined nếu không có thiên phú nào cấp. Nhiều nguồn (save cũ) lấy
// ngưỡng nhỏ nhất — nguồn có lợi nhất thắng, không cộng dồn hai ngưỡng.
export function getInsightPerCultivation(
  selectedTalentIds: readonly string[] | undefined,
): number | undefined {
  let threshold: number | undefined

  for (const effect of collectTalentEffects(selectedTalentIds)) {
    if (effect.kind === 'insight_per_cultivation') {
      threshold = threshold === undefined ? effect.cultivationPerInsight : Math.min(threshold, effect.cultivationPerInsight)
    }
  }

  return threshold
}

export function getSpiritStoneGainMultiplier(selectedTalentIds: readonly string[] | undefined): number {
  return 1 + sumPercent(selectedTalentIds, 'spirit_stone_gain')
}

export function getEquipmentDropChanceMultiplier(selectedTalentIds: readonly string[] | undefined): number {
  return 1 + sumPercent(selectedTalentIds, 'equipment_drop_chance')
}

export function getBodyRefinementProgressMultiplier(selectedTalentIds: readonly string[] | undefined): number {
  return 1 + sumPercent(selectedTalentIds, 'body_refinement_progress')
}

export function getAlchemySuccessBonusPercentPoints(selectedTalentIds: readonly string[] | undefined): number {
  let points = 0

  for (const effect of collectTalentEffects(selectedTalentIds)) {
    if (effect.kind === 'alchemy_success_bonus') {
      points += effect.percentPoints
    }
  }

  return points
}

export function getSurviveLethalUsesPerBattle(selectedTalentIds: readonly string[] | undefined): number {
  let uses = 0

  for (const effect of collectTalentEffects(selectedTalentIds)) {
    if (effect.kind === 'survive_lethal') {
      uses += effect.usesPerBattle
    }
  }

  return uses
}

export function getReactionKeepChance(selectedTalentIds: readonly string[] | undefined): number {
  return Math.min(1, sumPercent(selectedTalentIds, 'reaction_keep_chance'))
}

export function getHealOnKillMaxHpPercent(selectedTalentIds: readonly string[] | undefined): number {
  let percent = 0

  for (const effect of collectTalentEffects(selectedTalentIds)) {
    if (effect.kind === 'heal_on_kill') {
      percent += effect.maxHpPercent
    }
  }

  return percent
}
