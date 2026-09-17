import { getRealmIndex } from '../realm/realmSystem'

// Scale phần thưởng quái theo cảnh giới của stage (2026-08-28, balance
// playtest) — Trúc Cơ hiện tái sử dụng enemyPool Luyện Khí (Stages.ts
// foundationStages chỉ override realmId), khiến thu nhập Linh Thạch/Cảm
// ngộ ở Trúc Cơ bị "khựng" bằng Luyện Khí trong khi chi phí token/enhance
// tăng. Nhân thưởng theo bậc cảnh giới để tiến trình có ý nghĩa.
//
// Convention: mortal & Luyen Khi x1 (baseline); Foundation+ x3 per
// realm tier (matching the ~x3/realm time/effort curve). enemy.realmId
// was already overridden by StageWaveSystem to stage.requiredRealmId at
// spawn, so reading enemy.realmId matches the stage being fought
// (consistent with the doan_bao_thach drop-table gate).
const REALM_REWARD_GROWTH_BASE = 3

export function getRealmRewardMultiplier(realmId: string): number {
  const realmIndex = getRealmIndex(realmId)

  if (realmIndex <= 1) {
    return 1
  }

  return Math.pow(REALM_REWARD_GROWTH_BASE, realmIndex - 1)
}
