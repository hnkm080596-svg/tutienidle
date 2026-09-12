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

export type CompanionSkillSlot = 'basic' | 'special' | 'ultimate'

/** Whitelisted skill overrides - id/targeting may NOT be overridden (A8). */
export interface CompanionSkillOverride {
  cooldownTurns?: number
  damageMultiplierPercent?: number   // multiplies damage.multiplier, e.g. 20 = x1.2
  healPercentOfDamage?: number
}

export type ConstellationPerk =
  | { atRank: number; kind: 'stat'; stat: keyof CompanionBaseStats; percent?: number; flat?: number }
  | { atRank: number; kind: 'skill_override'; slot: CompanionSkillSlot; overrides: CompanionSkillOverride }

export interface CompanionDefinition {
  id: string
  name: string
  grade: ItemGrade
  growthRate: number                       // stat multiplier per global cultivation level
  unlockThresholds: {                      // realm gate per slot (compare vs instance realm/tier)
    special?: { realmId: string; realmLevel: number }
    ultimate?: { realmId: string; realmLevel: number }
  }
  baseStats: CompanionBaseStats
  basic: TurnSkillDefinition
  special?: TurnSkillDefinition
  ultimate?: TurnSkillDefinition
  constellationPerks?: ConstellationPerk[]
}

export interface CompanionInstance {
  instanceId: string          // stable identity - crypto.randomUUID(), never array index
  definitionId: string
  realmId: string             // starts 'mortal'
  realmLevel: number          // tier within realmId (1..realm.maxLevel)
  exp: number                 // exp banked within current tier
  constellationRank: number   // 0..6
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

// Export (bug fix 2026-09-06, user report "không thấy nhân vật phụ test ở
// đâu") — TranPhapPanel.vue cần đúng danh sách id này để cấp phát trực tiếp
// vào player.companions (chưa có gacha UI thật để tự pull), thay vì đoán
// prefix 'test_companion_' từ COMPANIONS một cách rời rạc/dễ vỡ.
export const TEST_COMPANIONS: CompanionDefinition[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `test_companion_${n}`,
  name: `Test Companion ${n}`,
  grade: 'hoang',
  growthRate: 0.05,
  unlockThresholds: {},
  baseStats: TEST_COMPANION_BASE_STATS,
  basic: testCompanionBasicSkill(`test_companion_${n}`),
}))

export const COMPANIONS: readonly CompanionDefinition[] = [
  // Nội dung roster thêm ở pass balance/content sau — file này chỉ ship
  // cơ chế (Companion Roster spec §8, nội dung roster nằm ngoài scope).
  ...TEST_COMPANIONS,
]
