import type { EnemyReward } from '../enemy/Enemy'

// skill-insight-and-auto-combat-hud-plan.md mục 12 — "Cân bằng số Cảm
// ngộ cuối cùng; phase đầu dùng config tạm để dễ chỉnh". Tỉ lệ DUY
// NHẤT quyết định Cảm ngộ Kỹ năng khi enemy không tự khai skillInsight
// riêng — đổi 1 số này là chỉnh được toàn bộ economy, không cần sửa
// từng entry trong data/enemy/*.ts.
// M2 (spec 2026-09-03 §4.3 row 18): baseline insight economy cut ~40%
// (1 -> 0.6) as Van Dao's declared cost — the talent's insight_gain
// multiplier buys it back for its holder.
export const SKILL_INSIGHT_PER_TECHNIQUE_MASTERY = 0.6

export function getSkillInsightReward(reward: Pick<EnemyReward, 'techniqueMastery' | 'skillInsight'>): number {
  if (reward.skillInsight !== undefined) {
    return reward.skillInsight
  }

  return Math.round(reward.techniqueMastery * SKILL_INSIGHT_PER_TECHNIQUE_MASTERY)
}
