// Companions (Companion Roster spec, 2026-09-05) — đồng đội chiêu mộ qua
// gacha, có bộ kỹ năng CỐ ĐỊNH (không có node-tree/loadout Ngũ Hành riêng
// từng nhân vật) và KHÔNG mang trang bị — chỉ số scale hoàn toàn từ
// grade + level (xem companionStatsAtLevel trong CompanionCombat.ts).
// Dùng lại ItemGrade (Hoàng/Huyền/Địa/Thiên/Tiên Chất) làm hệ độ hiếm —
// CÙNG một thang 5 bậc với Equipment/Pill/Talisman/Formation, khác hoàn
// toàn ProfessionGrade 10 bậc (không liên quan).
import type { ItemGrade } from '@/core/item/ItemGrade'
import type { TurnSkillDefinition } from '@/core/battle/turn/TurnSkillAction'

export interface CompanionBaseStats {
  maxHp: number
  attack: number
  speed: number
}

export interface CompanionDefinition {
  id: string
  name: string
  grade: ItemGrade
  baseStats: CompanionBaseStats
  basic: TurnSkillDefinition
  special?: TurnSkillDefinition
  ultimate?: TurnSkillDefinition
}

export interface CompanionInstance {
  definitionId: string
  level: number
  exp: number
}

export const COMPANIONS: readonly CompanionDefinition[] = [
  // Nội dung roster thêm ở pass balance/content sau — file này chỉ ship
  // cơ chế (Companion Roster spec §8, nội dung roster nằm ngoài scope).
]
