import { describe, expect, it, vi } from 'vitest'
vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaQuestEnabled: () => true,
}))
import type { Quest } from './Quest'
import { QuestRegistry } from './QuestRegistry'
import { QuestManager } from './QuestManager'
import { QuestSystem } from './QuestSystem'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { PillBag } from '../pill/PillBag'
import { PillRegistry } from '../pill/PillRegistry'
import { RewardSystem } from '../reward/RewardSystem'
import type { PlayerData } from '../player/Player'
import { betaQuestSurfaceFor } from '../betaScopeQuestDomain'

function setup(condition: Quest['condition'], cadence: Quest['cadence'] = 'once') {
  const quest: Quest = { id: 'multi', name: 'multi', description: '', condition, cadence,
    reward: { reward: { spiritStone: 10 } } }
  const registry = new QuestRegistry()
  registry.register(quest)
  const manager = new QuestManager()
  const system = new QuestSystem()
  const player = { realmId: 'qi_refining', completedStageIds: ['early'] } as PlayerData
  const materialRegistry = new MaterialRegistry()
  materialRegistry.register({ id: 'wood', name: 'wood', category: 'herb', sourceType: 'exploration' })
  const bags = { materialRegistry, materialBag: new MaterialBag(),
    pillRegistry: new PillRegistry(), pillBag: new PillBag(),
    withAtomicClaim: <T>(settle: () => T): T => settle() }
  let paid = 0
  const receiver = { addSpiritStone: (n: number) => { paid += n },
    addCultivation: () => {}, addSkillInsight: () => {} }
  const claim = () => system.claim(registry, manager, new RewardSystem(), receiver, bags, quest.id)
  return { quest, registry, manager, system, player, bags, claim, paid: () => paid }
}

const threeLeaves: Quest['condition'] = { kind: 'allOf', objectives: [
  { id: 'wood', kind: 'acquire', materialId: 'wood', amount: 2 },
  { id: 'wolf', kind: 'kill', enemyId: 'wolf', amount: 1 },
  { id: 'craft', kind: 'flag', flagId: 'alchemy.crafted', amount: 1 },
] }

describe('allOf quest objectives', () => {
  it('requires every leaf, retains acquired items and pays once', () => {
    const s = setup(threeLeaves)
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    s.bags.materialBag.add(s.bags.materialRegistry.get('wood'), 2)
    s.system.onMaterialCollected(s.registry, s.manager, 'wood', 2)
    s.system.onEnemyDefeated(s.registry, s.manager, 'wolf', undefined)
    expect(s.claim()).toBe(false)
    expect(s.paid()).toBe(0)
    s.system.onFlag(s.registry, s.manager, 'alchemy.crafted')
    expect(s.claim()).toBe(true)
    expect(s.claim()).toBe(false)
    expect(s.paid()).toBe(10)
    expect(s.bags.materialBag.getAmount('wood')).toBe(2)
    expect(s.manager.isCompletedOnce('multi')).toBe(true)
  })

  it('acquire records delivery after activation even when the item is later spent', () => {
    const s = setup({ kind: 'acquire', materialId: 'wood', amount: 2 })
    s.system.onMaterialCollected(s.registry, s.manager, 'wood', 2)
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    expect(s.claim()).toBe(false)
    s.system.onMaterialCollected(s.registry, s.manager, 'wood', 2)
    expect(s.claim()).toBe(true)
    expect(s.bags.materialBag.getAmount('wood')).toBe(0)
  })

  it('aggregates collect leaves sharing a material before granting or debiting', () => {
    const s = setup({ kind: 'allOf', objectives: [
      { id: 'a', kind: 'collect', materialId: 'wood', amount: 2 },
      { id: 'b', kind: 'collect', materialId: 'wood', amount: 3 },
    ] })
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    s.bags.materialBag.add(s.bags.materialRegistry.get('wood'), 3)
    s.system.onMaterialCollected(s.registry, s.manager, 'wood', 3)
    expect(s.claim()).toBe(false)
    expect(s.paid()).toBe(0)
    expect(s.bags.materialBag.getAmount('wood')).toBe(3)
    s.bags.materialBag.add(s.bags.materialRegistry.get('wood'), 2)
    expect(s.claim()).toBe(true)
    expect(s.bags.materialBag.getAmount('wood')).toBe(0)
  })

  it('restores detached leaf counters by stable ID, independently of definition order', () => {
    const s = setup(threeLeaves)
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    s.system.onMaterialCollected(s.registry, s.manager, 'wood', 2)
    const wire = JSON.parse(JSON.stringify(s.manager.getState()))
    const restored = new QuestManager()
    restored.restore(wire)
    expect(restored.getProgress('multi')?.objectives?.wood).toBe(2)
    wire.active[0].objectives.wood = 0
    expect(restored.getProgress('multi')?.objectives?.wood).toBe(2)
    const reordered: Quest = { ...s.quest, condition: { kind: 'allOf',
      objectives: [...threeLeaves.objectives].reverse() } }
    const r = new QuestRegistry()
    r.register(reordered)
    s.system.reconcileActiveQuests(r, restored, s.player)
    s.system.onEnemyDefeated(r, restored, 'wolf', undefined)
    s.system.onFlag(r, restored, 'alchemy.crafted')
    expect(s.system.canClaim(r, restored, s.bags, 'multi')).toBe(true)
  })

  it('projects every leaf and never mutates progress on reads', () => {
    const s = setup(threeLeaves)
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    s.system.onMaterialCollected(s.registry, s.manager, 'wood', 2)
    const before = JSON.stringify(s.manager.getState())
    const row = betaQuestSurfaceFor(s.quest, s.manager.getProgress('multi')!, s.player,
      { ...s.bags, enemyName: () => undefined })
    expect(row.objectives?.map((o) => [o.id, o.progress, o.target])).toEqual([
      ['wood', 2, 2], ['wolf', 0, 1], ['craft', 0, 1],
    ])
    expect(row.claim.available).toBe(false)
    expect(JSON.stringify(s.manager.getState())).toBe(before)
  })

  it.each([[], [{ id: 'same', kind: 'kill', amount: 1 }, { id: 'same', kind: 'kill', amount: 1 }],
    [{ id: '', kind: 'kill', amount: 1 }], [{ id: 'a', kind: 'kill', amount: 0 }]].map((leaves) => [leaves]))(
    'fails closed for malformed objectives %j', (objectives) => {
      const s = setup({ kind: 'allOf', objectives } as Quest['condition'])
      s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
      expect(s.manager.getProgress('multi')).toBeUndefined()
      expect(s.claim()).toBe(false)
    })

  it('daily reset replaces all counters; once counters remain', () => {
    const s = setup(threeLeaves, 'daily')
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    s.system.onMaterialCollected(s.registry, s.manager, 'wood', 2)
    expect(s.system.checkAndResetDaily(s.registry, s.manager, s.player, 86400000)).toBe(true)
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    expect(s.manager.getProgress('multi')?.objectives?.wood).toBe(0)
    expect(s.claim()).toBe(false)
  })

  it('reconciles durable realm and stage witnesses only through a lifecycle command', () => {
    const s = setup({ kind: 'allOf', objectives: [
      { id: 'realm', kind: 'realm_reached', realmId: 'qi_refining', amount: 1 },
      { id: 'stage', kind: 'stage_clear', stageId: 'early', amount: 1 },
    ] })
    s.manager.ensureActive(s.quest)
    expect(s.system.canClaim(s.registry, s.manager, s.bags, 'multi')).toBe(false)
    s.system.getActiveQuests(s.registry, s.manager, s.player)
    expect(s.system.canClaim(s.registry, s.manager, s.bags, 'multi')).toBe(false)
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    expect(s.claim()).toBe(true)
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    expect(s.claim()).toBe(false)
    expect(s.paid()).toBe(10)
  })

  it('rejects unknown realm witnesses rather than treating an unknown index as attained', () => {
    const s = setup({ kind: 'allOf', objectives: [
      { id: 'realm', kind: 'realm_reached', realmId: 'unknown', amount: 1 },
    ] })
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    expect(s.claim()).toBe(false)
  })

  it('ignores invalid event quantities and caps leaf counters at their target', () => {
    const s = setup(threeLeaves)
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    for (const amount of [0, -1, NaN, Infinity]) {
      s.system.onMaterialCollected(s.registry, s.manager, 'wood', amount)
    }
    expect(s.manager.getProgress('multi')?.objectives?.wood).toBe(0)
    s.system.onMaterialCollected(s.registry, s.manager, 'wood', Number.MAX_SAFE_INTEGER)
    expect(s.manager.getProgress('multi')?.objectives?.wood).toBe(2)
  })

  it('does not pay twice when a reward callback reenters claim', () => {
    const s = setup({ kind: 'acquire', materialId: 'wood', amount: 1 })
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    s.system.onMaterialCollected(s.registry, s.manager, 'wood', 1)
    let paid = 0
    let reentered = false
    const receiver = { addSpiritStone: () => {
      paid++
      if (!reentered) { reentered = true; s.claim() }
    }, addCultivation: () => {}, addSkillInsight: () => {} }
    expect(s.system.claim(s.registry, s.manager, new RewardSystem(), receiver, s.bags, 'multi')).toBe(true)
    expect(paid + s.paid() / 10).toBe(1)
  })

  it('initializes missing leaf counters at reconciliation without importing scalar legacy credit', () => {
    const s = setup(threeLeaves)
    s.manager.restore({ active: [{ questId: 'multi', progress: 999, claimed: false }],
      completedOnceIds: [], lastDailyResetAtMs: 0 })
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    expect(s.claim()).toBe(false)
    s.system.onMaterialCollected(s.registry, s.manager, 'wood', 2)
    s.system.onEnemyDefeated(s.registry, s.manager, 'wolf', undefined)
    s.system.onFlag(s.registry, s.manager, 'alchemy.crafted')
    expect(s.claim()).toBe(true)
  })

  it('releases claim reservation after a failed reward and preserves every turn-in balance', () => {
    const s = setup({ kind: 'allOf', objectives: [
      { id: 'a', kind: 'collect', materialId: 'wood', amount: 2 },
      { id: 'b', kind: 'acquire', materialId: 'wood', amount: 2 },
    ] })
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    s.bags.materialBag.add(s.bags.materialRegistry.get('wood'), 2)
    s.system.onMaterialCollected(s.registry, s.manager, 'wood', 2)
    expect(() => s.system.claim(s.registry, s.manager, new RewardSystem(), {
      addSpiritStone: () => { throw new Error('failed') },
      addCultivation: () => {}, addSkillInsight: () => {},
    }, s.bags, 'multi')).toThrow('failed')
    expect(s.bags.materialBag.getAmount('wood')).toBe(2)
    expect(s.manager.getProgress('multi')?.claimed).toBe(false)
    expect(s.claim()).toBe(true)
    expect(s.bags.materialBag.getAmount('wood')).toBe(0)
  })

  it('applies safe bounded quantities to scalar acquire as well as composite acquire', () => {
    const s = setup({ kind: 'acquire', materialId: 'wood', amount: 2 })
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    for (const amount of [0, -1, NaN, Infinity]) {
      s.system.onMaterialCollected(s.registry, s.manager, 'wood', amount)
    }
    expect(s.manager.getProgress('multi')?.progress).toBe(0)
    s.system.onMaterialCollected(s.registry, s.manager, 'wood', Number.MAX_SAFE_INTEGER)
    expect(s.manager.getProgress('multi')?.progress).toBe(2)
    expect(s.claim()).toBe(true)
  })

  it.each(['scalar', 'composite'])('preserves fractional delivered credit and restore in %s acquire', (shape) => {
    const leaf = { kind: 'acquire' as const, materialId: 'wood', amount: 1 }
    const s = setup(shape === 'scalar' ? leaf : { kind: 'allOf', objectives: [{ ...leaf, id: 'wood' }] })
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    s.bags.materialBag.add(s.bags.materialRegistry.get('wood'), 0.5)
    s.system.onMaterialCollected(s.registry, s.manager, 'wood', 0.5)
    const wire = JSON.parse(JSON.stringify(s.manager.getState()))
    s.manager.restore(wire)
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    expect(s.claim()).toBe(false)
    s.bags.materialBag.add(s.bags.materialRegistry.get('wood'), 0.5)
    s.system.onMaterialCollected(s.registry, s.manager, 'wood', 0.5)
    expect(s.bags.materialBag.getAmount('wood')).toBe(1)
    expect(s.claim()).toBe(true)
    expect(s.bags.materialBag.getAmount('wood')).toBe(1)
  })

  it('rejects cross-quest callback reentry before it can reuse reserved turn-in items', () => {
    const s = setup({ kind: 'allOf', objectives: [
      { id: 'wood', kind: 'collect', materialId: 'wood', amount: 1 },
    ] })
    s.registry.register({ ...s.quest, id: 'other' })
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    s.bags.materialBag.add(s.bags.materialRegistry.get('wood'), 1)
    s.system.onMaterialCollected(s.registry, s.manager, 'wood', 1)
    let paid = 0
    let nested: boolean | undefined
    const receiver = { addSpiritStone: (amount: number) => {
      paid += amount
      if (nested === undefined) {
        nested = false
        nested = s.system.claim(s.registry, s.manager, new RewardSystem(), receiver, s.bags, 'other')
      }
    }, addCultivation: () => {}, addSkillInsight: () => {} }
    expect(s.system.claim(s.registry, s.manager, new RewardSystem(), receiver, s.bags, 'multi')).toBe(true)
    expect(nested).toBe(false)
    expect(paid).toBe(10)
    expect(s.bags.materialBag.getAmount('wood')).toBe(0)
    expect(s.manager.isCompletedOnce('other')).toBe(false)
    expect(s.manager.isCompletedOnce('multi')).toBe(true)
  })

  it('projects the manager claim reservation without mutating or persisting it', () => {
    const s = setup({ kind: 'acquire', materialId: 'wood', amount: 1 })
    s.system.reconcileActiveQuests(s.registry, s.manager, s.player)
    s.system.onMaterialCollected(s.registry, s.manager, 'wood', 1)
    const before = JSON.stringify(s.manager.getState())
    expect(s.manager.beginClaim('other')).toBe(true)
    const model = betaQuestSurfaceFor(s.quest, s.manager.getProgress('multi')!, s.player,
      { ...s.bags, enemyName: () => undefined })
    expect(model.claim.available).toBe(false)
    expect(s.system.canClaim(s.registry, s.manager, s.bags, 'multi')).toBe(false)
    expect(JSON.stringify(s.manager.getState())).toBe(before)
    s.manager.endClaim('other')
    expect(s.claim()).toBe(true)
  })
})
