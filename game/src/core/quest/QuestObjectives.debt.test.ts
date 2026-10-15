import { describe, expect, it } from 'vitest'
import { QuestSystem } from './QuestSystem'
import { QuestManager } from './QuestManager'
import { QuestRegistry } from './QuestRegistry'
import type { Quest } from './Quest'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { PillBag } from '../pill/PillBag'
import { PillRegistry } from '../pill/PillRegistry'
import { RewardSystem } from '../reward/RewardSystem'
import { createDefaultPlayer } from '../player/Player'

describe('S1 atomic reward settlement', () => {
  it.each(['legacy', 'allOf'])('rolls back a partial receiver grant and survives save/retry: %s', (shape) => {
    const condition: Quest['condition'] = shape === 'legacy'
      ? { kind: 'collect', materialId: 'wood', amount: 1 }
      : { kind: 'allOf', objectives: [{ id: 'wood', kind: 'acquire', materialId: 'wood', amount: 1 }] }
    const quest: Quest = { id: 'partial-reward', name: 'partial', description: '',
      cadence: 'once', condition, reward: { reward: { skillInsight: 3, spiritStone: 10 } } }
    const registry = new QuestRegistry()
    registry.register(quest)
    const manager = new QuestManager()
    const system = new QuestSystem()
    const materialRegistry = new MaterialRegistry()
    materialRegistry.register({ id: 'wood', name: 'wood', category: 'herb', sourceType: 'exploration' })
    const bags = { materialRegistry, materialBag: new MaterialBag(),
      pillRegistry: new PillRegistry(), pillBag: new PillBag(),
      withAtomicClaim: <T>(execute: () => T): T => {
        const priorInsight = insight
        const priorState = structuredClone(manager.getState())
        try { return execute() } catch (error) {
          insight = priorInsight
          manager.restore(priorState)
          throw error
        }
      },
    }
    bags.materialBag.add(materialRegistry.get('wood'), 1)
    system.reconcileActiveQuests(registry, manager, createDefaultPlayer())
    system.onMaterialCollected(registry, manager, 'wood', 1)
    let insight = 0
    let throwOnStone = true
    const receiver = { addSkillInsight: (amount: number) => { insight += amount },
      addCultivation: () => {}, addSpiritStone: () => { if (throwOnStone) throw new Error('later failure') } }
    const claim = () => system.claim(registry, manager, new RewardSystem(), receiver, bags, quest.id)
    expect(claim).toThrow('later failure')
    expect(manager.getProgress(quest.id)?.claimed).toBe(false)
    expect(insight).toBe(0)
    const saved = structuredClone(manager.getState())
    manager.restore(JSON.parse(JSON.stringify(saved)))
    throwOnStone = false
    expect(claim()).toBe(true)
    expect(insight).toBe(3)
    expect(manager.isCompletedOnce(quest.id)).toBe(true)
    const completed = structuredClone(manager.getState())
    manager.restore(JSON.parse(JSON.stringify(completed)))
    expect(claim()).toBe(false)
    expect(insight).toBe(3)
  })
})
