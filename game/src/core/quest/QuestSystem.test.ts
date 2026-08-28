import { describe, expect, it } from 'vitest'
import { QuestSystem } from './QuestSystem'
import { QuestRegistry } from './QuestRegistry'
import { QuestManager } from './QuestManager'
import type { Quest } from './Quest'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { PillRegistry } from '../pill/PillRegistry'
import { PillBag } from '../pill/PillBag'
import { RewardSystem } from '../reward/RewardSystem'
import type { RewardReceiver } from '../reward/RewardSystem'
import type { Material } from '../material/Material'
import type { PlayerData } from '../player/Player'

function createPlayer(realmId = 'qi_refining'): PlayerData {
  return { realmId } as unknown as PlayerData
}

function createMaterial(id: string): Material {
  return { id, name: id, category: 'herb', sourceType: 'exploration' }
}

function createReceiver(): RewardReceiver & { spiritStone: number; cultivation: number; insight: number } {
  return {
    spiritStone: 0,
    cultivation: 0,
    insight: 0,
    addTechniqueInsight(amount) {
      this.insight += amount
    },
    addCultivation(amount) {
      this.cultivation += amount
    },
    addSpiritStone(amount) {
      this.spiritStone += amount
    },
  }
}

describe('QuestSystem', () => {
  const collectQuest: Quest = {
    id: 'collect_test',
    name: 'Thu thập test',
    description: '',
    condition: { kind: 'collect', materialId: 'linh_chi', amount: 5 },
    reward: { reward: { spiritStone: 10 } },
    cadence: 'once',
  }

  const killQuest: Quest = {
    id: 'kill_test',
    name: 'Tiêu diệt test',
    description: '',
    condition: { kind: 'kill', enemyId: 'wild_wolf', amount: 3 },
    reward: { reward: { cultivation: 20 } },
    cadence: 'daily',
  }

  function setup() {
    const registry = new QuestRegistry()
    registry.register(collectQuest)
    registry.register(killQuest)

    const manager = new QuestManager()
    const system = new QuestSystem()

    const materialRegistry = new MaterialRegistry()
    materialRegistry.register(createMaterial('linh_chi'))
    const materialBag = new MaterialBag()

    const pillRegistry = new PillRegistry()
    const pillBag = new PillBag()

    const bags = { materialRegistry, materialBag, pillRegistry, pillBag }
    const rewardSystem = new RewardSystem()

    return { registry, manager, system, bags, rewardSystem, materialRegistry, materialBag }
  }

  it('turn-in trừ đúng bag khi claim collect quest', () => {
    const { registry, manager, system, bags, rewardSystem, materialRegistry, materialBag } = setup()
    const player = createPlayer()

    system.getActiveQuests(registry, manager, player)
    materialBag.add(materialRegistry.get('linh_chi'), 5)
    manager.incrementProgress('collect_test', 5)

    const receiver = createReceiver()
    expect(system.claim(registry, manager, rewardSystem, receiver, bags, 'collect_test')).toBe(true)
    expect(materialBag.getAmount('linh_chi')).toBe(0)
    expect(receiver.spiritStone).toBe(10)
  })

  it('reject claim nếu progress đủ nhưng bag thiếu đồ (đã tiêu ở nơi khác)', () => {
    const { registry, manager, system, bags, rewardSystem } = setup()
    const player = createPlayer()

    system.getActiveQuests(registry, manager, player)
    manager.incrementProgress('collect_test', 5)

    const receiver = createReceiver()
    expect(system.claim(registry, manager, rewardSystem, receiver, bags, 'collect_test')).toBe(false)
  })

  it('claim không cho double-claim', () => {
    const { registry, manager, system, bags, rewardSystem, materialRegistry, materialBag } = setup()
    const player = createPlayer()

    system.getActiveQuests(registry, manager, player)
    materialBag.add(materialRegistry.get('linh_chi'), 5)
    manager.incrementProgress('collect_test', 5)

    const receiver = createReceiver()
    expect(system.claim(registry, manager, rewardSystem, receiver, bags, 'collect_test')).toBe(true)
    expect(system.claim(registry, manager, rewardSystem, receiver, bags, 'collect_test')).toBe(false)
  })

  it('kill increment chỉ áp dụng đúng enemyId', () => {
    const { registry, manager, system } = setup()
    const player = createPlayer()

    system.getActiveQuests(registry, manager, player)
    system.onEnemyDefeated(registry, manager, 'bandit', undefined)
    expect(manager.getProgress('kill_test')?.progress).toBe(0)

    system.onEnemyDefeated(registry, manager, 'wild_wolf', undefined)
    expect(manager.getProgress('kill_test')?.progress).toBe(1)
  })

  it('onMaterialCollected tăng progress collect-quest khớp materialId (review 2026-08-28 bug #3)', () => {
    const { registry, manager, system } = setup()
    const player = createPlayer()

    system.getActiveQuests(registry, manager, player)

    // Material lệch id → không tăng.
    system.onMaterialCollected(registry, manager, 'other_material', 9)
    expect(manager.getProgress('collect_test')?.progress).toBe(0)

    // Đúng materialId → tăng đúng lượng.
    system.onMaterialCollected(registry, manager, 'linh_chi', 3)
    expect(manager.getProgress('collect_test')?.progress).toBe(3)

    system.onMaterialCollected(registry, manager, 'linh_chi', 2)
    expect(manager.getProgress('collect_test')?.progress).toBe(5)
  })

  it('onMaterialCollected bỏ qua amount NaN/âm và quest đã claim', () => {
    const { registry, manager, system, bags, rewardSystem, materialRegistry, materialBag } = setup()
    const player = createPlayer()

    system.getActiveQuests(registry, manager, player)
    materialBag.add(materialRegistry.get('linh_chi'), 5)
    manager.incrementProgress('collect_test', 5)

    const receiver = createReceiver()
    expect(system.claim(registry, manager, rewardSystem, receiver, bags, 'collect_test')).toBe(true)

    // Đã claim → không tăng nữa; NaN/âm bị bỏ qua.
    system.onMaterialCollected(registry, manager, 'linh_chi', 7)
    system.onMaterialCollected(registry, manager, 'linh_chi', Number.NaN)
    system.onMaterialCollected(registry, manager, 'linh_chi', -5)
    expect(manager.getProgress('collect_test')?.progress).toBe(5)
  })

  it('daily reset xoá progress chưa claim nhưng không đụng completedOnceIds', () => {
    const { registry, manager, system } = setup()
    const player = createPlayer()

    system.getActiveQuests(registry, manager, player)
    manager.incrementProgress('kill_test', 2)
    manager.markCompletedOnce('collect_test')

    const resetHappened = system.checkAndResetDaily(registry, manager, player, Date.now() + 25 * 60 * 60 * 1000)
    expect(resetHappened).toBe(true)
    expect(manager.getProgress('kill_test')?.progress ?? 0).toBe(0)
    expect(manager.isCompletedOnce('collect_test')).toBe(true)

    const notResetTwice = system.checkAndResetDaily(registry, manager, player, Date.now() + 25 * 60 * 60 * 1000)
    expect(notResetTwice).toBe(false)
  })
})
