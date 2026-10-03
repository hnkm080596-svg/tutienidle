// Mission A7 - whole-payload round-trip conformance: a save built from a
// fully-populated manager must survive
//   buildGameSave -> JSON.stringify/parse -> validateGameSaveShape
//     -> restoreGameSession (fresh Pinia store + fresh manager)
//     -> buildGameSave
// with every non-volatile field identical. This makes serializer/
// validator/restore drift structurally visible instead of per-slice.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { equipment } from '../../data/equipment/equipment'
import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'
import { GameManager } from '../../core/game/GameManager'
import { makeInstance } from '../../core/equipment/EquipmentInstance.fixture'
import { alchemyJobFixture } from '../../core/alchemy/AlchemyJob.fixture'
import { createDefaultPlayer, type PlayerData } from '../../core/player/Player'
import { freshSwordPathState } from '../../core/kiem-tu/KiemTuState'
import { SWORD_PATHWAY } from '../../core/kiem-tu/KiemTuPath'
import { skillCoreNodeId } from '../../core/progression/SkillCoreLevel'
import { usePlayerStore } from '../../stores/player'
import { validateGameSaveShape } from './saveShapeValidation'
import { buildGameSave, restoreGameSession, type GameSave } from './SaveSystem'
import { CYCLE_BASE_SECONDS_BY_REALM, computeCycleSeconds } from '../../core/production/ProductionBalance'
import type { ProductionCycle, ProductionSiteState } from '../../core/production/ProductionTypes'
import type { Skill } from '../../core/skill/Skill'
import type { Technique } from '../../core/technique/Technique'

const NOW = 1_725_160_000_000

// Techniques/skills round-trip only when a template is registered -
// restore drops orphan entries (dev-stage rule, Mission G) - so the
// fixtures double as their own registered templates.
// P7-M3 - the seeded technique must satisfy the v70 holder contract:
// id == committed way's techniqueId and the player carries the way
// commit (set in populateSource).
const CONF_TECHNIQUE: Technique = {
  id: 'sword_control_art',
  name: 'Conf Tech',
  description: 'd',
  grade: 1,
  rank: 0,
  mastery: 0,
  quality: 'hoang',
  // The fixture's save claims foundation_establishment - the live
  // grade-1 cycle lags the realm, so it must carry its sealed
  // realm-exit record (untrained commit -> partial at rank 0).
  gradeHistory: { 1: { finalRank: 0, completionState: 'partial' } },
  gradeEffects: {},
}

const CONF_SKILL: Skill = {
  id: 'conf_skill',
  name: 'Conf Skill',
  description: 'd',
  type: 'passive',
  level: 3,
  maxLevel: 10,
  cooldown: 0,
  target: 'self',
  effects: [],
}

function createRegisteredManager(): GameManager {
  const manager = new GameManager()

  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerSkillTemplates([CONF_SKILL])
  manager.catalogOps.registerTechniqueTemplates([CONF_TECHNIQUE])
  // Mission B audit - the persisted autoFarmStage lease below only
  // survives restore when its stage is registered (reconcile drops a dead
  // lease). stage_a must exist as a template for the round-trip.
  manager.catalogOps.registerStages([
    {
      id: 'stage_a',
      name: 'Stage A',
      description: '',
      floor: 1,
      enemyPool: [],
      totalEnemyCount: 0,
      waves: [],
      spawnIntervalSeconds: 0,
    },
  ])

  return manager
}

function productionCycle(cycleId: string, siteId: string, completesAtMs: number): ProductionCycle {
  // F-CYC-1: the span replays the authored cycle window (mortal base at
  // site level 2 speed) - compute it from the balance table like the
  // real writer.
  return {
    cycleId,
    siteId,
    collectionRealmId: 'mortal',
    siteLevelAtStart: 2,
    rewardTableVersion: 1,
    rollSeed: 42,
    startedAtMs: completesAtMs - computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM.mortal ?? 0, 2) * 1000,
    completesAtMs,
  }
}

/** Populate every declared GameSave slice on (player, manager). */
function populateSource(player: PlayerData, manager: GameManager): void {
  // Player slice - touch several non-trivial fields.
  player.name = 'Conformance'
  player.cultivation = 321
  player.duyenPhan = 55
  player.skillInsight = 12
  // F-A11-3: insight can never exceed the lifetime-minted tally.
  player.totalSkillInsightGained = 12
  player.attributePoints = 4
  player.nodeLevels = { test_node: 2 }
  player.purchasedNodeIds = ['test_node']
  player.completedStageIds = ['stage_a']
  // A real armed-farm save always carries the perfect-clear row -
  // reconcileAutoFarmRuntime drops a farm whose stage was never cleared
  // (same precondition as startAutoFarm).
  player.perfectClearStageIds = ['stage_a']
  player.perfectClearSeconds = { stage_a: 60 }
  player.autoFarmStage = { stageId: 'stage_a', lastCheckedMs: NOW - 1_000 }
  player.companions = [
    {
      instanceId: 'comp-1',
      definitionId: 'ho_ly_tinh',
      realmId: 'mortal',
      realmLevel: 1,
      exp: 0,
      constellationRank: 0,
    },
  ]

  // Techniques/skills registered as templates above - the entries
  // round-trip through restore's template re-derive unchanged.
  // Way commit required by the v70 technique holder contract - the
  // sword path-state slice is part of the atomic commit
  // (applyPathChoice shape; the shape validator requires it).
  player.cultivationPath = 'sword'
  player.cultivationWay = 'sword_pathway'
  player.swordPath = freshSwordPathState()
  // F-COMP-REALM-PIN: the fixture carries a companion, so the realm
  // claim must reach the companion-domain unlock tier.
  player.realmId = 'foundation_establishment'
  player.realmLevel = 1
  // F-REALM-1 / F-A12-2: a committed qi+ save carries the stamped grade
  // and the foundation victory record.
  player.breakthroughGrade = 1
  player.highestFoundationAchieved = 'human'
  // M-QI-05 (v73) - the committed way's coreSkillIds are granted at the
  // ritual: nodeLevels[core_<id>] = 1 plus purchasedNodeIds membership.
  for (const skillId of SWORD_PATHWAY.coreSkillIds ?? []) {
    const coreId = skillCoreNodeId(skillId)
    player.nodeLevels[coreId] = 1
    player.purchasedNodeIds.push(coreId)
  }
  // P7-M6 - canonical seam: bind the player first so the progress sink
  // publishes techniqueProgress, exactly like production restore order.
  manager.setActivePlayer(player)
  manager.techniqueSystem.restore([structuredClone(CONF_TECHNIQUE)])
  manager.skillManager.restore([structuredClone(CONF_SKILL)])

  // Bags.
  // F-SCOPE-1: every stone writer is realm-tier-keyed, so a trung stack
  // on a tier-2 save is unproducible - the second stack uses the first
  // non-stone material instead.
  manager.materialBag.add(manager.materialRegistry.get(materials[0]!.id), 7)
  manager.materialBag.add(manager.materialRegistry.get(materials[3]!.id), 3)
  manager.pillBag.add(manager.pillRegistry.get(pills[0]!.id), 2)
  manager.equipmentBag.add(
    makeInstance({
      instanceId: 'conf-item',
      itemId: 'base_kiem',
        realmLevel: 2,
      zoneId: 'thanh_van_dong',
      mainStat: {
        id: 'conf-item-main',
        sourceId: 'conf-item',
        sourceType: 'equipment',
        stat: 'might',
        flat: 9,
      },
      affixes: [{ affixId: 'suffix_accuracy', tier: 1, value: 2 }],
    }),
  )

  // Buildings - Chi Hien Quan level 1 sets worker capacity 3 (1+level*2).
  // pill_room level 1 witnesses the alchemy job's roomLevelAtStart
  // claim (F-TC9-3 bound: building level never decreases).
  manager.buildingManager.add({
    instanceId: 'b-chq',
    buildingId: 'chi_hien_quan',
    level: 1,
    lastCollectedAt: NOW - 2_000,
  })
  manager.buildingManager.add({
    instanceId: 'b-pill',
    buildingId: 'pill_room',
    level: 1,
    lastCollectedAt: NOW - 2_000,
  })
  manager.buildingOps.refreshAutoWorkerCapacity(
    player,
    manager.buildingManager.get('b-chq')!,
  )

  // Production - one populated site (worker cycles + manual
  // assignment); the other definitions get default ensured states.
  const siteId = manager.productionSystem.getSiteDefinitions()[0]!.siteId
  const siteState: ProductionSiteState = {
    siteId,
    level: 2,
    autoRestart: true,
    activeWorkerSlots: 1,
    workerCycles: [
      productionCycle('cycle-active', siteId, NOW + 60_000),
      // F-CYC-1: a writer-spawned cycle never completes later than the
      // authored span out - an 87s window can end at most NOW + 87s.
      productionCycle('cycle-worker-1', siteId, NOW + 80_000),
    ],
    assignedWorkers: 2,
  }

  manager.productionSystem.restoreStates([siteState])
  for (const definition of manager.productionSystem.getSiteDefinitions()) {
    manager.productionSystem.ensureSiteState(definition.siteId)
  }

  // Alchemy - a still-running job (completesAtMs in the future so the
  // restore-time offline settle leaves it pending).
  manager.alchemySystem.restoreJobs([
    alchemyJobFixture({
      jobId: 'conf-job',
      recipeId: 'conf-recipe',
      pillId: pills[0]!.id,
      herbMaterialId: 'conf-herb',
      startedAtMs: NOW - 1_000,
      completesAtMs: NOW + 999_999,
      roomLevelAtStart: 1,
    }),
  ])

  // Decompose - non-default filters, workers within capacity, live timer.
  manager.decomposeSystem.updateCapacity(3)
  manager.decomposeSystem.setSetting({ workers: 2, gradeFilter: 'cuu_pham', ageFilter: 'century' })
  manager.decomposeSystem.tick(NOW)

  // Quests - the registry stays empty so restore-time
  // reconcileQuestLifecycle is a no-op and the slice round-trips as-is.
  manager.questManager.restore({
    active: [{ questId: 'conf_quest', progress: 2, claimed: false }],
    completedOnceIds: ['conf_once'],
    lastDailyResetAtMs: NOW - 86_400_000,
  })
}

function stripVolatile(save: GameSave): Omit<GameSave, 'player'> & {
  player: Omit<PlayerData, 'lastSavedAt'>
} {
  const { lastSavedAt: _ignored, ...player } = save.player

  return { ...save, player }
}

describe('Mission A7 — whole-payload save conformance', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('build -> serialize -> validate -> restore -> rebuild preserves every declared slice', () => {
    const sourceManager = createRegisteredManager()
    const sourcePlayer = createDefaultPlayer()

    populateSource(sourcePlayer, sourceManager)

    const save1 = buildGameSave(sourcePlayer, sourceManager)

    // The persisted form is what JSON.stringify would write.
    const persisted = JSON.parse(JSON.stringify(save1)) as unknown
    const shape = validateGameSaveShape(persisted)
    if (!shape.ok) {
      console.log(JSON.stringify(shape.issues, null, 2))
    }

    expect(shape.ok).toBe(true)
    if (!shape.ok) {
      return
    }

    // Restore into a fresh session (new Pinia store + new manager).
    const normalized = shape.normalizedSave as GameSave
    const freshPlayer = usePlayerStore()
    const freshManager = createRegisteredManager()

    const restored = restoreGameSession(freshPlayer, freshManager, normalized)

    expect(restored.status).toBe('ok')

    const save2 = buildGameSave(freshPlayer.$state, freshManager)

    // save2 must equal the normalized persisted form - only the volatile
    // lastSavedAt may differ (Date.now is mocked equal anyway).
    expect(stripVolatile(save2)).toEqual(stripVolatile(normalized))
  })
})
