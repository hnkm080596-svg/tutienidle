/**
 * BETA SCOPE LOCK v2 Phase-5 - pins the sec.11-sec.15 domain-level gates
 * and the new read-models against the REAL flag table (BETA_FEATURES all
 * false in beta). Every gate fails closed on a DIRECT domain call, so a
 * caller bypassing the frontend never reaches dormant behavior:
 *
 *   sec.11 equipment - wash/refine mutating + preview entry points all
 *                      reject 'scope_hidden'; decompose freezes at every
 *                      public seam while persisted settings round-trip;
 *   sec.12 alchemy   - dormant families cannot startJob or preview; the
 *                      canonical read-model only carries beta families;
 *   sec.13 workforce - manual assignment is off; the Worker Lodge
 *                      read-model resolves tab verdicts itself;
 *   sec.14 domains   - companion/formation/artifact acquisition and
 *                      mutation seams are closed; the hidden-beast kill
 *                      counter freezes (no hidden_window_opened cue);
 *   sec.15 quests    - daily cadence is gone from the data, no enabled
 *                      enemy-specific target is off the beta roster.
 *
 * Enabled-path coverage of the dormant systems lives in their own
 * suites under a scope-authority mock - this file must NEVER mock
 * betaScope (its assertions ARE the real beta state).
 */
import { describe, expect, it } from 'vitest'
import { GameManager } from '@/core/game/GameManager'
import { createDefaultPlayer, type PlayerData } from '@/core/player/Player'
import { isCompanionDomainUnlocked } from '@/core/companion/CompanionAvailability'
import { isArtifactDomainUnlocked } from '@/core/artifact/ArtifactProgression'
import {
  commitFormationLoadout,
  isFormationUnlocked,
} from '@/core/game/FormationPlacement'
import { issueCompanionGifts } from '@/core/companion/CompanionGifts'
import { HiddenBeastSystem } from '@/core/game/HiddenBeastSystem'
import { hiddenBeastChannels } from '@/data/drop/HiddenMaterialChannels'
import { ENEMIES } from '@/data/enemy/Enemies'
import { HIDDEN_BEASTS } from '@/data/enemy/HiddenBeasts'
import { QUESTS } from '@/data/quest/quests'
import { alchemyRecipes } from '@/data/alchemy/alchemyRecipes'
import type { AlchemyRecipe } from '@/core/alchemy/AlchemySystem'
import {
  BETA_ENABLED_RECIPE_FAMILIES,
  BETA_EQUIPMENT_TABS,
  BETA_WORKER_LODGE_TABS,
  betaRecipeFamilyOfId,
  isBetaEnemyId,
  isBetaQuestEnabled,
} from '@/core/betaScope'
import type { Quest } from '@/core/quest/Quest'

function foundationPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'foundation_establishment'
  player.realmLevel = 1
  return player
}

const BETA_RECIPE: AlchemyRecipe = alchemyRecipes.find(
  (recipe) => recipe.id === 'alchemy_tu_linh_dan_qi_refining',
)!
const DORMANT_RECIPE: AlchemyRecipe = alchemyRecipes.find(
  (recipe) => recipe.id === 'alchemy_phi_van_dan_qi_refining',
)!

describe('sec.11 equipment hall - wash/refine/ore-decompose fail closed at domain level', () => {
  it('wash entry points all reject scope_hidden on a direct call', () => {
    const gm = new GameManager()

    expect(
      gm.equipmentSystem.washAffixes(
        'instance-1',
        gm.equipmentBag,
        gm.equipmentRegistry,
        gm.materialBag,
        gm.equipmentSlotManager,
        gm.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'scope_hidden' })

    expect(
      gm.equipmentSystem.previewWashAffixes(
        'instance-1',
        gm.equipmentBag,
        gm.equipmentRegistry,
        gm.materialBag,
        gm.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'scope_hidden' })

    expect(
      gm.equipmentSystem.commitWashAffixes(
        'instance-1',
        'ticket-1',
        gm.equipmentBag,
        gm.equipmentSlotManager,
        gm.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'scope_hidden' })

    // Query side fails closed too - a lingering pre-flag ticket never
    // renders through the domain API.
    expect(gm.equipmentSystem.getWashPreviewAffixes('ticket-1')).toBeUndefined()
  })

  it('refine entry points all reject scope_hidden on a direct call', () => {
    const gm = new GameManager()

    expect(
      gm.equipmentSystem.refineAffixValues(
        'instance-1',
        [],
        gm.equipmentBag,
        gm.equipmentRegistry,
        gm.materialBag,
        gm.equipmentSlotManager,
        gm.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'scope_hidden' })

    expect(
      gm.equipmentSystem.previewRefineValues(
        'instance-1',
        [],
        gm.equipmentBag,
        gm.equipmentRegistry,
        gm.materialBag,
        gm.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'scope_hidden' })

    expect(
      gm.equipmentSystem.commitRefineValues(
        'instance-1',
        [],
        gm.equipmentBag,
        gm.equipmentSlotManager,
        gm.affixRegistry,
      ),
    ).toEqual({ ok: false, reason: 'scope_hidden' })
  })

  it('the beta equipment surface stays exactly Enhance + Dissolve', () => {
    expect(BETA_EQUIPMENT_TABS).toEqual(['enhance', 'dissolve'])

    // Positive control: enhance reaches its normal validation (missing
    // instance), never the scope gate.
    const gm = new GameManager()
    const result = gm.equipmentSystem.enhance(
      'weapon',
      'mortal',
      gm.equipmentBag,
      gm.equipmentRegistry,
      gm.materialBag,
      gm.equipmentSlotManager,
      gm.affixRegistry,
    )
    expect(result.ok).toBe(false)
    expect(result.reason).not.toBe('scope_hidden')
  })

  it('ore decompose freezes at every seam while raw settings persist', () => {
    const gm = new GameManager()
    gm.decomposeSystem.updateCapacity(5)

    // A stale save restoring workers must round-trip verbatim even
    // though consumers see the domain as emptied.
    gm.decomposeSystem.restore({
      settings: { workers: 3, gradeFilter: 'all', ageFilter: 'all' },
      nextCycleAt: 0,
      started: true,
    })
    expect(gm.decomposeSystem.getSaveState().settings.workers).toBe(3)
    expect(gm.decomposeSystem.getSettings().workers).toBe(0)

    // setSetting is a no-op under the gate; the saved shape stays put.
    gm.decomposeSystem.setSetting({ workers: 4 })
    expect(gm.decomposeSystem.getSaveState().settings.workers).toBe(3)
    expect(gm.decomposeSystem.getSettings().workers).toBe(0)

    expect(gm.decomposeSystem.listMatchingOres()).toEqual([])
    expect(gm.decomposeSystem.settleOffline(1_000_000, 60_000)).toBe(0)
  })
})

describe('sec.12 alchemy - dormant families stay unreachable and off the read-model', () => {
  function managerWithRecipes(): GameManager {
    const gm = new GameManager()
    gm.catalogOps.registerAlchemyRecipes(alchemyRecipes)
    return gm
  }

  it('startJob fails closed on dormant families - direct API bypass', () => {
    const gm = new GameManager()

    expect(
      gm.alchemySystem.startJob(
        DORMANT_RECIPE,
        DORMANT_RECIPE.herbVariants[0]!.materialId,
        gm.materialBag,
        gm.materialRegistry,
        0,
        1,
        0,
        4,
      ),
    ).toEqual({ ok: false, reason: 'scope_hidden' })

    // Positive control: a beta family reaches normal validation (the
    // missing herb/materials rejection, not the scope gate).
    const betaResult = gm.alchemySystem.startJob(
      BETA_RECIPE,
      BETA_RECIPE.herbVariants[0]!.materialId,
      gm.materialBag,
      gm.materialRegistry,
      0,
      1,
      0,
      4,
    )
    expect(betaResult.ok).toBe(false)
    expect(betaResult.reason).not.toBe('scope_hidden')
  })

  it('the ops path and the preview query carry the same gate', () => {
    const gm = managerWithRecipes()
    const player = foundationPlayer()

    expect(
      gm.alchemyOps.startAlchemyJob(DORMANT_RECIPE.id, DORMANT_RECIPE.herbVariants[0]!.materialId, player),
    ).toEqual({ ok: false, reason: 'scope_hidden' })

    expect(
      gm.alchemyOps.previewAlchemyOutcome(
        DORMANT_RECIPE.id,
        DORMANT_RECIPE.herbVariants[0]!.materialId,
        1,
        player,
      ),
    ).toBeNull()
  })

  it('getBetaAlchemyRecipeModels returns only beta families with sufficiency fields', () => {
    const gm = managerWithRecipes()
    const player = foundationPlayer()

    const model = gm.alchemyOps.getBetaAlchemyRecipeModels(player)

    expect(model.recipes.length).toBeGreaterThan(0)
    for (const recipe of model.recipes) {
      expect(BETA_ENABLED_RECIPE_FAMILIES.has(recipe.familyId)).toBe(true)
      for (const variant of recipe.variants) {
        // sufficiency is derived per variant - no frontend recomputation.
        expect(variant.sufficient).toBe(
          variant.herbOwned >= variant.herbAmount &&
            variant.fuelWoodOwned >= variant.fuelWoodAmount,
        )
      }
    }

    // The dormant families must not appear at all.
    const dormantIds = alchemyRecipes
      .filter((recipe) => betaRecipeFamilyOfId(recipe.id) === null)
      .map((recipe) => recipe.id)
    expect(dormantIds.length).toBeGreaterThan(0)
    for (const recipe of model.recipes) {
      expect(dormantIds).not.toContain(recipe.recipeId)
    }
  })
})

describe('sec.13 workforce - automatic allocation is the only beta path', () => {
  it('manual worker assignment fails closed at the domain level', () => {
    const gm = new GameManager()
    expect(gm.productionSystem.setWorkerAssignment('thanh_van_lam', 2, 5)).toBe(false)
    expect(gm.productionSystem.setWorkerAssignment('thanh_van_lam', undefined, 5)).toBe(false)
  })

  it('worker lodge read-model resolves tab verdicts without companion-domain logic', () => {
    const gm = new GameManager()
    const surface = gm.buildingOps.getWorkerLodgeSurfaceModel()

    expect(surface.tabs.map((tab) => tab.id)).toEqual([...BETA_WORKER_LODGE_TABS])

    const workforce = surface.tabs.find((tab) => tab.id === 'nhan_cong')
    expect(workforce?.verdict).toBe('available')
    // Manual assignment itself is scope-hidden; the site runs
    // automatic allocation.
    expect(workforce?.manualAssignOffered).toBe(false)

    for (const tab of surface.tabs.filter((entry) => entry.id !== 'nhan_cong')) {
      expect(tab.verdict).toBe('scope-hidden')
    }
  })
})

describe('sec.14 companion/formation/artifact - all faucets shut', () => {
  it('domain unlock predicates fail closed even at open realms', () => {
    expect(isCompanionDomainUnlocked('foundation_establishment')).toBe(false)
    expect(isCompanionDomainUnlocked('golden_core')).toBe(false)
    expect(isFormationUnlocked('foundation_establishment')).toBe(false)
    expect(isFormationUnlocked('golden_core')).toBe(false)
    expect(isArtifactDomainUnlocked('golden_core')).toBe(false)
    expect(isArtifactDomainUnlocked('nascent_soul')).toBe(false)
  })

  it('companion acquisition paths reject or emit nothing', () => {
    const gm = new GameManager()
    const player = foundationPlayer()
    gm.setActivePlayer(player)

    // Mailbox gifts: trigger fires append no record.
    const giftsBefore = player.companionGifts?.length ?? 0
    expect(
      issueCompanionGifts(player, { kind: 'realm_entered', realmId: 'foundation_establishment' }),
    ).toEqual([])
    expect(player.companionGifts?.length ?? 0).toBe(giftsBefore)

    // Mutation seams stay closed: formation loadout commit rejects
    // through the domain predicate.
    expect(
      commitFormationLoadout(player, { formationId: 'test_formation', assignments: [] }),
    ).toBe(false)
  })

  it('hidden-beast kill counting freezes - no cue can fire, records untouched', () => {
    const player = foundationPlayer()
    player.hiddenBeastKills = { chan_qi: 4 }
    const enemyById = (id: string) => [...ENEMIES, ...HIDDEN_BEASTS].find((e) => e.id === id)
    const system = new HiddenBeastSystem({
      getEnemyTemplate: enemyById,
      channels: hiddenBeastChannels(),
    })

    const channel = hiddenBeastChannels()[0]!
    const opened = system.onEnemyDefeated(
      player,
      channel.enemyId,
      channel.bandRealmId,
    )
    expect(opened).toEqual([])
    expect(player.hiddenBeastKills['chan_qi']).toBe(4)

    // The substitution funnel itself stays mechanically live (Phase-4
    // contract): a primed window + winning roll still resolves the
    // beast template - the stage roster is what keeps it off stages.
    for (const c of hiddenBeastChannels()) {
      player.hiddenBeastKills[c.id] = c.killThreshold
    }
    expect(system.maybeReplaceSpawn(player, 'qi_refining', () => 0)?.id).toBe('huyet_mong')
  })
})

describe('sec.15 quest lifecycle - daily gone, targets stay completable', () => {
  it('no daily-cadence quest remains in the authored set', () => {
    expect(QUESTS.filter((quest) => quest.cadence === 'daily')).toEqual([])
    for (const removed of [
      'daily_collect_hoi_xuan_thao',
      'daily_kill_bandit_15',
      'daily_chieu_hien_lenh',
    ]) {
      expect(QUESTS.map((quest) => quest.id)).not.toContain(removed)
    }
  })

  it('quest authority: daily and off-roster kill quests are not beta-enabled', () => {
    const daily: Pick<Quest, 'cadence' | 'condition'> = {
      cadence: 'daily',
      condition: { kind: 'kill', enemyId: 'wild_wolf', amount: 1 },
    }
    expect(isBetaQuestEnabled(daily)).toBe(false)

    const offRoster: Pick<Quest, 'cadence' | 'condition'> = {
      cadence: 'once',
      condition: { kind: 'kill', enemyId: 'bandit', amount: 1 },
    }
    expect(isBetaQuestEnabled(offRoster)).toBe(false)
    expect(isBetaEnemyId('bandit')).toBe(false)

    const rosterKill: Pick<Quest, 'cadence' | 'condition'> = {
      cadence: 'once',
      condition: { kind: 'kill', enemyId: 'wild_wolf', amount: 1 },
    }
    expect(isBetaQuestEnabled(rosterKill)).toBe(true)

    const genericKill: Pick<Quest, 'cadence' | 'condition'> = {
      cadence: 'once',
      condition: { kind: 'kill', amount: 1 },
    }
    expect(isBetaQuestEnabled(genericKill)).toBe(true)

    const collect: Pick<Quest, 'cadence' | 'condition'> = {
      cadence: 'once',
      condition: { kind: 'collect', materialId: 'qi_refining_ore_decade', amount: 1 },
    }
    expect(isBetaQuestEnabled(collect)).toBe(true)
  })

  it('every enabled enemy-specific target is a beta roster enemy', () => {
    for (const quest of QUESTS) {
      if (!isBetaQuestEnabled(quest)) continue
      if (quest.condition.kind !== 'kill' || quest.condition.enemyId === undefined) continue
      expect(
        isBetaEnemyId(quest.condition.enemyId),
        `${quest.id} targets off-roster enemy ${quest.condition.enemyId}`,
      ).toBe(true)
    }
  })
})
