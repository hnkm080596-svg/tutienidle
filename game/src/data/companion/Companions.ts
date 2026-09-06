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

// TEST-ONLY: 5 companion placeholder (2026-09-06, Hỗn Độn Trận visual test tooling) —
// chỉ để TranPhapPanel.vue có đủ quân lấp lưới 36 ô của hon_don_tran khi test.
// Chỉ số/tên tạm bợ, dùng art placeholder chung (không có combatTextureKey riêng —
// companionToCombatEntity()/render layer tự fallback về placeholder animation set
// theo id). Sẽ bị xoá khi có roster thật.
const TEST_COMPANION_BASE_STATS: CompanionBaseStats = { maxHp: 100, attack: 10, speed: 100 }

function testCompanionBasicSkill(id: string): TurnSkillDefinition {
  return {
    id: `${id}_basic`,
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  }
}

const TEST_COMPANIONS: CompanionDefinition[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `test_companion_${n}`,
  name: `Test Companion ${n}`,
  grade: 'hoang',
  baseStats: TEST_COMPANION_BASE_STATS,
  basic: testCompanionBasicSkill(`test_companion_${n}`),
}))

export const COMPANIONS: readonly CompanionDefinition[] = [
  // Nội dung roster thêm ở pass balance/content sau — file này chỉ ship
  // cơ chế (Companion Roster spec §8, nội dung roster nằm ngoài scope).
  ...TEST_COMPANIONS,
]
