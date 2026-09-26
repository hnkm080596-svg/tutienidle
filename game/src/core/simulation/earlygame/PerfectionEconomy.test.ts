// M-D (decision D6) - PerfectionEconomy: deterministic measurement of
// the mortal early-game economy - does the current authored source set
// support "Pham Nhan hoan my optional, giu kho"? Driven through
// EarlyGameSession production seams with combatCultivationParity on
// (production cultivates + auto-breakthroughs + auto-invests during
// battles). The driven run owns the verdict; the analytic budget is a
// cross-check, not the verdict owner.
//
// Spec: docs/p7/missions/md-perfection-sim.spec.md v12
//
// Gate split (test-workload remediation phase 1): this file keeps only the
// cheap analytic/invariant tests in the normal regression gate. The
// measureNormalRun/measurePerfectionRun driven simulations moved to
// tests/balance/PerfectionEconomy.test.ts behind `npm run test:balance`.
import { describe, expect, it } from 'vitest'
import { MAIN_STAT_KEYS } from '../../stats/StatTypes'
import { createBaseStats } from '../../stats/StatBlock'
import { createDefaultPlayer } from '../../player/Player'
import { getMainStatCap } from '../../stats/StatCap'
import { REALMS } from '../../../data/realms/realm'
import { BODY_REFINEMENT_TIERS } from '../../../data/realm/BodyRefinement'
import {
  expectedEssencePerKill,
  expectedKillsForBody,
  mortalStatBudget,
  reachableStatSourceCensus,
} from './PerfectionEconomy'

describe('mortalStatBudget — enumerated-source budget (spec §3.4)', () => {
  it('derives required from canonical baseline + cap, no magic numbers', () => {
    const budget = mortalStatBudget()
    const baseline = createBaseStats()
    const cap = getMainStatCap('mortal')
    const expectedRequired = MAIN_STAT_KEYS.reduce(
      (sum, stat) => sum + (cap - baseline[stat]),
      0,
    )
    expect(budget.required).toBe(expectedRequired)

    const mortal = REALMS.find((r) => r.id === 'mortal')!
    // Post-BETA-CREATION creation distributes no points - breakthrough
    // is the only enumerated source.
    const expectedAvailable = mortal.maxLevel - createDefaultPlayer().realmLevel
    expect(budget.available).toBe(expectedAvailable)
    expect(budget.shortfall).toBe(expectedRequired - expectedAvailable)
  })

  it('current enumerated sources fall short — available < required', () => {
    const budget = mortalStatBudget()
    expect(budget.available).toBeLessThan(budget.required)
    expect(budget.shortfall).toBeGreaterThan(0)
  })
})

describe('reachableStatSourceCensus — data-verifiable source census (spec §3.5)', () => {
  it('no authored pill carries random_main_stat', () => {
    const census = reachableStatSourceCensus()
    expect(census.pillsWithRandomMainStat).toEqual([])
  })

  it('quest rewards have no attribute-point channel (closed Reward type)', () => {
    const census = reachableStatSourceCensus()
    expect(census.rewardChannelsClosed).toBe(true)
  })

  it('quest pill itemDrops resolve only through PILLS — transitively clean', () => {
    const census = reachableStatSourceCensus()
    // With pillsWithRandomMainStat empty, no quest-drop pill reaches baseStats.
    expect(census.questItemDropPillIds).toBeDefined()
    for (const pillId of census.questItemDropPillIds) {
      expect(census.pillsWithRandomMainStat).not.toContain(pillId)
    }
  })
})

describe('analytic body expectations (spec §3.4)', () => {
  it('expectedEssencePerKill derives from the mortal stage drop table', () => {
    // Mortal band guarantees tinh_hoa_pham_the 1..3 @ 0.7 -> 1.4 expected.
    expect(expectedEssencePerKill()).toBeCloseTo(0.7 * 2, 5)
  })

  it('expectedKillsForBody = total tier cap / expected income', () => {
    const totalCap = BODY_REFINEMENT_TIERS.reduce((sum, t) => sum + t.cap, 0)
    expect(expectedKillsForBody()).toBeCloseTo(totalCap / expectedEssencePerKill(), 1)
  })
})
