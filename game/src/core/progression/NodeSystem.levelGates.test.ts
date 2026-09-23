import { describe, expect, it } from 'vitest'
import {
  aggregateNodeStatModifiers,
  canUpgradeNode,
  getBlockingNodeLevelGates,
  getEffectiveNodeMaxLevel,
  getNodeLevel,
  purchaseNode,
  upgradeNode,
} from './NodeSystem'
import { createDefaultPlayer } from '../player/Player'
import type { ProgressionNode } from './ProgressionNode'

// M-QI-06 (QI-D3) - technique-derived node max-level gates: levelGates
// cap the L-1 -> L upgrade transaction via an effective max level;
// owned levels never regress and the authored maxLevel stays the true
// completion ceiling.

function playerWith(overrides: Partial<ReturnType<typeof createDefaultPlayer>> = {}) {
  // M-F-TECHNIQUE (F5) - techniqueRank reads the effective rank, so the
  // default realm is qi_refining: grade-1 fixtures stay in-band.
  return { ...createDefaultPlayer(), realmId: 'qi_refining', ...overrides }
}

function gatedNode(overrides: Partial<ProgressionNode> = {}): ProgressionNode {
  return {
    id: 'test_gated',
    name: 'Test Gated',
    type: 'minor',
    insightCost: 1,
    maxLevel: 10,
    upgradeCost: { base: 1, perLevel: 3 },
    levelGates: [
      { atLevel: 6, prerequisite: { kind: 'techniqueRank', rank: 3 } },
      { atLevel: 9, prerequisite: { kind: 'techniqueRank', rank: 6 } },
    ],
    effect: {
      statModifiers: [
        { id: 'test_gated:might', sourceId: 'test_gated', sourceType: 'talent', stat: 'might', flat: 2, perLevelFlat: 2 },
      ],
    },
    ...overrides,
  }
}

describe('getEffectiveNodeMaxLevel / getBlockingNodeLevelGates', () => {
  it('a node without levelGates has its authored maxLevel', () => {
    const node = gatedNode({ levelGates: undefined })
    const player = playerWith({ techniqueProgress: { rank: 0, grade: 1 } })

    expect(getEffectiveNodeMaxLevel(player, node)).toBe(10)
    expect(getBlockingNodeLevelGates(player, node)).toEqual([])
  })

  it('an unsatisfied L6 gate caps the effective max at 5', () => {
    const player = playerWith({ techniqueProgress: { rank: 0, grade: 1 } })

    expect(getEffectiveNodeMaxLevel(player, gatedNode())).toBe(5)
  })

  it('satisfied gates leave the authored max reachable', () => {
    const player = playerWith({ techniqueProgress: { rank: 10, grade: 1 } })

    expect(getEffectiveNodeMaxLevel(player, gatedNode())).toBe(10)
    expect(getBlockingNodeLevelGates(player, gatedNode())).toEqual([])
  })

  it('multiple unsatisfied gates: the minimum unsatisfied atLevel binds', () => {
    const reversed = gatedNode({
      levelGates: [
        { atLevel: 9, prerequisite: { kind: 'techniqueRank', rank: 6 } },
        { atLevel: 6, prerequisite: { kind: 'techniqueRank', rank: 3 } },
      ],
    })
    const player = playerWith({ techniqueProgress: { rank: 0, grade: 1 } })

    expect(getEffectiveNodeMaxLevel(player, reversed)).toBe(5)
    expect(getBlockingNodeLevelGates(player, reversed)).toEqual([
      { atLevel: 6, prerequisite: { kind: 'techniqueRank', rank: 3 } },
    ])
  })

  it('the binding helper returns only the binding gate, never a later non-binding one', () => {
    const player = playerWith({ techniqueProgress: { rank: 3, grade: 1 } })

    expect(getEffectiveNodeMaxLevel(player, gatedNode())).toBe(8)
    expect(getBlockingNodeLevelGates(player, gatedNode())).toEqual([
      { atLevel: 9, prerequisite: { kind: 'techniqueRank', rank: 6 } },
    ])
  })

  it('absent techniqueProgress fails closed for positive rank gates', () => {
    const player = playerWith({ techniqueProgress: undefined })

    expect(getEffectiveNodeMaxLevel(player, gatedNode())).toBe(5)
    expect(getBlockingNodeLevelGates(player, gatedNode())).toHaveLength(1)
  })

  it('atLevel above authored maxLevel is inert: authored max stays reachable AND no blocker surfaces', () => {
    const node = gatedNode({
      levelGates: [{ atLevel: 12, prerequisite: { kind: 'techniqueRank', rank: 9 } }],
    })
    const player = playerWith({ techniqueProgress: { rank: 0, grade: 1 } })

    expect(getEffectiveNodeMaxLevel(player, node)).toBe(10)
    expect(getBlockingNodeLevelGates(player, node)).toEqual([])
  })

  it('multiple gates at the same atLevel all surface as binding blockers', () => {
    const node = gatedNode({
      levelGates: [
        { atLevel: 6, prerequisite: { kind: 'techniqueRank', rank: 3 } },
        { atLevel: 6, prerequisite: { kind: 'techniqueGrade', grade: 2 } },
      ],
    })
    const player = playerWith({ techniqueProgress: { rank: 3, grade: 1 } })

    expect(getBlockingNodeLevelGates(player, node)).toEqual([
      { atLevel: 6, prerequisite: { kind: 'techniqueGrade', grade: 2 } },
    ])
  })
})

describe('canUpgradeNode / upgradeNode under a level gate', () => {
  function ownedAt(level: number, rank: number) {
    const player = playerWith({
      techniqueProgress: { rank, grade: 1 },
      skillInsight: 500,
      nodeLevels: { test_gated: level },
      purchasedNodeIds: ['test_gated'],
    })

    return player
  }

  it('a node at its effective cap cannot upgrade', () => {
    expect(canUpgradeNode(ownedAt(5, 0), gatedNode())).toBe(false)
  })

  it('the same node upgrades once the gate is satisfied', () => {
    expect(canUpgradeNode(ownedAt(5, 3), gatedNode())).toBe(true)
  })

  it('upgradeNode rejected at the effective cap mutates nothing', () => {
    const player = ownedAt(5, 0)

    expect(upgradeNode(player, gatedNode())).toBe(false)
    expect(player.skillInsight).toBe(500)
    expect(getNodeLevel(player, 'test_gated')).toBe(5)
    expect(player.purchasedNodeIds).toEqual(['test_gated'])
  })

  it('frozen surplus: an owned level above the effective cap still aggregates', () => {
    const player = ownedAt(6, 0)

    expect(getEffectiveNodeMaxLevel(player, gatedNode())).toBe(5)
    expect(canUpgradeNode(player, gatedNode())).toBe(false)

    const mods = aggregateNodeStatModifiers({ getAll: () => [gatedNode()] }, player)
    const might = mods.find((mod) => mod.stat === 'might')

    // L6 stays active: flat 2 + perLevel 2 x 5 extra levels = 12 flat.
    expect(might).toBeDefined()
    expect(might!.flat).toBe(12)
  })

  it('a gate-blocked node still purchases/upgrades normally below the cap', () => {
    const player = playerWith({ techniqueProgress: { rank: 0, grade: 1 }, skillInsight: 500 })

    expect(purchaseNode(player, gatedNode())).toBe(true)

    for (let i = 0; i < 4; i++) {
      expect(upgradeNode(player, gatedNode())).toBe(true)
    }

    expect(getNodeLevel(player, 'test_gated')).toBe(5)
    expect(upgradeNode(player, gatedNode())).toBe(false)
  })
})
