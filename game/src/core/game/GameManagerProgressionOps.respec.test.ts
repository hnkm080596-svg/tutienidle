import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import { ManualClockSource } from '../battle/turn/CombatClock'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { getNextLevelCost } from '../progression/NodeSystem'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_ELEMENT_ROOT_IDS } from '../../data/progression/PhapTuNodes.builders'

// M-F-RESPEC (ruling S14) - ops-level contract for the player respec:
// FREE Beta respec of node investment, out-of-combat only, whole-tree or
// branch scope. Phap Tu element roots are preserved commit markers - the
// ops layer that rejects their public purchase also exempts them here.

function node(overrides: Partial<ProgressionNode> = {}): ProgressionNode {
  return {
    id: 'ops_node',
    name: 'Ops Node',
    type: 'minor',
    insightCost: 1,
    effect: {},
    ...overrides,
  }
}

function respecNodes() {
  const root = node({ id: 'ops_root', insightCost: 0 })

  const mid = node({
    id: 'ops_mid',
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    prerequisites: [{ kind: 'node', nodeId: 'ops_root' }],
  })

  const leaf = node({
    id: 'ops_leaf',
    prerequisites: [{ kind: 'node', nodeId: 'ops_mid' }],
  })

  return [root, mid, leaf]
}

// Immortal + harmless: a battle against it stays 'fighting' until
// abandoned - deterministic in-progress window for the combat guard.
const PUNCHING_BAG = defineEnemy({
  id: 'respec_punching_bag',
  name: 'Punching Bag',
  level: 1,
  realmId: 'mortal',
  lane: 'ground',
  statsInput: {
    maxHp: 1_000_000,
    might: 0,
    attackSpeed: 1,
    criticalRate: 0,
    criticalDamage: 1.5,
    armor: 0,
    evasionRate: 0,
  },
  rewards: { techniqueMastery: 0, spiritStone: 0 },
})

function setup(nodes: ProgressionNode[] = respecNodes()) {
  const gameManager = new GameManager()
  gameManager.setCombatClockSource(new ManualClockSource())
  gameManager.catalogOps.registerProgressionNodes(nodes)
  gameManager.catalogOps.registerEnemyTemplates([PUNCHING_BAG])

  const player = createDefaultPlayer()
  gameManager.setActivePlayer(player)

  return { gameManager, player }
}

function own(player: PlayerData, levels: Record<string, number>) {
  for (const [id, level] of Object.entries(levels)) {
    player.nodeLevels[id] = level

    if (!player.purchasedNodeIds.includes(id)) {
      player.purchasedNodeIds.push(id)
    }
  }
}

describe('progressionOps.respecNodeTree', () => {
  it('whole-tree respec refunds 100% actually-paid Insight and clears investment', () => {
    const { gameManager, player } = setup()

    // ops_mid L2 spend = 1+1 = 2, ops_leaf L1 = 1 (ops_root free).
    own(player, { ops_root: 1, ops_mid: 2, ops_leaf: 1 })
    player.skillInsight = 100

    const refund = gameManager.progressionOps.respecNodeTree(player)

    expect(refund).toBe(3)
    expect(player.skillInsight).toBe(103)
    expect(player.nodeLevels).toEqual({})
    expect(player.purchasedNodeIds).toEqual([])
  })

  it('rejects during an in-progress turn battle without mutating state', () => {
    const { gameManager, player } = setup()

    own(player, { ops_root: 1, ops_mid: 2, ops_leaf: 1 })
    player.skillInsight = 100

    gameManager.startBattleWithPlayer(player, PUNCHING_BAG)

    expect(gameManager.turnBattleOps.isTurnBattleInProgress()).toBe(true)

    const before = structuredClone(player)

    expect(gameManager.progressionOps.respecNodeTree(player)).toBeNull()
    expect(gameManager.progressionOps.respecNodeTree(player, { rootId: 'ops_mid' })).toBeNull()

    expect(player.nodeLevels).toEqual(before.nodeLevels)
    expect(player.purchasedNodeIds).toEqual(before.purchasedNodeIds)
    expect(player.skillInsight).toBe(before.skillInsight)
  })

  it('preserves Phap Tu element roots - commit markers are never respec targets', () => {
    const { gameManager, player } = setup(PHAP_TU_NODES)

    const rootId = PHAP_TU_ELEMENT_ROOT_IDS.fire
    const growth = PHAP_TU_NODES.find(
      node => node.elementTag === 'fire' && node.id !== rootId && (node.maxLevel ?? 1) > 1,
    )!

    // Committed element: root held via selectSpellPathElement's atomic
    // grant semantics, two growth levels invested on top.
    player.spellPath.element = 'fire'
    player.spellPath.route = 'dot'
    own(player, { [rootId]: 1, [growth.id]: 2 })
    player.skillInsight = 100

    const refund = gameManager.progressionOps.respecNodeTree(player)

    // The element root survives at level 1 (unreachable via
    // purchaseNode); the growth investment is refunded.
    expect(refund).toBe(getNextLevelCost(growth, 0) + getNextLevelCost(growth, 1))
    expect(player.nodeLevels[rootId]).toBe(1)
    expect(player.purchasedNodeIds).toContain(rootId)
    expect(player.nodeLevels[growth.id]).toBeUndefined()
  })

  it('branch scope at a preserved element root resets its descendants but keeps the root', () => {
    const { gameManager, player } = setup(PHAP_TU_NODES)

    const rootId = PHAP_TU_ELEMENT_ROOT_IDS.fire
    const growth = PHAP_TU_NODES.find(
      node =>
        (node.maxLevel ?? 1) > 1 &&
        (node.prerequisites ?? []).some(
          prerequisite => prerequisite.kind === 'node' && prerequisite.nodeId === rootId,
        ),
    )!

    player.spellPath.element = 'fire'
    player.spellPath.route = 'dot'
    own(player, { [rootId]: 1, [growth.id]: 2 })
    player.skillInsight = 100

    const refund = gameManager.progressionOps.respecNodeTree(player, { rootId })

    // Preservation exempts the commit marker from revocation, not from
    // seeding its subtree: the root stays, the investment below resets.
    expect(refund).toBe(getNextLevelCost(growth, 0) + getNextLevelCost(growth, 1))
    expect(player.nodeLevels[rootId]).toBe(1)
    expect(player.purchasedNodeIds).toContain(rootId)
    expect(player.nodeLevels[growth.id]).toBeUndefined()
  })

  it('branch scope resets only the subtree rooted at scope.rootId', () => {
    const { gameManager, player } = setup()

    own(player, { ops_root: 1, ops_mid: 2, ops_leaf: 1 })
    player.skillInsight = 100

    const refund = gameManager.progressionOps.respecNodeTree(player, { rootId: 'ops_mid' })

    // ops_mid L2 (2) + orphaned ops_leaf (1) = 3; ops_root kept.
    expect(refund).toBe(3)
    expect(player.nodeLevels).toEqual({ ops_root: 1 })
  })

  it('previewNodeRespec reports refund + reset count without mutating', () => {
    const { gameManager, player } = setup(PHAP_TU_NODES)

    const rootId = PHAP_TU_ELEMENT_ROOT_IDS.fire

    player.spellPath.element = 'fire'
    player.spellPath.route = 'dot'
    own(player, { [rootId]: 1 })
    player.skillInsight = 100

    const before = structuredClone(player)
    const preview = gameManager.progressionOps.previewNodeRespec(player)

    // The preserved element root is not counted as a reset target.
    expect(preview.refund).toBe(0)
    expect(preview.resetCount).toBe(0)
    expect(preview.resetNodeIds).toEqual([])
    expect(player).toEqual(before)
  })

  it('realm-reward grants survive respec - rewardOnly nodes are exempt from revocation', () => {
    const { gameManager, player } = setup(PHAP_TU_NODES)

    const reward = PHAP_TU_NODES.find((node) => node.rewardOnly === true)!

    // The grant writes nodeLevels only (no purchasedNodeIds mirror) -
    // that is the canonical grant shape produced by
    // grantCultivationPathRealmReward.
    player.spellPath.element = 'fire'
    player.spellPath.route = 'dot'
    player.nodeLevels[reward.id] = 2
    player.skillInsight = 100

    const preview = gameManager.progressionOps.previewNodeRespec(player)
    expect(preview.resetNodeIds).not.toContain(reward.id)

    const refund = gameManager.progressionOps.respecNodeTree(player)

    expect(refund).toBe(0)
    expect(player.nodeLevels[reward.id]).toBe(2)
  })

  it('rewardOnly nodes are exempt from the orphan cascade even when they carry node prereqs', () => {
    // Armor for the grant-owned channel: authored reward nodes carry no
    // 'node' prereqs today, but if a future one does, revoking its parent
    // must not sweep it (target-selection exemption alone is not enough).
    const root = node({ id: 'ops_root', insightCost: 0 })
    const mid = node({
      id: 'ops_mid',
      prerequisites: [{ kind: 'node', nodeId: 'ops_root' }],
    })
    const reward = node({
      id: 'ops_reward',
      rewardOnly: true,
      prerequisites: [{ kind: 'node', nodeId: 'ops_mid' }],
    })
    const { gameManager, player } = setup([root, mid, reward])

    own(player, { ops_root: 1, ops_mid: 1 })
    // Canonical grant shape: nodeLevels write only, no purchasedNodeIds.
    player.nodeLevels.ops_reward = 1
    player.skillInsight = 100

    gameManager.progressionOps.respecNodeTree(player)

    // ops_mid's revocation would orphan ops_reward - the exemption keeps it.
    expect(player.nodeLevels.ops_reward).toBe(1)
    expect(player.nodeLevels.ops_mid).toBeUndefined()
  })
})
