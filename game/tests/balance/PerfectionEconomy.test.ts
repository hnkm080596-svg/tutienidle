// M-D (decision D6) - PerfectionEconomy driven simulations: long-horizon
// balance measurement of the mortal early-game economy, moved out of the
// default regression gate into the BALANCE SIMULATION GATE
// (`npm run test:balance`, vitest.balance.config.mts).
//
// The cheap analytic/invariant tests for the same economy stay in the
// normal gate at src/core/simulation/earlygame/PerfectionEconomy.test.ts.
// Every simulation, assertion, and seed below is preserved verbatim from
// that file's original driven-run describes.
//
// Spec: docs/p7/missions/md-perfection-sim.spec.md v12
import { describe, expect, it } from 'vitest'
import { MAIN_STAT_KEYS } from '../../src/core/stats/StatTypes'
import { getMainStatCap } from '../../src/core/stats/StatCap'
import { BODY_REFINEMENT_TIERS } from '../../src/data/realm/BodyRefinement'
import {
  expectedEssencePerKill,
  expectedKillsForBody,
  measureNormalRun,
  measurePerfectionRun,
  mortalStatBudget,
} from '../../src/core/simulation/earlygame/PerfectionEconomy'

describe('measureNormalRun — canonical loop sliced at the ritual (spec §2)', () => {
  it('ends at qi_refining right after the ritual with measured counters', { timeout: 600_000 }, () => {
    const m = measureNormalRun(11)
    expect(m.realmId).toBe('qi_refining')
    expect(m.stageRuns).toBeGreaterThan(0)
    expect(m.victories).toBeGreaterThan(0)
    expect(m.battleSeconds).toBeGreaterThan(0)
    expect(m.enemiesDefeated).toBeGreaterThan(0)
    expect(m.uncountedStageRuns).toBe(0)
    // Parity model: battle-carried cultivation is inside battleSeconds;
    // idle cultivation is measured separately, never double-counted.
    expect(m.cultivationSeconds).toBeGreaterThanOrEqual(0)
    expect(m.tinhHoaGained).toBeGreaterThan(0)
  })
})

describe('measurePerfectionRun — driven run owns the verdict (spec §3.3/§3.5)', () => {
  it('runs to a measured outcome with full accounting', { timeout: 600_000 }, () => {
    const m = measurePerfectionRun(11)

    // Kill accounting integrity - a single counted:false run would
    // invalidate the income/kill cross-check.
    expect(m.uncountedStageRuns).toBe(0)

    // Under the CURRENT economy the run MUST resolve - spec sec.3.5 pins
    // 'achieved' or 'proven_infeasible' for the default bound; hitting
    // safety_bound is itself a finding, not a passable outcome.
    expect(m.outcome).not.toBe('safety_bound')
    expect(m.boundReason).toBeNull()

    if (m.outcome === 'proven_infeasible') {
      // Stat axis starved at the level cap with the pool dry.
      expect(m.statAxisVerdict).toBe('proven_infeasible')
      expect(m.realmLevelReached).toBe(18)
      expect(m.statAxisResolvedAtSeconds).not.toBeNull()
      expect(m.perfectionPredicateWouldPass).toBe(false)
      // The run still measures the body axis to completion.
      expect(m.bodyTiersCompleted).toBe(BODY_REFINEMENT_TIERS.length)
      expect(m.bodyAxisResolvedAtSeconds).not.toBeNull()
      // Measured end-state raw-stat deficit agrees with the analytic
      // budget for the sources the driver exercises (spec sec.3.5).
      const cap = getMainStatCap('mortal')
      const measuredDeficit = MAIN_STAT_KEYS.reduce(
        (sum, stat) => sum + Math.max(0, cap - m.finalBaseStats[stat]),
        0,
      )
      expect(measuredDeficit).toBeGreaterThan(0)
      expect(measuredDeficit).toBe(mortalStatBudget().shortfall)
    }

    if (m.outcome === 'achieved') {
      expect(m.statAxisVerdict).toBe('achieved')
      expect(m.perfectionPredicateWouldPass).toBe(true)
      expect(m.bodyTiersCompleted).toBe(BODY_REFINEMENT_TIERS.length)
      // No level-18 requirement - a feasible economy may cap earlier.
    }

    // Body-axis measurement is real regardless of outcome: kills within
    // +-25% of analytic expectation, income within +-25% of expected/kill.
    if (m.bodyTiersCompleted === BODY_REFINEMENT_TIERS.length) {
      const expectedKills = expectedKillsForBody()
      expect(m.enemiesDefeated).toBeGreaterThan(expectedKills * 0.75)
      expect(m.enemiesDefeated).toBeLessThan(expectedKills * 1.25)
      const incomePerKill = m.tinhHoaGained / m.enemiesDefeated
      expect(incomePerKill).toBeGreaterThan(expectedEssencePerKill() * 0.75)
      expect(incomePerKill).toBeLessThan(expectedEssencePerKill() * 1.25)
    }
  })

  it('determinism: same seed → identical measurement', { timeout: 600_000 }, () => {
    const a = measurePerfectionRun(23)
    const b = measurePerfectionRun(23)
    expect(b).toEqual(a)
  })

  it('a shrunk kill bound reports safety_bound with the max_kills reason', { timeout: 600_000 }, () => {
    const m = measurePerfectionRun(11, { maxKills: 1 })
    expect(m.outcome).toBe('safety_bound')
    expect(m.boundReason).toBe('max_kills')
    // Bound fired while axes were still unresolved - no fabricated verdict.
    expect(m.statAxisVerdict).toBe('unresolved')
    expect(m.bodyAxisResolvedAtSeconds).toBeNull()
  })
})

describe('three-seed measurement evidence (spec §3.5)', () => {
  // Per-seed kills/essence/income variance - the report's table is
  // sourced from this run. ~60s of sim time per seed.
  it.each([11, 23, 7])('seed %i resolves with income inside tolerance', { timeout: 600_000 }, (seed) => {
    const m = measurePerfectionRun(seed)
    expect(m.uncountedStageRuns).toBe(0)
    expect(m.outcome).not.toBe('safety_bound')
    expect(m.enemiesDefeated).toBeGreaterThan(0)
    const incomePerKill = m.tinhHoaGained / m.enemiesDefeated
    expect(incomePerKill).toBeGreaterThan(expectedEssencePerKill() * 0.75)
    expect(incomePerKill).toBeLessThan(expectedEssencePerKill() * 1.25)
    console.log(
      `[md-econ] seed=${seed} outcome=${m.outcome} kills=${m.enemiesDefeated} ` +
        `essence=${m.tinhHoaGained} income=${incomePerKill.toFixed(4)} ` +
        `wall=${m.wallSeconds} battle=${m.battleSeconds} idle=${m.cultivationSeconds} ` +
        `stageRuns=${m.stageRuns} statAt=${m.statAxisResolvedAtSeconds} bodyAt=${m.bodyAxisResolvedAtSeconds}`,
    )
  })
})

describe('cross-run consistency', () => {
  it('normal run reaches qi_refining while perfection stays mortal', { timeout: 600_000 }, () => {
    const normal = measureNormalRun(11)
    const perfection = measurePerfectionRun(11)
    expect(normal.realmId).toBe('qi_refining')
    expect(perfection.realmId).toBe('mortal')
    // Same mortal prefix under identical parity → the shared window of
    // the two runs sees comparable kill/economy magnitudes.
    expect(normal.enemiesDefeated).toBeGreaterThan(0)
    expect(perfection.enemiesDefeated).toBeGreaterThan(normal.enemiesDefeated)
  })
})
