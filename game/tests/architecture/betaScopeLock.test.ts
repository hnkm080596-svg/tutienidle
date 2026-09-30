/**
 * BETA-SCOPE-LOCK pins (2026-09-30) - the 1-month beta build ships Phap
 * Tu + supporting systems only. These pins keep the reduction honest:
 *
 *   - the lock LIST itself (drift guard - a way added to the union but
 *     not to the lock set, or a flag flipped by accident, fails here),
 *   - offer/commit authority: a fresh mortal sees exactly
 *     {spell_pathway}; hidden ways stay unoffered even with precursor
 *     levels met; applyPathChoice refuses a locked way but commits the
 *     open one,
 *   - hidden content: lineage stays closed, discovery/trial/diversion/
 *     Chu Thien never engage, lineage closure is SUSPENDED (not burned)
 *     so re-enable works, beasts never substitute, kill tracking stays
 *     frozen,
 *   - companion content: gameplay gate closed at every realm while the
 *     domain realm-gate itself is untouched, gift issuance writes no
 *     records, new companion deployments refuse while solo 'player'
 *     commits and already-persisted loadouts keep resolving,
 *   - Tran Phap access lock: the wheel slot reports the release-
 *     unavailable reason while formation machinery stays ungated.
 */
import { describe, expect, it, vi } from 'vitest'

// The global test setup mocks betaScope to its ENABLED shape so
// mechanism suites keep pinning post-beta behavior; this file owns the
// LOCKED-state pins, so it restores the real flag module for its whole
// import graph.
vi.unmock('@/core/betaScope')
import {
  BETA_COMPANION_CONTENT_ENABLED,
  BETA_FORMATION_PANEL_ENABLED,
  BETA_HIDDEN_CONTENT_ENABLED,
  BETA_SCOPE_LOCKED_PATHWAYS,
  BETA_SCOPE_LOCKED_REASON,
} from '@/core/betaScope'
import {
  CULTIVATION_PATH_MODULES,
  isCultivationPathOffered,
} from '@/core/player/CultivationPathKit'
import {
  applyPathChoice,
  listOfferableWays,
} from '@/core/player/CultivationPathSystem'
import { createDefaultPlayer } from '@/core/player/Player'
import {
  canProgressHiddenBody,
  closeHiddenLineage,
  discoverHiddenRealm,
  getRealmHiddenState,
  isHiddenBreakthroughEligible,
  isHiddenLineageOpen,
  recordHiddenBreakthrough,
  resolveBreakthroughType,
} from '@/core/realm/hidden/HiddenLineage'
import { isNghichChuTianRevealed } from '@/core/realm/hidden/NghichChuTian'
import { HiddenBeastSystem } from '@/core/game/HiddenBeastSystem'
import {
  isCompanionDomainUnlocked,
  isCompanionGameplayUnlocked,
} from '@/core/companion/CompanionAvailability'
import { issueCompanionGifts } from '@/core/companion/CompanionGifts'
import {
  commitFormationLoadout,
  isFormationUnlocked,
  resolvePartyFormation,
} from '@/core/game/FormationPlacement'
import {
  COMMAND_WHEEL_SLOTS,
  RELEASE_UNAVAILABLE_REASON,
  type CommandWheelDisabledContext,
} from '@/data/ui/commandWheelCatalog'

function wheelContext(over: Partial<CommandWheelDisabledContext> = {}): CommandWheelDisabledContext {
  return {
    artifactDomainUnlocked: true,
    artifactUnlockRealmAvailable: true,
    hasArtifactDefinition: true,
    companionDomainUnlocked: true,
    formationUnlocked: true,
    // Beta defaults: scope-locked.
    companionContentEnabled: false,
    formationPanelEnabled: false,
    realmReleaseUnavailable: false,
    ...over,
  }
}

describe('beta scope lock - flag contract', () => {
  it('locks exactly the five non-spell ways (drift guard)', () => {
    expect([...BETA_SCOPE_LOCKED_PATHWAYS].sort()).toEqual([
      'body_pathway',
      'hidden_body_pathway',
      'hidden_spell_pathway',
      'hidden_sword_pathway',
      'sword_pathway',
    ])
    // The one open way is never in the lock set.
    expect(BETA_SCOPE_LOCKED_PATHWAYS.has('spell_pathway')).toBe(false)
  })

  it('ships all scope flags off', () => {
    expect(BETA_HIDDEN_CONTENT_ENABLED).toBe(false)
    expect(BETA_COMPANION_CONTENT_ENABLED).toBe(false)
    expect(BETA_FORMATION_PANEL_ENABLED).toBe(false)
  })

  it('keeps the locked label identical to the wheel release reason', () => {
    expect(BETA_SCOPE_LOCKED_REASON).toBe(RELEASE_UNAVAILABLE_REASON)
  })
})

describe('beta scope lock - pathway offers', () => {
  it('offers exactly spell_pathway to a fresh mortal', () => {
    const player = createDefaultPlayer()
    const eligible = listOfferableWays(player)
      .filter((offer) => offer.eligible)
      .map((offer) => offer.wayId)

    expect(eligible).toEqual(['spell_pathway'])
  })

  it('never offers hidden ways even with every precursor met', () => {
    const player = createDefaultPlayer()
    // huy_quyen Lv3 + tram Lv3 core levels and linh_bao cast Lv3 - the
    // three authored offer gates fully satisfied.
    player.nodeLevels['core_tram'] = 3
    player.nodeLevels['core_huy_quyen'] = 3
    player.skillCastCounts = { linh_bao: 10000 }

    const allWays = Object.values(CULTIVATION_PATH_MODULES).flatMap((pathModule) =>
      Object.values(pathModule.ways),
    )
    const hiddenWays = allWays.filter((way) => way.id.startsWith('hidden_'))
    expect(hiddenWays).toHaveLength(3)

    for (const way of hiddenWays) {
      expect(isCultivationPathOffered(way, player)).toBe(false)
    }

    expect(
      listOfferableWays(player)
        .filter((offer) => offer.eligible)
        .map((offer) => offer.wayId),
    ).toEqual(['spell_pathway'])
  })

  it('marks locked offers with the scope reason and leaves spell free of one', () => {
    const player = createDefaultPlayer()

    for (const offer of listOfferableWays(player)) {
      if (offer.wayId === 'spell_pathway') {
        expect(offer.eligible).toBe(true)
        expect(offer.reason).toBeUndefined()
      } else {
        expect(offer.eligible).toBe(false)
        expect(offer.reason).toBe(BETA_SCOPE_LOCKED_REASON)
      }
    }
  })

  it('refuses a locked way at the ritual commit but commits spell', () => {
    const locked = createDefaultPlayer()
    expect(applyPathChoice(locked, 'sword', 'sword_pathway').ok).toBe(false)
    expect(applyPathChoice(locked, 'body', 'body_pathway').ok).toBe(false)
    expect(locked.cultivationPath ?? null).toBeNull()
    expect(locked.cultivationWay ?? null).toBeNull()

    const open = createDefaultPlayer()
    expect(applyPathChoice(open, 'spell', 'spell_pathway').ok).toBe(true)
    expect(open.cultivationPath).toBe('spell')
    expect(open.cultivationWay).toBe('spell_pathway')
  })
})

describe('beta scope lock - hidden content', () => {
  it('keeps the lineage closed and writes no discovery state', () => {
    const player = createDefaultPlayer()

    expect(isHiddenLineageOpen(player)).toBe(false)
    expect(canProgressHiddenBody(player, 'mortal')).toBe(false)
    expect(discoverHiddenRealm(player, 'mortal')).toBeUndefined()
    expect(getRealmHiddenState(player, 'mortal')).toBeUndefined()
  })

  it('suspends lineage closure instead of burning it (re-enable safe)', () => {
    const player = createDefaultPlayer()

    // A beta-era normal breakthrough calls closeHiddenLineage; the flag
    // turns it into a no-op so the open lineage survives for post-beta.
    closeHiddenLineage(player, 'mortal')

    expect(player.hiddenPerfection.lineageActive).toBe(true)
    expect(player.hiddenPerfection.lineageClosedByRealmId).toBeUndefined()
  })

  it('never resolves or records a hidden breakthrough', () => {
    const player = createDefaultPlayer()
    player.realmLevel = 18

    expect(isHiddenBreakthroughEligible(player)).toBe(false)
    expect(resolveBreakthroughType(player)).toBe('normal')

    // The write guard is defensive too: even a direct call refuses.
    player.realmId = 'qi_refining'
    expect(recordHiddenBreakthrough(player, 'qi_refining')).toBe(false)
    expect(player.hiddenPerfection.hiddenBreakthroughRealmIds).toEqual([])
  })

  it('hides an already-discovered Nghich Chu Thien record while locked', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.hiddenPerfection.realms['foundation_establishment'] = {
      discovered: true,
      bodyCompleted: false,
      frozen: false,
    }

    expect(isNghichChuTianRevealed(player)).toBe(false)
    // The record itself is untouched - it re-reveals on flag flip.
    expect(player.hiddenPerfection.realms['foundation_establishment'].discovered).toBe(true)
  })

  it('never substitutes hidden beasts and never counts banded kills', () => {
    const player = createDefaultPlayer()
    const system = new HiddenBeastSystem({
      getEnemyTemplate: () => undefined,
      channels: [
        {
          kind: 'hidden_beast',
          id: 'test_channel',
          enemyId: 'test_beast',
          bandRealmId: 'mortal',
          killThreshold: 3,
          spawnChancePerSpawn: 1,
        },
      ],
    })

    expect(system.maybeReplaceSpawn(player, 'mortal', () => 0)).toBeUndefined()
    expect(system.onEnemyDefeated(player, 'some_enemy', 'mortal')).toEqual([])
    expect(player.hiddenBeastKills).toEqual({})
  })
})

describe('beta scope lock - companion content', () => {
  it('keeps the domain realm gate but closes gameplay at every realm', () => {
    expect(isCompanionDomainUnlocked('foundation_establishment')).toBe(true)
    expect(isCompanionGameplayUnlocked('foundation_establishment')).toBe(false)
    expect(isCompanionGameplayUnlocked('mortal')).toBe(false)
    expect(isCompanionGameplayUnlocked('qi_refining')).toBe(false)
  })

  it('issues no gift records while locked', () => {
    const player = createDefaultPlayer()

    const issued = issueCompanionGifts(player, {
      kind: 'realm_entered',
      realmId: 'foundation_establishment',
    })

    expect(issued).toEqual([])
    expect(player.companionGifts).toEqual([])
  })

  function foundationPlayerWithCompanion() {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.companions.push({
      instanceId: 'c1',
      definitionId: 'ho_ly_tinh',
      realmId: 'mortal',
      realmLevel: 1,
      exp: 0,
      constellationRank: 0,
    })
    return player
  }

  it('refuses new companion deployments but keeps solo commits legal', () => {
    const player = foundationPlayerWithCompanion()
    expect(isFormationUnlocked(player.realmId)).toBe(true)

    expect(
      commitFormationLoadout(player, {
        formationId: 'luong_nghi_tran',
        assignments: [{ row: 1, column: 0, combatantId: 'ho_ly_tinh' }],
      }),
    ).toBe(false)
    expect(player.formationLoadout).toBeNull()

    expect(
      commitFormationLoadout(player, {
        formationId: 'doc_hanh_tran',
        assignments: [{ row: 1, column: 2, combatantId: 'player' }],
      }),
    ).toBe(true)
  })

  it('still resolves an already-persisted companion loadout (machinery untouched)', () => {
    const player = foundationPlayerWithCompanion()
    player.formationLoadout = {
      formationId: 'luong_nghi_tran',
      assignments: [
        { row: 1, column: 0, combatantId: 'ho_ly_tinh' },
        { row: 1, column: 2, combatantId: 'player' },
      ],
    }

    const slots = resolvePartyFormation(player)
    expect(slots).toHaveLength(2)
    expect(slots.map((slot) => slot.combatantId).sort()).toEqual(['ho_ly_tinh', 'player'])
  })
})

describe('beta scope lock - wheel access', () => {
  function slot(id: string) {
    const found = COMMAND_WHEEL_SLOTS.find((entry) => entry.id === id)
    expect(found).toBeDefined()
    return found!
  }

  it('locks the Tran Phap slot at access only', () => {
    const reason = slot('formation_slot').disabledReason!(wheelContext())
    expect(reason).toBe(RELEASE_UNAVAILABLE_REASON)

    // Machinery untouched: formation unlock itself still resolves.
    expect(isFormationUnlocked('foundation_establishment')).toBe(true)

    // Flag flipped (post-beta shape): an unlocked realm opens the slot.
    expect(
      slot('formation_slot').disabledReason!(
        wheelContext({ formationPanelEnabled: true }),
      ),
    ).toBeNull()
  })

  it('locks the companion roster slot while gameplay is off', () => {
    const reason = slot('companion_roster').disabledReason!(wheelContext())
    expect(reason).toBe(RELEASE_UNAVAILABLE_REASON)

    expect(
      slot('companion_roster').disabledReason!(
        wheelContext({ companionContentEnabled: true }),
      ),
    ).toBeNull()
  })
})
