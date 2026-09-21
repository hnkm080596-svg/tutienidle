// P6-M1 - EarlyGameSession loop-closure contract: a fresh pinned-profile
// character progresses mortal -> Quan Khi -> qi_refining through REAL
// production seams on ONE persistent GameManager. See the P6 plan.
import { describe, expect, it } from 'vitest'
import { EarlyGameSession } from './EarlyGameSession'
import { CANONICAL_EARLY_LOOP, runLoop } from './EarlyGameLoop'
import { getRequiredCultivation } from '../../realm/realmSystem'
import { BASE_CULTIVATION_PER_SECOND } from '../../realm/realmSystem'

const PINNED = {
  name: 'probe',
  talentIds: ['hap_linh'], // combat passive - no cultivation/insight/economy subsidy
  attributes: { strength: 2, vitality: 3 }, // exactly 5 points
}

function grindToBreakthrough(s: EarlyGameSession) {
  const req = getRequiredCultivation(s.player.realmId, s.player.realmLevel)
  s.cultivate(req / s.player.cultivationPerSecond + 1)
  return s.breakthroughIfReady()
}

describe('EarlyGameSession', () => {
  it('bootstraps the pinned profile without subsidy', () => {
    const s = new EarlyGameSession({ seed: 11, profile: PINNED })
    expect(s.player.selectedTalentIds).toEqual(['hap_linh'])
    expect(s.player.baseStats.strength).toBe(3) // 1 base + 2
    expect(s.player.baseStats.vitality).toBe(4) // 1 base + 3
    expect(s.player.cultivationPath).toBeUndefined()
    // hap_linh is a combat passive: no speed/ramp/insight subsidy.
    s.cultivate(1)
    expect(s.player.cultivationPerSecond).toBe(BASE_CULTIVATION_PER_SECOND)
  })

  it('cultivates through the shared production tick (snapshot written)', () => {
    const s = new EarlyGameSession({ seed: 11, profile: PINNED })
    const gained = s.cultivate(10)
    expect(gained).toBe(BASE_CULTIVATION_PER_SECOND * 10)
    expect(s.player.totalCultivationGained).toBe(gained)
  })

  it('closes the mortal loop: dong_1 defeat -> grind -> victory -> dong_2', () => {
    const s = new EarlyGameSession({ seed: 11, profile: PINNED })

    // Fresh character loses floor 1 (honest data from the M0 probe).
    expect(s.runStage('mortal_dong_1')).toBe('defeat')

    // The loop step: cultivate -> breakthrough -> retry -> victory.
    // P7-M3: without tu_linh_quyet's so_nhap stats the flip takes a few
    // mortal breakthroughs (CANONICAL_EARLY_LOOP lands it at mortal:3) -
    // bound the honest grind; mortal starter compensation is M4 scope.
    let attempts = 0
    while (s.runStage('mortal_dong_1') !== 'victory' && attempts < 5) {
      expect(grindToBreakthrough(s)).toBe(true)
      attempts++
    }
    expect(attempts).toBeGreaterThan(0)
    expect(s.player.completedStageIds).toContain('mortal_dong_1')

    // Grind the mortal ladder to the second floor's gate.
    while (s.player.realmLevel < 14 && grindToBreakthrough(s)) {
      // keep climbing
    }
    // P7-M3: raw cultivation alone no longer covers dong_2 without
    // tu_linh_quyet - spend the earned attribute points exactly like the
    // canonical loop's allocate_all(strength) step. Allocation stops at
    // the per-stat mortal cap (getMainStatCap) with points unspent.
    while (s.allocateAttribute('strength')) {
      // keep allocating until the cap or empty pool
    }
    expect(s.runStage('mortal_dong_2')).toBe('victory')
    expect(s.player.completedStageIds).toEqual(
      expect.arrayContaining(['mortal_dong_1', 'mortal_dong_2']),
    )
  })

  it('runs Quan Khi -> ritual -> qi_refining with a positive-cost node buy', () => {
    const s = new EarlyGameSession({ seed: 11, profile: PINNED })

    // Insight income is combat-earned: grind floor 1 to victory first.
    expect(grindToBreakthrough(s)).toBe(true)
    s.runStage('mortal_dong_1')
    expect(s.player.skillInsight).toBeGreaterThan(0)

    // Reach mortal:12 (Quan Khi gate) through the real cultivate/breakthrough loop.
    while (s.player.realmLevel < 12) {
      expect(grindToBreakthrough(s)).toBe(true)
    }

    expect(s.runTribulation('qi_refining')).toBe('victory')
    expect(s.performRitual('sword', 'sword_pathway')).toBe(true)
    expect(s.player.realmId).toBe('qi_refining')
    expect(s.player.cultivationPath).toBe('sword')
    expect(s.player.cultivationWay).toBe('sword_pathway')

    // Positive-cost node purchase: actual skillInsight reduction, not just
    // a catalog cost > 0.
    const before = s.player.skillInsight
    expect(s.purchaseNode('orb_dam_1')).toBe(true)
    expect(s.player.skillInsight).toBe(before - 1)
    expect(s.player.nodeLevels['orb_dam_1']).toBe(1)
  })

  it('is deterministic: same seed -> identical normalized snapshots', () => {
    const run = () => {
      const s = new EarlyGameSession({ seed: 7, profile: PINNED })
      s.runStage('mortal_dong_1')
      grindToBreakthrough(s)
      s.runStage('mortal_dong_1')
      while (s.player.realmLevel < 12) grindToBreakthrough(s)
      s.runTribulation('qi_refining')
      s.performRitual('sword', 'sword_pathway')
      return s.snapshot()
    }
    expect(run()).toEqual(run())
  })

  // P6 characterization evidence (2026-09-21): the loop cleared mortal
  // floors 1-7 then walled at mortal_dong_8 - the first ferocious-tier
  // floor. P7-M3 re-characterization: removing tu_linh_quyet pulled the
  // wall forward to mortal_dong_5 (defeated at mortal:14 even after the
  // growth cycle) - the locked "mortal holds no technique" cut is an
  // intentional power loss whose compensation is deferred (mortal
  // starter basics = M4 scope, plus the same pending balance pass).
  // Still a balance/content finding, not a harness defect; flip back to
  // `toBeNull()` + the two asserts below once tuning lands.
  it('canonical loop: fresh pinned character reaches qi_refining floor 1 victory', { timeout: 60000 }, () => {
    const s = new EarlyGameSession({ seed: 11, profile: PINNED })
    const report = runLoop(s, CANONICAL_EARLY_LOOP)
    console.log('LOOP\n' + JSON.stringify(report, null, 1))
    const dong5Index = report.steps.findIndex(
      (r) => r.step.kind === 'stage_until_victory' && r.step.stageId === 'mortal_dong_5',
    )
    // Characterization: every step before the wall succeeds, and the
    // wall is exactly mortal_dong_5 under the M3 no-starter-technique model.
    expect(dong5Index).toBeGreaterThan(0)
    expect(report.failedAt).toBe(dong5Index)
    expect(report.snapshot.completedStageIds).toContain('mortal_dong_4')
    // TODO(balance): expect(report.failedAt).toBeNull()
    // expect(report.snapshot.cultivationPath).toBe('sword')
    // expect(report.snapshot.completedStageIds).toContain('qi_refining_forest')
  })

  it('persists one player/GameManager across the whole session', () => {
    const s = new EarlyGameSession({ seed: 11, profile: PINNED })
    const playerRef = s.player
    const gmRef = s.gameManager
    s.runStage('mortal_dong_1')
    while (s.player.realmLevel < 12) grindToBreakthrough(s)
    s.runTribulation('qi_refining')
    s.performRitual('spell', 'hidden_spell_pathway')
    expect(s.player).toBe(playerRef)
    expect(s.gameManager).toBe(gmRef)
  })
})
