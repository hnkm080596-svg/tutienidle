import type { EnemyReward } from '../enemy/Enemy'

// skill-insight-and-auto-combat-hud-plan.md muc 12 - "Can bang so Cam
// ngo cuoi cung; phase dau dung config tam de de chinh". Ti le DUY
// NHAT quyet dinh Cam ngo Ky nang khi enemy khong tu khai skillInsight
// rieng - doi 1 so nay la chinh duoc toan bo economy, khong can sua
// tung entry trong data/enemy/*.ts.
// M2 (spec 2026-09-03 sec4.3 row 18): baseline insight economy cut ~40%
// (1 -> 0.6) as Van Dao's declared cost - the talent's insight_gain
// multiplier buys it back for its holder.
// balance-review 2026-10-04 (docs/balance/progression-review.md C2.1):
// at 0.6 a Luyen Khi kill mints 21-27 insight while the whole fire tree
// costs 53 - the tree empties inside one floor and every insight_gain
// talent reads as a trap. Cut to 0.18 so a full tree is ~8-10 kills.
// pace-floor retune 2026-10-05 (insight-pace worker): realm floors moved
// to ~1 day (QI) / ~1 week (TC) but the auto-farm loop mints a full
// stage's kill rewards every half-clear cycle - at 0.18 a QI floor idles
// ~10-17k insight/h against a ~30-cost tree. Cut to 0.018: insight mints
// off the realm band's techniqueMastery roll (StageDropTables), so
// mortal kills mint 0, QI kills ~1, TC kills ~5-6 (band roll x3 realm
// multiplier), while node prices were re-anchored to each realm window
// (QI minor 600/level, TC minor 40,000/level - see data/progression/*).
export const SKILL_INSIGHT_PER_TECHNIQUE_MASTERY = 0.018

export function getSkillInsightReward(reward: Pick<EnemyReward, 'techniqueMastery' | 'skillInsight'>): number {
  if (reward.skillInsight !== undefined) {
    return reward.skillInsight
  }

  return Math.round(reward.techniqueMastery * SKILL_INSIGHT_PER_TECHNIQUE_MASTERY)
}
