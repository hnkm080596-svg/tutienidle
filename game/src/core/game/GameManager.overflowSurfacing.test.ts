// Task A6 (roadmap 9.8) — surface MaterialBag.add() overflow at reward
// call sites: collectBuilding phải (1) clamp bag tại stackLimit, (2) push
// notification 'bag.overflow' với lượng TRÀN bị mất, (3) quest hook chỉ
// tính lượng THỰC SỰ vào túi (delivered = claimed − overflow). Restore
// save quá cap phải gom đúng MỘT event mỗi loại material tràn.
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import type { PlayerData } from '../player/Player'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'
import type { Material } from '../material/Material'
import { materials } from '../../data/materials/materials'
import type { Building } from '../building/Building'
import type { Quest } from '../quest/Quest'
import type { Pill } from '../pill/Pill'
import type { AlchemyRecipe, ActiveAlchemyJob } from '../alchemy/AlchemySystem'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'

const OVERFLOW_MATERIAL: Material = {
  id: 'mat_overflow_test',
  name: 'Vật Liệu Tràn Test',
  category: 'other',
  sourceType: 'monster',
  stackLimit: 100,
}

const OVERFLOW_BUILDING: Building = {
  id: 'overflow_test_spring',
  name: 'Linh Mạch Test',
  category: 'crafting_station',
  tier: 1,
  maxLevel: 1,
  producesMaterialId: 'mat_overflow_test',
  baseProductionRate: 10,
  baseStorageCapacity: 500,
  upgradeCost: [[]],
}

const OVERFLOW_QUEST: Quest = {
  id: 'overflow_collect_test',
  name: 'Thu thập vật liệu tràn',
  description: 'Test collect quest',
  condition: { kind: 'collect', materialId: 'mat_overflow_test', amount: 5 },
  reward: {},
  cadence: 'once',
}

function makeManager(): GameManager {
  const manager = new GameManager()

  manager.catalogOps.registerMaterials([OVERFLOW_MATERIAL])
  manager.catalogOps.registerBuildings([OVERFLOW_BUILDING])
  manager.catalogOps.registerQuests([OVERFLOW_QUEST])

  return manager
}

describe('GameManager — bag overflow surfacing (9.8)', () => {
  it('collectBuilding tràn túi → bag clamp 100, toast bag.overflow 460, quest progress chỉ tính 40 delivered', () => {
    const manager = makeManager()
    const player: PlayerData = createDefaultPlayer()

    manager.setActivePlayer(player)
    // R8.1 (AR-09): activation moved from the read query to the
    // lifecycle command.
    manager.tickOps.reconcileQuestLifecycle()

    manager.materialBag.add(manager.materialRegistry.get('mat_overflow_test'), 60)

    manager.buildingManager.add({
      instanceId: 'overflow_inst',
      buildingId: 'overflow_test_spring',
      level: 1,
      lastCollectedAt: 0,
    })

    const returned = manager.buildingOps.collectBuilding('overflow_inst', player, 1000)

    expect(returned).toBe(500)
    expect(manager.materialBag.getAmount('mat_overflow_test')).toBe(100)

    const events = manager.drainNotifications()
    const overflowEvent = events.find((event) => event.messageKey === 'bag.overflow')

    expect(overflowEvent).toBeDefined()
    expect(overflowEvent!.kind).toBe('warning')
    expect(overflowEvent!.message).toBe('Túi đầy — mất 460 Vật Liệu Tràn Test')
    expect(overflowEvent!.messageParams).toEqual({
      amount: '460',
      name: 'Vật Liệu Tràn Test',
    })

    const progress = manager.questManager.getProgress('overflow_collect_test')

    expect(progress?.progress).toBe(40)
  })

  it('restoreFromSave material 300 quá cap 100 → bag 100, đúng MỘT event bag.overflow amount 200', () => {
    const manager = makeManager()
    const player: PlayerData = createDefaultPlayer()

    manager.setActivePlayer(player)

    manager.saveOps.restoreFromSave({
      version: CURRENT_SAVE_VERSION,
      player: { ...player },
      techniques: [],
      skills: [],
      materials: [{ materialId: 'mat_overflow_test', amount: 300 }],
      equipment: [],
      equipmentSlots: [],
      pills: [],
      talismans: [],
      formations: [],
      buildings: [],
      quests: { active: [], completedOnceIds: [], lastDailyResetAtMs: 0 },
      productionSites: [],
    })

    expect(manager.materialBag.getAmount('mat_overflow_test')).toBe(100)

    const overflowEvents = manager
      .drainNotifications()
      .filter((event) => event.messageKey === 'bag.overflow')

    expect(overflowEvents).toHaveLength(1)
    expect(overflowEvents[0]!.messageParams).toEqual({
      amount: '200',
      name: 'Vật Liệu Tràn Test',
    })
  })
})

// ARCH-012 (M12) — production/alchemy settle events are RECEIPTS
// (amount/overflow, pills/delivered/overflow). The notification adapter in
// GameManagerTickOps must surface DELIVERED quantity and route the lost
// part through the shared bag.overflow notification — before the fix it
// toasted the rolled amount even when the bag absorbed nothing.
describe('GameManager — production/alchemy settle receipts (ARCH-012, M12)', () => {
  it('production cycle vào bag ĐẦY → cap giữ nguyên, KHÔNG có loot toast, bag.overflow ghi lượng mất, quest progress = 0', () => {
    const manager = new GameManager()
    const player: PlayerData = createDefaultPlayer()

    // Real material data — the cycle roll resolves a real materialId and
    // grantCycleRewards skips unregistered ids entirely.
    manager.catalogOps.registerMaterials(materials)
    manager.setActivePlayer(player)
    manager.tickOps.reconcileQuestLifecycle()

    const siteId = manager.productionSystem.getSiteDefinitions()[0]!.siteId

    // Backdate so the cycle is already complete on the next update tick.
    expect(
      manager.productionSystem.startCycle(siteId, player.realmId, Date.now() - 86_400_000),
    ).toBe(true)

    const cycle = manager.productionSystem.getState(siteId)!.activeCycle!
    const rewards = manager.productionSystem.rollRewards(cycle)

    expect(rewards.length).toBeGreaterThan(0)

    // Deterministic seed -> the SAME rewards the settle will grant. Fill
    // every rolled material's stack to its cap so delivery clamps to 0.
    const rolled = rewards.map((reward) => {
      const material = manager.materialRegistry.get(reward.materialId)
      const limit = material.stackLimit ?? MAX_STACK_AMOUNT

      manager.materialBag.add(material, limit)

      return { reward, material, limit }
    })

    const collectQuest: Quest = {
      id: 'prod_collect_overflow',
      name: 'Thu thập (production overflow)',
      description: 'collect-quest over the first rolled material',
      condition: { kind: 'collect', materialId: rolled[0]!.reward.materialId, amount: 5 },
      reward: {},
      cadence: 'once',
    }
    manager.catalogOps.registerQuests([collectQuest])
    manager.tickOps.reconcileQuestLifecycle()

    manager.tickOps.update(1)

    for (const { reward, limit } of rolled) {
      expect(manager.materialBag.getAmount(reward.materialId)).toBe(limit)
    }

    const events = manager.drainNotifications()
    const overflowEvents = events.filter((event) => event.messageKey === 'bag.overflow')

    expect(overflowEvents).toHaveLength(rolled.length)

    for (const { reward, material } of rolled) {
      const evt = overflowEvents.find(
        (event) => event.messageParams?.name === material.name,
      )

      expect(evt, `overflow event for ${reward.materialId}`).toBeDefined()
      expect(evt!.kind).toBe('warning')
      expect(evt!.messageParams?.amount).toBe(String(reward.amount))

      // No loot toast may claim a delivery the bag never accepted.
      expect(
        events.some(
          (event) => event.kind === 'loot' && (event.message ?? '').includes(material.name),
        ),
      ).toBe(false)
    }

    // The collect-quest counted only DELIVERED quantity -> still 0.
    expect(manager.questManager.getProgress('prod_collect_overflow')?.progress ?? 0).toBe(0)
  })

  it('production cycle vào bag TRỐNG → loot toast +N đúng delivered, không overflow event, quest progress = amount', () => {
    const manager = new GameManager()
    const player: PlayerData = createDefaultPlayer()

    manager.catalogOps.registerMaterials(materials)
    manager.setActivePlayer(player)
    manager.tickOps.reconcileQuestLifecycle()

    const siteId = manager.productionSystem.getSiteDefinitions()[0]!.siteId

    expect(
      manager.productionSystem.startCycle(siteId, player.realmId, Date.now() - 86_400_000),
    ).toBe(true)

    const cycle = manager.productionSystem.getState(siteId)!.activeCycle!
    const rewards = manager.productionSystem.rollRewards(cycle)

    expect(rewards.length).toBeGreaterThan(0)

    const collectQuest: Quest = {
      id: 'prod_collect_clean',
      name: 'Thu thập (production clean)',
      description: 'collect-quest over the first rolled material',
      condition: { kind: 'collect', materialId: rewards[0]!.materialId, amount: 9999 },
      reward: {},
      cadence: 'once',
    }
    manager.catalogOps.registerQuests([collectQuest])
    manager.tickOps.reconcileQuestLifecycle()

    manager.tickOps.update(1)

    const events = manager.drainNotifications()

    for (const reward of rewards) {
      const material = manager.materialRegistry.get(reward.materialId)

      expect(manager.materialBag.getAmount(reward.materialId)).toBe(reward.amount)
      expect(
        events.some(
          (event) =>
            event.kind === 'loot' &&
            event.message === `${material.name} +${reward.amount}`,
        ),
      ).toBe(true)
    }

    expect(events.filter((event) => event.messageKey === 'bag.overflow')).toHaveLength(0)
    expect(manager.questManager.getProgress('prod_collect_clean')?.progress).toBe(
      rewards[0]!.amount,
    )
  })

  it('alchemy jobs vào PillBag sát cap → toast x<delivered>, bag.overflow cho phần mất, job hỏng vẫn báo thất bại', () => {
    const OVERFLOW_PILL: Pill = {
      id: 'pill_overflow_test',
      name: 'Đan Tràn Test',
      type: 'healing',
      grade: 'hoang',
      effects: [],
    }
    const OVERFLOW_RECIPE: AlchemyRecipe = {
      id: 'recipe_overflow_test',
      pillId: 'pill_overflow_test',
      realmId: 'mortal',
      // 'myriad_year' base success 100% -> each job deterministically yields
      // exactly 1 pill (no Math.random dependency in this test).
      herbVariants: [{ materialId: 'test_herb_myriad', age: 'myriad_year', label: 'Vạn Niên' }],
      herbAmount: 1,
      fuelWoodRealmId: 'mortal',
      fuelWoodAmount: 1,
      spiritStoneCost: 0,
      baseDurationSeconds: 1,
    }

    const makeJob = (jobId: string, recipeId = OVERFLOW_RECIPE.id): ActiveAlchemyJob => ({
      jobId,
      recipeId,
      pillId: OVERFLOW_PILL.id,
      herbMaterialId: 'test_herb_myriad',
      startedAtMs: 0,
      completesAtMs: 1, // already due on the first update tick
      roomLevelAtStart: 1,
    })

    const manager = new GameManager()
    const player: PlayerData = createDefaultPlayer()

    manager.catalogOps.registerPills([OVERFLOW_PILL])
    manager.catalogOps.registerAlchemyRecipes([OVERFLOW_RECIPE])
    manager.setActivePlayer(player)

    // One free slot left: job 1 delivers its pill, job 2 loses its pill.
    manager.pillBag.add(OVERFLOW_PILL, MAX_STACK_AMOUNT - 1)

    manager.alchemySystem.restoreJobs([
      makeJob('job_ok_1'),
      makeJob('job_ok_2'),
      // Deterministic failure: the recipe id resolves to nothing -> the
      // system emits success:false instead of silently dropping the job.
      makeJob('job_broken_recipe', 'recipe_missing'),
    ])

    manager.tickOps.update(1)

    expect(manager.pillBag.getAmount(OVERFLOW_PILL.id)).toBe(MAX_STACK_AMOUNT)

    const events = manager.drainNotifications()

    // Exactly ONE delivered toast (x1), not two — job 2 delivered nothing.
    const successToasts = events.filter(
      (event) => event.kind === 'craft' && event.message === `${OVERFLOW_PILL.name} x1`,
    )
    expect(successToasts).toHaveLength(1)

    const overflowEvents = events.filter((event) => event.messageKey === 'bag.overflow')
    expect(overflowEvents).toHaveLength(1)
    expect(overflowEvents[0]!.kind).toBe('warning')
    expect(overflowEvents[0]!.messageParams).toEqual({
      amount: '1',
      name: OVERFLOW_PILL.name,
    })

    // Failure notification preserved for the unresolvable-recipe job.
    expect(
      events.some(
        (event) =>
          event.kind === 'craft' && event.message === `Luyện ${OVERFLOW_PILL.name} thất bại`,
      ),
    ).toBe(true)
  })
})
