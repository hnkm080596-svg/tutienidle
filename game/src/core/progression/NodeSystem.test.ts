import { describe, expect, it } from 'vitest'
import {
  aggregateNodeSkillModifiers,
  aggregateNodeStatModifiers,
  canPurchaseNode,
  canUpgradeNode,
  devResetBranch,
  getNodeLevel,
  getNextLevelCost,
  hasPrerequisite,
  purchaseNode,
  upgradeNode,
} from './NodeSystem'
import { createDefaultPlayer } from '../player/Player'
import type { ProgressionNode } from './ProgressionNode'

// combat-skill-flow-element-power-dot-plan.md §6 + §9 — hạ tầng node
// LEVEL dùng chung (nodeLevels là nguồn sự thật; modifier suy ra qua
// aggregator, không push vĩnh viễn).

function playerWith(overrides: Partial<ReturnType<typeof createDefaultPlayer>> = {}) {
  return { ...createDefaultPlayer(), ...overrides }
}

function minorNode(overrides: Partial<ProgressionNode> = {}): ProgressionNode {
  return {
    id: 'test_minor',
    name: 'Test Minor',
    type: 'minor',
    insightCost: 1,
    effect: { statModifiers: [{ id: 'test_mod', sourceId: 'test_minor', sourceType: 'talent', stat: 'attack', flat: 5 }] },
    ...overrides,
  }
}

function powerNode(overrides: Partial<ProgressionNode> = {}): ProgressionNode {
  return minorNode({
    id: 'test_power',

    maxLevel: 10,

    upgradeCost: { base: 1, perLevel: 3 },

    effect: {
      statModifiers: [{ id: 'test_power:attack', sourceId: 'test_power', sourceType: 'talent', stat: 'attack', flat: 2, perLevelFlat: 2 }],
    },

    ...overrides,
  })
}

describe('hasPrerequisite — theo LEVEL (plan §6.1)', () => {
  it('kind realm — thoả khi player ở cảnh giới >= yêu cầu', () => {
    const player = playerWith({ realmId: 'nascent_soul' })

    expect(hasPrerequisite(player, { kind: 'realm', realmId: 'golden_core' })).toBe(true)
    expect(hasPrerequisite(player, { kind: 'realm', realmId: 'void_refinement' })).toBe(false)
  })

  it('kind element — thoả khi hành đã nằm trong unlockedElements', () => {
    const player = playerWith({ unlockedElements: ['fire'] })

    expect(hasPrerequisite(player, { kind: 'element', element: 'fire' })).toBe(true)
    expect(hasPrerequisite(player, { kind: 'element', element: 'water' })).toBe(false)
  })

  it('kind node — thoả khi node kia có level >= 1 (không đọc purchasedNodeIds)', () => {
    const player = playerWith({ nodeLevels: { unlock_fire: 1 }, purchasedNodeIds: [] })

    expect(hasPrerequisite(player, { kind: 'node', nodeId: 'unlock_fire' })).toBe(true)
    expect(hasPrerequisite(player, { kind: 'node', nodeId: 'unlock_water' })).toBe(false)
  })

  it('kind nodeCount — đếm node CÓ LEVEL >= 1 (any-N-of-M)', () => {
    const masteryNodeIds = ['mastery_fire', 'mastery_water', 'mastery_wood', 'mastery_metal', 'mastery_earth']

    const player = playerWith({ nodeLevels: { mastery_water: 2, mastery_metal: 1 } })

    expect(hasPrerequisite(player, { kind: 'nodeCount', nodeIds: masteryNodeIds, countRequired: 2 })).toBe(true)
    expect(hasPrerequisite(player, { kind: 'nodeCount', nodeIds: masteryNodeIds, countRequired: 3 })).toBe(false)

    player.nodeLevels = { mastery_fire: 1, mastery_wood: 4 }

    expect(hasPrerequisite(player, { kind: 'nodeCount', nodeIds: masteryNodeIds, countRequired: 2 })).toBe(true)
  })

  it("kind excludesNode — chặn khi node đối diện có level >= 1", () => {
    const cleanPlayer = playerWith({})

    const blockedPlayer = playerWith({ nodeLevels: { hoa_truc_co_tu_hoa: 1 } })

    expect(hasPrerequisite(cleanPlayer, { kind: 'excludesNode', nodeId: 'hoa_truc_co_tu_hoa' })).toBe(true)
    expect(hasPrerequisite(blockedPlayer, { kind: 'excludesNode', nodeId: 'hoa_truc_co_tu_hoa' })).toBe(false)
  })
})

// Kiếm Tu (2026-08-28) — gate Bạt Kiếm đọc mirror player.skillCastCounts/
// skillLevels (skill instance thật sống trong SkillManager, không phải
// PlayerData — xem Player.ts's skillCastCounts field).
describe('prerequisite skillCastCount', () => {
  it('thoả khi level skill đạt ngưỡng VÀ cast count đạt ngưỡng', () => {
    const player = playerWith({
      skillCastCounts: { tram: 9999 },
      skillLevels: { tram: 3 },
    })

    expect(
      hasPrerequisite(player, { kind: 'skillCastCount', skillId: 'tram', level: 3, count: 9999 }),
    ).toBe(true)

    expect(
      hasPrerequisite(player, { kind: 'skillCastCount', skillId: 'tram', level: 3, count: 10000 }),
    ).toBe(false)

    expect(
      hasPrerequisite(player, { kind: 'skillCastCount', skillId: 'tram', level: 4, count: 9999 }),
    ).toBe(false)
  })
})

describe('cost theo cấp data-driven (plan §6.2/§6.7)', () => {
  it('Power {base:1, perLevel:3} → dãy 1,1,1,2,2,2,3,3,3,4', () => {
    const costs: number[] = []

    for (let level = 0; level < 10; level++) {
      costs.push(getNextLevelCost(powerNode(), level))
    }

    expect(costs).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4])
  })

  it('growth/specialization {base:1, perLevel:2} → dãy 1,1,2,2,3', () => {
    const growth = minorNode({ upgradeCost: { base: 1, perLevel: 2 }, maxLevel: 5 })

    const costs: number[] = []

    for (let level = 0; level < 5; level++) {
      costs.push(getNextLevelCost(growth, level))
    }

    expect(costs).toEqual([1, 1, 2, 2, 3])
  })

  it('node không khai upgradeCost → insightCost cho mọi lần', () => {
    expect(getNextLevelCost(minorNode({ insightCost: 7 }), 0)).toBe(7)
    expect(getNextLevelCost(minorNode({ insightCost: 7 }), 3)).toBe(7)
  })
})

describe('purchaseNode / upgradeNode (plan §6.1)', () => {
  it('lĩnh ngộ 0→1: trừ cost cấp 1, ghi nodeLevels + purchasedNodeIds, KHÔNG push modifier', () => {
    const player = playerWith({ skillInsight: 5 })

    const node = minorNode({ insightCost: 3 })

    expect(purchaseNode(player, node)).toBe(true)

    expect(player.skillInsight).toBe(2)
    expect(getNodeLevel(player, 'test_minor')).toBe(1)
    expect(player.purchasedNodeIds).toEqual(['test_minor'])
    // §6.8 — modifiers KHÔNG nằm trong player.modifiers nữa.
    expect(player.modifiers).toEqual([])
  })

  it('unlocksElement — thêm vào unlockedElements, không trùng', () => {
    const player = playerWith({ skillInsight: 5 })

    expect(purchaseNode(player, minorNode({ id: 'unlock_fire', insightCost: 1, effect: { unlocksElement: 'fire' } }))).toBe(true)
    expect(player.unlockedElements).toEqual(['fire'])

    expect(purchaseNode(player, minorNode({ id: 'unlock_fire_2', insightCost: 1, effect: { unlocksElement: 'fire' } }))).toBe(true)
    expect(player.unlockedElements).toEqual(['fire'])
  })

  it('nâng nhiều cấp trừ ĐÚNG cost từng cấp; không vượt maxLevel; thất bại không mutate', () => {
    const player = playerWith({ skillInsight: 100 })

    const node = powerNode()

    expect(purchaseNode(player, node)).toBe(true)

    // Dãy 1,1,1,2,2,2,3,3,3,4 — tổng 22 cho level 10.
    let spent = 1

    while (upgradeNode(player, node)) {
      spent += getNextLevelCost(node, getNodeLevel(player, node.id) - 1)
    }

    expect(getNodeLevel(player, 'test_power')).toBe(10)
    expect(player.skillInsight).toBe(100 - 22 - spent + spent)
    expect(canUpgradeNode(player, node)).toBe(false)

    const before = { insight: player.skillInsight, level: getNodeLevel(player, 'test_power') }

    expect(upgradeNode(player, node)).toBe(false)

    expect(player.skillInsight).toBe(before.insight)
    expect(getNodeLevel(player, 'test_power')).toBe(before.level)
  })

  it('canUpgradeNode false khi chưa lĩnh ngộ', () => {
    const player = playerWith({ skillInsight: 50 })

    expect(canUpgradeNode(player, powerNode())).toBe(false)
    expect(upgradeNode(player, powerNode())).toBe(false)
    expect(getNodeLevel(player, 'test_power')).toBe(0)
  })
})

describe('aggregator (plan §6.8) — hiệu lực suy ra từ (registry, nodeLevels)', () => {
  it('Power modifier = base + perLevel × (level − 1), bất kể thứ tự nâng', () => {
    const registryA = { getAll: () => [powerNode()] }

    const playerA = playerWith({ skillInsight: 100 })

    purchaseNode(playerA, powerNode())

    for (let i = 0; i < 4; i++) {
      upgradeNode(playerA, powerNode())
    }

    // Nâng lẻ tẻ tới level 5...
    const playerB = playerWith({ skillInsight: 100, nodeLevels: { test_power: 5 } })

    // ...cùng kết quả với nâng tuần tự.
    expect(getNodeLevel(playerB, 'test_power')).toBe(getNodeLevel(playerA, 'test_power'))

    const modsA = aggregateNodeStatModifiers(registryA, playerA)
    const modsB = aggregateNodeStatModifiers(registryA, playerB)

    expect(modsA).toHaveLength(1)
    expect(modsA[0]!.flat).toBe(10) // 2 + 2 × 4
    expect(modsB[0]!.flat).toBe(modsA[0]!.flat)
  })

  it('node level 0 KHÔNG đóng góp modifier nào', () => {
    const registry = { getAll: () => [powerNode()] }

    const player = playerWith({})

    expect(aggregateNodeStatModifiers(registry, player)).toEqual([])
  })

  it('skillModifiers suy ra theo level, không mutate Skill instance', () => {
    const keystone = minorNode({
      id: 'tu_hoa_test',

      effect: {
        skillModifiers: [
          { skillId: 'hoa_cau_thuat', statModifiers: [{ stat: 'hoaTheGainPerCast', flat: 1 }] },
        ],
      },
    })

    const spec = minorNode({
      id: 'hoa_mach_test',

      maxLevel: 5,

      effect: {
        skillModifiers: [
          { skillId: 'hoa_cau_thuat', statModifiers: [{ stat: 'hoaTheGainPerCast', flat: 0.02, perLevelFlat: 0.02 }] },
        ],
      },
    })

    const registry = { getAll: () => [keystone, spec] }

    const player = playerWith({ nodeLevels: { tu_hoa_test: 1, hoa_mach_test: 3 } })

    const aggregated = aggregateNodeSkillModifiers(registry, player)

    expect(aggregated).toHaveLength(2)

    // Cả 2 node cùng nhắm stat hoaTheGainPerCast — flats phải là
    // {keystone: 1} và {spec level 3: 0.02 + 0.02 × 2 = 0.06}.
    const flats = aggregated
      .flatMap(entry => entry.statModifiers.map(modifier => modifier.flat))
      .sort((a, b) => a - b)

    expect(flats[0]).toBeCloseTo(0.06, 6)
    expect(flats[1]).toBe(1)
  })
})

describe('canPurchaseNode', () => {
  it('false khi node đã có level (chặn mua trùng)', () => {
    const player = playerWith({ skillInsight: 50, nodeLevels: { test_minor: 2 } })

    expect(canPurchaseNode(player, minorNode({ insightCost: 3 }))).toBe(false)
  })

  it('prerequisites là AND — thiếu 1 cái thì false', () => {
    const player = playerWith({ skillInsight: 10, realmId: 'golden_core', unlockedElements: ['fire'] })

    const node = minorNode({
      insightCost: 1,
      prerequisites: [
        { kind: 'realm', realmId: 'golden_core' },
        { kind: 'element', element: 'water' },
      ],
    })

    expect(canPurchaseNode(player, node)).toBe(false)

    player.unlockedElements.push('water')

    expect(canPurchaseNode(player, node)).toBe(true)
  })
})

describe('devResetBranch (plan §6.10)', () => {
  function branchRegistry() {
    const root = minorNode({
      id: 'branch_root',

      branchTag: 'test_branch',

      insightCost: 0,

      effect: {},
    })

    const power = powerNode({ prerequisites: [{ kind: 'node', nodeId: 'branch_root' }], branchTag: 'test_branch' })

    const childOfPower = minorNode({
      id: 'branch_child',

      branchTag: 'test_branch',

      maxLevel: 5,

      upgradeCost: { base: 1, perLevel: 2 },

      prerequisites: [{ kind: 'node', nodeId: 'test_power' }],

      effect: {},
    })

    return { registry: { getAll: () => [root, power, childOfPower] }, root, power, childOfPower }
  }

  it('hoàn đúng tổng Cảm Ngộ đã tiêu, reset level về 0', () => {
    const { registry, root, power, childOfPower } = branchRegistry()

    const player = playerWith({ skillInsight: 100 })

    // Chi tiêu thực tế: root (cost 0) + power (1+1+1+1) + child (1+1).
    expect(purchaseNode(player, root)).toBe(true)

    expect(purchaseNode(player, power)).toBe(true)

    for (let i = 0; i < 3; i++) {
      expect(upgradeNode(player, power)).toBe(true)
    }

    expect(purchaseNode(player, childOfPower)).toBe(true)

    expect(upgradeNode(player, childOfPower)).toBe(true)

    const before = player.skillInsight

    const refund = devResetBranch(player, registry, 'test_branch')

    // power level 4: 1+1+1+2 = 5; child level 2: 1+1 = 2 → refund 7.
    expect(refund).toBe(7)

    expect(player.skillInsight).toBe(before + refund)

    expect(getNodeLevel(player, 'test_power')).toBe(0)
    expect(getNodeLevel(player, 'branch_child')).toBe(0)
    expect(player.purchasedNodeIds).toEqual([])
  })

  it('cascade gỡ node con mồ côi khi prerequisite cha về 0', () => {
    const { registry, power, childOfPower } = branchRegistry()

    const player = playerWith({
      skillInsight: 100,

      // Chỉ còn child có level — cha đã về 0 trước đó.
      nodeLevels: { branch_child: 2 },
    })

    void power

    const refund = devResetBranch(player, registry, 'other_branch')

    // other_branch không tồn tại → refund 0, KHÔNG đụng state.
    expect(refund).toBe(0)
    expect(getNodeLevel(player, 'branch_child')).toBe(2)

    // Reset đúng nhánh chứa cha (test_branch) → child mồ côi cũng bị gỡ.
    const refund2 = devResetBranch(player, registry, 'test_branch')

    expect(refund2).toBe(1 + 1)
    expect(getNodeLevel(player, 'branch_child')).toBe(0)
  })
})
