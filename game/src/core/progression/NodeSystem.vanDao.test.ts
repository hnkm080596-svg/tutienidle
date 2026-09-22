import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  devResetBranch,
  getNodeLevel,
  purchaseNode,
  upgradeNode,
} from './NodeSystem'
import { NodeRegistry } from './NodeRegistry'
import { createDefaultPlayer } from '../player/Player'
import type { ProgressionNode } from './ProgressionNode'

// Talent v4 M2 — Van Dao (spec §4.3 row 18): at each purchase/upgrade a
// 50% roll may waive the insight cost; the waived amount is recorded in
// player.nodeFreePurchaseRecord so devResetBranch refunds only what was
// ACTUALLY paid (record survives talent removal — no refund exploit).
function minorNode(overrides: Partial<ProgressionNode> = {}): ProgressionNode {
  return {
    id: 'test_minor',
    name: 'Test Minor',
    type: 'minor',
    insightCost: 5,
    branchTag: 'test_branch',
    effect: {},
    ...overrides,
  }
}

function growthNode(overrides: Partial<ProgressionNode> = {}): ProgressionNode {
  return minorNode({
    id: 'test_growth',
    insightCost: 4,
    maxLevel: 3,
    upgradeCost: { base: 2, perLevel: 1 },
    ...overrides,
  })
}

describe('NodeSystem — Van Dao free-purchase roll (M2)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('roll trung (random < 0.5) — purchase mien phi, ghi waived amount', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4)
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['van_dao']
    player.skillInsight = 5

    expect(purchaseNode(player, minorNode())).toBe(true)

    expect(player.skillInsight).toBe(5) // waived — khong tru
    expect(player.nodeFreePurchaseRecord['test_minor']).toBe(5)
    expect(getNodeLevel(player, 'test_minor')).toBe(1)
  })

  it('roll truot (random >= 0.5) — purchase tru cost nhu thuong', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['van_dao']
    player.skillInsight = 5

    expect(purchaseNode(player, minorNode())).toBe(true)

    expect(player.skillInsight).toBe(0)
    expect(player.nodeFreePurchaseRecord['test_minor']).toBeUndefined()
  })

  it('upgradeNode cung roll — waived amount cong don theo cost tung cap', () => {
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['van_dao']
    player.skillInsight = 20

    // growthNode: upgradeCost {base:2, perLevel:1} -> costs 2, 3, 4.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.9) // purchase pays 2
      .mockReturnValueOnce(0.1) // upgrade to 2 free (waived 3)
      .mockReturnValueOnce(0.1) // upgrade to 3 free (waived 4)

    expect(purchaseNode(player, growthNode())).toBe(true)
    expect(upgradeNode(player, growthNode())).toBe(true)
    expect(upgradeNode(player, growthNode())).toBe(true)

    expect(getNodeLevel(player, 'test_growth')).toBe(3)
    expect(player.skillInsight).toBe(18) // paid 2 only
    expect(player.nodeFreePurchaseRecord['test_growth']).toBe(7) // waived 3 + 4
  })

  it('khong co van_dao — khong roll, khong record', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1)
    const player = createDefaultPlayer()
    player.skillInsight = 10

    expect(purchaseNode(player, minorNode())).toBe(true)

    expect(player.skillInsight).toBe(5)
    expect(player.nodeFreePurchaseRecord).toEqual({})
    expect(randomSpy).not.toHaveBeenCalled()
    // canPurchaseNode still gates — affordability unchanged.
  })

  it('devResetBranch refund = tien THUC tra (tru waived amount da ghi)', () => {
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['van_dao']
    player.skillInsight = 20

    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1) // purchase free (waived 2)
      .mockReturnValueOnce(0.9) // upgrade pays 3
      .mockReturnValueOnce(0.9) // upgrade pays 4

    const node = growthNode()
    purchaseNode(player, node)
    upgradeNode(player, node)
    upgradeNode(player, node)

    expect(player.skillInsight).toBe(13) // 20 - 7 paid
    expect(player.nodeFreePurchaseRecord['test_growth']).toBe(2)

    const registry = new NodeRegistry()
    registry.register(node)
    const refunded = devResetBranch(player, registry, 'test_branch')

    // Total level costs 2+3+4=9, waived 2 -> actual paid 7 refunded.
    expect(refunded).toBe(7)
    expect(player.skillInsight).toBe(20)
    // Record cleared together with the reset node (no double-subtract
    // if the node is re-purchased later).
    expect(player.nodeFreePurchaseRecord['test_growth']).toBeUndefined()
  })

  it('refund dung ngay ca khi talent da bi go (record song doc lap)', () => {
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['van_dao']
    player.skillInsight = 20

    vi.spyOn(Math, 'random').mockReturnValue(0.1)

    const node = growthNode()
    purchaseNode(player, node) // free, waived 2 (upgradeCost.base at level 0)

    player.selectedTalentIds = [] // talent removed

    const registry = new NodeRegistry()
    registry.register(node)
    const refunded = devResetBranch(player, registry, 'test_branch')

    expect(refunded).toBe(0) // node was free — nothing paid, nothing refunded
    expect(player.skillInsight).toBe(20)
  })
})
