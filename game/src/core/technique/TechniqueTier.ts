import { REALMS } from '../../data/realms/realm'
import { getRequiredCultivation } from '../realm/realmSystem'
import type { TechniqueTier } from './Technique'

// PLAN HOÀN CHỈNH mục 5 rework (2026-08-20) — Tâm Pháp giờ có thanh
// kinh nghiệm THẬT của riêng nó (PlayerData.techniqueExperience, nuôi
// bởi stores/player.ts's cultivate() — cùng nguồn với
// totalCultivationGained), thay cho driver cũ (suy tier thẳng từ đại
// cảnh giới người chơi). Ngưỡng lên tier vẫn giữ ĐÚNG cảm giác ranh
// giới cũ (tieu_thanh bắt đầu ở Trúc Cơ, dai_thanh ở Hóa Thần, vien_man
// ở Đại Thừa) nhưng tính bằng TỔNG tu vi cộng dồn (không reset khi đột
// phá, khác `cultivation`) cần để đi bộ tới đúng cảnh giới đó từ đầu
// game — tái dùng getRequiredCultivation() thay vì bịa số mới.
const TIER_BOUNDARY_REALM_INDEX = {
  tieu_thanh: 2, // Trúc Cơ
  dai_thanh: 5, // Hóa Thần
  vien_man: 8, // Đại Thừa
} as const

function cumulativeCultivationAtRealmStart(realmIndex: number): number {
  let total = 0

  for (let i = 0; i < realmIndex; i++) {
    const realm = REALMS[i]!

    for (let level = 1; level <= realm.maxLevel; level++) {
      total += getRequiredCultivation(realm.id, level)
    }
  }

  return total
}

interface TierThreshold {
  tier: TechniqueTier
  expRequired: number
}

const TIER_EXP_THRESHOLDS: TierThreshold[] = [
  { tier: 'so_nhap', expRequired: 0 },
  { tier: 'tieu_thanh', expRequired: cumulativeCultivationAtRealmStart(TIER_BOUNDARY_REALM_INDEX.tieu_thanh) },
  { tier: 'dai_thanh', expRequired: cumulativeCultivationAtRealmStart(TIER_BOUNDARY_REALM_INDEX.dai_thanh) },
  { tier: 'vien_man', expRequired: cumulativeCultivationAtRealmStart(TIER_BOUNDARY_REALM_INDEX.vien_man) },
]

// Dùng chung cho cả getTechniqueTier() lẫn UI exp bar (TechniqueSlotCard.vue/
// LoadoutManager.vue) — 1 lần quét ra cả tier hiện tại lẫn 2 mốc cần
// cho thanh tiến độ. nextThreshold undefined = đã Viên Mãn (MAX).
export function getTechniqueTierProgress(techniqueExperience: number): {
  tier: TechniqueTier
  lowerBound: number
  nextThreshold: number | undefined
} {
  let current = TIER_EXP_THRESHOLDS[0]!
  let nextThreshold: number | undefined

  for (let i = 0; i < TIER_EXP_THRESHOLDS.length; i++) {
    const entry = TIER_EXP_THRESHOLDS[i]!

    if (techniqueExperience >= entry.expRequired) {
      current = entry
      nextThreshold = TIER_EXP_THRESHOLDS[i + 1]?.expRequired
    }
  }

  return { tier: current.tier, lowerBound: current.expRequired, nextThreshold }
}

export function getTechniqueTier(techniqueExperience: number): TechniqueTier {
  return getTechniqueTierProgress(techniqueExperience).tier
}

export const TECHNIQUE_TIER_LABELS: Record<TechniqueTier, string> = {
  so_nhap: 'Sơ Nhập',
  tieu_thanh: 'Tiểu Thành',
  dai_thanh: 'Đại Thành',
  vien_man: 'Viên Mãn',
}
