import { describe, expect, it } from 'vitest'
import { createDeadEnemy, createLootTestSetup } from './battleLootTestSetup'

// Minh ruling 2026-10-05 - cap cam ngo kenh idle (auto-farm) theo ngay.
// Integration pin qua processDefeatedEnemies: kill QI mint 1 insight
// (stage mastery roll 35-45 -> round(x * 0.018) = 1). Kenh active
// (manual combat) KHONG qua gate - minh chung bang mint van tra full
// sau khi quota het.

const DAY_MS = 24 * 60 * 60 * 1000

describe('BattleLootSystem - idle-channel daily insight cap (2026-10-05)', () => {
  it('idle mint clamps at the daily band cap, then pays 0 until rollover', () => {
    const { loot, player, killEnemy } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: { stageId: 'qi_1', requiredRealmId: 'qi_refining', floor: 1 },
    })
    // Authored QI daily quota (SkillInsightBalance
    // AUTO_FARM_DAILY_SKILL_INSIGHT_CAP_BY_REALM).
    const cap = 30_000

    // Persisted ledger already at cap-1 for today's UTC bucket.
    player.idleSkillInsightDaily = {
      dayBucket: Math.floor(Date.now() / DAY_MS),
      minted: cap - 1,
    }

    loot.setChannel('idle')

    // Kill 1 pays only the remaining 1 insight - quota now spent.
    killEnemy()
    expect(player.skillInsight).toBe(1)
    expect(player.idleSkillInsightDaily?.minted).toBe(cap)

    // Kills 2 and 3 pay 0 - the cap holds for the rest of the day.
    killEnemy()
    killEnemy()
    expect(player.skillInsight).toBe(1)
    expect(player.idleSkillInsightDaily?.minted).toBe(cap)
  })

  it('active channel mints unaffected by the idle cap (manual combat ungated)', () => {
    const { loot, player, killEnemy } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: { stageId: 'qi_1', requiredRealmId: 'qi_refining', floor: 1 },
    })
    const cap = 30_000

    // Quota already exhausted on the idle channel.
    player.idleSkillInsightDaily = {
      dayBucket: Math.floor(Date.now() / DAY_MS),
      minted: cap,
    }

    loot.setChannel('active')
    killEnemy()

    // Manual kill still mints its full 1 insight; the idle ledger is
    // untouched by the active channel (minted stays at the cap - the
    // active mint never debits or credits it).
    expect(player.skillInsight).toBe(1)
    expect(player.idleSkillInsightDaily?.minted).toBe(cap)
  })

  it('day-bucket rollover pays again through the real kill path', () => {
    const { loot, player, killEnemy } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: { stageId: 'qi_1', requiredRealmId: 'qi_refining', floor: 1 },
    })
    const cap = 30_000

    // Ledger from YESTERDAY, already spent - the next idle mint rolls
    // the bucket and pays normally.
    player.idleSkillInsightDaily = {
      dayBucket: Math.floor(Date.now() / DAY_MS) - 1,
      minted: cap,
    }

    loot.setChannel('idle')
    killEnemy()

    expect(player.skillInsight).toBe(1)
    expect(player.idleSkillInsightDaily).toEqual({
      dayBucket: Math.floor(Date.now() / DAY_MS),
      minted: 1,
    })
  })

  it('entity list mint - killEnemy direct sanity', () => {
    const { loot, player } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: { stageId: 'qi_1', requiredRealmId: 'qi_refining', floor: 1 },
    })

    loot.setChannel('idle')
    loot.processDefeatedEnemies(
      [createDeadEnemy('e1'), createDeadEnemy('e2')],
      null,
    )

    expect(player.skillInsight).toBe(2)
    expect(player.idleSkillInsightDaily?.minted).toBe(2)
  })
})
