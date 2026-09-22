import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import type { ProgressionNode } from '../progression/ProgressionNode'

// M-QI-06 - cost preview reads must respect the effective level-gate
// cap: a blocked L -> L+1 never previews an Insight cost.

function gatedNode(): ProgressionNode {
  return {
    id: 'test_ops_gated',
    name: 'Test Ops Gated',
    type: 'minor',
    insightCost: 1,
    maxLevel: 10,
    upgradeCost: { base: 1, perLevel: 3 },
    levelGates: [{ atLevel: 6, prerequisite: { kind: 'techniqueRank', rank: 3 } }],
    effect: {},
  }
}

function gatedCore(): ProgressionNode {
  return {
    id: 'core_test_ops_skill',
    name: 'Test Ops Core',
    type: 'major',
    insightCost: 0,
    maxLevel: 10,
    upgradeCost: { base: 5, perLevel: 3 },
    levelsSkillId: 'test_ops_skill',
    levelGates: [{ atLevel: 6, prerequisite: { kind: 'techniqueRank', rank: 3 } }],
    effect: {},
  }
}

function setup() {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerProgressionNodes([gatedNode(), gatedCore()])

  const player = createDefaultPlayer()
  player.skillInsight = 500

  return { gameManager, player }
}

describe('progressionOps cost reads under levelGates', () => {
  it('getNextNodeCost returns undefined while parked at the effective cap', () => {
    const { gameManager, player } = setup()
    player.techniqueProgress = { rank: 0, grade: 1 }
    player.nodeLevels['test_ops_gated'] = 5
    player.purchasedNodeIds.push('test_ops_gated')

    // At the effective cap (L6 gate unmet) the next cost is undefined.
    expect(gameManager.progressionOps.getNextNodeCost('test_ops_gated', player)).toBeUndefined()
  })

  it('getNextNodeCost previews again once the gate is satisfied', () => {
    const { gameManager, player } = setup()
    player.techniqueProgress = { rank: 3, grade: 1 }
    player.nodeLevels['test_ops_gated'] = 5
    player.purchasedNodeIds.push('test_ops_gated')

    // {base:1, perLevel:3} curve: 1 + floor(5/3) = 2.
    expect(gameManager.progressionOps.getNextNodeCost('test_ops_gated', player)).toBe(2)
  })

  it('getSkillCoreUpgradeCost respects a levelGate on a registered core', () => {
    const { gameManager, player } = setup()
    player.techniqueProgress = { rank: 0, grade: 1 }
    player.nodeLevels['core_test_ops_skill'] = 5
    player.purchasedNodeIds.push('core_test_ops_skill')

    expect(gameManager.progressionOps.getSkillCoreUpgradeCost('test_ops_skill', player)).toBeUndefined()

    player.techniqueProgress = { rank: 3, grade: 1 }

    // Core curve: getSkillCoreUpgradeCost(5) = 5 + 3 * 4 = 17.
    expect(gameManager.progressionOps.getSkillCoreUpgradeCost('test_ops_skill', player)).toBe(17)
  })
})
