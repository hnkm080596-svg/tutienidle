import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import { ManualClockSource } from '../battle/turn/CombatClock'
import type { ProgressionNode } from '../progression/ProgressionNode'

// F-TT-CLEAN-A2-INT-1 - every progression writer gated on
// isTurnBattleInProgress gets the same rejection pin respecNodeTree
// already had: mid-battle calls return the rejection sentinel and
// mutate nothing. The UI disabled-state is cosmetic; the ops gate is
// the authoritative boundary.

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

// Same punching bag the respec pin uses - a battle against it stays
// 'fighting' until abandoned, giving a deterministic in-progress window.
const PUNCHING_BAG = defineEnemy({
  id: 'inbattle_punching_bag',
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

function startInProgressBattle(gameManager: GameManager, player: PlayerData) {
  gameManager.startBattleWithPlayer(player, PUNCHING_BAG)
  expect(gameManager.turnBattleOps.isTurnBattleInProgress()).toBe(true)
}

describe('progressionOps in-battle rejection gates', () => {
  it('grantSkillCoreBySkillId rejects mid-battle without mutating state', () => {
    const { gameManager, player } = setup()
    startInProgressBattle(gameManager, player)
    const before = structuredClone(player)

    expect(gameManager.progressionOps.grantSkillCoreBySkillId(player, 'any_skill')).toBe(false)
    expect(player.nodeLevels).toEqual(before.nodeLevels)
  })

  it('purchaseNode rejects mid-battle without mutating state', () => {
    const { gameManager, player } = setup()
    player.skillInsight = 100
    startInProgressBattle(gameManager, player)
    const before = structuredClone(player)

    expect(gameManager.progressionOps.purchaseNode('ops_root', player)).toBe(false)
    expect(player.nodeLevels).toEqual(before.nodeLevels)
    expect(player.purchasedNodeIds).toEqual(before.purchasedNodeIds)
    expect(player.skillInsight).toBe(100)
  })

  it('upgradeNode rejects mid-battle without mutating state', () => {
    const { gameManager, player } = setup()
    own(player, { ops_root: 1, ops_mid: 1 })
    player.skillInsight = 100
    startInProgressBattle(gameManager, player)
    const before = structuredClone(player)

    expect(gameManager.progressionOps.upgradeNode('ops_mid', player)).toBe(false)
    expect(player.nodeLevels).toEqual(before.nodeLevels)
    expect(player.skillInsight).toBe(100)
  })

  it('devResetBranch rejects mid-battle without mutating state', () => {
    const { gameManager, player } = setup()
    own(player, { ops_root: 1, ops_mid: 2 })
    startInProgressBattle(gameManager, player)
    const before = structuredClone(player)

    expect(gameManager.progressionOps.devResetBranch('ops', player)).toBeNull()
    expect(player.nodeLevels).toEqual(before.nodeLevels)
    expect(player.purchasedNodeIds).toEqual(before.purchasedNodeIds)
  })

  it('levelUpSkill rejects mid-battle without mutating state', () => {
    const { gameManager, player } = setup()
    startInProgressBattle(gameManager, player)
    const before = structuredClone(player)

    expect(gameManager.progressionOps.levelUpSkill('any_skill', player)).toBe(false)
    expect(player.nodeLevels).toEqual(before.nodeLevels)
  })

  // F-TT-CLEAN-A3-INT-2 - coverage extension: the already-gated
  // selectSpellPathElement and the four writers the cleanA3 census
  // found ungated get the same rejection pin.
  it('selectSpellPathElement rejects mid-battle without mutating state', () => {
    const { gameManager, player } = setup()
    startInProgressBattle(gameManager, player)
    const before = structuredClone(player)

    expect(gameManager.progressionOps.selectSpellPathElement('fire', 'dot', player)).toBe(false)
    expect(player.spellPath).toEqual(before.spellPath)
    expect(player.nodeLevels).toEqual(before.nodeLevels)
  })

  it('learnSkill rejects mid-battle without mutating state', () => {
    const { gameManager, player } = setup()
    startInProgressBattle(gameManager, player)
    const before = structuredClone(player)

    expect(gameManager.progressionOps.learnSkill('any_skill', player)).toBe(false)
    expect(player.nodeLevels).toEqual(before.nodeLevels)
  })

  it('allocateAttributePoint rejects mid-battle without mutating state', () => {
    const { gameManager, player } = setup()
    player.attributePoints = 5
    startInProgressBattle(gameManager, player)
    const before = structuredClone(player)

    expect(gameManager.progressionOps.allocateAttributePoint(player, 'strength')).toBe(false)
    expect(player.attributePoints).toBe(5)
    expect(player.baseStats).toEqual(before.baseStats)
  })

  it('setMortalBasicSkill rejects mid-battle without mutating state', () => {
    const { gameManager, player } = setup()
    startInProgressBattle(gameManager, player)
    const before = structuredClone(player)

    expect(gameManager.progressionOps.setMortalBasicSkill(player, 'any_skill')).toBe(false)
    expect(player.mortalBasicSkillId).toEqual(before.mortalBasicSkillId)
  })

  it('selectSkillSpecialization rejects mid-battle without mutating state', () => {
    const { gameManager, player } = setup()
    startInProgressBattle(gameManager, player)
    const before = structuredClone(player)

    expect(gameManager.progressionOps.selectSkillSpecialization('any_skill', 'any_spec')).toBe(false)
    expect(player).toEqual(before)
  })
})
