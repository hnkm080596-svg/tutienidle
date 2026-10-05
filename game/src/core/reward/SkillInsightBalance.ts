import type { EnemyReward } from '../enemy/Enemy'
import { utcDayBucket } from '../idle/GameClock'

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

// EnemyReward.skillInsight override removed 2026-10-05 (r10-COR): the
// resolved drop table - not enemy.rewards - feeds this function, so the
// authored per-enemy field was unreachable dead surface (ruling 3:
// no consumer, drop it). Skill insight is always mastery-derived.
export function getSkillInsightReward(reward: Pick<EnemyReward, 'techniqueMastery'>): number {
  return Math.round(reward.techniqueMastery * SKILL_INSIGHT_PER_TECHNIQUE_MASTERY)
}

// Minh ruling 2026-10-05 (reward-channels worker, "cap cam ngo
// auto-farm 1 ngay"): the idle/auto-farm channel minted insight
// unbounded - a permanently armed farm out-paced every tree price.
// Daily quota on the IDLE channel only: each idle-channel mint clamps
// at the killed enemy's realm-band quota; manual/active battles never
// touch the ledger. Cap sizes = one max auto-farm day's mint at the
// 0.018 rate, measured off the pace audit
// (docs/balance/2026-10-05-economy-pace-retune.md, autofarm stones/h /
// band stone roll -> kills/h):
//   qi_refining  ~1 insight/kill x ~1.2k kills/h x 24h ~= 29k -> 30_000
//   foundation   ~2 insight/kill x ~0.77k kills/h x 24h ~= 37k -> 40_000
// mortal mints ~0 (5-8 mastery rounds to 0) and post-beta bands have no
// authored drop table yet - unlisted realms take the top beta quota.
export const AUTO_FARM_DAILY_SKILL_INSIGHT_CAP_BY_REALM: Record<string, number> = {
  qi_refining: 30_000,
  foundation_establishment: 40_000,
}
export const AUTO_FARM_DAILY_SKILL_INSIGHT_CAP_DEFAULT = 40_000

// Canonical UTC day-bucket comes from GameClock.utcDayBucket - shared
// with QuestSystem.dayBucket so daily resets cannot drift apart.

export interface IdleSkillInsightDaily {
  // UTC day-bucket convention - identical to QuestSystem.dayBucket /
  // lastDailyResetAtMs (floor(ms / 24h)). Lazily rolled at mint time,
  // no scheduler needed.
  dayBucket: number
  minted: number
}

/**
 * Idle-channel insight mint gate: rolls the persisted daily ledger at
 * the UTC boundary, clamps the requested mint to the day's remaining
 * quota for the enemy's realm band, and returns the amount actually
 * minted (0 once the quota is spent until the bucket rolls).
 */
export function settleIdleSkillInsightMint(
  player: { idleSkillInsightDaily?: IdleSkillInsightDaily },
  enemyRealmId: string | undefined,
  requested: number,
  nowMs: number,
): number {
  const today = utcDayBucket(nowMs)
  const ledger = (player.idleSkillInsightDaily ??= { dayBucket: today, minted: 0 })

  if (ledger.dayBucket !== today) {
    ledger.dayBucket = today
    ledger.minted = 0
  }

  const cap =
    AUTO_FARM_DAILY_SKILL_INSIGHT_CAP_BY_REALM[enemyRealmId ?? ''] ??
    AUTO_FARM_DAILY_SKILL_INSIGHT_CAP_DEFAULT

  const granted = Math.min(requested, Math.max(0, cap - ledger.minted))
  ledger.minted += granted
  return granted
}
