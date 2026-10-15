import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { GameManager } from '../game/GameManager'
import { buildGameSave } from '../../services/save/SaveSystem'
import { primeMortalCreationPick } from '../../services/save/GameSave.fixture'
import { SKILLS } from '../../data/skill/Skills'
import { GameManagerQuestOps } from '../game/GameManagerQuestOps'
import { GameManagerRewardOps } from '../game/GameManagerRewardOps'
import { NotificationQueue } from '../game/NotificationQueue'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { SPIRIT_STONE_MATERIAL, SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'
import type { Material } from '../material/Material'
import { PillBag } from '../pill/PillBag'
import type { Pill } from '../pill/Pill'
import { PillRegistry } from '../pill/PillRegistry'
import { RewardSystem } from '../reward/RewardSystem'
import { createDefaultPlayer } from '../player/Player'
import { QuestManager } from './QuestManager'
import { QuestRegistry } from './QuestRegistry'
import { QuestSystem } from './QuestSystem'
import type { Quest } from './Quest'

class ThrowAfterStoneCreditBag extends MaterialBag {
  failOnce = true
  failOnDrop = false
  failOnDebit = false
  beforeFailure?: () => void

  override add(material: Material, amount: number): number {
    const overflow = super.add(material, amount)
    if (material.id === SPIRIT_STONE_MATERIAL_ID && this.failOnce) {
      this.failOnce = false
      this.beforeFailure?.()
      throw new Error('failed after stone credit')
    }
    if (material.id === 'wood' && this.failOnDrop) {
      this.failOnDrop = false
      throw new Error('failed after material drop credit')
    }
    return overflow
  }

  override remove(materialId: string, amount: number): boolean {
    const debited = super.remove(materialId, amount)
    if (materialId === 'wood' && this.failOnDebit) {
      this.failOnDebit = false
      return false
    }
    return debited
  }
}

class ThrowAfterPillCreditBag extends PillBag {
  failOnce = false
  override add(pill: Pill, amount: number, quality?: Parameters<PillBag['add']>[2]): number {
    const overflow = super.add(pill, amount, quality)
    if (this.failOnce) {
      this.failOnce = false
      throw new Error('failed after pill drop credit')
    }
    return overflow
  }
}

describe('quest production reward transaction', () => {
  it.each([
    ['legacy', 'stone'], ['allOf', 'stone'],
    ['legacy', 'drop'], ['allOf', 'drop'],
    ['legacy', 'pill'], ['allOf', 'pill'],
    ['legacy', 'debit'], ['allOf', 'debit'],
  ])('restores owners after %s reward %s failure then credits once across save/retry', (shape, stage) => {
    const wood: Material = { id: 'wood', name: 'wood', category: 'herb', sourceType: 'exploration' }
    const quest: Quest = {
      id: 'settlement', name: 'settlement', description: '', cadence: 'once',
      condition: shape === 'legacy'
        ? { kind: 'collect', materialId: wood.id, amount: 1 }
        : { kind: 'allOf', objectives: [{ id: 'wood', kind: 'collect', materialId: wood.id, amount: 1 }] },
      reward: { reward: { skillInsight: 3, cultivation: 5, spiritStone: 10 },
        itemDrops: [{ kind: 'material', itemId: wood.id, amount: 2 },
          { kind: 'pill', itemId: 'test_pill', amount: 1 }] },
    }
    const questRegistry = new QuestRegistry()
    questRegistry.register(quest)
    questRegistry.register({
      id: 'other_collect', name: 'other_collect', description: '', cadence: 'once',
      condition: { kind: 'collect', materialId: wood.id, amount: 3 }, reward: {},
    })
    const questManager = new QuestManager()
    const questSystem = new QuestSystem()
    const rewardSystem = new RewardSystem()
    const materialRegistry = new MaterialRegistry()
    materialRegistry.register(wood)
    materialRegistry.register(SPIRIT_STONE_MATERIAL)
    const materialBag = new ThrowAfterStoneCreditBag()
    materialBag.add(wood, 1)
    materialBag.failOnce = stage === 'stone'
    materialBag.failOnDrop = stage === 'drop'
    materialBag.failOnDebit = stage === 'debit'
    const pillRegistry = new PillRegistry()
    pillRegistry.register({ id: 'test_pill', name: 'test_pill', type: 'material', grade: 'hoang', effects: [] })
    const pillBag = new ThrowAfterPillCreditBag()
    pillBag.failOnce = stage === 'pill'
    const notifications = new NotificationQueue()
    const player = reactive(createDefaultPlayer())
    const rewardOps = new GameManagerRewardOps({ rewardSystem, materialRegistry, materialBag,
      notifications, notifyMaterialGained: (id, delivered) =>
        questSystem.onMaterialCollected(questRegistry, questManager, id, delivered) })
    const ops = new GameManagerQuestOps({ questSystem, questRegistry, questManager, rewardSystem,
      materialRegistry, materialBag, pillRegistry, pillBag, notifications,
      getEnemyTemplate: () => undefined, getActivePlayer: () => player,
      buildPlayerRewardReceiver: (current) => rewardOps.buildPlayerRewardReceiver(current) })
    questSystem.reconcileActiveQuests(questRegistry, questManager, player)
    questSystem.onMaterialCollected(questRegistry, questManager, wood.id, 1)
    expect(questManager.getProgress('other_collect')?.progress).toBe(1)
    const startingPlayer = JSON.parse(JSON.stringify(player))
    expect(Object.hasOwn(player, 'cultivationPath')).toBe(true)
    expect(Object.hasOwn(player, 'pendingTalentEntitlement')).toBe(true)
    const originalSpellPath = player.spellPath
    const originalStats = player.baseStats
    const originalTalentIds = player.selectedTalentIds
    if (stage === 'stone') {
      materialBag.beforeFailure = () => {
        player.spellPath.element = 'fire'
        player.selectedTalentIds.push('injected_while_claiming')
        player.cultivationOvercharge += 4
      }
    }

    expect(() => ops.claimQuest(quest.id)).toThrow(
      stage === 'stone' ? 'failed after stone credit'
        : stage === 'drop' ? 'failed after material drop credit'
          : stage === 'debit' ? 'Quest turn-in debit failed' : 'failed after pill drop credit',
    )
    expect(player).toEqual(startingPlayer)
    expect(Object.hasOwn(player, 'cultivationPath')).toBe(true)
    expect(Object.hasOwn(player, 'pendingTalentEntitlement')).toBe(true)
    expect(player.spellPath).toBe(originalSpellPath)
    expect(player.baseStats).toBe(originalStats)
    expect(player.selectedTalentIds).toBe(originalTalentIds)
    expect(materialBag.getAmount(wood.id)).toBe(1)
    expect(materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(0)
    expect(pillBag.getAmount('test_pill')).toBe(0)
    expect(questManager.getProgress(quest.id)?.claimed).toBe(false)
    expect(questManager.getProgress('other_collect')?.progress).toBe(1)
    expect(questManager.isCompletedOnce(quest.id)).toBe(false)
    expect(notifications.drain()).toEqual([])

    // Persist and reload every mutated owner, not just the quest receipt.
    const saved = JSON.parse(JSON.stringify({ player, quests: questManager.getState(),
      materials: materialBag.getAll(), pills: pillBag.getAll() }))
    Object.assign(player, saved.player)
    questManager.restore(saved.quests)
    materialBag.restoreStacks(saved.materials)
    pillBag.restoreStacks(saved.pills)
    expect(ops.claimQuest(quest.id)).toBe(true)
    expect(player.skillInsight).toBe(startingPlayer.skillInsight + 3)
    expect(player.cultivation).toBe(startingPlayer.cultivation + 5)
    expect(materialBag.getAmount(wood.id)).toBe(2)
    expect(materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(10)
    expect(pillBag.getAmount('test_pill')).toBe(1)
    expect(questManager.getProgress('other_collect')?.progress).toBe(3)
    expect(questManager.isCompletedOnce(quest.id)).toBe(true)
    questManager.restore(JSON.parse(JSON.stringify(questManager.getState())))
    expect(ops.claimQuest(quest.id)).toBe(false)
    expect(player.skillInsight).toBe(startingPlayer.skillInsight + 3)
    expect(materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(10)
  })
})


describe('quest claim post-settlement failure', () => {
  it('rolls back rewards and receipt when success notice throws after enqueue', () => {
    class FailOnceSuccessNotice extends NotificationQueue {
      failOnce = true
      override push(event: Parameters<NotificationQueue['push']>[0]): void {
        super.push(event)
        if (event.kind === 'loot' && this.failOnce) {
          this.failOnce = false
          throw new Error('success notice failure')
        }
      }
    }
    const quest: Quest = {
      id: 'notice_failure', name: 'notice_failure', description: '', cadence: 'once',
      condition: { kind: 'collect', materialId: 'wood', amount: 1 },
      reward: { reward: { skillInsight: 3, cultivation: 5, spiritStone: 10 } },
    }
    const questRegistry = new QuestRegistry()
    questRegistry.register(quest)
    const questManager = new QuestManager()
    const questSystem = new QuestSystem()
    const rewardSystem = new RewardSystem()
    const materialRegistry = new MaterialRegistry()
    const wood: Material = { id: 'wood', name: 'wood', category: 'herb', sourceType: 'exploration' }
    materialRegistry.register(wood)
    materialRegistry.register(SPIRIT_STONE_MATERIAL)
    const materialBag = new MaterialBag()
    materialBag.add(wood, 1)
    const pillRegistry = new PillRegistry()
    const pillBag = new PillBag()
    const notifications = new FailOnceSuccessNotice()
    const player = reactive(createDefaultPlayer())
    const rewardOps = new GameManagerRewardOps({ rewardSystem, materialRegistry, materialBag,
      notifications, notifyMaterialGained: (id, delivered) =>
        questSystem.onMaterialCollected(questRegistry, questManager, id, delivered) })
    const ops = new GameManagerQuestOps({ questSystem, questRegistry, questManager, rewardSystem,
      materialRegistry, materialBag, pillRegistry, pillBag, notifications,
      getEnemyTemplate: () => undefined, getActivePlayer: () => player,
      buildPlayerRewardReceiver: (current) => rewardOps.buildPlayerRewardReceiver(current) })
    questSystem.reconcileActiveQuests(questRegistry, questManager, player)
    questSystem.onMaterialCollected(questRegistry, questManager, wood.id, 1)
    const savedPlayer = JSON.parse(JSON.stringify(player))
    expect(() => ops.claimQuest(quest.id)).toThrow('success notice failure')
    expect(player).toEqual(savedPlayer)
    expect(materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(0)
    expect(questManager.getProgress(quest.id)?.claimed).toBe(false)
    expect(questManager.isCompletedOnce(quest.id)).toBe(false)
    expect(notifications.drain()).toEqual([])
    expect(ops.claimQuest(quest.id)).toBe(true)
    expect(player.skillInsight).toBe(savedPlayer.skillInsight + 3)
    expect(materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(10)
    expect(ops.claimQuest(quest.id)).toBe(false)
  })
})

describe('quest claim through real save snapshots', () => {
  it('persists rollback after a partial receiver credit, then persists exactly one successful retry', () => {
    const wood: Material = { id: 'save_wood', name: 'save_wood', category: 'herb', sourceType: 'exploration' }
    const quest: Quest = {
      id: 'save_settlement', name: 'save_settlement', description: '', cadence: 'once',
      condition: { kind: 'collect', materialId: wood.id, amount: 1 },
      reward: { reward: { skillInsight: 3, cultivation: 5, spiritStone: 10 } },
    }
    const setup = (): GameManager => {
      const manager = new GameManager()
      manager.catalogOps.registerMaterials([wood, SPIRIT_STONE_MATERIAL])
      manager.catalogOps.registerSkillTemplates(SKILLS)
      manager.catalogOps.registerQuests([quest])
      return manager
    }

    const manager = setup()
    const player = reactive(createDefaultPlayer())
    primeMortalCreationPick(player, manager.skillManager)
    manager.setActivePlayer(player)
    manager.materialBag.add(wood, 1)
    manager.questSystem.reconcileActiveQuests(manager.questRegistry, manager.questManager, player)
    manager.questOps.notifyMaterialGained(wood.id, 1)
    const initialInsight = player.skillInsight
    const initialCultivation = player.cultivation
    const originalAdd = manager.materialBag.add.bind(manager.materialBag)
    const failure = vi.spyOn(manager.materialBag, 'add').mockImplementation((material, amount) => {
      const overflow = originalAdd(material, amount)
      if (material.id === SPIRIT_STONE_MATERIAL_ID) throw new Error('stone already credited')
      return overflow
    })
    expect(() => manager.questOps.claimQuest(quest.id)).toThrow('stone already credited')
    failure.mockRestore()

    expect(player.skillInsight).toBe(initialInsight)
    expect(player.cultivation).toBe(initialCultivation)
    const failedSnapshot = JSON.parse(JSON.stringify(buildGameSave(player, manager)))
    expect(failedSnapshot.materials).toEqual([{ materialId: wood.id, amount: 1 }])
    expect(failedSnapshot.quests.active.find((q: { questId: string }) => q.questId === quest.id)?.claimed).toBe(false)

    const restored = setup()
    const restoredPlayer = reactive(failedSnapshot.player)
    restored.setActivePlayer(restoredPlayer)
    restored.saveOps.restoreFromSave(failedSnapshot)
    expect(restored.questOps.claimQuest(quest.id)).toBe(true)
    expect(restoredPlayer.skillInsight).toBe(initialInsight + 3)
    expect(restoredPlayer.cultivation).toBe(initialCultivation + 5)
    expect(restored.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(10)
    expect(restored.materialBag.getAmount(wood.id)).toBe(0)

    const succeededSnapshot = JSON.parse(JSON.stringify(buildGameSave(restoredPlayer, restored)))
    const reloaded = setup()
    const reloadedPlayer = reactive(succeededSnapshot.player)
    reloaded.setActivePlayer(reloadedPlayer)
    reloaded.saveOps.restoreFromSave(succeededSnapshot)
    expect(reloaded.questOps.claimQuest(quest.id)).toBe(false)
    expect(reloadedPlayer.skillInsight).toBe(initialInsight + 3)
    expect(reloaded.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(10)
    expect(reloaded.questManager.isCompletedOnce(quest.id)).toBe(true)
  })
})
