import type { Skill } from './Skill'

// skill-insight-and-auto-combat-hud-plan.md mục 5/12 — chi phí nâng
// cấp skill TĂNG DẦN theo level hiện tại (level 1 -> 2 rẻ hơn level 9
// -> 10), tránh 1 skill "cày" hết sạch Cảm ngộ ngay từ đầu. Config tạm
// (phase đầu), chỉnh cân bằng cuối cùng chỉ cần đổi 2 số này.
const BASE_SKILL_UPGRADE_INSIGHT_COST = 5
const SKILL_UPGRADE_INSIGHT_COST_PER_LEVEL = 3

export function getSkillUpgradeInsightCost(skill: Pick<Skill, 'level'>): number {
  return BASE_SKILL_UPGRADE_INSIGHT_COST + SKILL_UPGRADE_INSIGHT_COST_PER_LEVEL * (skill.level - 1)
}
