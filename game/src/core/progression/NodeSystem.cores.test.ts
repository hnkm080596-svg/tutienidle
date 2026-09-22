import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultPlayer } from '../player/Player'
import type { ProgressionNode } from './ProgressionNode'
import {
  canPurchaseNode,
  canUpgradeNode,
  devResetBranch,
  getNextLevelCost,
  getNodeLevel,
  grantSkillCore,
  purchaseNode,
  upgradeNode,
} from './NodeSystem'

// M-QI-05 / QI-D3 - Core Node semantics inside NodeSystem: cores are
// granted (never purchased), upgrade through the frozen Insight curve,
// reject cast-channel skills, never roll the Van Dao waive, and revoke
// with the granting node on ownership removal.

function playerWith(overrides: Partial<ReturnType<typeof createDefaultPlayer>> = {}) {
  return { ...createDefaultPlayer(), ...overrides }
}

function coreNode(skillId = 'test_skill', maxLevel = 10): ProgressionNode {
  return {
    id: `core_${skillId}`,
    name: `Core ${skillId}`,
    type: 'minor',
    insightCost: 0,
    maxLevel,
    levelsSkillId: skillId,
    effect: {},
  }
}

describe('Core Node gates', () => {
  it('canPurchaseNode always rejects levelsSkillId nodes', () => {
    const player = playerWith({ skillInsight: 99 })

    expect(canPurchaseNode(player, coreNode())).toBe(false)
  })

  it('getNextLevelCost uses the frozen skill curve for cores', () => {
    const node = coreNode()

    expect(getNextLevelCost(node, 1)).toBe(5)
    expect(getNextLevelCost(node, 2)).toBe(8)
    expect(getNextLevelCost(node, 3)).toBe(11)
  })

  it('canUpgradeNode gates: level0 / maxed / poor / cast-channel', () => {
    const node = coreNode()

    expect(canUpgradeNode(playerWith({ skillInsight: 99 }), node)).toBe(false)

    const owned = playerWith({ skillInsight: 99, nodeLevels: { [node.id]: 1 } })

    expect(canUpgradeNode(owned, node)).toBe(true)

    const maxed = playerWith({ skillInsight: 99, nodeLevels: { [node.id]: 10 } })

    expect(canUpgradeNode(maxed, node)).toBe(false)

    const poor = playerWith({ skillInsight: 4, nodeLevels: { [node.id]: 1 } })

    expect(canUpgradeNode(poor, node)).toBe(false)

    const castChannel = coreNode('tram', 3)
    const castOwned = playerWith({ skillInsight: 99, nodeLevels: { [castChannel.id]: 1 } })

    expect(canUpgradeNode(castOwned, castChannel)).toBe(false)
  })

  it('upgradeNode deducts 5+3(L-1) and increments nodeLevels', () => {
    const node = coreNode()
    const player = playerWith({ skillInsight: 30, nodeLevels: { [node.id]: 2 } })

    expect(upgradeNode(player, node)).toBe(true)
    expect(player.nodeLevels[node.id]).toBe(3)
    expect(player.skillInsight).toBe(30 - 8)
  })

  it('upgradeNode never rolls the Van Dao waive for cores', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const node = coreNode()
    const player = playerWith({
      skillInsight: 30,
      nodeLevels: { [node.id]: 1 },
      selectedTalentIds: ['van_dao' as never],
    })

    expect(upgradeNode(player, node)).toBe(true)
    expect(player.skillInsight).toBe(25)
    expect(player.nodeFreePurchaseRecord?.[node.id] ?? 0).toBe(0)
  })
})

describe('grantSkillCore', () => {
  it('writes level 1 + purchasedNodeIds membership, idempotent', () => {
    const node = coreNode()
    const player = playerWith()

    grantSkillCore(player, node)

    expect(player.nodeLevels[node.id]).toBe(1)
    expect(player.purchasedNodeIds).toContain(node.id)

    grantSkillCore(player, node)

    expect(player.nodeLevels[node.id]).toBe(1)
    expect(player.purchasedNodeIds.filter((id) => id === node.id)).toHaveLength(1)
  })

  it('does not touch an existing higher level', () => {
    const node = coreNode()
    const player = playerWith({ nodeLevels: { [node.id]: 4 }, purchasedNodeIds: [node.id] })

    grantSkillCore(player, node)

    expect(player.nodeLevels[node.id]).toBe(4)
  })
})

describe('devResetBranch — grant-owned core revoke', () => {
  it('revokes grantsSkillCoreIds members and refunds their spent Insight', () => {
    const root: ProgressionNode = {
      id: 'cuong_chien',
      name: 'Cuong Chien',
      type: 'minor',
      insightCost: 2,
      branchTag: 'the_tu',
      effect: { grantsSkillCoreIds: ['cuong_quyen', 'loan_dau'] },
    }
    const cores = ['cuong_quyen', 'loan_dau'].map((id) => coreNode(id))
    const all = [root, ...cores]
    const registry = {
      getAll: () => all,
      has: (id: string) => all.some((node) => node.id === id),
      get: (id: string) => all.find((node) => node.id === id)!,
    }

    const player = playerWith({
      skillInsight: 0,
      nodeLevels: { cuong_chien: 1, core_cuong_quyen: 3, core_loan_dau: 1 },
      purchasedNodeIds: ['cuong_chien', 'core_cuong_quyen', 'core_loan_dau'],
    })

    // root cost 2 + cuong_quyen spent 5+8 + loan_dau spent 0 = 15
    const refund = devResetBranch(player, registry, 'the_tu')

    expect(refund).toBe(2 + 5 + 8)
    expect(player.nodeLevels['cuong_chien']).toBeUndefined()
    expect(player.nodeLevels['core_cuong_quyen']).toBeUndefined()
    expect(player.nodeLevels['core_loan_dau']).toBeUndefined()
    expect(player.purchasedNodeIds).toHaveLength(0)
    expect(player.skillInsight).toBe(15)
  })

  it('orphan-cascade removal also revokes granted cores', () => {
    const parent: ProgressionNode = {
      id: 'trunk',
      name: 'Trunk',
      type: 'minor',
      insightCost: 1,
      branchTag: 'the_tu',
      effect: {},
    }
    const child: ProgressionNode = {
      id: 'child_root',
      name: 'Child Root',
      type: 'minor',
      insightCost: 1,
      prerequisites: [{ kind: 'node', nodeId: 'trunk' }],
      effect: { grantsSkillCoreIds: ['orphan_skill'] },
    }
    const core = coreNode('orphan_skill')
    const all = [parent, child, core]
    const registry = {
      getAll: () => all,
      has: (id: string) => all.some((node) => node.id === id),
      get: (id: string) => all.find((node) => node.id === id)!,
    }

    const player = playerWith({
      nodeLevels: { trunk: 1, child_root: 1, core_orphan_skill: 2 },
      purchasedNodeIds: ['trunk', 'child_root', 'core_orphan_skill'],
    })

    // trunk 1 + child 1 + orphan_skill spent 5 = 7
    const refund = devResetBranch(player, registry, 'the_tu')

    expect(refund).toBe(1 + 1 + 5)
    expect(player.nodeLevels['core_orphan_skill']).toBeUndefined()
    expect(player.purchasedNodeIds).not.toContain('core_orphan_skill')
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
