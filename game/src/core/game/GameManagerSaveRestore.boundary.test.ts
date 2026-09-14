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

function makeManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerSkillTemplates(SKILLS)
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
  unlocked: true,
  equipped: false,
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
  unlocked: true,
  equipped: false,
}

const LIVE_TECHNIQUE: Technique = {
  id: 'live_only_technique',
  name: 'Live-only technique',
  description: 'seeded live, absent from the payload',
  unlocked: true,
  equipped: false,
}

const SAVED_TECHNIQUE: Technique = {
  id: 'saved_technique',
  name: 'Saved technique',
  description: 'payload entry',
  unlocked: true,
  equipped: false,
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
  bonusAffixSlots: 0,
  appliedTalismanIds: [],
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

  it('techniques: an empty slice clears the live set; a saved set replaces it', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()
    manager.techniqueManager.add(structuredClone(LIVE_TECHNIQUE))

    manager.saveOps.restoreFromSave(baseSave(player, { techniques: [] }))
    expect(manager.techniqueManager.getAll()).toEqual([])

    manager.saveOps.restoreFromSave(baseSave(player, { techniques: [structuredClone(SAVED_TECHNIQUE)] }))
    expect(manager.techniqueManager.getAll().map((technique) => technique.id)).toEqual(['saved_technique'])
    expect(manager.techniqueManager.has('live_only_technique')).toBe(false)
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
    const legacyTechnique = structuredClone(TECHNIQUES[0]!)
    legacyTechnique.name = 'stale saved technique name'

    const save = baseSave(player, {
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

    const save = baseSave(player, {
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
    save.techniques[0]!.name = 'payload-side mutation'
    save.equipment[0]!.forgeUsesRemaining = 0
    save.equipment[0]!.affixes[0]!.value = 999
    save.buildings[0]!.level = 9
    save.equipmentSlots[0]!.enhanceLevel = 99
    save.productionSites![0]!.level = 9
    save.alchemyJobs![0]!.completesAtMs = 0
    save.quests!.active[0]!.progress = 999

    expect(manager.skillManager.get('saved_skill')!.level).toBe(3)
    expect(manager.techniqueManager.get('saved_technique')!.name).toBe('Saved technique')
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
  function populatedSave(manager: GameManager, player: PlayerData): GameSave {
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
