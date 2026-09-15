import { describe, expect, it } from 'vitest'
import { CombatAnimationRuntime } from './CombatAnimationRuntime'
import { TurnBattleSystem, type TurnBattle } from './TurnBattleSystem'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { CombatEntity } from '../../combat/CombatEntity'
import { toTurnBattleParticipant } from '../../game/TurnBattleAdapter'
import { GENERIC_PHYSICAL_BASIC } from '../../../data/skill/TurnBasicAttacks'

// Combat Runtime Separation (Task 1, 2026-09-07) — CombatAnimationRuntime
// owns the presentation-ack timing state extracted from GameManager (P17).
// Fixture below mirrors the createCombatant()/participant() convention
// already used by TurnBattleSystem.test.ts — a real CombatSystem +
// TurnBattleSystem so declareActorAction/applyActionImpact/completeAction
// run for real (no mocking the business logic the runtime delegates to).

function createCombatant(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 4,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function fixture() {
  const eventBus = new EventBus()
  const combatSystem = new CombatSystem(eventBus)
  const turnBattleSystem = new TurnBattleSystem(combatSystem)

  const player = toTurnBattleParticipant(
    createCombatant('player', { type: 'player', x: 0, row: 4 }),
    0,
    GENERIC_PHYSICAL_BASIC,
  )
  const enemy = toTurnBattleParticipant(
    createCombatant('enemy', { type: 'enemy', x: 2, row: 4 }),
    1,
    GENERIC_PHYSICAL_BASIC,
  )

  const battle: TurnBattle = {
    players: [player],
    enemies: [enemy],
    state: 'fighting',
    totalTurnsElapsed: 0,
  }

  const runtime = new CombatAnimationRuntime({
    getTurnBattleSystem: () => turnBattleSystem,
    eventBus,
    getTurnBattle: () => battle,
  })

  return { runtime, battle, player, enemy, eventBus, turnBattleSystem }
}

describe('R5 runtime contract re-audit', () => {
  it('emits exactly one gameplay attack in presentation mode, matching headless', () => {
    const visual = fixture()
    const headless = fixture()
    const visualEvents: string[] = []
    const headlessEvents: string[] = []
    visual.eventBus.on('attack', () => visualEvents.push('attack'))
    headless.eventBus.on('attack', () => headlessEvents.push('attack'))
    headless.turnBattleSystem.resolveActorTurn(headless.battle, headless.player)
    visual.runtime.setPresentationActive(true)
    visual.runtime.notifyReadyActor(visual.player)
    const token = visual.runtime.getPendingPlaybackToken()!
    visual.runtime.acknowledgeTurnReady(token)
    visual.runtime.acknowledgeActionImpact(token)
    visual.runtime.acknowledgeActionComplete(token)
    expect(headlessEvents).toHaveLength(1)
    expect(visualEvents).toHaveLength(headlessEvents.length)
  })

  it('rejects an omitted ready token without declaring a new action', () => {
    const { runtime, player } = fixture()
    runtime.notifyReadyActor(player)
    runtime.acknowledgeTurnReady(undefined)
    expect(runtime.getAnimationState(player.id)).toBe('ready')
  })

  it('rejects an omitted impact token without applying damage', () => {
    const { runtime, player, enemy } = fixture()
    runtime.notifyReadyActor(player)
    runtime.acknowledgeTurnReady(runtime.getPendingPlaybackToken()!)
    const hp = enemy.entity.currentHp
    runtime.acknowledgeActionImpact(undefined)
    expect(enemy.entity.currentHp).toBe(hp)
    expect(runtime.getAnimationState(player.id)).toBe('cast')
  })

  it('rejects an omitted complete token without completing the turn', () => {
    const { runtime, player, battle } = fixture()
    runtime.notifyReadyActor(player)
    const token = runtime.getPendingPlaybackToken()!
    runtime.acknowledgeTurnReady(token)
    runtime.acknowledgeActionImpact(token)
    const turns = battle.totalTurnsElapsed
    runtime.acknowledgeActionComplete(undefined)
    expect(battle.totalTurnsElapsed).toBe(turns)
    expect(runtime.getAnimationState(player.id)).toBe('standby')
  })

  it('rejects an old explicit token after a reset and new action', () => {
    const { runtime, player } = fixture()
    runtime.notifyReadyActor(player)
    const stale = runtime.getPendingPlaybackToken()!
    runtime.resetPendingState()
    runtime.notifyReadyActor(player)
    runtime.acknowledgeTurnReady(stale)
    expect(runtime.getAnimationState(player.id)).toBe('ready')
  })
})
