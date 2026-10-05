import { describe, expect, it } from 'vitest'
import {
  AUTO_FARM_DAILY_SKILL_INSIGHT_CAP_BY_REALM,
  AUTO_FARM_DAILY_SKILL_INSIGHT_CAP_DEFAULT,
  settleIdleSkillInsightMint,
  type IdleSkillInsightDaily,
} from './SkillInsightBalance'

// Minh ruling 2026-10-05 - cap cam ngo auto-farm 1 ngay (kenh idle):
// mint vuot quota band tra 0 cho toi khi day-bucket UTC roll; ken
// manual khong qua gate nay (channel check o BattleLootSystem).

const DAY_MS = 24 * 60 * 60 * 1000
const T0 = Date.UTC(2026, 9, 5, 12, 0, 0) // 2026-10-05 12:00 UTC

function todayBucket(nowMs: number): number {
  return Math.floor(nowMs / DAY_MS)
}

describe('settleIdleSkillInsightMint - idle insight daily cap', () => {
  it('first mint creates the ledger and accrues up to the band cap', () => {
    const player: { idleSkillInsightDaily?: IdleSkillInsightDaily } = {}

    expect(settleIdleSkillInsightMint(player, 'qi_refining', 10, T0)).toBe(10)
    expect(player.idleSkillInsightDaily).toEqual({
      dayBucket: todayBucket(T0),
      minted: 10,
    })
  })

  it('cap hit -> mints clamp then 0 until the day bucket rolls', () => {
    const player: { idleSkillInsightDaily?: IdleSkillInsightDaily } = {}
    const cap = AUTO_FARM_DAILY_SKILL_INSIGHT_CAP_BY_REALM['qi_refining']!
    if (cap === undefined) throw new Error('cap table drifted')

    // Spend the whole quota in two mints: cap-2 then a request for 10
    // pays only the remaining 2; the next mint pays 0.
    expect(settleIdleSkillInsightMint(player, 'qi_refining', cap - 2, T0)).toBe(cap - 2)
    expect(settleIdleSkillInsightMint(player, 'qi_refining', 10, T0)).toBe(2)
    expect(settleIdleSkillInsightMint(player, 'qi_refining', 10, T0)).toBe(0)
    expect(settleIdleSkillInsightMint(player, 'qi_refining', 10, T0 + 60_000)).toBe(0)
    expect(player.idleSkillInsightDaily?.minted).toBe(cap)
  })

  it('day-bucket rollover resets the quota', () => {
    const player: { idleSkillInsightDaily?: IdleSkillInsightDaily } = {}
    const cap = AUTO_FARM_DAILY_SKILL_INSIGHT_CAP_BY_REALM['qi_refining']
    if (cap === undefined) throw new Error('cap table drifted')

    settleIdleSkillInsightMint(player, 'qi_refining', cap, T0)
    expect(settleIdleSkillInsightMint(player, 'qi_refining', 10, T0)).toBe(0)

    // Next UTC day -> fresh quota.
    const tomorrow = T0 + DAY_MS
    expect(settleIdleSkillInsightMint(player, 'qi_refining', 10, tomorrow)).toBe(10)
    expect(player.idleSkillInsightDaily).toEqual({
      dayBucket: todayBucket(tomorrow),
      minted: 10,
    })
  })

  it('a stale persisted ledger from a previous day rolls on the next mint', () => {
    const player: { idleSkillInsightDaily?: IdleSkillInsightDaily } = {
      // Save from 3 days ago, quota already spent.
      idleSkillInsightDaily: { dayBucket: todayBucket(T0) - 3, minted: 999_999 },
    }

    expect(settleIdleSkillInsightMint(player, 'qi_refining', 5, T0)).toBe(5)
    expect(player.idleSkillInsightDaily?.minted).toBe(5)
  })

  it('band caps: qi 30k / foundation 40k; unlisted realms fall back to the top beta quota', () => {
    const qi: { idleSkillInsightDaily?: IdleSkillInsightDaily } = {}
    const tc: { idleSkillInsightDaily?: IdleSkillInsightDaily } = {}
    const mortal: { idleSkillInsightDaily?: IdleSkillInsightDaily } = {}

    expect(settleIdleSkillInsightMint(qi, 'qi_refining', 100_000, T0)).toBe(30_000)
    expect(settleIdleSkillInsightMint(tc, 'foundation_establishment', 100_000, T0)).toBe(40_000)
    expect(settleIdleSkillInsightMint(mortal, 'mortal', 100_000, T0)).toBe(
      AUTO_FARM_DAILY_SKILL_INSIGHT_CAP_DEFAULT,
    )
    expect(settleIdleSkillInsightMint({}, undefined, 100_000, T0)).toBe(
      AUTO_FARM_DAILY_SKILL_INSIGHT_CAP_DEFAULT,
    )
  })
})
