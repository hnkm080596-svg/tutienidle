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
    // Post-BETA-CREATION creation distributes no points - level-up
    // allocation is the measured channel here (permanent_stat pills are
    // the second channel, material-bounded, exercised elsewhere).
    const expectedAvailable = mortal.maxLevel - createDefaultPlayer().realmLevel
    expect(budget.available).toBe(expectedAvailable)
    expect(budget.shortfall).toBe(expectedRequired - expectedAvailable)
  })

  it('the level-up channel alone falls short — available < required', () => {
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

  // Ruling 2026-09-29: permanent_stat pills write baseStats directly -
  // they are the authored pill channel that can fund the hidden
  // predicate at mortal (the alchemy/grotto pipeline supplies them).
  it('all five mortal stat families are authored as permanent_stat pills', () => {
    const census = reachableStatSourceCensus()
    expect(census.mortalPillsWithPermanentStat.sort()).toEqual([
      'duong_than_dan_mortal',
      'khai_linh_dan_mortal',
      'phi_van_dan_mortal',
      'thoi_the_dan_mortal',
      'to_cot_dan_mortal',
    ])
  })

  it('quest rewards have no attribute-point channel (closed Reward type)', () => {
    const census = reachableStatSourceCensus()
    expect(census.rewardChannelsClosed).toBe(true)
  })

  it('quest pill itemDrops resolve only through PILLS — no stat-channel leak', () => {
    const census = reachableStatSourceCensus()
    // No quest-drop pill may reach baseStats through either pill channel.
    expect(census.questItemDropPillIds).toBeDefined()
    for (const pillId of census.questItemDropPillIds) {
      expect(census.pillsWithRandomMainStat).not.toContain(pillId)
      expect(census.mortalPillsWithPermanentStat).not.toContain(pillId)
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
