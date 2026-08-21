import type { StatModifier } from '../stats/StatCalculator'

// Kiếm Tu (2026-08-15) — Kiếm Ý VĨNH VIỄN: "khi tu luyện, mỗi nhận
// được 9999 linh lực vĩnh viễn tăng 1 tầng Kiếm Ý cố định" — đọc
// "linh lực" ở đây là tu vi tích được (PlayerData.totalCultivationGained,
// đếm dồn suốt đời, KHÔNG giảm khi đột phá — khác `cultivation` bị
// tiêu hao). Mỗi tầng cộng thẳng % sát thương skill + tỉ lệ/sát
// thương chí mạng — người dùng cho khoảng 0.001~0.01/điểm, chọn mốc
// giữa dải làm số khởi điểm, cần tinh chỉnh qua playtest (giống mọi
// hằng số "khởi điểm" khác trong dự án).
const CULTIVATION_PER_SWORD_INTENT_TIER = 9999

const SKILL_DAMAGE_PERCENT_PER_TIER = 0.005
const CRITICAL_RATE_PER_TIER = 0.005
const CRITICAL_DAMAGE_PER_TIER = 0.005

export function getSwordIntentTier(totalCultivationGained: number): number {
  return Math.floor(totalCultivationGained / CULTIVATION_PER_SWORD_INTENT_TIER)
}

/**
 * Tính LIVE mỗi lần gọi (không "grant" 1 lần rồi lưu trạng thái) —
 * luôn khớp đúng totalCultivationGained hiện có, không có nguy cơ
 * lệch/cộng trùng. Gọi từ stores/player.ts's finalStats getter, hoà
 * chung pool modifier như equipment/buff khác.
 */
export function getSwordIntentModifiers(totalCultivationGained: number): StatModifier[] {
  const tier = getSwordIntentTier(totalCultivationGained)

  if (tier <= 0) {
    return []
  }

  return [
    {
      id: 'sword_intent:skill_damage',
      sourceId: 'sword_intent',
      sourceType: 'attribute',
      stat: 'skillDamagePercent',
      flat: tier * SKILL_DAMAGE_PERCENT_PER_TIER,
    },

    {
      id: 'sword_intent:critical_rate',
      sourceId: 'sword_intent',
      sourceType: 'attribute',
      stat: 'criticalRate',
      flat: tier * CRITICAL_RATE_PER_TIER,
    },

    {
      id: 'sword_intent:critical_damage',
      sourceId: 'sword_intent',
      sourceType: 'attribute',
      stat: 'criticalDamage',
      flat: tier * CRITICAL_DAMAGE_PER_TIER,
    },
  ]
}
