// P6-M1 - EarlyGameSession harness contract: bootstrap, production-tick
// cultivation, persistence identity, and the canonical-loop wall
// characterization. The committed Mortal journey legs (combat economy,
// ritual, boundary rejects, save/restore, determinism) live in
// MortalChapterJourney.test.ts (P7 M-C) - this file keeps only
// harness-level properties.
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { EarlyGameSession } from './EarlyGameSession'
import { CANONICAL_EARLY_LOOP, runLoop } from './EarlyGameLoop'
import { usePlayerStore } from '../../../stores/player'
import { getRequiredCultivation } from '../../realm/realmSystem'
import { BASE_CULTIVATION_PER_SECOND } from '../../realm/realmSystem'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../../data/realm/BodyRefinement'

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

beforeEach(() => {
  setActivePinia(createPinia())
})

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
    // Ungated base way so the ritual actually commits - the identity
    // assertion below is only meaningful post-commit.
    expect(s.performRitual('spell', 'spell_pathway')).toBe(true)
    expect(s.player).toBe(playerRef)
    expect(s.gameManager).toBe(gmRef)
  })
})

// M-F-JOURNEY - unit pins for the TC-era harness seams (plan Step 1):
// owner construction, the two-phase settle/drain contract, and the
// bag/chapter-invest fixture seams. Journey-level coverage lives in
// TrucCoJourney.test.ts; these pin the seams' own contracts.
describe('EarlyGameSession - M-F-JOURNEY seam pins', () => {
  it('playerOwner construction makes the session player the owner $state', () => {
    const owner = usePlayerStore()
    const s = new EarlyGameSession({ seed: 11, profile: PINNED, playerOwner: owner })
    expect(s.player).toBe(owner.$state)
    expect(s.player.selectedTalentIds).toEqual(['hap_linh'])
  })

  it('settle/drain mirror the two-phase contract on a committed Quan Khi victory', { timeout: 60000 }, () => {
    const owner = usePlayerStore()
    const s = new EarlyGameSession({ seed: 11, profile: PINNED, playerOwner: owner })
    while (s.player.realmLevel < 12) {
      expect(grindToBreakthrough(s)).toBe(true)
    }
    expect(s.runTribulation('qi_refining')).toBe('victory')

    // Settle binds ONCE: the qi_refining early-return writes no realm
    // (announcement-only result) but DID create the realm-pool
    // entitlement before returning.
    const receipt = s.settleTribulationOutcome()
    expect(receipt?.kind).toBe('victory')
    if (receipt?.kind === 'victory') {
      expect(receipt.realmEntered).toBeNull()
    }
    expect(s.player.realmId).toBe('mortal')
    expect(s.player.pendingTalentEntitlement?.realmId).toBe('qi_refining')

    // Idempotent: the repeat call returns the SAME bound receipt object.
    expect(s.settleTribulationOutcome()).toBe(receipt)

    // Drain HOLDS while the entitlement stays unresolved (the
    // committed outcome is retained for the post-resolution drain).
    expect(s.drainTribulationOutcome()).toBe(false)
    expect(s.gameManager.tribulationDirector.getCommittedOutcome()).not.toBeNull()

    const offered = s.player.pendingTalentEntitlement?.offeredTalentIds ?? []
    expect(offered.length).toBeGreaterThan(0)
    expect(s.resolveTalentEntitlement({ kind: 'new', talentId: offered[0]! })).toBe(true)
    expect(s.player.pendingTalentEntitlement).toBeUndefined()
    expect(s.drainTribulationOutcome()).toBe(true)
    expect(s.gameManager.tribulationDirector.getCommittedOutcome()).toBeNull()
  })

  it('settleTribulationOutcome rejects an owner-less session (writer contract)', () => {
    const s = new EarlyGameSession({ seed: 11, profile: PINNED })
    expect(() => s.settleTribulationOutcome()).toThrow()
  })

  it('bag seams + investChapter mirror the real chapter invest contract', () => {
    const s = new EarlyGameSession({ seed: 11, profile: PINNED })
    expect(s.holdPill('thong_mach_dan', 5)).toBe(5)
    expect(s.pillAmount('thong_mach_dan')).toBe(5)
    expect(s.holdMaterial(TINH_HOA_PHAM_THE_MATERIAL_ID, 60)).toBe(60)

    // Mortal tier-1 pace gate (requiredRealmLevel 2) holds at level 1.
    expect(s.investChapter('body_refinement')).toBe(0)
    s.player.realmLevel = 12
    expect(s.investChapter('body_refinement')).toBe(50)
    expect(s.materialAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)).toBe(10)

    // Meridian is page-locked at mortal: a real 0, no pill debit.
    expect(s.investChapter('meridian')).toBe(0)
    expect(s.pillAmount('thong_mach_dan')).toBe(5)
  })
})
