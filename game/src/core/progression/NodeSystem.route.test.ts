import { describe, expect, it } from 'vitest'
import type { ProgressionNode } from './ProgressionNode'
import { createDefaultPlayer } from '../player/Player'
import { GameManager } from '../game/GameManager'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { isBattleInProgress } from '../battle/BattleTypes'
import { defineEnemy } from '../enemy/Enemy'
import { asBaseStats } from '../stats/StatBlock'
import { SKILLS } from '../../data/skill/Skills'
import type { Stage } from '../stage/Stage'
import {
  aggregateNodeStatModifiers,
  canPurchaseNode,
  previewRouteSwitch,
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
    player.spellPath = { element: 'fire', route: 'no' }

    expect(canPurchaseNode(player, registry.get('dot_spec_1'))).toBe(false)
    expect(purchaseNode(player, registry.get('dot_spec_1'))).toBe(false)
    expect(player.nodeLevels['dot_spec_1']).toBeUndefined()

    // Untagged nodes unaffected by route state.
    expect(canPurchaseNode(player, registry.get('shared_1'))).toBe(true)
  })

  it('routeTag node unpurchasable when no route picked at all', () => {
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.spellPath = { element: null, route: null }

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
    player.spellPath = { element: 'fire', route: 'dot' }
    player.skillInsight = 100

    purchaseNode(player, statNode)
    expect(aggregateNodeStatModifiers(reg, player)).toHaveLength(1)

    player.spellPath.route = 'no'
    expect(aggregateNodeStatModifiers(reg, player)).toHaveLength(0)
  })
})

describe('switchRoute', () => {
  it('refunds 75% of actual paid and clears route-tagged levels', () => {
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element: 'fire', route: 'dot' }

    purchaseNode(player, registry.get('dot_spec_1')) // cost 2
    upgradeNode(player, registry.get('dot_spec_1')) // +3 (base2 + floor(1/1))
    const paid = 2 + 3
    const before = player.skillInsight

    const refunded = switchRoute(player, registry, 'no')

    expect(refunded).toBe(Math.floor(paid * 0.75))
    expect(player.nodeLevels['dot_spec_1']).toBeUndefined()
    expect(player.purchasedNodeIds).not.toContain('dot_spec_1')
    expect(player.skillInsight).toBe(before + refunded)
    expect(player.spellPath.route).toBe('no')
  })

  it('switching A->B->A pays the tax twice', () => {
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element: 'fire', route: 'dot' }
    const start = player.skillInsight

    purchaseNode(player, registry.get('dot_spec_1')) // -2
    switchRoute(player, registry, 'no') // +floor(2*0.75)=1

    purchaseNode(player, registry.get('no_spec_1')) // -2
    switchRoute(player, registry, 'dot') // +1

    // 2 paid + 2 paid, 1 + 1 refunded -> net -2 over the round trip.
    expect(player.skillInsight).toBe(start - 2)
    expect(player.spellPath.route).toBe('dot')
  })

  it('untagged nodes keep their levels across a switch', () => {
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element: 'fire', route: 'dot' }

    purchaseNode(player, registry.get('shared_1'))
    purchaseNode(player, registry.get('dot_spec_1'))

    switchRoute(player, registry, 'no')

    expect(player.nodeLevels['shared_1']).toBe(1)
    expect(player.nodeLevels['dot_spec_1']).toBeUndefined()
  })

  it('respects nodeFreePurchaseRecord — waived insight is not refunded', () => {
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element: 'fire', route: 'dot' }

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

  // Review fix (HIGH-2) — switchRoute is the ONLY remaining writer of
  // spellPath.route (selectSpellPathElement already guards path + null
  // fields). Without the same commitment gate here, a pre-commit call
  // would stamp route onto {element: null}, permanently poisoning
  // selectSpellPathElement — and a non-spell player's dirty route state
  // would leak universal route stats.
  it('rejects when no element+route is committed — never writes route', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element: null, route: null }

    expect(switchRoute(player, registry, 'dot')).toBe(0)
    expect(player.spellPath).toEqual({ element: null, route: null })
  })

  it('rejects a non-spell player even with committed spellPath state', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'hidden_spell_pathway'
    player.spellPath = { element: null, route: null }

    expect(switchRoute(player, registry, 'dot')).toBe(0)
    expect(player.spellPath.route).toBeNull()

    // Dirty state that cannot exist via production writes must not be
    // re-routed either.
    player.cultivationPath = 'sword'
    player.spellPath = { element: 'fire', route: 'dot' }
    expect(switchRoute(player, registry, 'no')).toBe(0)
    expect(player.spellPath.route).toBe('dot')
  })
})

// Task 16 — the respec confirm dialog's "regain X, lose Y" numbers come
// from previewRouteSwitch; it MUST agree with switchRoute's math (A9)
// and must not mutate state.
describe('previewRouteSwitch', () => {
  it('matches switchRoute refund and forfeited math exactly', () => {
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element: 'fire', route: 'dot' }

    purchaseNode(player, registry.get('dot_spec_1')) // cost 2
    upgradeNode(player, registry.get('dot_spec_1')) // +3
    purchaseNode(player, registry.get('shared_1')) // untagged — not counted

    const preview = previewRouteSwitch(player, registry)
    const paid = 2 + 3

    expect(preview.refund).toBe(Math.floor(paid * 0.75))
    expect(preview.forfeited).toBe(paid - Math.floor(paid * 0.75))
    expect(preview.resetNodeCount).toBe(1)

    // Preview mutated nothing — the switch then refunds the same amount.
    expect(player.nodeLevels['dot_spec_1']).toBe(2)
    expect(player.spellPath.route).toBe('dot')
    expect(switchRoute(player, registry, 'no')).toBe(preview.refund)
  })

  it('waived insight (nodeFreePurchaseRecord) is excluded from the preview', () => {
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element: 'fire', route: 'dot' }

    purchaseNode(player, registry.get('dot_spec_1'))
    player.nodeFreePurchaseRecord = { dot_spec_1: 2 }

    const preview = previewRouteSwitch(player, registry)

    expect(preview.refund).toBe(0)
    expect(preview.forfeited).toBe(0)
    expect(preview.resetNodeCount).toBe(1)
  })

  it('no route committed → empty preview', () => {
    const player = createDefaultPlayer()
    player.spellPath = { element: null, route: null }

    const preview = previewRouteSwitch(player, registry)

    expect(preview).toEqual({ refund: 0, forfeited: 0, resetNodeCount: 0 })
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
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element: 'fire', route: 'dot' }

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
    expect(player.spellPath.route).toBe('no')

    // The committed element's basic must be learned — round-3 fail-fast
    // throws when a required basic is missing.
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    expect(gameManager.progressionOps.learnSkill('hoa_cau_thuat')).toBe(true)

    gameManager.turnBattleOps.startStage(player, gameManager.catalogOps.getStage('route_stage')!, false)

    expect(gameManager.progressionOps.switchRoute('dot', player)).toBe(false)
    expect(player.spellPath.route).toBe('no')
  })

  it('allows switching after the battle reaches a terminal state', () => {
    const gameManager = new GameManager()
    const clock = new ManualClockSource()
    gameManager.setCombatClockSource(clock)
    const player = createDefaultPlayer()
    player.baseStats = asBaseStats({ ...player.baseStats, might: 100, speed: 100 })
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element: 'fire', route: 'dot' }

    gameManager.catalogOps.registerEnemyTemplates([
      defineEnemy({
        id: 'route_probe', name: 'Probe', level: 1, realmId: 'mortal', lane: 'ground',
        statsInput: { maxHp: 500, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
        rewards: { techniqueInsight: 0, spiritStone: 0 },
      }),
    ])
    gameManager.catalogOps.registerStages([stageFixture('route_stage', 'route_probe')])
    gameManager.setActivePlayer(player)

    // Required basic for the committed element (round-3 fail-fast).
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    expect(gameManager.progressionOps.learnSkill('hoa_cau_thuat')).toBe(true)

    gameManager.turnBattleOps.startStage(player, gameManager.catalogOps.getStage('route_stage')!, false)

    for (let i = 0; i < 4000 && isBattleInProgress(gameManager.getTurnBattle()?.state); i++) {
      clock.advance(COMBAT_STEP_SECONDS)
    }

    // The TurnBattle object is retained after terminal state — the gate
    // must look at battle state, not object existence.
    expect(gameManager.getTurnBattle()?.state).toBe('victory')
    expect(gameManager.progressionOps.switchRoute('no', player)).toBe(true)
    expect(player.spellPath.route).toBe('no')
  })

  it('rejects uncommitted / non-spell players even out of combat', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    // Path chosen but element+route not yet committed — there is no
    // route to switch FROM; writing one would poison selectSpellPathElement.
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element: null, route: null }
    expect(gameManager.progressionOps.switchRoute('dot', player)).toBe(false)
    expect(player.spellPath).toEqual({ element: null, route: null })

    // Hidden path never owns ordinary route state.
    player.cultivationPath = 'spell'
    player.cultivationWay = 'hidden_spell_pathway'
    expect(gameManager.progressionOps.switchRoute('dot', player)).toBe(false)
    expect(player.spellPath).toEqual({ element: null, route: null })
  })
})
