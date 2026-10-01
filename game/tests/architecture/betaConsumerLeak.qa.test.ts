/**
 * QA FIXPOINT probe (run qa-fixpoint-master) - consumer-seam leak pins
 * from clean-round B7. Two defects, one root class: dormant records
 * were trusted at a live decision/write surface without re-deriving
 * the scope verdict.
 *
 * F-B7-1: the mandatory breakthrough-talent modal offered owned DORMANT
 * talents (golden_core pool, multi-level) as UPGRADE cards - selecting
 * one burned the player's ONE entitlement result on an inert talent,
 * and a dormant-only upgrade list held an otherwise-empty entitlement
 * actionable. The beta lock must filter upgrade candidates to
 * beta-admitted talent ids at both the offer surface and the
 * resolution guard.
 *
 * F-B7-2: closeHiddenLineage ran on every live NORMAL breakthrough and
 * destructively mutated a carried open lineage (lineageActive ->
 * false, lineageClosedByRealmId written, every non-completed realm
 * record frozen) while every sibling read/write in HiddenLineage.ts
 * was already scope-gated. Under the lock the carried record must stay
 * readable-but-inert - no destructive mutation (the module's own
 * contract).
 *
 * Beta flags are pinned by lockBeta*ForTests() - the suite asserts
 * behavior under the canonical all-false tables.
 */
import { describe, expect, it } from 'vitest'
import { createDefaultPlayer, type PlayerData } from '@/core/player/Player'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '@/core/game/__fixtures__/betaTalentsUnlock'
import { isBetaTalentId } from '@/core/betaScope'
import {
  getUpgradeableTalentIds,
  isTalentEntitlementActionable,
  reconcileTalentEntitlement,
  resolveTalentEntitlement,
} from '@/core/talent/TalentEntitlement'
import {
  closeHiddenLineage,
  recordHiddenBreakthrough,
} from '@/core/realm/hidden/HiddenLineage'
import { getTalentDefinition } from '@/data/talent/Talents'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return { ...createDefaultPlayer(), ...overrides }
}

// Dormant golden_core-pool talent - authored with a second level so it
// is a legal UPGRADE candidate shape, inert at the effect seam.
const DORMANT_TALENT = 'kd_thanh_dan'
// Beta-admitted luyen_khi-pool talent - the live control path.
const BETA_TALENT = 'lk_linh_mach'

describe('F-B7-1 dormant talent offered on the mandatory breakthrough modal', () => {
  it('precondition: dormant golden_core talent is authored with levels but not beta-admitted; beta control is admitted', () => {
    const dormant = getTalentDefinition(DORMANT_TALENT)
    const beta = getTalentDefinition(BETA_TALENT)
    expect(dormant).toBeDefined()
    expect(beta).toBeDefined()
    expect(dormant!.levels!.length).toBeGreaterThan(0)
    expect(beta!.levels!.length).toBeGreaterThan(0)
    expect(isBetaTalentId(DORMANT_TALENT)).toBe(false)
    expect(isBetaTalentId(BETA_TALENT)).toBe(true)
  })

  it('getUpgradeableTalentIds excludes dormant owned talents under the lock', () => {
    const p = player({
      selectedTalentIds: [DORMANT_TALENT, BETA_TALENT],
      talentLevels: { [DORMANT_TALENT]: 1, [BETA_TALENT]: 1 },
    })
    const upgradeable = getUpgradeableTalentIds(p)
    expect(upgradeable).toContain(BETA_TALENT)
    expect(upgradeable).not.toContain(DORMANT_TALENT)
  })

  it('a dormant-only upgrade list never holds an empty-offer entitlement actionable', () => {
    const p = player({
      realmId: 'qi_refining',
      selectedTalentIds: [DORMANT_TALENT],
      talentLevels: { [DORMANT_TALENT]: 1 },
      pendingTalentEntitlement: {
        realmId: 'foundation_establishment',
        offeredTalentIds: [],
      },
    })
    expect(isTalentEntitlementActionable(p)).toBe(false)
    reconcileTalentEntitlement(p)
    expect(p.pendingTalentEntitlement).toBeUndefined()
  })

  it('resolveTalentEntitlement rejects an upgrade decision on a dormant id', () => {
    const p = player({
      selectedTalentIds: [DORMANT_TALENT],
      talentLevels: { [DORMANT_TALENT]: 1 },
      pendingTalentEntitlement: {
        realmId: 'foundation_establishment',
        offeredTalentIds: [],
      },
    })
    expect(
      resolveTalentEntitlement(p, { kind: 'upgrade', talentId: DORMANT_TALENT }),
    ).toBe(false)
    expect(p.talentLevels[DORMANT_TALENT]).toBe(1)
    // A rejected decision must not consume the record either.
    expect(p.pendingTalentEntitlement).toBeDefined()
  })

  it('control: a beta-admitted owned talent still upgrades and drains the entitlement', () => {
    const p = player({
      selectedTalentIds: [BETA_TALENT],
      talentLevels: { [BETA_TALENT]: 1 },
      pendingTalentEntitlement: {
        realmId: 'foundation_establishment',
        offeredTalentIds: [],
      },
    })
    expect(getUpgradeableTalentIds(p)).toContain(BETA_TALENT)
    expect(
      resolveTalentEntitlement(p, { kind: 'upgrade', talentId: BETA_TALENT }),
    ).toBe(true)
    expect(p.talentLevels[BETA_TALENT]).toBe(2)
    expect(p.pendingTalentEntitlement).toBeUndefined()
  })
})

describe('F-B7-2 live normal breakthrough mutates a carried hidden lineage', () => {
  function openLineage() {
    return {
      lineageActive: true,
      completedHiddenBodyRealmIds: [] as string[],
      hiddenBreakthroughRealmIds: [] as string[],
      realms: {
        thai_at_mon: {
          discovered: true,
          bodyCompleted: false,
          frozen: false,
        },
      },
    }
  }

  it('closeHiddenLineage is inert under the beta lock - carried record stays readable-but-inert', () => {
    const p = player({ realmId: 'qi_refining', hiddenPerfection: openLineage() })
    closeHiddenLineage(p, 'qi_refining')
    expect(p.hiddenPerfection!.lineageActive).toBe(true)
    expect(p.hiddenPerfection!.lineageClosedByRealmId).toBeUndefined()
    expect(p.hiddenPerfection!.realms.thai_at_mon!.frozen).toBe(false)
  })

  it('recordHiddenBreakthrough fails closed under the beta lock', () => {
    const p = player({
      realmId: 'golden_core',
      hiddenPerfection: openLineage(),
    })
    expect(recordHiddenBreakthrough(p, 'golden_core')).toBe(false)
    expect(p.hiddenPerfection!.hiddenBreakthroughRealmIds).toEqual([])
    expect(p.hiddenPerfection!.lineageActive).toBe(true)
  })

  it('control: the default open lineage every player carries is left untouched under the lock', () => {
    const p = player({ realmId: 'qi_refining' })
    expect(() => closeHiddenLineage(p, 'qi_refining')).not.toThrow()
    expect(p.hiddenPerfection!.lineageActive).toBe(true)
    expect(p.hiddenPerfection!.lineageClosedByRealmId).toBeUndefined()
    expect(() => recordHiddenBreakthrough(p, 'qi_refining')).not.toThrow()
    expect(p.hiddenPerfection!.hiddenBreakthroughRealmIds).toEqual([])
  })
})
