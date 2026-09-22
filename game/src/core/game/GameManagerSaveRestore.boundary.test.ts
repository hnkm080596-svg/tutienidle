// M1 (ARCH-001) — the save/restore boundary contract, exercised through
// the real GameManager + real catalogs (not helper-level checks):
//  - every payload slice REPLACES the owner's live set (no additive merge)
//  - absent/empty slices reset to defaults
//  - the input save is a value: never mutated, never aliased into live state
//  - repeat application converges (no duplicate skills/techniques/items)
//  - a mid-apply failure leaves the payload uncommitted; a retry re-applies
//    the un-committed slices and converges
//  - pending paid-op tickets (equipment wash/refine) die when the item set
//    is replaced (the M2/ARCH-011 hook)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from './GameManager'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { makeInstance } from '../equipment/EquipmentInstance.fixture'
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'
import type { Skill } from '../skill/Skill'
import type { Technique } from '../technique/Technique'
import type { EquipmentSlotState } from '../equipment/EquipmentSlotState'
import type { AlchemyJobSave } from '../../services/save/saveTypes'
import type { Quest } from '../quest/Quest'
import { buildGameSave, restoreGameSession, type GameSave } from '../../services/save/SaveSystem'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'
import { usePlayerStore } from '../../stores/player'
import { freshSwordPathState } from '../kiem-tu/KiemTuState'
import { resolveProductionWorkerCapacity } from '../production/WorkerCapacity'

function makeManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  // The fixture entries double as their own registered templates so the
  // save payloads below are not orphans - restore drops entries whose id
  // has no registered template (dev-stage rule, Mission G).
  manager.catalogOps.registerSkillTemplates([...SKILLS, SAVED_SKILL])
  manager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  return manager
}

function baseSave(player: PlayerData, overrides: Partial<GameSave> = {}): GameSave {
  return {
    version: CURRENT_SAVE_VERSION,
    player: { ...player, lastSavedAt: Date.now() },
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    equipmentSlots: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    quests: { active: [], completedOnceIds: [], lastDailyResetAtMs: 0 },
    productionSites: [],
    alchemyJobs: [],
    decompose: {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: 0,
      started: false,
    },
    ...overrides,
  }
}

const LIVE_SKILL: Skill = {
  id: 'live_only_skill',
  name: 'Live-only skill',
  description: 'seeded live, absent from the payload',
  type: 'active',
  level: 2,
  maxLevel: 10,
  cooldown: 1,
  target: 'enemy',
  effects: [],
}

const SAVED_SKILL: Skill = {
  id: 'saved_skill',
  name: 'Saved skill',
  description: 'payload entry',
  type: 'active',
  level: 3,
  maxLevel: 10,
  cooldown: 2,
  target: 'enemy',
  effects: [],
}

const LIVE_TECHNIQUE: Technique = {
  id: 'live_only_technique',
  name: 'Live-only technique',
  description: 'seeded live, absent from the payload',
  grade: 1,
  rank: 0,
  mastery: 0,
  quality: 'hoang',
}

// P7-M3 (v70) - the holder contract is way-owned: a save carrying a
// technique is only valid when the PLAYER slice commits a (path, way)
// pair and the entry id equals way.techniqueId. The canonical sword art
// doubles as the "saved" fixture; authored fields re-derive from the
// template on restore, so the payload markers live on the progression
// fields (rank/mastery/quality).
function swordCommittedPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'sword'
  player.cultivationWay = 'sword_pathway'
  player.swordPath = freshSwordPathState()
  player.realmId = 'qi_refining'
  player.realmLevel = 1
  return player
}

const SAVED_TECHNIQUE: Technique = {
  id: 'sword_control_art',
  name: 'Saved technique',
  description: 'payload entry',
  grade: 1,
  rank: 2,
  mastery: 100,
  quality: 'huyen',
}

const TEST_QUEST: Quest = {
  id: 'boundary_test_quest',
  name: 'Boundary Test Quest',
  description: 'fixture',
  condition: { kind: 'kill', amount: 1 },
  reward: {},
  cadence: 'daily',
}

const SAVED_SLOT_STATE: EquipmentSlotState = {
  slot: 'weapon',
  enhanceLevel: 5,
  enhanceFailStreak: 2,
}

const FUTURE_JOB: AlchemyJobSave = {
  jobId: 'saved-job',
  recipeId: 'saved-recipe',
  pillId: pills[0]!.id,
  herbMaterialId: 'saved-herb',
  startedAtMs: Date.now(),
  completesAtMs: Date.now() + 86_400_000, // far future — never settles during the test
  roomLevelAtStart: 1,
}

function savedItem(instanceId = 'saved-item'): ReturnType<typeof makeInstance> {
  return makeInstance({
    instanceId,
    itemId: 'base_kiem',
    equipped: false,
    quality: 'dia',
    forgeUsesTotal: 20,
    forgeUsesRemaining: 20,
    mainStat: {
      id: `${instanceId}-main`,
      sourceId: instanceId,
      sourceType: 'equipment',
      stat: 'might',
      flat: 12,
    },
    affixes: [{ affixId: 'suffix_accuracy', tier: 1, value: 3 }],
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('M1 (ARCH-001) — per-slice replacement / reset', () => {
  it('skills: an empty slice clears the live set; a saved set replaces it', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.skillManager.add(structuredClone(LIVE_SKILL))

    manager.saveOps.restoreFromSave(baseSave(player, { skills: [] }))
    expect(manager.skillManager.getAll()).toEqual([])

    manager.saveOps.restoreFromSave(baseSave(player, { skills: [structuredClone(SAVED_SKILL)] }))
    expect(manager.skillManager.getAll().map((skill) => skill.id)).toEqual(['saved_skill'])
    expect(manager.skillManager.has('live_only_skill')).toBe(false)
  })

  it('techniques: an empty slice clears the live set (way-less player); a saved set replaces it', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.techniqueManager.setActive(structuredClone(LIVE_TECHNIQUE))

    manager.saveOps.restoreFromSave(baseSave(player, { techniques: [] }))
    expect(manager.techniqueManager.getAll()).toEqual([])

    manager.saveOps.restoreFromSave(
      baseSave(swordCommittedPlayer(), { techniques: [structuredClone(SAVED_TECHNIQUE)] }),
    )
    expect(manager.techniqueManager.getAll().map((technique) => technique.id)).toEqual(['sword_control_art'])
    expect(manager.techniqueManager.has('live_only_technique')).toBe(false)
    expect(manager.techniqueManager.getActive()?.mastery).toBe(100)
  })

  // P7-M6 - the restore republishes player.techniqueProgress from the
  // CANONICAL holder (save.techniques[0]) through the sink; whatever the
  // bound player's mirror claimed before restore is overwritten.
  it('techniqueProgress mirror republishes from the canonical holder on restore', () => {
    const manager = makeManager()
    const player = swordCommittedPlayer()
    player.techniqueProgress = { rank: 99, grade: 9 }
    manager.setActivePlayer(player)

    manager.saveOps.restoreFromSave(
      baseSave(player, { techniques: [structuredClone(SAVED_TECHNIQUE)] }),
    )

    expect(player.techniqueProgress).toEqual({ rank: 2, grade: 1 })
  })

  it('an empty techniques slice clears the bound player mirror to the default', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    player.techniqueProgress = { rank: 3, grade: 1 }
    manager.setActivePlayer(player)

    manager.saveOps.restoreFromSave(baseSave(player, { techniques: [] }))

    expect(player.techniqueProgress).toBeUndefined()
  })

  it('materials + pills: empty slices clear the bags; saved stacks replace them', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    const materialId = materials[0]!.id
    const pillId = pills[0]!.id
    manager.materialBag.add(manager.materialRegistry.get(materialId), 9)
    manager.pillBag.add(manager.pillRegistry.get(pillId), 4)

    manager.saveOps.restoreFromSave(baseSave(player, { materials: [], pills: [] }))
    expect(manager.materialBag.getAll()).toEqual([])
    expect(manager.pillBag.getAll()).toEqual([])

    manager.saveOps.restoreFromSave(
      baseSave(player, { materials: [{ materialId, amount: 5 }], pills: [{ pillId, amount: 2 }] }),
    )
    expect(manager.materialBag.getAmount(materialId)).toBe(5)
    expect(manager.pillBag.getAmount(pillId)).toBe(2)
  })

  it('equipment: an empty slice clears the bag; a saved set replaces it', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.equipmentBag.add(savedItem('live_only_item'))

    manager.saveOps.restoreFromSave(baseSave(player, { equipment: [] }))
    expect(manager.equipmentBag.getAll()).toEqual([])

    manager.saveOps.restoreFromSave(baseSave(player, { equipment: [savedItem('saved-item')] }))
    expect(manager.equipmentBag.getAll().map((instance) => instance.instanceId)).toEqual(['saved-item'])
    expect(manager.equipmentBag.has('live_only_item')).toBe(false)
  })

  it('buildings: an empty slice clears live instances; a saved set replaces them', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.buildingManager.add({
      instanceId: 'live_only_building',
      buildingId: buildings[0]!.id,
      level: 1,
      lastCollectedAt: 0,
    })

    manager.saveOps.restoreFromSave(baseSave(player, { buildings: [] }))
    expect(manager.buildingManager.getAll()).toEqual([])

    manager.saveOps.restoreFromSave(
      baseSave(player, {
        buildings: [{ instanceId: 'saved-building', buildingId: buildings[0]!.id, level: 2, lastCollectedAt: 0 }],
      }),
    )
    expect(manager.buildingManager.getAll().map((instance) => instance.instanceId)).toEqual(['saved-building'])
    expect(manager.buildingManager.get('saved-building')?.level).toBe(2)
  })

  it('equipmentSlots: slots absent from the payload reset to defaults', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.equipmentSlotManager.get('ring').enhanceLevel = 9

    manager.saveOps.restoreFromSave(baseSave(player, { equipmentSlots: [structuredClone(SAVED_SLOT_STATE)] }))

    expect(manager.equipmentSlotManager.get('weapon').enhanceLevel).toBe(5)
    expect(manager.equipmentSlotManager.get('weapon').enhanceFailStreak).toBe(2)
    // `ring` was live-enhanced but absent from the payload -> reset, not kept.
    expect(manager.equipmentSlotManager.get('ring').enhanceLevel).toBe(0)
    expect(manager.equipmentSlotManager.get('ring').enhanceFailStreak).toBe(0)
  })

  it('productionSites: an empty slice resets every defined site to defaults', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    const siteId = manager.productionSystem.getSiteDefinitions()[0]!.siteId
    const liveState = manager.productionSystem.ensureSiteState(siteId)
    liveState.level = 4
    liveState.autoRestart = true

    manager.saveOps.restoreFromSave(baseSave(player, { productionSites: [] }))

    const restored = manager.productionSystem.getState(siteId)!
    expect(restored.level).toBe(1)
    expect(restored.autoRestart).toBe(false)
    expect(restored.activeWorkerSlots).toBe(0)
  })

  it('alchemyJobs: empty clears live jobs; an absent slice also resets', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.alchemySystem.restoreJobs([structuredClone(FUTURE_JOB)])

    manager.saveOps.restoreFromSave(baseSave(player, { alchemyJobs: [] }))
    expect(manager.alchemySystem.getJobs()).toEqual([])

    // Absent slice (old save without the field) must reset, not keep stale jobs.
    manager.alchemySystem.restoreJobs([structuredClone(FUTURE_JOB)])
    const save = baseSave(player)
    save.alchemyJobs = undefined
    manager.saveOps.restoreFromSave(save)
    expect(manager.alchemySystem.getJobs()).toEqual([])
  })

  it('quests: an absent slice resets to defaults', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.questManager.ensureActive(TEST_QUEST)
    manager.questManager.markCompletedOnce('once_quest')

    const save = baseSave(player)
    save.quests = undefined
    manager.saveOps.restoreFromSave(save)

    expect(manager.questManager.getState()).toEqual({
      active: [],
      completedOnceIds: [],
      lastDailyResetAtMs: 0,
    })
  })

  it('decompose: an absent slice resets settings to defaults', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    player.autoWorkerCapacity = 5
    manager.setActivePlayer(player)
    manager.decomposeSystem.updateCapacity(5)
    manager.decomposeSystem.setSetting({ workers: 3, ageFilter: 'decade' })

    const save = baseSave(player)
    save.decompose = undefined
    manager.saveOps.restoreFromSave(save)

    expect(manager.decomposeSystem.getSettings()).toEqual({
      gradeFilter: 'all',
      ageFilter: 'all',
      workers: 0,
    })
  })

  it('restore settle receives the SAME pool the online tick computes (spec D5 - one rule, no second copy)', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    player.autoWorkerCapacity = 7
    manager.setActivePlayer(player)

    // Prime live decompose capacity so the restored workers value survives its clamp.
    manager.decomposeSystem.updateCapacity(7)

    const spy = vi.spyOn(manager.productionSystem, 'settleOffline')

    manager.saveOps.restoreFromSave(
      baseSave(player, {
        player: { ...player, lastSavedAt: Date.now() - 7_200_000 }, // >60s gate -> offline settle runs
        productionSites: [
          { siteId: 'thanh_van_lam', level: 1, autoRestart: true, assignedWorkers: 5 },
        ],
        decompose: {
          settings: { gradeFilter: 'all', ageFilter: 'all', workers: 2 },
          nextCycleAt: 0,
          started: false,
        },
      }),
    )

    expect(spy).toHaveBeenCalledTimes(1)
    // Asserting against the helper itself (not a literal) is the point:
    // both paths MUST consume the same rule.
    expect(spy.mock.calls[0]![4]?.workerCapacity).toBe(resolveProductionWorkerCapacity(7, 2))
  })
})

describe('M1 (ARCH-001) — the input save is a value', () => {
  it('restore does not mutate the input save (template backfill writes hit clones, not the payload)', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()

    // A legacy-shaped skill (no `execution`) triggers the template
    // backfill path — the write must land on a detached copy.
    const legacySkill = structuredClone(SKILLS.find((skill) => skill.id === 'tram') ?? SKILLS[0]!)
    delete legacySkill.execution
    legacySkill.name = 'stale saved name'
    const legacyTechnique = structuredClone(TECHNIQUES.find((technique) => technique.id === 'sword_control_art')!)
    legacyTechnique.name = 'stale saved technique name'

    const save = baseSave(swordCommittedPlayer(), {
      skills: [legacySkill],
      techniques: [legacyTechnique],
      materials: [{ materialId: materials[0]!.id, amount: 3 }],
      equipment: [savedItem('saved-item')],
      equipmentSlots: [structuredClone(SAVED_SLOT_STATE)],
      buildings: [{ instanceId: 'b1', buildingId: buildings[0]!.id, level: 1, lastCollectedAt: 0 }],
      alchemyJobs: [structuredClone(FUTURE_JOB)],
      quests: { active: [{ questId: 'q1', progress: 1, claimed: false }], completedOnceIds: [], lastDailyResetAtMs: 0 },
    })
    const pristine = structuredClone(save)

    manager.saveOps.restoreFromSave(save)

    expect(save).toEqual(pristine)
  })

  it('post-restore mutation of the input save does not leak into live state', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()

    const save = baseSave(swordCommittedPlayer(), {
      skills: [structuredClone(SAVED_SKILL)],
      techniques: [structuredClone(SAVED_TECHNIQUE)],
      equipment: [savedItem('saved-item')],
      equipmentSlots: [structuredClone(SAVED_SLOT_STATE)],
      buildings: [{ instanceId: 'b1', buildingId: buildings[0]!.id, level: 1, lastCollectedAt: 0 }],
      productionSites: [{ siteId: manager.productionSystem.getSiteDefinitions()[0]!.siteId, level: 2, autoRestart: true }],
      alchemyJobs: [structuredClone(FUTURE_JOB)],
      quests: { active: [{ questId: 'q1', progress: 1, claimed: false }], completedOnceIds: ['done'], lastDailyResetAtMs: 5 },
    })

    manager.saveOps.restoreFromSave(save)

    save.skills[0]!.level = 99
    save.techniques[0]!.mastery = 9
    save.equipment[0]!.forgeUsesRemaining = 0
    save.equipment[0]!.affixes[0]!.value = 999
    save.buildings[0]!.level = 9
    save.equipmentSlots[0]!.enhanceLevel = 99
    save.productionSites![0]!.level = 9
    save.alchemyJobs![0]!.completesAtMs = 0
    save.quests!.active[0]!.progress = 999

    expect(manager.skillManager.get('saved_skill')!.level).toBe(3)
    expect(manager.techniqueManager.get('sword_control_art')!.mastery).toBe(100)
    expect(manager.equipmentBag.get('saved-item')!.forgeUsesRemaining).toBe(20)
    expect(manager.equipmentBag.get('saved-item')!.affixes[0]!.value).toBe(3)
    expect(manager.buildingManager.get('b1')!.level).toBe(1)
    expect(manager.equipmentSlotManager.get('weapon').enhanceLevel).toBe(5)
    expect(manager.productionSystem.getAllStates()[0]!.level).toBe(2)
    expect(manager.alchemySystem.getJobs()[0]!.completesAtMs).toBe(FUTURE_JOB.completesAtMs)
    expect(manager.questManager.getState().active[0]!.progress).toBe(1)
  })
})

describe('M1 (ARCH-001) — repeat application + failure semantics', () => {
  function populatedSave(manager: GameManager, _player: PlayerData): GameSave {
    // P7-M3 - the technique slice forces the player slice to carry the
    // matching (path, way) commit; the caller's player arg is replaced
    // by the committed shape so the save passes the v70 holder contract.
    const player = swordCommittedPlayer()
    return baseSave(player, {
      skills: [structuredClone(SAVED_SKILL)],
      techniques: [structuredClone(SAVED_TECHNIQUE)],
      materials: [{ materialId: materials[0]!.id, amount: 7 }],
      pills: [{ pillId: pills[0]!.id, amount: 2 }],
      equipment: [savedItem('saved-item')],
      equipmentSlots: [structuredClone(SAVED_SLOT_STATE)],
      buildings: [{ instanceId: 'b1', buildingId: buildings[0]!.id, level: 2, lastCollectedAt: 0 }],
      quests: { active: [{ questId: 'q1', progress: 1, claimed: false }], completedOnceIds: [], lastDailyResetAtMs: 0 },
      productionSites: [{ siteId: manager.productionSystem.getSiteDefinitions()[0]!.siteId, level: 3, autoRestart: false }],
      alchemyJobs: [structuredClone(FUTURE_JOB)],
    })
  }

  function liveSnapshot(manager: GameManager) {
    return {
      skills: manager.skillManager.getAll().map((skill) => skill.id),
      techniques: manager.techniqueManager.getAll().map((technique) => technique.id),
      materials: manager.materialBag.getAll().map((stack) => [stack.material.id, stack.amount]),
      pills: manager.pillBag.getAll().map((stack) => [stack.pill.id, stack.amount]),
      equipment: manager.equipmentBag.getAll().map((instance) => instance.instanceId),
      buildings: manager.buildingManager.getAll().map((instance) => [instance.instanceId, instance.level]),
      weaponEnhance: manager.equipmentSlotManager.get('weapon').enhanceLevel,
      quests: structuredClone(manager.questManager.getState()),
      alchemyJobs: manager.alchemySystem.getJobs().map((job) => job.jobId),
    }
  }

  it('restoring the same payload twice converges with no duplicates', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)
    const save = populatedSave(manager, player)

    manager.saveOps.restoreFromSave(save)
    const first = liveSnapshot(manager)

    // Identical payload again — the identity guard converges.
    manager.saveOps.restoreFromSave(save)
    expect(liveSnapshot(manager)).toEqual(first)
    expect(manager.equipmentBag.getAll()).toHaveLength(1)
    expect(manager.skillManager.getAll()).toHaveLength(1)
    expect(manager.techniqueManager.getAll()).toHaveLength(1)
  })

  it('a different payload re-applies fully; swapping payloads back and forth stays convergent', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    const saveA = populatedSave(manager, player)
    const saveB = populatedSave(manager, player)
    saveB.skills = []
    saveB.equipment = []
    saveB.materials = [{ materialId: materials[0]!.id, amount: 1 }]
    saveB.player.name = 'payload-b'

    manager.saveOps.restoreFromSave(saveA)
    manager.saveOps.restoreFromSave(saveB)

    expect(manager.skillManager.getAll()).toEqual([])
    expect(manager.equipmentBag.getAll()).toEqual([])
    expect(manager.materialBag.getAmount(materials[0]!.id)).toBe(1)
    expect(manager.buildingManager.getAll().map((instance) => instance.instanceId)).toEqual(['b1'])

    manager.saveOps.restoreFromSave(saveA)
    expect(manager.skillManager.getAll().map((skill) => skill.id)).toEqual(['saved_skill'])
    expect(manager.equipmentBag.getAll().map((instance) => instance.instanceId)).toEqual(['saved-item'])
    expect(manager.materialBag.getAmount(materials[0]!.id)).toBe(7)
  })

  it('a mid-restore fault leaves the payload uncommitted — a retry re-applies and converges', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)
    const save = populatedSave(manager, player)

    // Inject a one-shot fault into the buildings slice owner — slices
    // restored earlier in the chain (skills, bags, equipment) have
    // already applied when it throws.
    vi.spyOn(manager.buildingManager, 'restore').mockImplementationOnce(() => {
      throw new Error('injected mid-restore failure')
    })

    expect(() => manager.saveOps.restoreFromSave(save)).toThrow('injected mid-restore failure')

    // Partial apply is observable, and the payload must NOT be marked
    // applied — the retry below has to run the full restore again.
    expect(manager.materialBag.getAmount(materials[0]!.id)).toBe(7)
    expect(manager.buildingManager.getAll()).toEqual([])

    const modifiers = manager.saveOps.restoreFromSave(save)

    expect(Array.isArray(modifiers)).toBe(true)
    expect(manager.buildingManager.getAll().map((instance) => instance.instanceId)).toEqual(['b1'])
    // Retry re-applied from cleared state — no doubled materials.
    expect(manager.materialBag.getAmount(materials[0]!.id)).toBe(7)
    expect(manager.skillManager.getAll().map((skill) => skill.id)).toEqual(['saved_skill'])
    expect(manager.equipmentBag.getAll().map((instance) => instance.instanceId)).toEqual(['saved-item'])

    // A third call with the now-committed payload converges via the guard.
    manager.saveOps.restoreFromSave(save)
    expect(liveSnapshot(manager).buildings).toEqual([['b1', 2]])
  })

  it('restoreGameSession surfaces a mid-restore fault as a handled rejection; the same payload retries cleanly', () => {
    setActivePinia(createPinia())
    const playerStore = usePlayerStore()
    const manager = makeManager()
    const player = createDefaultPlayer()
    const save = populatedSave(manager, player)

    vi.spyOn(manager.buildingManager, 'restore').mockImplementationOnce(() => {
      throw new Error('injected session failure')
    })

    const first = restoreGameSession(playerStore, manager, save)
    expect(first.status).toBe('rejected')

    // The player slice already applied+committed; the manager payload did
    // not — retry must run the manager restore, not skip it.
    const retry = restoreGameSession(playerStore, manager, save)
    expect(retry.status).toBe('ok')
    expect(manager.buildingManager.getAll().map((instance) => instance.instanceId)).toEqual(['b1'])
    expect(playerStore.name).toBe(save.player.name)
  })
})

describe('M1 (ARCH-001) — pending paid-op invalidation (M2 hook)', () => {
  function seedWashableItem(manager: GameManager, player: PlayerData): GameSave {
    const instance = savedItem('wash-boundary-item')
    manager.equipmentBag.add(instance)
    manager.materialBag.add(manager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID), 9)
    manager.materialBag.add(manager.materialRegistry.get(SPIRIT_STONE_MATERIAL_ID), 100)
    return buildGameSave(player, manager)
  }

  it('a session restore clears a pending wash ticket — commit rejects no_pending_wash', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    const save = seedWashableItem(manager, player)

    const preview = manager.equipmentOps.previewWashItem('wash-boundary-item')
    expect(preview.ok).toBe(true)

    manager.saveOps.restoreFromSave(save)

    // The item still exists post-restore, so the rejection proves the
    // ticket was invalidated — not that the item went missing.
    expect(manager.equipmentBag.has('wash-boundary-item')).toBe(true)
    expect(manager.equipmentOps.commitWashItem('wash-boundary-item', preview.ticketId!)).toEqual({
      ok: false,
      reason: 'no_pending_wash',
    })
  })

  // M2 (ARCH-011 / AUD-E02) — the E02 loop through the real restore path:
  // the payload carries the SAME instanceId but a different affix shape.
  // Restore replaces the bag with a detached clone (different object, new
  // membership generation), so the pre-restore paid roll must not land on
  // the restored item even if the ticket itself were still reachable.
  it('a pre-restore wash ticket cannot overwrite a restored same-id item with a different shape', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    const live = savedItem('wash-boundary-item')
    manager.equipmentBag.add(live)
    manager.materialBag.add(manager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID), 9)
    manager.materialBag.add(manager.materialRegistry.get(SPIRIT_STONE_MATERIAL_ID), 100)

    const preview = manager.equipmentOps.previewWashItem('wash-boundary-item')
    expect(preview.ok).toBe(true)

    const restoredShape = [{ affixId: 'prefix_max_hp', tier: 2, value: 40 }]
    const replacement = savedItem('wash-boundary-item')
    replacement.affixes = structuredClone(restoredShape)
    manager.saveOps.restoreFromSave(baseSave(player, { equipment: [replacement] }))

    const restored = manager.equipmentBag.get('wash-boundary-item')
    expect(restored).toBeDefined()
    expect(restored).not.toBe(live)

    expect(manager.equipmentOps.commitWashItem('wash-boundary-item', preview.ticketId!)).toEqual({
      ok: false,
      reason: 'no_pending_wash',
    })
    expect(restored!.affixes).toEqual(restoredShape)
  })

  it('a session restore clears a pending refine preview — commit rejects invalid_refine_preview', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    const save = seedWashableItem(manager, player)

    const preview = manager.equipmentOps.previewRefineItem('wash-boundary-item', [])
    expect(preview.ok).toBe(true)

    manager.saveOps.restoreFromSave(save)

    expect(manager.equipmentBag.has('wash-boundary-item')).toBe(true)
    expect(manager.equipmentOps.commitRefineItem('wash-boundary-item', preview.values ?? [])).toEqual({
      ok: false,
      reason: 'invalid_refine_preview',
    })
  })
})

// Stat-key restore contract (post-Mission-G) — saves written before the
// stat-key rename keep legacy stat keys inside skills[] entries.
// gradeEffects/combatModifiers/passiveModifiers/specializations are
// authored data: restore re-derives them from the registered template
// (same contract as name/description), so stale keys can't stay inert.
// P7-M3 — a technique entry with NO registered template is no longer a
// silent drop: the v70 holder contract rejects the whole save in the
// preflight. Skills keep the drop rule.
describe('stat-key handling on techniques[]/skills[] restore', () => {
  it('stale technique gradeEffects re-derive from the registered template', () => {
    const manager = makeManager()
    const player = swordCommittedPlayer()

    // Save authored with stale/unknown gradeEffects keys — restore must
    // re-derive the authored table from the template, not trust the
    // persisted copy.
    const stale = structuredClone(SAVED_TECHNIQUE)
    stale.gradeEffects = { 1: { so_nhap: { mightFlat: 999 } } }

    manager.saveOps.restoreFromSave(baseSave(player, { techniques: [stale] }))

    const restored = manager.techniqueManager.get('sword_control_art')!
    const template = TECHNIQUES.find((technique) => technique.id === 'sword_control_art')!
    expect(restored.gradeEffects).toEqual(template.gradeEffects)
    // Persisted progression state is NOT template-owned.
    expect(restored.rank).toBe(2)
    expect(restored.mastery).toBe(100)
    expect(restored.quality).toBe('huyen')
  })

  it('legacy skill passiveModifiers stat:"attack" re-derives stat:"might" from the template', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()

    const legacy = structuredClone(
      SKILLS.find((skill) => skill.id === 'passive_linh_khi_cam_ung')!,
    )
    ;(legacy.passiveModifiers![0] as { stat: string }).stat = 'attack'

    manager.saveOps.restoreFromSave(baseSave(player, { skills: [legacy] }))

    const restored = manager.skillManager.get('passive_linh_khi_cam_ung')!
    expect(restored.passiveModifiers![0]!.stat).toBe('might')
    // The scaled passive aggregation emits the remapped stat again.
    expect(manager.skillSystem.getScaledPassiveModifiers()).toContainEqual(
      expect.objectContaining({ stat: 'might' }),
    )
  })

  it('frozen skill effects re-derive from the template on restore', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()

    // Save written while da_phap_lien_tuyen was authored with an empty
    // effects[] shell — the converter gate then rejects every An battle.
    // effects is authored data, so restore must re-derive it from the
    // registered template like execution/targeting/passiveModifiers.
    const stale = structuredClone(
      SKILLS.find((skill) => skill.id === 'da_phap_lien_tuyen')!,
    )
    stale.effects = []

    manager.saveOps.restoreFromSave(baseSave(player, { skills: [stale] }))

    const restored = manager.skillManager.get('da_phap_lien_tuyen')!
    expect(restored.effects).toEqual(
      SKILLS.find((skill) => skill.id === 'da_phap_lien_tuyen')!.effects,
    )
    expect(restored.effects.length).toBeGreaterThan(0)
  })

  it('skill entries with no registered template are dropped, not kept with remapped keys', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()

    const orphanSkill = structuredClone(SAVED_SKILL)
    ;(orphanSkill as { id: string }).id = 'removed_skill'
    orphanSkill.passiveModifiers = [
      {
        id: 'removed_skill:p1',
        sourceId: 'removed_skill',
        sourceType: 'skill',
        stat: 'attack' as never,
        flat: 6,
      },
    ]

    // A valid sibling entry still restores — the drop is per-entry.
    const validSkill = structuredClone(SAVED_SKILL)

    manager.saveOps.restoreFromSave(
      baseSave(player, {
        skills: [orphanSkill, validSkill],
      }),
    )

    expect(manager.skillManager.get('removed_skill')).toBeUndefined()
    expect(manager.skillManager.get(validSkill.id)).toBeDefined()
  })
})

// P7-M3 (v70) — technique holder contract preflight: 0-or-1 entries,
// the single entry must equal the committed way's techniqueId, a
// way-less player must carry none, and rank/mastery/grade/quality must
// be valid (rank cap 10 => mastery 0). Every rejection happens BEFORE
// any owner mutation.
describe('v70 technique holder preflight', () => {
  it('rejects a way-less (mortal) save carrying any technique', () => {
    const manager = makeManager()
    const save = baseSave(createDefaultPlayer(), {
      techniques: [structuredClone(SAVED_TECHNIQUE)],
    })

    expect(() => manager.saveOps.restoreFromSave(save)).toThrow(/way-less/i)
    expect(manager.techniqueManager.getActive()).toBeUndefined()
  })

  it('rejects a way player save carrying zero techniques', () => {
    const manager = makeManager()
    const save = baseSave(swordCommittedPlayer(), { techniques: [] })

    expect(() => manager.saveOps.restoreFromSave(save)).toThrow(/contract/i)
    expect(manager.techniqueManager.getActive()).toBeUndefined()
  })

  it('rejects a multi-entry techniques slice', () => {
    const manager = makeManager()
    const save = baseSave(swordCommittedPlayer(), {
      techniques: [structuredClone(SAVED_TECHNIQUE), structuredClone(SAVED_TECHNIQUE)],
    })

    expect(() => manager.saveOps.restoreFromSave(save)).toThrow(/contract/i)
    expect(manager.techniqueManager.getActive()).toBeUndefined()
  })

  it('rejects a technique id that is not the committed way technique', () => {
    const manager = makeManager()
    const wrong = structuredClone(SAVED_TECHNIQUE)
    wrong.id = 'five_elements_art' // spell way's technique, not sword's

    const save = baseSave(swordCommittedPlayer(), { techniques: [wrong] })

    expect(() => manager.saveOps.restoreFromSave(save)).toThrow(/contract/i)
    expect(manager.techniqueManager.getActive()).toBeUndefined()
  })

  it('rejects an unknown technique id even when it matches the way contract', () => {
    // Reach the template branch: the id equals way.techniqueId, but the
    // manager's registry lacks the template.
    const narrow = new GameManager()
    narrow.catalogOps.registerSkillTemplates(SKILLS)
    narrow.catalogOps.registerTechniqueTemplates(
      TECHNIQUES.filter((technique) => technique.id !== 'sword_control_art'),
    )

    const save = baseSave(swordCommittedPlayer(), {
      techniques: [structuredClone(SAVED_TECHNIQUE)],
    })

    expect(() => narrow.saveOps.restoreFromSave(save)).toThrow(/Unknown technique/i)
  })

  it.each([
    ['grade 0', { grade: 0 }],
    ['grade above the realm ceiling', { grade: 99 }],
    ['negative rank', { rank: -1 }],
    ['rank above cap', { rank: 11 }],
    ['negative mastery', { mastery: -1 }],
    ['mastery >= rank cost', { mastery: 300 }],
    ['invalid quality', { quality: 'mythic' }],
  ])('rejects invalid progression state: %s', (_label, patch) => {
    const manager = makeManager()
    const bad = { ...structuredClone(SAVED_TECHNIQUE), ...patch } as Technique
    const save = baseSave(swordCommittedPlayer(), { techniques: [bad] })

    expect(() => manager.saveOps.restoreFromSave(save)).toThrow(/Invalid technique/i)
    expect(manager.techniqueManager.getActive()).toBeUndefined()
  })

  it('rejects rank 10 with nonzero mastery', () => {
    const manager = makeManager()
    const bad = { ...structuredClone(SAVED_TECHNIQUE), rank: 10, mastery: 5 } as Technique
    const save = baseSave(swordCommittedPlayer(), { techniques: [bad] })

    expect(() => manager.saveOps.restoreFromSave(save)).toThrow(/Invalid technique/i)
    expect(manager.techniqueManager.getActive()).toBeUndefined()
  })
})

// P7-M4 (v71) - mortalBasicSkillId preflight: absent = tram default;
// present = a precursor member AND a still-mortal player (the ritual
// clears the pick inside the commit block, so post-path presence is
// corrupt). Every rejection happens BEFORE any owner mutation - the
// same hard-fail seam as the technique-holder contract above.
describe('v71 mortalBasicSkillId preflight', () => {
  it.each(['tram', 'linh_bao', 'huy_quyen'])(
    'restores a mortal save carrying a valid pick (%s)',
    (skillId) => {
      const manager = makeManager()
      const player = createDefaultPlayer()
      player.mortalBasicSkillId = skillId

      expect(() => manager.saveOps.restoreFromSave(baseSave(player))).not.toThrow()
    },
  )

  it('restores a mortal save carrying no pick (absent = tram default)', () => {
    const manager = makeManager()

    expect(() => manager.saveOps.restoreFromSave(baseSave(createDefaultPlayer()))).not.toThrow()
  })

  it.each(['hoa_cau_thuat', 'khong_ton_tai', '', 7])(
    'rejects a non-precursor pick (%s) before any owner mutation',
    (value) => {
      const manager = makeManager()
      const player = createDefaultPlayer()
      player.mortalBasicSkillId = value as string
      const save = baseSave(player, { skills: [structuredClone(SAVED_SKILL)] })

      expect(() => manager.saveOps.restoreFromSave(save)).toThrow(/Invalid mortalBasicSkillId/i)
      // Zero-mutation: preflight threw before the skills slice replaced
      // the live set (an applied restore would carry SAVED_SKILL).
      expect(manager.skillManager.getAll()).toEqual([])
    },
  )

  it('rejects a post-path pick before any owner mutation', () => {
    const manager = makeManager()
    const player = swordCommittedPlayer()
    player.mortalBasicSkillId = 'huy_quyen'
    const save = baseSave(player, {
      techniques: [structuredClone(SAVED_TECHNIQUE)],
      skills: [structuredClone(SAVED_SKILL)],
    })

    expect(() => manager.saveOps.restoreFromSave(save)).toThrow(/mortalBasicSkillId persisted post-path/i)
    expect(manager.techniqueManager.getActive()).toBeUndefined()
    expect(manager.skillManager.getAll()).toEqual([])
  })
})

// P7-M5 (v72) - bodyProgression integrity is the last preflight check,
// delegated to the BodyProgression authority: a corrupt chapter slice is
// corrupt progression state and fails closed BEFORE any owner mutation.
describe('v72 bodyProgression preflight + rehydration', () => {
  it.each([
    ['non-integer completedTiers', (p: PlayerData) => { p.bodyProgression.body_refinement.completedTiers = 1.5 }],
    ['completedTiers out of range', (p: PlayerData) => { p.bodyProgression.body_refinement.completedTiers = 7 }],
    ['progress at/above the active-tier cap', (p: PlayerData) => {
      p.bodyProgression.body_refinement.completedTiers = 0
      p.bodyProgression.body_refinement.currentTierProgress = 51
    }],
    ['residue progress at 6/6', (p: PlayerData) => {
      p.bodyProgression.body_refinement.completedTiers = 6
      p.bodyProgression.body_refinement.currentTierProgress = 1
    }],
    ['unknown meridian id', (p: PlayerData) => { p.bodyProgression.meridian.openedIds = ['huyen_mach'] }],
    ['non-prefix meridian order', (p: PlayerData) => { p.bodyProgression.meridian.openedIds = ['doi_mach'] }],
    ['non-array meridian openedIds', (p: PlayerData) => { p.bodyProgression.meridian.openedIds = 42 as never }],
    ['missing bodyProgression record', (p: PlayerData) => { p.bodyProgression = undefined as never }],
    ['missing meridian slice', (p: PlayerData) => { p.bodyProgression = { body_refinement: { completedTiers: 0, currentTierProgress: 0 } } as never }],
    // M-QI-07: a missing advancement-owning slice must still fail through
    // the aggregated integrity error - not a raw TypeError from the
    // physique derivation walking the absent slice.
    ['missing body_refinement slice', (p: PlayerData) => { p.bodyProgression = { meridian: { openedIds: [] } } as never }],
  ])('rejects %s before any owner mutation', (_label, corrupt) => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    corrupt(player)
    const save = baseSave(player, { skills: [structuredClone(SAVED_SKILL)] })

    expect(() => manager.saveOps.restoreFromSave(save)).toThrow(/BodyProgression integrity/i)
    // Zero-mutation: preflight threw before the skills slice replaced
    // the live set (an applied restore would carry SAVED_SKILL).
    expect(manager.skillManager.getAll()).toEqual([])
  })

  it('accepts canonical default + mid-progress + complete states', () => {
    const manager = makeManager()

    expect(() => manager.saveOps.restoreFromSave(baseSave(createDefaultPlayer()))).not.toThrow()

    const mid = createDefaultPlayer()
    // M-E (D2): meridian progress needs the qi_refining page unlocked -
    // a mortal + opened meridian is now an integrity violation.
    mid.realmId = 'qi_refining'
    mid.bodyProgression.body_refinement.completedTiers = 3
    mid.bodyProgression.body_refinement.currentTierProgress = 100
    mid.bodyProgression.meridian.openedIds = ['nham_mach', 'doi_mach']
    expect(() => manager.saveOps.restoreFromSave(baseSave(mid))).not.toThrow()
  })

  it('rehydrates body modifiers from canonical state - persisted stale slices are corrected', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()

    // M-E (D2): the meridian progress below is only legit with the
    // qi_refining page unlocked.
    player.realmId = 'qi_refining'
    player.bodyProgression.body_refinement.completedTiers = 1
    player.bodyProgression.meridian.openedIds = ['nham_mach']
    // Stale persisted slices: a completed-tier id the state no longer
    // backs + a fabricated meridian entry. Chapter state wins.
    player.modifiers = [
      {
        id: 'luyen-the:luyen_mach:maxHp',
        sourceId: 'luyen_mach',
        sourceType: 'realm',
        stat: 'maxHp',
        percent: 0.08,
      },
      {
        id: 'bat-mach:doc_mach:strength',
        sourceId: 'doc_mach',
        sourceType: 'realm',
        stat: 'strength',
        percent: 0.05,
      },
    ]

    // Simulate the store-level restore already applied (the active
    // player IS the payload player - saveOps rehydrates on it).
    manager.setActivePlayer(player)
    manager.saveOps.restoreFromSave(baseSave(player))

    const ids = player.modifiers.map(m => m.id)
    // M-F (D1): luyen-the:* is never re-emitted - body gains live in the
    // assembled base, so every persisted luyen-the slice is scrubbed.
    expect(ids.filter(id => id.startsWith('luyen-the:'))).toHaveLength(0)
    expect(ids).not.toContain('bat-mach:doc_mach:strength')
    expect(ids).toContain('bat-mach:nham_mach:maxHp')
  })
})

// M-QI-07 (QI-D4) - physiqueGrade preflight: restore derives the exact
// reachable grade by walking the authored contiguous-prefix chain and
// REJECTS any persisted grade that does not match. No recompute, no
// repair - the save is corrupt.
describe('v74 physiqueGrade preflight (M-QI-07)', () => {
  it('rejects a persisted grade unreachable from the authored chain', () => {
    const manager = makeManager()
    const live = createDefaultPlayer()
    manager.setActivePlayer(live)

    // 6/6 chapter done but the transform never applied - incoherent.
    const stale = createDefaultPlayer()
    stale.realmId = 'qi_refining'
    stale.bodyProgression.body_refinement.completedTiers = 6
    stale.physiqueGrade = 'pham'
    expect(() => manager.saveOps.restoreFromSave(baseSave(stale))).toThrow(/physique/i)
    // Preflight throws before owner mutation - the live player is untouched.
    expect(live.bodyProgression.body_refinement.completedTiers).toBe(0)
    expect(live.physiqueGrade).toBe('pham')

    // Grade outrunning an incomplete chapter.
    const ahead = createDefaultPlayer()
    ahead.realmId = 'qi_refining'
    ahead.bodyProgression.body_refinement.completedTiers = 5
    ahead.physiqueGrade = 'bao'
    expect(() => manager.saveOps.restoreFromSave(baseSave(ahead))).toThrow(/physique/i)

    // Rung with no authored chain - unreachable, not just incoherent.
    for (const rung of ['phap', 'tien'] as const) {
      const unreachable = createDefaultPlayer()
      unreachable.realmId = 'qi_refining'
      unreachable.bodyProgression.body_refinement.completedTiers = 6
      unreachable.physiqueGrade = rung
      expect(() => manager.saveOps.restoreFromSave(baseSave(unreachable))).toThrow(/physique/i)
    }
  })

  it('accepts the canonical pairs - restore is read-only, grade passes through unchanged', () => {
    setActivePinia(createPinia())
    const playerStore = usePlayerStore()
    const manager = makeManager()

    expect(() => manager.saveOps.restoreFromSave(baseSave(createDefaultPlayer()))).not.toThrow()

    const done = createDefaultPlayer()
    done.realmId = 'qi_refining'
    done.bodyProgression.body_refinement.completedTiers = 6
    done.physiqueGrade = 'bao'

    const result = restoreGameSession(playerStore, manager, baseSave(done))
    expect(result.status).toBe('ok')
    // The grade crosses restore verbatim - no re-derive, no re-advance.
    expect(playerStore.physiqueGrade).toBe('bao')
  })
})
