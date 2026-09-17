// R10 (AR-12) - snapshot isolation: buildGameSave must produce a VALUE
// at a point in time. Mutating live state after the build must not
// change the snapshot (nested player fields included).
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { makeInstance } from '../../core/equipment/EquipmentInstance.fixture'
import { buildGameSave } from './SaveSystem'

function createBootedGameManager(): GameManager {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerMaterials(materials)
  gameManager.catalogOps.registerEquipment(equipment)
  gameManager.catalogOps.registerAffixes(affixes)
  gameManager.catalogOps.registerBuildings(buildings)
  return gameManager
}

describe('buildGameSave snapshot isolation (AR-12)', () => {
  it('mutating live nested player state after build does not change the snapshot', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    const save = buildGameSave(player, gameManager)
    const snapshot = structuredClone(save)

    // Mutate live nested + top-level fields AFTER the build.
    player.baseStats.strength = 101
    player.name = 'changed-name'
    player.cultivation = 12345
    if (player.modifiers?.[0]) {
      player.modifiers[0].sourceId = 'mutated-after-build'
    }
    player.lastSavedAt = 1

    expect(save).toEqual(snapshot)
  })

  it('mutating manager-owned state after build does not change the snapshot', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    const save = buildGameSave(player, gameManager)
    const snapshot = structuredClone(save)

    // Live manager state mutations (quests active list, production sites).
    gameManager.questManager.getActive().push({
      questId: 'ghost_quest',
      progress: 99,
      claimed: false,
    })

    expect(save).toEqual(snapshot)
  })

  // M1 (ARCH-001) — every GameSave slice is a detached value: mutating a
  // live manager object AFTER buildGameSave() must not reach the snapshot,
  // and mutating the snapshot must not reach live state. Before this fix,
  // getAll()-sourced slices (skills/techniques/equipment/buildings/
  // equipmentSlots/alchemyJobs/production nested cycles) aliased the live
  // objects in both directions.
  it('mutating a live skill after buildGameSave (level 1 -> 11) does not alter the snapshot — and neither does any other slice', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    const liveSkill = structuredClone(SKILLS[0]!)
    liveSkill.level = 1
    gameManager.skillManager.add(liveSkill)

    const liveTechnique = structuredClone(TECHNIQUES[0]!)
    gameManager.techniqueManager.add(liveTechnique)

    const liveItem = makeInstance({ instanceId: 'iso-item', itemId: 'base_kiem' })
    gameManager.equipmentBag.add(liveItem)

    gameManager.buildingManager.add({
      instanceId: 'iso-building',
      buildingId: buildings[0]!.id,
      level: 1,
      lastCollectedAt: 0,
    })

    gameManager.equipmentSlotManager.get('weapon').enhanceLevel = 4

    const siteId = gameManager.productionSystem.getSiteDefinitions()[0]!.siteId
    const liveSite = gameManager.productionSystem.ensureSiteState(siteId)
    liveSite.workerCycles = [{ cycleId: 'w1', siteId, collectionRealmId: 'mortal', siteLevelAtStart: 1, rewardTableVersion: 1, rollSeed: 2, startedAtMs: 0, completesAtMs: 1000 }]

    gameManager.alchemySystem.restoreJobs([{
      jobId: 'iso-job',
      recipeId: 'r',
      pillId: 'p',
      herbMaterialId: 'h',
      startedAtMs: 0,
      completesAtMs: 999,
      roomLevelAtStart: 1,
    }])

    const save = buildGameSave(player, gameManager)
    const snapshot = structuredClone(save)

    // Mutate every live source the snapshot was built from.
    liveSkill.level = 11
    liveTechnique.name = 'mutated-after-build'
    liveItem.affixes.push({ affixId: 'suffix_accuracy', tier: 1, value: 9 })
    liveItem.forgeUsesRemaining = 0
    gameManager.buildingManager.get('iso-building')!.level = 9
    gameManager.equipmentSlotManager.get('weapon').enhanceLevel = 99
    liveSite.workerCycles![0]!.rollSeed = -1
    liveSite.level = 9
    gameManager.alchemySystem.getJobs()[0]!.completesAtMs = -1

    expect(save).toEqual(snapshot)
    expect(save.skills[0]!.level).toBe(1)
  })

  it('mutating the built save does not reach live manager state (the snapshot is a value in both directions)', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    const liveSkill = structuredClone(SKILLS[0]!)
    liveSkill.level = 1
    gameManager.skillManager.add(liveSkill)
    gameManager.techniqueManager.add(structuredClone(TECHNIQUES[0]!))
    const liveItem = makeInstance({ instanceId: 'iso-item', itemId: 'base_kiem' })
    gameManager.equipmentBag.add(liveItem)
    gameManager.buildingManager.add({
      instanceId: 'iso-building',
      buildingId: buildings[0]!.id,
      level: 1,
      lastCollectedAt: 0,
    })
    gameManager.equipmentSlotManager.get('weapon').enhanceLevel = 4
    gameManager.alchemySystem.restoreJobs([{
      jobId: 'iso-job', recipeId: 'r', pillId: 'p', herbMaterialId: 'h',
      startedAtMs: 0, completesAtMs: 999, roomLevelAtStart: 1,
    }])
    gameManager.questManager.ensureActive({
      id: 'iso_quest', name: 'q', description: 'd',
      condition: { kind: 'kill', amount: 1 }, reward: {}, cadence: 'daily',
    })

    const save = buildGameSave(player, gameManager)

    save.skills[0]!.level = 77
    save.techniques[0]!.name = 'save-side mutation'
    save.equipment[0]!.forgeUsesRemaining = 0
    save.buildings[0]!.level = 9
    save.equipmentSlots.find((entry) => entry.slot === 'weapon')!.enhanceLevel = 99
    save.alchemyJobs![0]!.completesAtMs = -1
    save.quests!.active[0]!.progress = 999

    expect(gameManager.skillManager.get(liveSkill.id)!.level).toBe(1)
    expect(gameManager.techniqueManager.getAll()[0]!.name).not.toBe('save-side mutation')
    expect(gameManager.equipmentBag.get('iso-item')!.forgeUsesRemaining).toBe(liveItem.forgeUsesTotal)
    expect(gameManager.buildingManager.get('iso-building')!.level).toBe(1)
    expect(gameManager.equipmentSlotManager.get('weapon').enhanceLevel).toBe(4)
    expect(gameManager.alchemySystem.getJobs()[0]!.completesAtMs).toBe(999)
    expect(gameManager.questManager.getState().active[0]!.progress).toBe(0)
  })

  // Production regression (found live, not from a synthetic fixture):
  // usePlayerStore's actual `this.$state` is a Vue-reactive Proxy, not a
  // plain PlayerData object. structuredClone has no concept of Proxy
  // exotic objects — it throws DataCloneError the instant it meets one,
  // at ANY nesting depth, including a field Vue only wrapped lazily after
  // some earlier getter/computed touched it (this is why a
  // freshly-constructed reactive() with no prior access still needs to
  // exercise a getter here to reproduce it — real gameplay's `finalStats`
  // getter runs every tick and touches baseStats/modifiers/
  // externalModifiers this way). toRaw() alone is not sufficient either —
  // it only unwraps the OUTERMOST proxy, not nested ones.
  it('accepts a Vue-reactive player object (real usePlayerStore.$state shape), even after nested fields were reactively accessed', () => {
    const gameManager = createBootedGameManager()
    const reactivePlayer = reactive(createDefaultPlayer())

    reactivePlayer.modifiers.push({ id: 'x', sourceId: 'x', sourceType: 'attribute', stat: 'might', flat: 1 })
    reactivePlayer.externalModifiers.push({ id: 'y', sourceId: 'y', sourceType: 'attribute', stat: 'might', flat: 1 })

    // Force Vue to lazily wrap nested modifier objects in their own
    // reactive Proxies, matching what reading `finalStats` does live.
    void reactivePlayer.baseStats.might
    for (const modifier of reactivePlayer.modifiers) void modifier.flat
    for (const modifier of reactivePlayer.externalModifiers) void modifier.flat

    expect(() => buildGameSave(reactivePlayer, gameManager)).not.toThrow()

    const save = buildGameSave(reactivePlayer, gameManager)
    expect(save.player.modifiers).toEqual([{ id: 'x', sourceId: 'x', sourceType: 'attribute', stat: 'might', flat: 1 }])
  })
})
