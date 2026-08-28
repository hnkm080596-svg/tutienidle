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
export type TalentEffect =
  | { kind: 'cultivation_speed'; percent: number }
  | { kind: 'insight_gain'; percent: number }
  | { kind: 'insight_per_cultivation'; cultivationPerInsight: number }
  | { kind: 'spirit_stone_gain'; percent: number }
  | { kind: 'equipment_drop_chance'; percent: number }
  | { kind: 'body_refinement_progress'; percent: number }
  | { kind: 'alchemy_success_bonus'; percentPoints: number }
  | { kind: 'survive_lethal'; usesPerBattle: number }
  | { kind: 'reaction_keep_chance'; percent: number }
  | { kind: 'heal_on_kill'; maxHpPercent: number }

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
