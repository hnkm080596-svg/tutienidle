// M-F-BODY-PERFECTION (spec S4/S8, plan Steps 5.3/5.4/5.8) - the
// material-landing funnel and the perfectBodyRealm transaction over a
// vi.mock'd FIXTURE registry (C2C r65-f1). Real catalog ids so the
// material bag/registry path stays fully honest.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { FIXTURE } = vi.hoisted(() => {
  const FIXTURE: Record<string, readonly string[]> = {
  mortal: ['tinh_hoa_pham_the'],
  qi_refining: ['great_dao_seed', 'yeu_dan_hung_giao'],
  foundation_establishment: ['thien_dia_chi_kieu', 'doan_bao_thach', 'old_jade_slip'],
  golden_core: ['stele_fragment', 'tinh_hoa_bao_the', 'tinh_hoa_phap_the', 'broken_foundation_scroll'],
  nascent_soul: [],
  soul_transformation: [],
  void_refinement: [],
  body_integration: [],
  mahayana: [],
  tribulation: [],
}
  return { FIXTURE }
})

vi.mock('../../data/realm/BodyPerfection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/realm/BodyPerfection')>()

  const byRealm = new Map(Object.entries(FIXTURE).map(([realm, ids]) => [realm, ids]))
  const realmOf = new Map<string, string>()
  for (const [realm, ids] of byRealm) {
    for (const id of ids) {
      realmOf.set(id, realm)
    }
  }

  return {
    ...actual,
    BODY_PERFECTION_REALM_MATERIALS: FIXTURE,
    bodyPerfectionMaterialIds: (realmId: string) => byRealm.get(realmId) ?? [],
    bodyPerfectionRealmOf: (materialId: string) => realmOf.get(materialId),
    isBodyPerfectionMaterial: (materialId: string) => realmOf.has(materialId),
  }
})

// Force the companion-pull rollback arm deterministically: the token is
// debited BEFORE the roll, so a throwing roll exercises the refund
// funnel (refund = a genuine material landing).
vi.mock('../companion/CompanionGacha', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../companion/CompanionGacha')>()
  return {
    ...actual,
    pullCompanion: () => {
      throw new Error('intentional roll failure (test fixture)')
    },
  }
})

import { GameManager } from './GameManager'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { materials } from '../../data/materials/materials'
import { createLootTestSetup } from './battleLootTestSetup'
import { QuestSystem } from '../quest/QuestSystem'
import { QuestRegistry } from '../quest/QuestRegistry'
import { QuestManager } from '../quest/QuestManager'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { PillRegistry } from '../pill/PillRegistry'
import { PillBag } from '../pill/PillBag'
import { RewardSystem } from '../reward/RewardSystem'
import { COMPANION_PULL_TOKEN_ID } from './GameManagerCompanionOps'
import type { Quest } from '../quest/Quest'

const PHAM = 'tinh_hoa_pham_the'
const BAO = 'tinh_hoa_bao_the'

function freshPlayer(realmId = 'mortal'): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = realmId
  return player
}

function freshManager(player: PlayerData): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.setActivePlayer(player)
  return manager
}

const add = (manager: GameManager, materialId: string, amount: number) =>
  manager.materialBag.add(manager.materialRegistry.get(materialId), amount)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('material-landing funnel (plan 5.3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('rename-site: notifyMaterialGained fires quest hook + discovery once each', () => {
    const player = freshPlayer()
    const manager = freshManager(player)
    const questSpy = vi.spyOn(manager.questSystem, 'onMaterialCollected')

    manager.questOps.notifyMaterialGained(PHAM, 3)

    expect(questSpy).toHaveBeenCalledTimes(1)
    expect(questSpy).toHaveBeenLastCalledWith(
      manager.questRegistry,
      expect.anything(),
      PHAM,
      3,
    )
    expect(player.bodyPerfection.discoveredMaterials).toEqual([PHAM])

    // Non-perfection id: quest hook fires, discovery does not.
    manager.questOps.notifyMaterialGained('spirit_stone', 2)
    expect(player.bodyPerfection.discoveredMaterials).toEqual([PHAM])
  })

  it('zero-amount landing dispatches to NO subscriber (C2C r76-f1)', () => {
    const player = freshPlayer()
    const manager = freshManager(player)
    const questSpy = vi.spyOn(manager.questSystem, 'onMaterialCollected')

    manager.questOps.notifyMaterialGained(PHAM, 0)

    expect(questSpy).not.toHaveBeenCalled()
    expect(player.bodyPerfection.discoveredMaterials).toEqual([])
  })

  it('decompose output funnels the net delivered amount exactly once', () => {
    const player = freshPlayer()
    const manager = freshManager(player)
    const questSpy = vi.spyOn(manager.questSystem, 'onMaterialCollected')

    manager.tickOps.deliverDecomposeOutput({ materialId: PHAM, amount: 4 })

    expect(manager.materialBag.getAmount(PHAM)).toBe(4)
    expect(questSpy).toHaveBeenCalledTimes(1)
    expect(questSpy).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), PHAM, 4)
    expect(player.bodyPerfection.discoveredMaterials).toEqual([PHAM])
  })

  it('decompose output with full overflow makes no funnel call at all (C2C r76-f1)', () => {
    const player = freshPlayer()
    const manager = freshManager(player)
    const funnelSpy = vi.spyOn(manager.questOps, 'notifyMaterialGained')
    const questSpy = vi.spyOn(manager.questSystem, 'onMaterialCollected')

    const template = manager.materialRegistry.get(PHAM)
    const cap = template.stackLimit ?? Number.MAX_SAFE_INTEGER
    manager.materialBag.add(template, cap)

    manager.tickOps.deliverDecomposeOutput({ materialId: PHAM, amount: 5 })

    expect(funnelSpy).not.toHaveBeenCalled()
    expect(questSpy).not.toHaveBeenCalled()
    expect(player.bodyPerfection.discoveredMaterials).toEqual([])
  })

  it('companion-pull refund routes the returned token through the funnel once', () => {
    const player = freshPlayer('foundation_establishment')
    const manager = freshManager(player)
    const questSpy = vi.spyOn(manager.questSystem, 'onMaterialCollected')

    add(manager, COMPANION_PULL_TOKEN_ID, 1)

    // The gacha mock above throws inside the roll - the debited token
    // comes back through notifyMaterialGained (the ops' atomic-refund arm).
    expect(() => manager.companionOps.pullCompanion()).toThrowError(/intentional roll failure/)

    expect(manager.materialBag.getAmount(COMPANION_PULL_TOKEN_ID)).toBe(1)
    expect(questSpy).toHaveBeenCalledTimes(1)
    expect(questSpy).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      COMPANION_PULL_TOKEN_ID,
      1,
    )
  })

  it('essence change credit funnels the credited amount once, on success only', () => {
    // Deterministic overpay: 1 pham + 25 bao covers the tier-1 cost of
    // 50 pham-equivalents (bao ratio 2 -> 25 bao covers 50), so the
    // 1-unit overpay lands back as pham - a real material landing.
    const player = freshPlayer('qi_refining')
    const manager = freshManager(player)
    const questSpy = vi.spyOn(manager.questSystem, 'onMaterialCollected')

    add(manager, PHAM, 1)
    add(manager, BAO, 25)

    const consumed = manager.realmAdvanceOps.investBodyChapter(player, 'body_refinement')

    expect(consumed).toBe(50)
    expect(manager.materialBag.getAmount(BAO)).toBe(0)
    expect(manager.materialBag.getAmount(PHAM)).toBe(1)

    // Exactly ONE funnel call - the credited pham unit - which is also
    // the player's first perfection-material discovery.
    expect(questSpy).toHaveBeenCalledTimes(1)
    expect(questSpy).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), PHAM, 1)
    expect(player.bodyPerfection.discoveredMaterials).toEqual([PHAM])
  })

  it('QuestSystem.claim prefers bags.onMaterialGained and never double-hooks', () => {
    const rewardQuest: Quest = {
      id: 'drop_reward_quest',
      name: 'Reward drop',
      description: '',
      condition: { kind: 'collect', materialId: 'linh_chi', amount: 1 },
      reward: {
        reward: { spiritStone: 0 },
        itemDrops: [{ kind: 'material', itemId: PHAM, amount: 2 }],
      },
      cadence: 'once',
    }

    const registry = new QuestRegistry()
    registry.register(rewardQuest)
    const manager = new QuestManager()
    const system = new QuestSystem()

    const materialRegistry = new MaterialRegistry()
    materialRegistry.register({ id: 'linh_chi', name: 'lc', category: 'herb', sourceType: 'monster' })
    materialRegistry.register({ id: PHAM, name: 'pham', category: 'essence', sourceType: 'monster' })
    const materialBag = new MaterialBag()
    const bags = {
      materialRegistry,
      materialBag,
      pillRegistry: new PillRegistry(),
      pillBag: new PillBag(),
      onMaterialGained: vi.fn(),
    }

    const player = freshPlayer()
    const onCollectedSpy = vi.spyOn(system, 'onMaterialCollected')

    system.reconcileActiveQuests(registry, manager, player)
    materialBag.add(materialRegistry.get('linh_chi'), 1)
    manager.incrementProgress('drop_reward_quest', 1)

    const receiver = { addSkillInsight: vi.fn(), addCultivation: vi.fn(), addSpiritStone: vi.fn() }
    expect(
      system.claim(registry, manager, new RewardSystem(), receiver, bags, 'drop_reward_quest'),
    ).toBe(true)

    // Exactly one funnel call with the net delivered amount; the legacy
    // direct hook stays silent (no double count).
    expect(bags.onMaterialGained).toHaveBeenCalledTimes(1)
    expect(bags.onMaterialGained).toHaveBeenLastCalledWith(PHAM, 2)
    expect(onCollectedSpy).not.toHaveBeenCalled()
  })

  it('QuestSystem.claim falls back to onMaterialCollected when no funnel is supplied', () => {
    const rewardQuest: Quest = {
      id: 'drop_reward_quest',
      name: 'Reward drop',
      description: '',
      condition: { kind: 'collect', materialId: 'linh_chi', amount: 1 },
      reward: {
        reward: { spiritStone: 0 },
        itemDrops: [{ kind: 'material', itemId: PHAM, amount: 2 }],
      },
      cadence: 'once',
    }

    const registry = new QuestRegistry()
    registry.register(rewardQuest)
    const manager = new QuestManager()
    const system = new QuestSystem()

    const materialRegistry = new MaterialRegistry()
    materialRegistry.register({ id: 'linh_chi', name: 'lc', category: 'herb', sourceType: 'monster' })
    materialRegistry.register({ id: PHAM, name: 'pham', category: 'essence', sourceType: 'monster' })
    const materialBag = new MaterialBag()
    const bags = {
      materialRegistry,
      materialBag,
      pillRegistry: new PillRegistry(),
      pillBag: new PillBag(),
    }

    const player = freshPlayer()
    const onCollectedSpy = vi.spyOn(system, 'onMaterialCollected')

    system.reconcileActiveQuests(registry, manager, player)
    materialBag.add(materialRegistry.get('linh_chi'), 1)
    manager.incrementProgress('drop_reward_quest', 1)

    const receiver = { addSkillInsight: vi.fn(), addCultivation: vi.fn(), addSpiritStone: vi.fn() }
    expect(
      system.claim(registry, manager, new RewardSystem(), receiver, bags, 'drop_reward_quest'),
    ).toBe(true)

    expect(onCollectedSpy).toHaveBeenCalledTimes(1)
    expect(onCollectedSpy).toHaveBeenLastCalledWith(registry, manager, PHAM, 2)
  })

  it('battle loot grant sites route material landings through the funnel once', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, deps, materialBag } = createLootTestSetup({
      realmId: 'mortal',
      signatureDrops: [
        { kind: 'material', itemId: 'bp_drop_a', chance: 1, amount: { min: 3, max: 3 } },
      ],
      materialIds: ['bp_drop_a'],
    })

    killEnemy()

    expect(materialBag.getAmount('bp_drop_a')).toBe(3)
    const gained = vi.mocked(deps.notifyMaterialGained)
    expect(gained).toHaveBeenCalledTimes(1)
    expect(gained).toHaveBeenLastCalledWith('bp_drop_a', 3)
    // No dual quest hook beside the funnel at the same grant site.
    expect(vi.mocked(deps.questSystem.onMaterialCollected)).not.toHaveBeenCalled()
  })

  it('auto-dissolve rewards (the second battle-loot site) funnel once each', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, deps, equipmentBag, materialBag } = createLootTestSetup({
      realmId: 'mortal',
      signatureDrops: [{ kind: 'equipment', itemId: 'eq_test', chance: 1 }],
      equipmentTemplates: [{ id: 'eq_test', name: 'Kiem Test' }],
      materialIds: ['bp_drop_a'],
    })

    // Equipment bag at soft cap: add() returns AutoDissolveReward rows -
    // each row is a real material landing into the material bag.
    equipmentBag.add.mockReturnValue([{ materialId: 'bp_drop_a', amount: 2 }])

    killEnemy()

    expect(materialBag.getAmount('bp_drop_a')).toBe(2)
    const gained = vi.mocked(deps.notifyMaterialGained)
    expect(gained).toHaveBeenCalledTimes(1)
    expect(gained).toHaveBeenLastCalledWith('bp_drop_a', 2)
    expect(vi.mocked(deps.questSystem.onMaterialCollected)).not.toHaveBeenCalled()
  })
})

describe('perfectBodyRealm transaction (plan 5.4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('commits: consumes exactly one of each authored id, marks the realm, returns true', () => {
    const player = freshPlayer()
    player.bodyPerfection.discoveredMaterials.push(PHAM)
    const manager = freshManager(player)
    add(manager, PHAM, 3)

    expect(manager.realmAdvanceOps.perfectBodyRealm(player, 'mortal')).toBe(true)

    expect(manager.materialBag.getAmount(PHAM)).toBe(2)
    expect(player.bodyPerfection.perfectedRealmIds).toEqual(['mortal'])
  })

  it('multi-material realm consumes one of EACH authored id', () => {
    const player = freshPlayer('qi_refining')
    player.bodyPerfection.discoveredMaterials.push('great_dao_seed', 'yeu_dan_hung_giao')
    const manager = freshManager(player)
    add(manager, 'great_dao_seed', 5)
    add(manager, 'yeu_dan_hung_giao', 2)

    expect(manager.realmAdvanceOps.perfectBodyRealm(player, 'qi_refining')).toBe(true)

    expect(manager.materialBag.getAmount('great_dao_seed')).toBe(4)
    expect(manager.materialBag.getAmount('yeu_dan_hung_giao')).toBe(1)
    expect(player.bodyPerfection.perfectedRealmIds).toEqual(['qi_refining'])
  })

  it('is idempotent: re-transact returns false and debits nothing', () => {
    const player = freshPlayer()
    player.bodyPerfection.discoveredMaterials.push(PHAM)
    const manager = freshManager(player)
    add(manager, PHAM, 3)

    expect(manager.realmAdvanceOps.perfectBodyRealm(player, 'mortal')).toBe(true)
    expect(manager.realmAdvanceOps.perfectBodyRealm(player, 'mortal')).toBe(false)

    expect(manager.materialBag.getAmount(PHAM)).toBe(2)
    expect(player.bodyPerfection.perfectedRealmIds).toEqual(['mortal'])
  })

  it('atomic: inventory shortfall leaves materials + state untouched', () => {
    const player = freshPlayer('qi_refining')
    player.bodyPerfection.discoveredMaterials.push('great_dao_seed', 'yeu_dan_hung_giao', PHAM)
    const manager = freshManager(player)
    add(manager, 'great_dao_seed', 1)
    add(manager, PHAM, 1)

    expect(manager.realmAdvanceOps.perfectBodyRealm(player, 'qi_refining')).toBe(false)

    expect(manager.materialBag.getAmount('great_dao_seed')).toBe(1)
    expect(manager.materialBag.getAmount(PHAM)).toBe(1)
    expect(player.bodyPerfection.perfectedRealmIds).toEqual([])
  })

  it('atomic: owned-but-undiscovered required material rejects with zero mutation (C2C r60-f1)', () => {
    const player = freshPlayer()
    const manager = freshManager(player)
    add(manager, PHAM, 2)

    expect(manager.realmAdvanceOps.perfectBodyRealm(player, 'mortal')).toBe(false)

    expect(manager.materialBag.getAmount(PHAM)).toBe(2)
    expect(player.bodyPerfection.perfectedRealmIds).toEqual([])
    expect(player.bodyPerfection.discoveredMaterials).toEqual([])
  })

  it('probe failure returns false with zero mutation (C2C r76-f2)', () => {
    const player = freshPlayer()
    player.bodyPerfection.discoveredMaterials.push(PHAM)
    const manager = freshManager(player)
    add(manager, PHAM, 2)

    vi.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
      throw new Error('intentional probe serialization failure')
    })

    expect(manager.realmAdvanceOps.perfectBodyRealm(player, 'mortal')).toBe(false)

    expect(manager.materialBag.getAmount(PHAM)).toBe(2)
    expect(player.bodyPerfection.perfectedRealmIds).toEqual([])
  })

  it('rejects a future realm with zero mutation', () => {
    const player = freshPlayer('mortal')
    player.bodyPerfection.discoveredMaterials.push('great_dao_seed', 'yeu_dan_hung_giao')
    const manager = freshManager(player)
    add(manager, 'great_dao_seed', 1)
    add(manager, 'yeu_dan_hung_giao', 1)

    expect(manager.realmAdvanceOps.perfectBodyRealm(player, 'qi_refining')).toBe(false)

    expect(manager.materialBag.getAmount('great_dao_seed')).toBe(1)
    expect(manager.materialBag.getAmount('yeu_dan_hung_giao')).toBe(1)
    expect(player.bodyPerfection.perfectedRealmIds).toEqual([])
  })

  it('late perfection: a golden_core player perfects mortal (plan 5.8)', () => {
    const player = freshPlayer('golden_core')
    player.bodyPerfection.discoveredMaterials.push(PHAM)
    const manager = freshManager(player)
    add(manager, PHAM, 1)

    expect(manager.realmAdvanceOps.perfectBodyRealm(player, 'mortal')).toBe(true)
    expect(player.bodyPerfection.perfectedRealmIds).toEqual(['mortal'])
    expect(manager.materialBag.getAmount(PHAM)).toBe(0)
  })
})
