import { describe, expect, it, vi } from 'vitest'
import {
  isBeyondReleaseCeiling,
  isBreakthroughAcquisitionEnabled,
  isRealmAvailable,
  isRealmTransitionEnabled,
  progressionCeilingRealmId,
} from './ReleasePolicy'
import { isCompanionDomainUnlocked } from '../companion/CompanionAvailability'
import { isFormationUnlocked } from '../game/FormationPlacement'
import {
  isArtifactDomainUnlocked,
  normalizeArtifactProgress,
  createDefaultArtifactProgress,
} from '../artifact/ArtifactProgression'
import { grantCultivationPathRealmReward } from '../player/CultivationPathSystem'
import { TribulationDirector } from '../tribulation/TribulationDirector'
import { GameManager } from '../game/GameManager'
import {
  GameManagerAlchemyOps,
  type GameManagerAlchemyOpsDeps,
} from '../game/GameManagerAlchemyOps'
import type { AlchemyRecipe } from '../alchemy/AlchemySystem'
import { SPECIAL_ALCHEMY_RECIPES, alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import {
  BREAKTHROUGH_SCOPED_MATERIAL_IDS,
  BREAKTHROUGH_SCOPED_PILL_IDS,
  BREAKTHROUGH_SCOPED_RECIPE_IDS,
  TRUC_CO_DAN_PILL_ID,
} from '../../data/breakthrough/BreakthroughScopedResources'
import {
  COMMAND_WHEEL_SLOTS,
  type CommandWheelDisabledContext,
} from '../../data/ui/commandWheelCatalog'
import { QuestSystem } from '../quest/QuestSystem'
import { QuestRegistry } from '../quest/QuestRegistry'
import { QuestManager } from '../quest/QuestManager'
import type { Quest } from '../quest/Quest'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { PillRegistry } from '../pill/PillRegistry'
import { PillBag } from '../pill/PillBag'
import { RewardSystem, type RewardReceiver } from '../reward/RewardSystem'
import { EventBus } from '../events/EventBus'
import { QI_REFINING_BREAKTHROUGH_STAGE_ID, getRealmIndex } from './realmSystem'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { createBaseStats, type Stats } from '../stats/StatBlock'
import { createLootTestSetup } from '../game/battleLootTestSetup'
import { REALMS } from '../../data/realms/realm'
import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'

// Fake chapter PRESENCE for every target realm so a start() rejection in
// this file can only come from release policy - never from missing
// chapter data. Other module exports (grade difficulty tables, ...) keep
// their real implementations.
vi.mock('../../data/tribulation/TribulationChapters', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../data/tribulation/TribulationChapters')>()
  return {
    ...actual,
    getTribulationChapters: () => [
      {
        kind: 'mind',
        name: 'Policy Test Chapter',
        description: '',
        mind: {
          questionCount: 1,
          firstQuestionSeconds: 5,
          lastQuestionSeconds: 5,
          restSecondsBetweenQuestions: 0,
        },
      },
    ],
  }
})

function tribulationDirector() {
  return new TribulationDirector({ eventBus: new EventBus() })
}

function testStats(): Stats {
  return createBaseStats({ maxHp: 5000, defense: 0 }) as Stats
}

function spellPlayer(realmId: string): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'spell'
  player.cultivationWay = 'spell_pathway'
  player.realmId = realmId
  return player
}

describe('ReleasePolicy - predicate matrix (Beta ceiling = Truc Co)', () => {
  it('pins the Beta ceiling at foundation_establishment below golden_core', () => {
    expect(progressionCeilingRealmId).toBe('foundation_establishment')
    const order = REALMS.map((realm) => realm.id)
    expect(order.indexOf('foundation_establishment')).toBeLessThan(
      order.indexOf('golden_core'),
    )
  })

  it('isRealmAvailable: realms at/below the ceiling are playable, above are not', () => {
    expect(isRealmAvailable('mortal')).toBe(true)
    expect(isRealmAvailable('qi_refining')).toBe(true)
    expect(isRealmAvailable('foundation_establishment')).toBe(true)
    expect(isRealmAvailable('golden_core')).toBe(false)
    expect(isRealmAvailable('nascent_soul')).toBe(false)
    expect(isRealmAvailable('tribulation')).toBe(false)
    // Unknown ids fail closed.
    expect(isRealmAvailable('not_a_realm')).toBe(false)
  })

  it('isBeyondReleaseCeiling: only authored realms above the ceiling report dormant', () => {
    expect(isBeyondReleaseCeiling('golden_core')).toBe(true)
    expect(isBeyondReleaseCeiling('nascent_soul')).toBe(true)
    expect(isBeyondReleaseCeiling('tribulation')).toBe(true)
    expect(isBeyondReleaseCeiling('foundation_establishment')).toBe(false)
    expect(isBeyondReleaseCeiling('mortal')).toBe(false)
    // Unknown ids are unavailable, not "beyond".
    expect(isBeyondReleaseCeiling('not_a_realm')).toBe(false)
  })

  it('isRealmTransitionEnabled: adjacent forward into an available realm only', () => {
    expect(isRealmTransitionEnabled('mortal', 'qi_refining')).toBe(true)
    expect(isRealmTransitionEnabled('qi_refining', 'foundation_establishment')).toBe(true)
    // The ruled suppression: TC -> KD is closed while data stays authored.
    expect(isRealmTransitionEnabled('foundation_establishment', 'golden_core')).toBe(false)
    expect(isRealmTransitionEnabled('golden_core', 'nascent_soul')).toBe(false)
    // C2C-12 adjacency: skip-ahead is rejected even when BOTH endpoints
    // are in-window (mortal -> Truc Co can never be admitted at the
    // funnel), plus backward / self / unknown endpoints as before.
    expect(isRealmTransitionEnabled('mortal', 'foundation_establishment')).toBe(false)
    expect(isRealmTransitionEnabled('mortal', 'golden_core')).toBe(false)
    expect(isRealmTransitionEnabled('qi_refining', 'golden_core')).toBe(false)
    expect(isRealmTransitionEnabled('qi_refining', 'mortal')).toBe(false)
    expect(isRealmTransitionEnabled('mortal', 'mortal')).toBe(false)
    expect(isRealmTransitionEnabled('not_a_realm', 'mortal')).toBe(false)
    expect(isRealmTransitionEnabled('mortal', 'not_a_realm')).toBe(false)
  })

  it('isBreakthroughAcquisitionEnabled: KD-scoped acquisition suppressed, untagged never suppressed', () => {
    expect(isBreakthroughAcquisitionEnabled('foundation_establishment')).toBe(true)
    expect(isBreakthroughAcquisitionEnabled('golden_core')).toBe(false)
    expect(isBreakthroughAcquisitionEnabled('nascent_soul')).toBe(false)
    expect(isBreakthroughAcquisitionEnabled('not_a_realm')).toBe(false)
    expect(isBreakthroughAcquisitionEnabled(undefined)).toBe(true)
    expect(isBreakthroughAcquisitionEnabled()).toBe(true)
  })

  it('C2C-12 drift guard: the acquisition gate IS the predecessor->target transition', () => {
    // For every authored realm with a predecessor, the resource gate
    // must equal the canonical adjacent transition into it - the two
    // gates can never drift apart.
    for (let i = 1; i < REALMS.length; i++) {
      const target = REALMS[i]!
      const predecessor = REALMS[i - 1]!
      expect(
        isBreakthroughAcquisitionEnabled(target.id),
        `${predecessor.id} -> ${target.id}`,
      ).toBe(isRealmTransitionEnabled(predecessor.id, target.id))
    }
    // Index-0 (mortal) has no breakthrough INTO it: degrades to availability.
    expect(isBreakthroughAcquisitionEnabled('mortal')).toBe(isRealmAvailable('mortal'))
  })
})

describe('ReleasePolicy - migrated gates consult the authority', () => {
  it('getBreakthroughRequirements/canTriggerBreakthrough: open transitions report rows, closed report none', () => {
    const gameManager = new GameManager()

    const mortal = createDefaultPlayer()
    mortal.realmId = 'mortal'
    mortal.realmLevel = 12
    expect(gameManager.realmAdvanceOps.getBreakthroughRequirements(mortal)).toEqual([
      { key: 'level', met: true },
    ])
    expect(gameManager.realmAdvanceOps.canTriggerBreakthrough(mortal)).toBe(true)

    const qiRefining = createDefaultPlayer()
    qiRefining.realmId = 'qi_refining'
    qiRefining.realmLevel = 12
    qiRefining.completedStageIds = [QI_REFINING_BREAKTHROUGH_STAGE_ID]
    expect(
      gameManager.realmAdvanceOps.canTriggerBreakthrough(qiRefining),
    ).toBe(true)

    // The ruled suppression: a max-level Truc Co player sees NO path into
    // Kim Dan - the transition is disabled by policy, not by missing data.
    const foundation = createDefaultPlayer()
    foundation.realmId = 'foundation_establishment'
    foundation.realmLevel = 18
    expect(gameManager.realmAdvanceOps.getBreakthroughRequirements(foundation)).toEqual([])
    expect(gameManager.realmAdvanceOps.canTriggerBreakthrough(foundation)).toBe(false)

    // A dev save already beyond the ceiling still cannot transition on.
    const kimDan = createDefaultPlayer()
    kimDan.realmId = 'golden_core'
    kimDan.realmLevel = 1
    expect(gameManager.realmAdvanceOps.canTriggerBreakthrough(kimDan)).toBe(false)
  })

  it('TribulationDirector.start rejects a closed transition even when chapters exist', () => {
    // getTribulationChapters is mocked to return chapters for EVERY realm,
    // so a rejection here can only come from the release-policy check.
    const director = tribulationDirector()
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.realmLevel = 18

    expect(director.start(player, testStats(), false, 'golden_core')).toBe(false)
    expect(director.getState()).toBeNull()
  })

  it('TribulationDirector.start admits an open transition (control)', () => {
    const director = tribulationDirector()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 12

    expect(director.start(player, testStats(), false, 'foundation_establishment')).toBe(true)
  })

  it('GameManager.startTribulation: production entry point is policy-gated', () => {
    const gameManager = new GameManager()

    const foundation = createDefaultPlayer()
    foundation.realmId = 'foundation_establishment'
    foundation.realmLevel = 18
    expect(gameManager.startTribulation(foundation, 'golden_core')).toBe(false)

    const qiRefining = createDefaultPlayer()
    qiRefining.realmId = 'qi_refining'
    qiRefining.realmLevel = 12
    expect(gameManager.startTribulation(qiRefining, 'foundation_establishment')).toBe(true)
  })

  it('domain unlock predicates compose the authority - persisted saves beyond the ceiling hide domains', () => {
    expect(isCompanionDomainUnlocked('qi_refining')).toBe(false)
    expect(isCompanionDomainUnlocked('foundation_establishment')).toBe(true)
    // C2C-9 simple rule: no grandfathering - a golden_core save is a save
    // BEYOND the release ceiling, so every domain is hidden for it even
    // though the unlock realm sits in-window.
    expect(isCompanionDomainUnlocked('golden_core')).toBe(false)

    expect(isFormationUnlocked('qi_refining')).toBe(false)
    expect(isFormationUnlocked('foundation_establishment')).toBe(true)
    expect(isFormationUnlocked('golden_core')).toBe(false)

    expect(isArtifactDomainUnlocked('qi_refining')).toBe(false)
    expect(isArtifactDomainUnlocked('foundation_establishment')).toBe(true)
    expect(isArtifactDomainUnlocked('golden_core')).toBe(false)
  })

  it('normalizeArtifactProgress gates AWAKENING but never strips persisted ownership', () => {
    const notAwakened = spellPlayer('qi_refining')
    normalizeArtifactProgress(notAwakened)
    expect(notAwakened.artifact).toBeUndefined()

    const awakened = spellPlayer('foundation_establishment')
    normalizeArtifactProgress(awakened)
    expect(awakened.artifact?.artifactId).toBe('ngu_hanh_chau')

    // C2C-12 boundary: a beyond-ceiling save does NOT awaken (the gate
    // hides the domain), but restore never destroys ownership - a
    // persisted matching artifact survives normalize untouched while
    // isArtifactDomainUnlocked stays false for that realm.
    const beyondCeiling = spellPlayer('golden_core')
    normalizeArtifactProgress(beyondCeiling)
    expect(beyondCeiling.artifact).toBeUndefined()
    expect(isArtifactDomainUnlocked(beyondCeiling.realmId)).toBe(false)

    const persisted = spellPlayer('golden_core')
    persisted.artifact = createDefaultArtifactProgress('ngu_hanh_chau')
    persisted.artifact.experience = 7
    normalizeArtifactProgress(persisted)
    expect(persisted.artifact?.artifactId).toBe('ngu_hanh_chau')
    expect(persisted.artifact?.experience).toBe(7)
  })

  it('grantCultivationPathRealmReward: authored rewards for unreleased realms stay dormant', () => {
    // spell_pathway composes the canonical ladder - every canonical realm
    // (incl. golden_core+) already carries a passiveSkillId record, so a
    // grant attempt reaches the policy check, not a missing-reward miss.
    const player = spellPlayer('golden_core')
    expect(grantCultivationPathRealmReward(player, 'golden_core')).toBe(false)

    const atCeiling = spellPlayer('foundation_establishment')
    expect(grantCultivationPathRealmReward(atCeiling, 'foundation_establishment')).toBe(true)
    expect(atCeiling.artifact?.artifactId).toBe('ngu_hanh_chau')
  })

  it('phap_bao wheel slot reads the artifact domain predicate, not raw realm presence', () => {
    const slot = COMMAND_WHEEL_SLOTS.find((entry) => entry.id === 'phap_bao')
    const context = (overrides: Partial<CommandWheelDisabledContext>) => ({
      artifactDomainUnlocked: false,
      hasArtifactDefinition: true,
      companionDomainUnlocked: false,
      formationUnlocked: false,
      realmReleaseUnavailable: false,
      ...overrides,
    })

    // Below-TC save: progression lock message.
    expect(slot?.disabledReason?.(context({}))).toBe('Cần đạt Trúc Cơ')

    // C2C-12: a beyond-ceiling save gets the release-hidden reason, not
    // the "requires Truc Co" progression lock (the unlock realm is
    // already passed - the domain is unavailable in this build).
    expect(
      slot?.disabledReason?.(context({ realmReleaseUnavailable: true })),
    ).toBe('Chưa mở trong bản hiện tại')

    expect(
      slot?.disabledReason?.(context({ artifactDomainUnlocked: true })),
    ).toBeNull()
  })

  it('combat drop delivery suppresses breakthrough-scoped material/pill for a closed transition', () => {
    const { killEnemy, materialBag, materialRegistry, pillBag } = createLootTestSetup({
      realmId: 'mortal',
      signatureDrops: [
        { kind: 'material', itemId: 'kd_scoped_mat', chance: 1, amount: { min: 1, max: 1 } },
        { kind: 'material', itemId: 'tc_scoped_mat', chance: 1, amount: { min: 1, max: 1 } },
        { kind: 'material', itemId: 'untagged_mat', chance: 1, amount: { min: 1, max: 1 } },
        { kind: 'pill', itemId: 'kd_scoped_pill', chance: 1, amount: { min: 1, max: 1 } },
      ],
      pillTemplates: [
        {
          id: 'kd_scoped_pill',
          name: 'KD Pill',
          grade: 'huyen',
          breakthroughRealmId: 'golden_core',
        },
      ],
    })

    materialRegistry.register({
      id: 'kd_scoped_mat',
      name: 'KD Mat',
      category: 'other',
      sourceType: 'boss',
      breakthroughRealmId: 'golden_core',
    })
    materialRegistry.register({
      id: 'tc_scoped_mat',
      name: 'TC Mat',
      category: 'other',
      sourceType: 'boss',
      breakthroughRealmId: 'foundation_establishment',
    })
    materialRegistry.register({
      id: 'untagged_mat',
      name: 'Untagged Mat',
      category: 'other',
      sourceType: 'boss',
    })

    killEnemy()

    expect(materialBag.getAmount('kd_scoped_mat')).toBe(0)
    expect(materialBag.getAmount('tc_scoped_mat')).toBe(1)
    expect(materialBag.getAmount('untagged_mat')).toBe(1)
    expect(pillBag.add).not.toHaveBeenCalled()
  })

  it('artifact EXP feed stops for a beyond-ceiling save but the persisted artifact survives', () => {
    // C2C-12 boundary: domain ACCESS is disabled (no EXP), ownership is
    // not destroyed. The player realm is set on the session player, not
    // the enemy - the enemy realm only scales reward magnitude.
    const atCeiling = createLootTestSetup({
      realmId: 'mortal',
      rewards: { techniqueMastery: 100, spiritStone: 0 },
    })
    atCeiling.player.realmId = 'foundation_establishment'
    atCeiling.player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')
    atCeiling.killEnemy()
    expect(atCeiling.player.artifact.experience).toBeGreaterThan(0)

    const beyondCeiling = createLootTestSetup({
      realmId: 'mortal',
      rewards: { techniqueMastery: 100, spiritStone: 0 },
    })
    beyondCeiling.player.realmId = 'golden_core'
    beyondCeiling.player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')
    beyondCeiling.killEnemy()
    expect(beyondCeiling.player.artifact.experience).toBe(0)
    expect(beyondCeiling.player.artifact.artifactId).toBe('ngu_hanh_chau')
  })

  it('quest itemDrops skip breakthrough-scoped rewards for a closed transition', () => {
    const registry = new QuestRegistry()
    const manager = new QuestManager()
    const system = new QuestSystem()
    const materialRegistry = new MaterialRegistry()
    const materialBag = new MaterialBag()
    const pillRegistry = new PillRegistry()
    const pillBag = new PillBag()
    const rewardSystem = new RewardSystem()

    materialRegistry.register({
      id: 'kd_scoped_mat',
      name: 'KD Mat',
      category: 'other',
      sourceType: 'boss',
      breakthroughRealmId: 'golden_core',
    })
    materialRegistry.register({
      id: 'untagged_mat',
      name: 'Untagged Mat',
      category: 'other',
      sourceType: 'boss',
    })
    pillRegistry.register({
      id: 'kd_scoped_pill',
      name: 'KD Pill',
      grade: 'huyen',
      type: 'material',
      effects: [],
      breakthroughRealmId: 'golden_core',
    })

    const quest: Quest = {
      id: 'release_policy_test',
      name: 'Release policy test',
      description: '',
      condition: { kind: 'kill', enemyId: 'mob', amount: 1 },
      reward: {
        itemDrops: [
          { kind: 'material', itemId: 'kd_scoped_mat', amount: 2 },
          { kind: 'material', itemId: 'untagged_mat', amount: 1 },
          { kind: 'pill', itemId: 'kd_scoped_pill', amount: 1 },
        ],
      },
      cadence: 'once',
    }
    registry.register(quest)

    const player = { realmId: 'qi_refining' } as unknown as PlayerData
    system.reconcileActiveQuests(registry, manager, player)
    manager.incrementProgress('release_policy_test', 1)

    const receiver: RewardReceiver = {
      addSkillInsight: () => {},
      addCultivation: () => {},
      addSpiritStone: () => {},
    }

    expect(
      system.claim(
        registry,
        manager,
        rewardSystem,
        receiver,
        { materialRegistry, materialBag, pillRegistry, pillBag },
        'release_policy_test',
      ),
    ).toBe(true)
    expect(materialBag.getAmount('kd_scoped_mat')).toBe(0)
    expect(materialBag.getAmount('untagged_mat')).toBe(1)
    expect(pillBag.getAmount('kd_scoped_pill')).toBe(0)
  })

  it('startAlchemyJob suppresses breakthrough-scoped recipes for a closed transition', () => {
    const ops = (recipes: AlchemyRecipe[]) =>
      new GameManagerAlchemyOps({
        alchemyRecipesById: new Map(recipes.map((recipe) => [recipe.id, recipe])),
        // Room lookup returns undefined - anything reaching it reports
        // 'room_not_built', which proves the policy check let it through.
        buildingManager: { getByBuildingId: () => undefined },
      } as unknown as GameManagerAlchemyOpsDeps)

    const closedRecipe: AlchemyRecipe = {
      ...SPECIAL_ALCHEMY_RECIPES[0]!,
      id: 'alchemy_kd_scoped_test',
      breakthroughRealmId: 'golden_core',
    }
    expect(ops([closedRecipe]).startAlchemyJob('alchemy_kd_scoped_test', 'any_herb', createDefaultPlayer()))
      .toEqual({ ok: false, reason: 'realm_unavailable' })

    // The authored Truc Co Dan recipe (tagged TC, open transition) passes
    // the policy check and falls through to the room check.
    const trucCoDan = SPECIAL_ALCHEMY_RECIPES.find(
      (recipe) => recipe.id === 'alchemy_truc_co_dan',
    )!
    expect(ops([trucCoDan]).startAlchemyJob('alchemy_truc_co_dan', 'any_herb', createDefaultPlayer()))
      .toEqual({ ok: false, reason: 'room_not_built' })
  })
})

describe('ReleasePolicy - authored breakthrough tags (Beta window)', () => {
  it('breakthrough-scoped resources carry their target-realm tag', () => {
    expect(materials.find((m) => m.id === 'great_dao_seed')?.breakthroughRealmId).toBe(
      'foundation_establishment',
    )
    expect(pills.find((p) => p.id === 'truc_co_dan')?.breakthroughRealmId).toBe(
      'foundation_establishment',
    )
    expect(
      SPECIAL_ALCHEMY_RECIPES.find((r) => r.id === 'alchemy_truc_co_dan')
        ?.breakthroughRealmId,
    ).toBe('foundation_establishment')
  })
})

describe('ReleasePolicy - breakthrough-scope census integrity (C2C-9)', () => {
  // The tag is optional by shape, so completeness lives in the census:
  // every id BreakthroughScopedResources declares must be tagged with a
  // REAL realm, and every tagged registry record must be declared there.
  // A future breakthrough-scoped resource added to the census without the
  // tag - or tagged without the census - fails here.

  it('every census id exists in its registry and carries a valid breakthroughRealmId', () => {
    for (const id of BREAKTHROUGH_SCOPED_MATERIAL_IDS) {
      const material = materials.find((m) => m.id === id)
      expect(material, `census material '${id}' missing from materials registry`).toBeDefined()
      expect(
        material!.breakthroughRealmId,
        `census material '${id}' lacks breakthroughRealmId - untagged breakthrough-scoped resources bypass the policy`,
      ).toBeDefined()
      expect(getRealmIndex(material!.breakthroughRealmId!)).toBeGreaterThanOrEqual(0)
    }

    for (const id of BREAKTHROUGH_SCOPED_PILL_IDS) {
      const pill = pills.find((p) => p.id === id)
      expect(pill, `census pill '${id}' missing from pills registry`).toBeDefined()
      expect(
        pill!.breakthroughRealmId,
        `census pill '${id}' lacks breakthroughRealmId - untagged breakthrough-scoped resources bypass the policy`,
      ).toBeDefined()
      expect(getRealmIndex(pill!.breakthroughRealmId!)).toBeGreaterThanOrEqual(0)
    }

    for (const id of BREAKTHROUGH_SCOPED_RECIPE_IDS) {
      const recipe = alchemyRecipes.find((r) => r.id === id)
      expect(recipe, `census recipe '${id}' missing from alchemyRecipes`).toBeDefined()
      expect(
        recipe!.breakthroughRealmId,
        `census recipe '${id}' lacks breakthroughRealmId - untagged breakthrough-scoped recipes bypass the policy`,
      ).toBeDefined()
      expect(getRealmIndex(recipe!.breakthroughRealmId!)).toBeGreaterThanOrEqual(0)
    }
  })

  it('every tagged registry record is declared in the census (no stray tags)', () => {
    const materialCensus = new Set<string>(BREAKTHROUGH_SCOPED_MATERIAL_IDS)
    for (const material of materials) {
      if (material.breakthroughRealmId !== undefined) {
        expect(
          materialCensus.has(material.id),
          `material '${material.id}' carries breakthroughRealmId but is not in BREAKTHROUGH_SCOPED_MATERIAL_IDS`,
        ).toBe(true)
      }
    }

    const pillCensus = new Set<string>(BREAKTHROUGH_SCOPED_PILL_IDS)
    for (const pill of pills) {
      if (pill.breakthroughRealmId !== undefined) {
        expect(
          pillCensus.has(pill.id),
          `pill '${pill.id}' carries breakthroughRealmId but is not in BREAKTHROUGH_SCOPED_PILL_IDS`,
        ).toBe(true)
      }
    }

    const recipeCensus = new Set<string>(BREAKTHROUGH_SCOPED_RECIPE_IDS)
    for (const recipe of alchemyRecipes) {
      if (recipe.breakthroughRealmId !== undefined) {
        expect(
          recipeCensus.has(recipe.id),
          `recipe '${recipe.id}' carries breakthroughRealmId but is not in BREAKTHROUGH_SCOPED_RECIPE_IDS`,
        ).toBe(true)
      }
    }
  })

  it('the live breakthrough gate binds the census (TRUC_CO_DAN_PILL_ID is tagged + declared)', () => {
    expect(BREAKTHROUGH_SCOPED_PILL_IDS).toContain(TRUC_CO_DAN_PILL_ID)
    expect(pills.find((p) => p.id === TRUC_CO_DAN_PILL_ID)?.breakthroughRealmId).toBeDefined()
  })
})
