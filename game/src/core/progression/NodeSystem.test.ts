import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import {
  aggregateNodeStatModifiers,
  canPurchaseNode,
  canUpgradeNode,
  devResetBranch,
  getNodeLevel,
  getNodeMaxLevel,
  getNextLevelCost,
  grantSkillCore,
  hasPrerequisite,
  purchaseNode,
  respecNodeTree,
  upgradeNode,
} from './NodeSystem'
import { skillCoreNodeId } from './SkillCoreLevel'
import { NodeRegistry } from './NodeRegistry'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
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
    effect: { statModifiers: [{ id: 'test_mod', sourceId: 'test_minor', sourceType: 'talent', stat: 'might', flat: 5 }] },
    ...overrides,
  }
}

function powerNode(overrides: Partial<ProgressionNode> = {}): ProgressionNode {
  return minorNode({
    id: 'test_power',

    maxLevel: 10,

    upgradeCost: { base: 1, perLevel: 3 },

    effect: {
      statModifiers: [{ id: 'test_power:might', sourceId: 'test_power', sourceType: 'talent', stat: 'might', flat: 2, perLevelFlat: 2 }],
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

  // T8-75 - an unknown prerequisite realm id resolves to index -1 and
  // `playerIndex >= -1` silently passed the gate. Content drift must
  // fail closed.
  it('kind realm - unknown prerequisite realm id does NOT pass the gate', () => {
    const player = playerWith({ realmId: 'nascent_soul' })

    expect(hasPrerequisite(player, { kind: 'realm', realmId: 'realm_that_does_not_exist' })).toBe(false)
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

// Kiem Tu (2026-08-28) - Bat Kiem gate reads the player.skillCastCounts mirror
// + the canonical Core Node level (M-QI-05 - nodeLevels[core_<id>]).
describe('prerequisite skillCastCount', () => {
  it('thoả khi level skill đạt ngưỡng VÀ cast count đạt ngưỡng', () => {
    const player = playerWith({
      skillCastCounts: { tram: 9999 },
      nodeLevels: { core_tram: 3 },
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

// P7-M6 - technique-gated prerequisites read the read-only mirror
// player.techniqueProgress (canonical holder lives in TechniqueManager;
// TechniqueSystem's progress sink republishes the pair - same mirror
// contract as skillCastCounts for `skillCastCount`).
describe('prerequisite techniqueRank / techniqueGrade (P7-M6)', () => {
  // M-F-TECHNIQUE (F5) - techniqueRank reads the EFFECTIVE rank: the
  // live grade must equal the realm index, so fixtures set an in-band
  // realmId (a lagging holder contributes rank 0).
  it('techniqueRank - passes at/above mirror rank, fails below, fails closed without a technique', () => {
    const player = playerWith({
      realmId: 'foundation_establishment',
      techniqueProgress: { rank: 5, grade: 2 },
    })

    expect(hasPrerequisite(player, { kind: 'techniqueRank', rank: 5 })).toBe(true)
    expect(hasPrerequisite(player, { kind: 'techniqueRank', rank: 6 })).toBe(false)

    const noTechnique = playerWith({})

    expect(hasPrerequisite(noTechnique, { kind: 'techniqueRank', rank: 1 })).toBe(false)
  })

  it('techniqueGrade - passes at/above mirror grade, fails below, fails closed without a technique', () => {
    const player = playerWith({ techniqueProgress: { rank: 0, grade: 3 } })

    expect(hasPrerequisite(player, { kind: 'techniqueGrade', grade: 3 })).toBe(true)
    expect(hasPrerequisite(player, { kind: 'techniqueGrade', grade: 4 })).toBe(false)

    const noTechnique = playerWith({})

    expect(hasPrerequisite(noTechnique, { kind: 'techniqueGrade', grade: 1 })).toBe(false)
  })

  it('techniqueRank gate blocks purchase below threshold without deducting insight', () => {
    const player = playerWith({
      realmId: 'qi_refining',
      skillInsight: 5,
      techniqueProgress: { rank: 2, grade: 1 },
    })

    const node = minorNode({
      insightCost: 3,
      prerequisites: [{ kind: 'techniqueRank', rank: 4 }],
    })

    expect(canPurchaseNode(player, node)).toBe(false)
    expect(purchaseNode(player, node)).toBe(false)
    expect(player.skillInsight).toBe(5)
    expect(getNodeLevel(player, 'test_minor')).toBe(0)
    expect(player.purchasedNodeIds).toEqual([])

    player.techniqueProgress = { rank: 4, grade: 1 }

    expect(purchaseNode(player, node)).toBe(true)
    expect(player.skillInsight).toBe(2)
    expect(getNodeLevel(player, 'test_minor')).toBe(1)
  })

  it('technique-kind revealWhen gates purchase until the mirror reveals it', () => {
    const player = playerWith({ skillInsight: 5, techniqueProgress: { rank: 0, grade: 1 } })

    const node = minorNode({
      insightCost: 1,
      revealWhen: { kind: 'techniqueGrade', grade: 2 },
    })

    expect(canPurchaseNode(player, node)).toBe(false)

    player.techniqueProgress = { rank: 0, grade: 2 }

    expect(canPurchaseNode(player, node)).toBe(true)
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

  // E-8 (2026-09-03) — selectsSpecialization là effect THUẦN DATA (wire
  // SkillSystem ở GameManager.purchaseNode, không phải NodeSystem thuần)
  // — NodeSystem chỉ cần mua được node mang effect này.
  it('node có selectsSpecialization mua bình thường (effect data-only)', () => {
    const player = playerWith({ skillInsight: 5 })

    const node = minorNode({
      id: 'test_spec',
      insightCost: 1,
      effect: { selectsSpecialization: { skillId: 'hoa_cau_thuat', specializationId: 'spec_a' } },
    })

    expect(purchaseNode(player, node)).toBe(true)
    expect(getNodeLevel(player, 'test_spec')).toBe(1)
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
})

describe('canPurchaseNode', () => {
  it('false khi node đã có level (chặn mua trùng)', () => {
    const player = playerWith({ skillInsight: 50, nodeLevels: { test_minor: 2 } })

    expect(canPurchaseNode(player, minorNode({ insightCost: 3 }))).toBe(false)
  })

  it('prerequisites là AND — thiếu 1 cái thì false', () => {
    const player = playerWith({ skillInsight: 10, realmId: 'golden_core', nodeLevels: { prereq_node: 1 } })

    const node = minorNode({
      insightCost: 1,
      prerequisites: [
        { kind: 'realm', realmId: 'golden_core' },
        { kind: 'node', nodeId: 'missing_node' },
      ],
    })

    expect(canPurchaseNode(player, node)).toBe(false)

    player.nodeLevels['missing_node'] = 1

    expect(canPurchaseNode(player, node)).toBe(true)
  })
})

// requiredCultivationPath ownership gate — a path-tagged node must be
// inert for every other path at purchase, upgrade, and aggregation
// (the render layer is not the gameplay authority).
describe('nodePathApplies — cultivation path ownership gate', () => {
  const bodyNode = () =>
    minorNode({
      id: 'the_tu_only',
      requiredCultivationPath: 'body',
      effect: {
        statModifiers: [{ id: 'the_tu_only:vit', sourceId: 'the_tu_only', sourceType: 'talent', stat: 'vitality', flat: 3 }],
      },
    })

  const hiddenBodyNode = () => minorNode({ id: 'the_tu_an_only', requiredCultivationPath: 'body' })

  it('a body node is NOT purchasable by a spell player even with insight and prereqs satisfied', () => {
    const player = playerWith({ cultivationPath: 'spell', skillInsight: 50 })

    expect(canPurchaseNode(player, bodyNode())).toBe(false)
    expect(purchaseNode(player, bodyNode())).toBe(false)
    expect(getNodeLevel(player, 'the_tu_only')).toBe(0)
  })

  it('a body node owned by a sword player aggregates NOTHING; a body player gets the stats', () => {
    const registry = { getAll: () => [bodyNode()] }

    const swordPathPlayer = playerWith({ cultivationPath: 'sword', nodeLevels: { the_tu_only: 2 } })
    expect(aggregateNodeStatModifiers(registry, swordPathPlayer)).toEqual([])

    const bodyPlayer = playerWith({ cultivationPath: 'body', nodeLevels: { the_tu_only: 2 } })
    const mods = aggregateNodeStatModifiers(registry, bodyPlayer)
    expect(mods).toHaveLength(1)
    expect(mods[0]!.flat).toBe(3)
  })

  it('a base-path stamp with no requiredWay is path-level only — way membership is the inner gate (M7)', () => {
    const registry = { getAll: () => [hiddenBodyNode()] }
    // The node carries only requiredCultivationPath ('body' base id):
    // EITHER way inside the path owns it at path level. requiredWay (a
    // sibling gate, NodeSystem.way.test.ts) is what separates hien from
    // ung_the inside the family.
    const bodyPlayer = playerWith({ cultivationPath: 'body', cultivationWay: 'body_pathway', skillInsight: 50 })

    expect(canPurchaseNode(bodyPlayer, hiddenBodyNode())).toBe(true)

    const ungThePlayer = playerWith({ cultivationPath: 'body', cultivationWay: 'hidden_body_pathway', skillInsight: 50 })
    expect(canPurchaseNode(ungThePlayer, hiddenBodyNode())).toBe(true)
  })

  it('canUpgradeNode rejects a wrong-path owner even when the node has levels', () => {
    const node = { ...bodyNode(), maxLevel: 5, upgradeCost: { base: 1, perLevel: 2 } }

    const bodyPlayer = playerWith({ cultivationPath: 'body', skillInsight: 50, nodeLevels: { the_tu_only: 1 } })
    expect(canUpgradeNode(bodyPlayer, node)).toBe(true)

    const spellPathPlayer = playerWith({ cultivationPath: 'spell', skillInsight: 50, nodeLevels: { the_tu_only: 1 } })
    expect(canUpgradeNode(spellPathPlayer, node)).toBe(false)
  })

  it('path-agnostic nodes (requiredCultivationPath undefined) still work for every path', () => {
    const player = playerWith({ cultivationPath: 'sword', skillInsight: 10 })

    expect(canPurchaseNode(player, minorNode())).toBe(true)
    expect(purchaseNode(player, minorNode())).toBe(true)

    const registry = { getAll: () => [minorNode()] }
    expect(aggregateNodeStatModifiers(registry, player)).toHaveLength(1)
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

    const registry = new NodeRegistry()

    for (const node of [root, power, childOfPower]) {
      registry.register(node)
    }

    return { registry, root, power, childOfPower }
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
    const { registry, power } = branchRegistry()

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

// M-F-RESPEC (ruling S14) - player-facing FREE Beta respec: 100% actual
// Insight refund, cascade-reset invalid descendants, atomic/deterministic/
// idempotent/save-safe. Same command for whole-tree and branch scope -
// scope.rootId scopes to the subtree rooted at that node; omitted scope
// resets the whole NodeTree.
describe('respecNodeTree', () => {
  function respecRegistry() {
    const root = minorNode({ id: 'respec_root', insightCost: 0, effect: {} })

    const power = powerNode({ prerequisites: [{ kind: 'node', nodeId: 'respec_root' }] })

    const child = minorNode({
      id: 'respec_child',
      maxLevel: 5,
      upgradeCost: { base: 1, perLevel: 2 },
      prerequisites: [{ kind: 'node', nodeId: 'test_power' }],
      effect: {},
    })

    const otherRoot = minorNode({ id: 'other_root', insightCost: 3, effect: {} })

    const registry = new NodeRegistry()

    for (const node of [root, power, child, otherRoot]) {
      registry.register(node)
    }

    return { registry, root, power, child, otherRoot }
  }

  // Spend: power L4 = 1+1+1+2 = 5; child L2 = 1+1 = 2; otherRoot L1 = 3.
  // Total actually paid = 10.
  function invest(
    player: ReturnType<typeof playerWith>,
    nodes: { root: ProgressionNode; power: ProgressionNode; child: ProgressionNode; otherRoot: ProgressionNode },
  ) {
    expect(purchaseNode(player, nodes.root)).toBe(true)
    expect(purchaseNode(player, nodes.power)).toBe(true)

    for (let i = 0; i < 3; i++) {
      expect(upgradeNode(player, nodes.power)).toBe(true)
    }

    expect(purchaseNode(player, nodes.child)).toBe(true)
    expect(upgradeNode(player, nodes.child)).toBe(true)
    expect(purchaseNode(player, nodes.otherRoot)).toBe(true)
  }

  it('whole-tree scope (omitted) — refunds 100% actually-paid and resets every owned node', () => {
    const { registry, ...nodes } = respecRegistry()
    const player = playerWith({ skillInsight: 100 })

    invest(player, nodes)
    const before = player.skillInsight

    const refund = respecNodeTree(player, registry)

    expect(refund).toBe(10)
    expect(player.skillInsight).toBe(before + 10)
    expect(player.nodeLevels).toEqual({})
    expect(player.purchasedNodeIds).toEqual([])
    expect(player.nodeFreePurchaseRecord).toEqual({})
  })

  it('repeat respec is idempotent — second call refunds 0 and changes nothing', () => {
    const { registry, ...nodes } = respecRegistry()
    const player = playerWith({ skillInsight: 100 })

    invest(player, nodes)
    respecNodeTree(player, registry)

    const snapshot = structuredClone(player)
    const refund = respecNodeTree(player, registry)

    expect(refund).toBe(0)
    expect(player.nodeLevels).toEqual(snapshot.nodeLevels)
    expect(player.purchasedNodeIds).toEqual(snapshot.purchasedNodeIds)
    expect(player.skillInsight).toBe(snapshot.skillInsight)
  })

  it('no double refund — free-purchase record nets out of the refund and is cleared', () => {
    const { registry, ...nodes } = respecRegistry()
    const player = playerWith({ skillInsight: 100 })

    invest(player, nodes)
    player.nodeFreePurchaseRecord = { test_power: 2 }

    const before = player.skillInsight
    const refund = respecNodeTree(player, registry)

    // 10 paid - 2 recorded free = 8, written once.
    expect(refund).toBe(8)
    expect(player.skillInsight).toBe(before + 8)
    expect(player.nodeFreePurchaseRecord).toEqual({})
  })

  it('cascade revokes M-QI-05 granted cores; un-granted skill cores are not respec targets', () => {
    const granter = minorNode({ id: 'granter', effect: { grantsSkillCoreIds: ['test_skill'] } })
    const grantedCore = minorNode({
      id: skillCoreNodeId('test_skill'),
      levelsSkillId: 'test_skill',
      insightCost: 0,
      maxLevel: 10,
      upgradeCost: { base: 5, perLevel: 3 },
    })
    const ungrantedCore = minorNode({
      id: skillCoreNodeId('free_skill'),
      levelsSkillId: 'free_skill',
      insightCost: 0,
      maxLevel: 10,
      upgradeCost: { base: 5, perLevel: 3 },
    })

    const registry = new NodeRegistry()

    for (const node of [granter, grantedCore, ungrantedCore]) {
      registry.register(node)
    }

    const player = playerWith({ skillInsight: 100 })

    expect(purchaseNode(player, granter)).toBe(true)
    grantSkillCore(player, grantedCore)

    // Core upgrades repaid Insight (curve 5 + 3x(L-1)): L3 = 5 + 8 = 13.
    for (let i = 0; i < 2; i++) {
      expect(upgradeNode(player, grantedCore)).toBe(true)
    }

    // The un-granted core is skill-axis investment, not node-tree content.
    player.nodeLevels[ungrantedCore.id] = 3

    const before = player.skillInsight
    const refund = respecNodeTree(player, registry)

    // granter 1 + core spend 13 = 14; the free core stays levelled.
    expect(refund).toBe(14)
    expect(player.skillInsight).toBe(before + 14)
    expect(getNodeLevel(player, 'granter')).toBe(0)
    expect(getNodeLevel(player, grantedCore.id)).toBe(0)
    expect(getNodeLevel(player, ungrantedCore.id)).toBe(3)
  })

  it('save-safe — a JSON restore after respec keeps the outcome, no double refund', () => {
    const { registry, ...nodes } = respecRegistry()
    const player = playerWith({ skillInsight: 100 })

    invest(player, nodes)
    respecNodeTree(player, registry)

    // The save payload IS a JSON encoding - round-trip it like the real
    // restore transaction does, then prove a second respec can find no
    // refund residue.
    const restored = JSON.parse(JSON.stringify(player)) as typeof player
    const refund = respecNodeTree(restored, registry)

    expect(refund).toBe(0)
    expect(restored.nodeLevels).toEqual({})
    expect(restored.skillInsight).toBe(player.skillInsight)
  })

  it('re-purchase after respec costs normally; a later respec refunds only the new spend', () => {
    const { registry, ...nodes } = respecRegistry()
    const player = playerWith({ skillInsight: 100 })

    invest(player, nodes)
    respecNodeTree(player, registry)

    // Re-invest in the power node only: its respec_root prereq must be
    // re-bought first, then L2 = 1+1 = 2.
    expect(purchaseNode(player, nodes.root)).toBe(true)
    expect(purchaseNode(player, nodes.power)).toBe(true)
    expect(upgradeNode(player, nodes.power)).toBe(true)

    const before = player.skillInsight
    const refund = respecNodeTree(player, registry)

    expect(refund).toBe(2)
    expect(player.skillInsight).toBe(before + 2)
  })

  it('scoped respec at a preserved root keeps the root but resets its descendants', () => {
    const { registry, ...nodes } = respecRegistry()
    const player = playerWith({ skillInsight: 100 })

    invest(player, nodes)

    const refund = respecNodeTree(player, registry, {
      rootId: 'respec_root',
      preserveIds: ['respec_root'],
    })

    // power (5) + child (2) reset; the preserved root and the unrelated
    // otherRoot both survive.
    expect(refund).toBe(7)
    expect(player.nodeLevels).toEqual({ respec_root: 1, other_root: 1 })
    expect(player.purchasedNodeIds).toEqual(['respec_root', 'other_root'])
  })

  it('branch scope at the tree root is equivalent to whole-tree scope', () => {
    const { registry, root, power, child } = respecRegistry()
    const singleRoot = new NodeRegistry()

    for (const node of [root, power, child]) {
      singleRoot.register(node)
    }

    const scoped = playerWith({ skillInsight: 100 })
    const whole = playerWith({ skillInsight: 100 })

    invest(scoped, { root, power, child, otherRoot: minorNode({ id: 'ghost' }) })
    invest(whole, { root, power, child, otherRoot: minorNode({ id: 'ghost' }) })

    // otherRoot is not registered here; invest() purchases it against the
    // real node object so both players end with identical tree state.
    const scopedRefund = respecNodeTree(scoped, singleRoot, { rootId: 'respec_root' })
    const wholeRefund = respecNodeTree(whole, singleRoot)

    expect(scopedRefund).toBe(7)
    expect(wholeRefund).toBe(7)
    expect(scoped.nodeLevels).toEqual(whole.nodeLevels)
    expect(scoped.purchasedNodeIds).toEqual(whole.purchasedNodeIds)
    expect(scoped.skillInsight).toBe(whole.skillInsight)
  })

  it('branch scope on a subtree root resets that subtree and keeps siblings', () => {
    const { registry, ...nodes } = respecRegistry()
    const player = playerWith({ skillInsight: 100 })

    invest(player, nodes)
    const before = player.skillInsight

    const refund = respecNodeTree(player, registry, { rootId: 'test_power' })

    // power L4 (5) + orphaned child L2 (2) = 7; root and otherRoot kept.
    expect(refund).toBe(7)
    expect(player.skillInsight).toBe(before + 7)
    expect(getNodeLevel(player, 'test_power')).toBe(0)
    expect(getNodeLevel(player, 'respec_child')).toBe(0)
    expect(getNodeLevel(player, 'respec_root')).toBe(1)
    expect(getNodeLevel(player, 'other_root')).toBe(1)
  })

  it('preserveIds exempts commit-marker nodes from whole-tree and scoped resets', () => {
    const { registry, ...nodes } = respecRegistry()
    const player = playerWith({ skillInsight: 100 })

    invest(player, nodes)

    const refund = respecNodeTree(player, registry, { preserveIds: ['respec_root', 'other_root'] })

    // Only power + child reset; both roots survive as preserved markers.
    expect(refund).toBe(7)
    expect(getNodeLevel(player, 'respec_root')).toBe(1)
    expect(getNodeLevel(player, 'other_root')).toBe(1)
    expect(getNodeLevel(player, 'test_power')).toBe(0)
    expect(getNodeLevel(player, 'respec_child')).toBe(0)

    // A scoped reset at the preserved root refunds 0 - its descendants
    // are already reset, and the marker itself is never revoked.
    expect(respecNodeTree(player, registry, { rootId: 'respec_root', preserveIds: ['respec_root'] })).toBe(0)
    expect(getNodeLevel(player, 'respec_root')).toBe(1)
  })

  it('atomic — a broken core tie fails closed with zero state change', () => {
    const { registry: inner, ...nodes } = respecRegistry()

    const granter = minorNode({
      id: 'broken_granter',
      effect: { grantsSkillCoreIds: ['ghost_skill'] },
    })
    const ghostCore = minorNode({
      id: skillCoreNodeId('ghost_skill'),
      levelsSkillId: 'ghost_skill',
      insightCost: 0,
    })

    inner.register(granter)
    inner.register(ghostCore)

    // Corrupt tie: the core resolves in `has` but `get` throws. Without
    // the clone preflight the revocation would delete granter's record
    // and then die mid-transaction on the tied core.
    const registry = {
      getAll: () => inner.getAll(),
      has: (id: string) => inner.has(id),
      get: (id: string) => {
        if (id === ghostCore.id) {
          throw new Error('corrupt core entry')
        }
        return inner.get(id)
      },
    }

    const player = playerWith({ skillInsight: 100 })

    expect(purchaseNode(player, nodes.root)).toBe(true)
    expect(purchaseNode(player, nodes.otherRoot)).toBe(true)
    expect(purchaseNode(player, granter)).toBe(true)

    // Simulate the granted core the tie would revoke.
    player.nodeLevels[ghostCore.id] = 1

    const before = structuredClone(player)

    expect(() => respecNodeTree(player, registry)).toThrow('corrupt core entry')
    expect(player).toEqual(before)
  })

  it('scoped respec on an unregistered root is a no-op', () => {
    const { registry, ...nodes } = respecRegistry()
    const player = playerWith({ skillInsight: 100 })

    invest(player, nodes)
    const before = player.skillInsight

    expect(respecNodeTree(player, registry, { rootId: 'node_that_does_not_exist' })).toBe(0)
    expect(player.skillInsight).toBe(before)
    expect(getNodeLevel(player, 'test_power')).toBe(4)
  })
})

// Dry-run projection of respecNodeTree on a cloned player - mirrors the
// ops-layer preview's domain leg so these specs assert preview==commit
// parity without reaching SkillManager state.
function previewRespec(
  player: PlayerData,
  registry: NodeRegistry,
): { refund: number; resetNodeIds: string[]; resetCount: number } {
  const sim = JSON.parse(JSON.stringify(player)) as PlayerData
  const refund = respecNodeTree(sim, registry)
  const resetNodeIds = Object.keys(player.nodeLevels ?? {}).filter(
    id => !(id in (sim.nodeLevels ?? {})),
  )

  return { refund, resetNodeIds, resetCount: resetNodeIds.length }
}

describe('previewNodeRespec', () => {
  it('reports the same refund and reset set the commit produces, without mutating', () => {
    const root = minorNode({ id: 'respec_root', insightCost: 0, effect: {} })
    const power = powerNode({ prerequisites: [{ kind: 'node', nodeId: 'respec_root' }] })
    const child = minorNode({
      id: 'respec_child',
      maxLevel: 5,
      upgradeCost: { base: 1, perLevel: 2 },
      prerequisites: [{ kind: 'node', nodeId: 'test_power' }],
      effect: {},
    })

    const registry = new NodeRegistry()

    for (const node of [root, power, child]) {
      registry.register(node)
    }

    const player = playerWith({ skillInsight: 100 })

    expect(purchaseNode(player, root)).toBe(true)
    expect(purchaseNode(player, power)).toBe(true)

    for (let i = 0; i < 3; i++) {
      expect(upgradeNode(player, power)).toBe(true)
    }

    expect(purchaseNode(player, child)).toBe(true)
    expect(upgradeNode(player, child)).toBe(true)

    const before = structuredClone(player)
    const preview = previewRespec(player, registry)

    expect(preview.refund).toBe(7)
    expect(preview.resetNodeIds.sort()).toEqual(['respec_child', 'respec_root', 'test_power'].sort())
    expect(preview.resetCount).toBe(3)

    // Preview is observational: live state is untouched.
    expect(player).toEqual(before)

    // The commit produces exactly what the preview reported.
    const refund = respecNodeTree(player, registry)

    expect(refund).toBe(preview.refund)
  })

  it('count covers granted cores revoked by the cascade, not only purchased nodes', () => {
    const granter = minorNode({
      id: 'prev_granter',
      effect: { grantsSkillCoreIds: ['prev_skill'] },
    })
    const core = minorNode({
      id: skillCoreNodeId('prev_skill'),
      levelsSkillId: 'prev_skill',
      insightCost: 0,
    })

    const registry = new NodeRegistry()

    for (const node of [granter, core]) {
      registry.register(node)
    }

    const player = playerWith({ skillInsight: 50 })

    expect(purchaseNode(player, granter)).toBe(true)
    grantSkillCore(player, core)

    const preview = previewRespec(player, registry)

    // C2C round-8 pin: the confirm count is ONE number over every
    // ownership record reset - the purchased node AND its revoked
    // granted core. Refund stays strictly actually-paid.
    expect(preview.resetNodeIds.sort()).toEqual([core.id, granter.id].sort())
    expect(preview.resetCount).toBe(2)
    expect(preview.refund).toBe(getNextLevelCost(granter, 0))
    expect(getNodeLevel(player, core.id)).toBe(1)
  })

  it('accepts a reactive (proxied) player — the UI path hands in Pinia state', () => {
    const root = minorNode({ id: 'respec_root', insightCost: 0, effect: {} })
    const power = powerNode({ prerequisites: [{ kind: 'node', nodeId: 'respec_root' }] })

    const registry = new NodeRegistry()

    for (const node of [root, power]) {
      registry.register(node)
    }

    // Pinia's store.$state is a reactive proxy; structuredClone would
    // refuse it - the preview must clone through the proxy instead.
    const player = reactive(playerWith({ skillInsight: 50 }))

    purchaseNode(player, root)
    purchaseNode(player, power)

    const preview = previewRespec(player, registry)

    expect(preview.refund).toBe(power.insightCost)
    expect(preview.resetCount).toBe(2)
    expect(getNodeLevel(player, 'test_power')).toBe(1)
  })
})

describe('getNodeMaxLevel', () => {
  // Single normalization owner for "how many levels can this node reach"
  // - both UI consumers (NodeTreePanel, NodeInspector) must read through
  // it instead of re-deriving Math.max(1, maxLevel ?? 1).
  it('normalizes absent/zero/positive maxLevel to 1/1/N', () => {
    expect(getNodeMaxLevel(minorNode())).toBe(1)
    expect(getNodeMaxLevel(minorNode({ maxLevel: 0 }))).toBe(1)
    expect(getNodeMaxLevel(minorNode({ maxLevel: 7 }))).toBe(7)
  })
})
