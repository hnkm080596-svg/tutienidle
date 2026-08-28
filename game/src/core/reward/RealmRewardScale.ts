import { getRealmIndex } from '../realm/realmSystem'

// Scale phần thưởng quái theo cảnh giới của stage (2026-08-28, balance
// playtest) — Trúc Cơ hiện tái sử dụng enemyPool Luyện Khí (Stages.ts
// foundationStages chỉ override realmId), khiến thu nhập Linh Thạch/Cảm
// ngộ ở Trúc Cơ bị "khựng" bằng Luyện Khí trong khi chi phí token/enhance
// tăng. Nhân thưởng theo bậc cảnh giới để tiến trình có ý nghĩa.
//
// Quy ước: mortal & Luyện Khí ×1 (baseline); từ Trúc Cơ trở lên ×3 mỗi
// bậc cảnh giới (khớp đường cong thời gian/effort ~×3/realm). enemy.realmId
// đã được StageWaveSystem override theo stage.requiredRealmId lúc spawn,
// nên đọc theo enemy.realmId là đúng stage đang đánh (nhất quán với gate
// rớt Đoán Bảo Thạch trong ArtifactDropBalance.ts).
const REALM_REWARD_GROWTH_BASE = 3

export function getRealmRewardMultiplier(realmId: string): number {
  const realmIndex = getRealmIndex(realmId)

  if (realmIndex <= 1) {
    return 1
  }

  return Math.pow(REALM_REWARD_GROWTH_BASE, realmIndex - 1)
}
