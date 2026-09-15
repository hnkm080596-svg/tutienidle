import { describe, expect, it } from 'vitest'
import type { ProgressionNode } from './ProgressionNode'
import { createDefaultPlayer } from '../player/Player'
import { GameManager } from '../game/GameManager'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { defineEnemy } from '../enemy/Enemy'
import { asBaseStats } from '../stats/StatBlock'
import type { Stage } from '../stage/Stage'
import {
  aggregateNodeStatModifiers,
  canPurchaseNode,
  purchaseNode,
  switchRoute,
  upgradeNode,
} from './NodeSystem'

// Phap Tu Reimagined Task 4 — routeTag gating + switchRoute refund.
// Route-tagged nodes only exist while the player's route matches;
// switching refunds 75% of actually-paid insight and zeroes the levels.

function node(partial: Partial<ProgressionNode> & Pick<ProgressionNode, 'id'>): ProgressionNode {
  return {
    name: partial.id,
    description: '',
    type: 'minor',
    insightCost: 2,
    effect: {},
    ...partial,
  }
}

const registry = {
  nodes: [
    node({ id: 'dot_spec_1', routeTag: 'dot', upgradeCost: { base: 2, perLevel: 1 }, maxLevel: 3 }),
    node({ id: 'no_spec_1', routeTag: 'no' }),
    node({ id: 'shared_1' }),
  ],
  get(id: string) {
    return this.nodes.find((n) => n.id === id)!
  },
  getAll() {
    return this.nodes
  },
}

describe('NodeSystem — routeTag gating', () => {
  it('routeTag node unpurchasable when route mismatches', () => {
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.phapTu = { element: 'fire', route: 'no' }

    expect(canPurchaseNode(player, registry.get('dot_spec_1'))).toBe(false)
    expect(purchaseNode(player, registry.get('dot_spec_1'))).toBe(false)
    expect(player.nodeLevels['dot_spec_1']).toBeUndefined()

    // Untagged nodes unaffected by route state.
    expect(canPurchaseNode(player, registry.get('shared_1'))).toBe(true)
  })

  it('routeTag node unpurchasable when no route picked at all', () => {
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.phapTu = { element: null, route: null }

    expect(canPurchaseNode(player, registry.get('dot_spec_1'))).toBe(false)
    expect(canPurchaseNode(player, registry.get('no_spec_1'))).toBe(false)
  })

  it('inactive-route node contributes nothing to aggregators', () => {
    const statNode = node({
      id: 'dot_stat',
      routeTag: 'dot',
      effect: { statModifiers: [{ id: 'm', sourceId: 'n', sourceType: 'talent', stat: 'might', flat: 5 }] },
    })
    const reg = { getAll: () => [statNode] }
    const player = createDefaultPlayer()
    player.phapTu = { element: 'fire', route: 'dot' }
    player.skillInsight = 100

    purchaseNode(player, statNode)
    expect(aggregateNodeStatModifiers(reg, player)).toHaveLength(1)

    player.phapTu.route = 'no'
    expect(aggregateNodeStatModifiers(reg, player)).toHaveLength(0)
  })
})

describe('switchRoute', () => {
  it('refunds 75% of actual paid and clears route-tagged levels', () => {
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.phapTu = { element: 'fire', route: 'dot' }

    purchaseNode(player, registry.get('dot_spec_1')) // cost 2
    upgradeNode(player, registry.get('dot_spec_1')) // +3 (base2 + floor(1/1))
    const paid = 2 + 3
    const before = player.skillInsight

    const refunded = switchRoute(player, registry, 'no')

    expect(refunded).toBe(Math.floor(paid * 0.75))
    expect(player.nodeLevels['dot_spec_1']).toBeUndefined()
    expect(player.purchasedNodeIds).not.toContain('dot_spec_1')
    expect(player.skillInsight).toBe(before + refunded)
    expect(player.phapTu.route).toBe('no')
  })

  it('switching A->B->A pays the tax twice', () => {
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.phapTu = { element: 'fire', route: 'dot' }
    const start = player.skillInsight

    purchaseNode(player, registry.get('dot_spec_1')) // -2
    switchRoute(player, registry, 'no') // +floor(2*0.75)=1

    purchaseNode(player, registry.get('no_spec_1')) // -2
    switchRoute(player, registry, 'dot') // +1

    // 2 paid + 2 paid, 1 + 1 refunded -> net -2 over the round trip.
    expect(player.skillInsight).toBe(start - 2)
    expect(player.phapTu.route).toBe('dot')
  })

  it('untagged nodes keep their levels across a switch', () => {
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.phapTu = { element: 'fire', route: 'dot' }

    purchaseNode(player, registry.get('shared_1'))
    purchaseNode(player, registry.get('dot_spec_1'))

    switchRoute(player, registry, 'no')

    expect(player.nodeLevels['shared_1']).toBe(1)
    expect(player.nodeLevels['dot_spec_1']).toBeUndefined()
  })

  it('respects nodeFreePurchaseRecord — waived insight is not refunded', () => {
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.phapTu = { element: 'fire', route: 'dot' }

    purchaseNode(player, registry.get('dot_spec_1'))
    // Simulate Van Dao having waived the 2-cost purchase.
    player.nodeFreePurchaseRecord = { dot_spec_1: 2 }
    player.skillInsight += 2 // as if the waive happened

    const before = player.skillInsight
    const refunded = switchRoute(player, registry, 'no')

    // paid = 0 after subtracting the waived record -> refund 0.
    expect(refunded).toBe(0)
    expect(player.skillInsight).toBe(before)
    expect(player.nodeFreePurchaseRecord['dot_spec_1']).toBeUndefined()
  })
})

// The orchestration op additionally refuses to switch while a turn
// battle is active (route is static during battle — INV-16).
describe('GameManagerProgressionOps.switchRoute', () => {
  function stageFixture(id: string, enemyId: string): Stage {
    return {
      id, name: id, description: '', floor: 1,
      enemyPool: [{ enemyId, weight: 1 }],
      totalEnemyCount: 1, waves: [1],
      spawnIntervalSeconds: 0,
    }
  }

  it('rejects while a turn battle is active', () => {
    const gameManager = new GameManager()
    gameManager.setCombatClockSource(new ManualClockSource())
    const player = createDefaultPlayer()
    player.baseStats = asBaseStats({ ...player.baseStats, might: 100, speed: 100 })
    player.cultivationPath = 'phap_tu'
    player.phapTu = { element: 'fire', route: 'dot' }

    gameManager.catalogOps.registerEnemyTemplates([
      defineEnemy({
        id: 'route_probe', name: 'Probe', level: 1, realmId: 'mortal', lane: 'ground',
        statsInput: { maxHp: 500, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
        rewards: { techniqueInsight: 0, spiritStone: 0 },
      }),
    ])
    gameManager.catalogOps.registerStages([stageFixture('route_stage', 'route_probe')])
    gameManager.setActivePlayer(player)

    expect(gameManager.progressionOps.switchRoute('no', player)).toBe(true)
    expect(player.phapTu.route).toBe('no')

    gameManager.turnBattleOps.startStage(player, gameManager.catalogOps.getStage('route_stage')!, false)

    expect(gameManager.progressionOps.switchRoute('dot', player)).toBe(false)
    expect(player.phapTu.route).toBe('no')
  })
})
