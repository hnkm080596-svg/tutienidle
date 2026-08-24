import type { EnemyReward } from '../enemy/Enemy'

// skill-insight-and-auto-combat-hud-plan.md mục 12 — "Cân bằng số Cảm
// ngộ cuối cùng; phase đầu dùng config tạm để dễ chỉnh". Tỉ lệ DUY
// NHẤT quyết định Cảm ngộ Kỹ năng khi enemy không tự khai skillInsight
// riêng — đổi 1 số này là chỉnh được toàn bộ economy, không cần sửa
// từng entry trong data/enemy/*.ts.
export const SKILL_INSIGHT_PER_TECHNIQUE_INSIGHT = 1

export function getSkillInsightReward(reward: Pick<EnemyReward, 'techniqueInsight' | 'skillInsight'>): number {
  if (reward.skillInsight !== undefined) {
    return reward.skillInsight
  }

  return Math.round(reward.techniqueInsight * SKILL_INSIGHT_PER_TECHNIQUE_INSIGHT)
}
