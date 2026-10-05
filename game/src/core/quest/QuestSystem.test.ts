import { describe, expect, it, vi } from 'vitest'

// BETA SCOPE LOCK v2 Phase-5 - this suite exercises the scope-hidden
// quest lifecycle's ENABLED implementation (sec.15: dormant, not
// deleted), so the scope authority reports in-scope for this file.
vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
  isBetaQuestEnabled: () => true,
}))

import {
  QuestSystem,
  questRewardBandRealmId,
  scaleQuestRewardByRealm,
} from './QuestSystem'
import { betaQuestSurfaceFor } from '../betaScopeQuestDomain'
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
    addSkillInsight(amount) {
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

    system.reconcileActiveQuests(registry, manager, player)
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

    system.reconcileActiveQuests(registry, manager, player)
    manager.incrementProgress('collect_test', 5)

    const receiver = createReceiver()
    expect(system.claim(registry, manager, rewardSystem, receiver, bags, 'collect_test')).toBe(false)
  })

  it('claim không cho double-claim', () => {
    const { registry, manager, system, bags, rewardSystem, materialRegistry, materialBag } = setup()
    const player = createPlayer()

    system.reconcileActiveQuests(registry, manager, player)
    materialBag.add(materialRegistry.get('linh_chi'), 5)
    manager.incrementProgress('collect_test', 5)

    const receiver = createReceiver()
    expect(system.claim(registry, manager, rewardSystem, receiver, bags, 'collect_test')).toBe(true)
    expect(system.claim(registry, manager, rewardSystem, receiver, bags, 'collect_test')).toBe(false)
  })

  // Mission E Task 3 (audit T1-11): a throwing grant must not consume
  // the turn-in cost - debit runs after give, before itemDrops.
  it('does not debit quest item cost when reward grant throws', () => {
    const { registry, manager, system, bags, rewardSystem, materialRegistry, materialBag } = setup()
    const player = createPlayer()

    system.reconcileActiveQuests(registry, manager, player)
    materialBag.add(materialRegistry.get('linh_chi'), 5)
    manager.incrementProgress('collect_test', 5)

    const receiver = {
      addSkillInsight: vi.fn(),
      addCultivation: vi.fn(),
      addSpiritStone: vi.fn(() => {
        throw new Error('sink exploded')
      }),
    }

    expect(() =>
      system.claim(registry, manager, rewardSystem, receiver, bags, 'collect_test'),
    ).toThrow('sink exploded')
    expect(materialBag.getAmount('linh_chi')).toBe(5)
    expect(manager.getProgress('collect_test')?.claimed).not.toBe(true)
  })

  it('kill increment chỉ áp dụng đúng enemyId', () => {
    const { registry, manager, system } = setup()
    const player = createPlayer()

    system.reconcileActiveQuests(registry, manager, player)
    system.onEnemyDefeated(registry, manager, 'bandit', undefined)
    expect(manager.getProgress('kill_test')?.progress).toBe(0)

    system.onEnemyDefeated(registry, manager, 'wild_wolf', undefined)
    expect(manager.getProgress('kill_test')?.progress).toBe(1)
  })

  it('onMaterialCollected tăng progress collect-quest khớp materialId (review 2026-08-28 bug #3)', () => {
    const { registry, manager, system } = setup()
    const player = createPlayer()

    system.reconcileActiveQuests(registry, manager, player)

    // Material lech id -> khong tang.
    system.onMaterialCollected(registry, manager, 'other_material', 9)
    expect(manager.getProgress('collect_test')?.progress).toBe(0)

    // Dung materialId -> tang dung luong.
    system.onMaterialCollected(registry, manager, 'linh_chi', 3)
    expect(manager.getProgress('collect_test')?.progress).toBe(3)

    system.onMaterialCollected(registry, manager, 'linh_chi', 2)
    expect(manager.getProgress('collect_test')?.progress).toBe(5)
  })

  it('onMaterialCollected bỏ qua amount NaN/âm và quest đã claim', () => {
    const { registry, manager, system, bags, rewardSystem, materialRegistry, materialBag } = setup()
    const player = createPlayer()

    system.reconcileActiveQuests(registry, manager, player)
    materialBag.add(materialRegistry.get('linh_chi'), 5)
    manager.incrementProgress('collect_test', 5)

    const receiver = createReceiver()
    expect(system.claim(registry, manager, rewardSystem, receiver, bags, 'collect_test')).toBe(true)

    // Da claim -> khong tang nua; NaN/am bi bo qua.
    system.onMaterialCollected(registry, manager, 'linh_chi', 7)
    system.onMaterialCollected(registry, manager, 'linh_chi', Number.NaN)
    system.onMaterialCollected(registry, manager, 'linh_chi', -5)
    expect(manager.getProgress('collect_test')?.progress).toBe(5)
  })

  it('daily reset xoá progress chưa claim nhưng không đụng completedOnceIds', () => {
    const { registry, manager, system } = setup()
    const player = createPlayer()

    system.reconcileActiveQuests(registry, manager, player)
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

describe('QuestSystem - domain-scoped reward material gate (F-W-10)', () => {
  const domainQuest: Quest = {
    id: 'domain_reward_test',
    name: 'Thuong domain',
    description: '',
    condition: { kind: 'collect', materialId: 'linh_chi', amount: 1 },
    reward: {
      reward: { spiritStone: 1 },
      itemDrops: [{ kind: 'material', itemId: 'domain_scoped_ore', amount: 2 }],
    },
    cadence: 'once',
  }

  function domainSetup(playerRealmId: string) {
    const registry = new QuestRegistry()
    registry.register(domainQuest)

    const manager = new QuestManager()
    const system = new QuestSystem()

    const materialRegistry = new MaterialRegistry()
    materialRegistry.register(createMaterial('linh_chi'))
    materialRegistry.register({
      ...createMaterial('domain_scoped_ore'),
      domainUnlockRealmId: 'qi_refining',
    })
    const materialBag = new MaterialBag()

    const pillRegistry = new PillRegistry()
    const pillBag = new PillBag()

    const bags = { materialRegistry, materialBag, pillRegistry, pillBag, playerRealmId }
    const rewardSystem = new RewardSystem()

    const player = createPlayer()
    system.reconcileActiveQuests(registry, manager, player)
    materialBag.add(materialRegistry.get('linh_chi'), 1)
    manager.incrementProgress('domain_reward_test', 1)

    return { registry, manager, system, bags, rewardSystem, materialBag }
  }

  it('below the domain realm the scoped line stays dormant - claim still completes', () => {
    const { registry, manager, system, bags, rewardSystem, materialBag } = domainSetup('mortal')

    expect(system.claim(registry, manager, rewardSystem, createReceiver(), bags, 'domain_reward_test')).toBe(true)
    expect(materialBag.getAmount('domain_scoped_ore')).toBe(0)
  })

  it('at the domain realm the scoped line lands', () => {
    const { registry, manager, system, bags, rewardSystem, materialBag } = domainSetup('qi_refining')

    expect(system.claim(registry, manager, rewardSystem, createReceiver(), bags, 'domain_reward_test')).toBe(true)
    expect(materialBag.getAmount('domain_scoped_ore')).toBe(2)
  })
})

// Minh ruling 2026-10-05 - quest currency rewards scale by the QUEST's
// realm band via stoneCostRealmFactor (x1 mortal / x8 qi / x50 truc co).
// skillInsight stays authored (data already era-anchored).
describe('QuestSystem - quest reward realm-band scaling (2026-10-05)', () => {
  function scaledSetup(quest: Quest, playerRealmId: string) {
    const registry = new QuestRegistry()
    registry.register(quest)

    const manager = new QuestManager()
    const system = new QuestSystem()

    const materialRegistry = new MaterialRegistry()
    materialRegistry.register(createMaterial('linh_chi'))
    const materialBag = new MaterialBag()

    const pillRegistry = new PillRegistry()
    const pillBag = new PillBag()

    const bags = { materialRegistry, materialBag, pillRegistry, pillBag }
    const rewardSystem = new RewardSystem()

    const player = createPlayer(playerRealmId)
    system.reconcileActiveQuests(registry, manager, player)
    materialBag.add(materialRegistry.get('linh_chi'), 1)
    manager.incrementProgress(quest.id, 1)

    return { registry, manager, system, bags, rewardSystem, materialRegistry, materialBag, pillRegistry, pillBag, player }
  }

  const baseQuest: Omit<Quest, 'id' | 'requiredRealmId'> = {
    name: 'Scaled reward test',
    description: '',
    condition: { kind: 'collect', materialId: 'linh_chi', amount: 1 },
    reward: { reward: { spiritStone: 100, cultivation: 50, skillInsight: 400 } },
    cadence: 'once',
  }

  it('ungated (mortal-era) quest pays authored amounts - factor 1', () => {
    const quest: Quest = { ...baseQuest, id: 'scale_mortal' }
    const { registry, manager, system, bags, rewardSystem } = scaledSetup(quest, 'mortal')

    const receiver = createReceiver()
    expect(system.claim(registry, manager, rewardSystem, receiver, bags, quest.id)).toBe(true)
    expect(receiver.spiritStone).toBe(100)
    expect(receiver.cultivation).toBe(50)
    expect(receiver.insight).toBe(400)
  })

  it('qi_refining-gated quest pays x8 spiritStone/cultivation, skillInsight unchanged', () => {
    const quest: Quest = { ...baseQuest, id: 'scale_qi', requiredRealmId: 'qi_refining' }
    const { registry, manager, system, bags, rewardSystem } = scaledSetup(quest, 'qi_refining')

    const receiver = createReceiver()
    expect(system.claim(registry, manager, rewardSystem, receiver, bags, quest.id)).toBe(true)
    expect(receiver.spiritStone).toBe(800)
    expect(receiver.cultivation).toBe(400)
    expect(receiver.insight).toBe(400)
  })

  it('foundation_establishment-gated quest pays x50', () => {
    const quest: Quest = {
      ...baseQuest,
      id: 'scale_foundation',
      requiredRealmId: 'foundation_establishment',
    }
    const { registry, manager, system, bags, rewardSystem } = scaledSetup(
      quest,
      'foundation_establishment',
    )

    const receiver = createReceiver()
    expect(system.claim(registry, manager, rewardSystem, receiver, bags, quest.id)).toBe(true)
    expect(receiver.spiritStone).toBe(5000)
    expect(receiver.cultivation).toBe(2500)
    expect(receiver.insight).toBe(400)
  })

  it('ungated quest chained after a qi-gated ancestor pays the qi band (main_08 shape)', () => {
    const gatedAncestor: Quest = {
      ...baseQuest,
      id: 'chain_main_07',
      requiredRealmId: 'qi_refining',
    }
    const ungatedChainMember: Quest = {
      ...baseQuest,
      id: 'chain_main_08',
      unlocksAfterQuestId: 'chain_main_07',
    }
    const { registry, manager, system, bags, rewardSystem, player } = scaledSetup(
      ungatedChainMember,
      'qi_refining',
    )
    registry.register(gatedAncestor)
    // Real unlock flow: the ancestor's completedOnceIds witness is what
    // admits the member on the next idempotent reconcile pass.
    manager.markCompletedOnce('chain_main_07')
    system.reconcileActiveQuests(registry, manager, player)
    manager.incrementProgress(ungatedChainMember.id, 1)

    const receiver = createReceiver()
    expect(
      system.claim(registry, manager, rewardSystem, receiver, bags, ungatedChainMember.id),
    ).toBe(true)
    expect(receiver.spiritStone).toBe(800)
    expect(receiver.cultivation).toBe(400)
  })

  it('questRewardBandRealmId pins the band-resolution contract', () => {
    const gated: Quest = { ...baseQuest, id: 'band_gated', requiredRealmId: 'qi_refining' }
    const member: Quest = { ...baseQuest, id: 'band_member', unlocksAfterQuestId: 'band_gated' }
    const grandchild: Quest = {
      ...baseQuest,
      id: 'band_grandchild',
      unlocksAfterQuestId: 'band_member',
    }
    const orphan: Quest = { ...baseQuest, id: 'band_orphan' }

    const registry = new QuestRegistry()
    registry.register(gated)
    registry.register(member)

    expect(questRewardBandRealmId(gated, registry)).toBe('qi_refining')
    // Transitive walk: grandchild -> member -> gated ancestor.
    expect(questRewardBandRealmId(grandchild, registry)).toBe('qi_refining')
    // Ungated + unchained = mortal band.
    expect(questRewardBandRealmId(orphan, registry)).toBe('mortal')
    // Chain not resolvable on a partial registry stops at mortal.
    expect(questRewardBandRealmId(grandchild, undefined)).toBe('mortal')
  })

  it('questRewardBandRealmId stops on a chain cycle instead of looping', () => {
    const a: Quest = { ...baseQuest, id: 'band_cycle_a', unlocksAfterQuestId: 'band_cycle_b' }
    const b: Quest = { ...baseQuest, id: 'band_cycle_b', unlocksAfterQuestId: 'band_cycle_a' }
    const registry = new QuestRegistry()
    registry.register(a)
    registry.register(b)

    expect(questRewardBandRealmId(a, registry)).toBe('mortal')
  })

  it('beta quest surface preview shows the SAME scaled amounts claim pays', () => {
    const quest: Quest = { ...baseQuest, id: 'scale_preview', requiredRealmId: 'qi_refining' }
    const { registry, manager, materialRegistry, materialBag, pillRegistry, pillBag, player } =
      scaledSetup(quest, 'qi_refining')

    const model = betaQuestSurfaceFor(quest, manager.getProgress(quest.id)!, player, {
      materialRegistry,
      materialBag,
      pillRegistry,
      pillBag,
      enemyName: () => undefined,
      questRegistry: registry,
    })

    const stoneEntry = model.rewards.find((entry) => entry.kind === 'spiritStone')
    const insightEntry = model.rewards.find((entry) => entry.kind === 'skillInsight')
    expect(stoneEntry?.amount).toBe(800)
    expect(insightEntry?.amount).toBe(400)
  })

  it('scaleQuestRewardByRealm unit pin: unknown/ungated band = factor 1', () => {
    const authored = { spiritStone: 100, cultivation: 50, skillInsight: 400 }

    expect(scaleQuestRewardByRealm(authored, undefined)).toEqual(authored)
    expect(scaleQuestRewardByRealm(authored, 'mortal')).toEqual(authored)
    expect(scaleQuestRewardByRealm(authored, 'unknown_realm')).toEqual(authored)
  })
})
