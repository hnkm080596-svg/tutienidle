import { describe, expect, it, vi } from 'vitest'
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
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0 }

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
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
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

  const syncLegacyBattleState = vi.fn()

  const runtime = new CombatAnimationRuntime({
    getTurnBattleSystem: () => turnBattleSystem,
    eventBus,
    getBattle: () => battle,
    syncLegacyBattleState,
  })

  return { runtime, battle, player, enemy, eventBus, syncLegacyBattleState }
}

describe('CombatAnimationRuntime', () => {
  it('reports idle animation state when no phase is pending', () => {
    const runtime = new CombatAnimationRuntime({
      getTurnBattleSystem: () => ({}) as never,
      eventBus: { emit: vi.fn() } as never,
      getBattle: () => null,
      syncLegacyBattleState: vi.fn(),
    })

    expect(runtime.getAnimationState('player')).toBe('idle')
  })

  it('notifyReadyActor → pendingReadyActor set → getAnimationState reports ready + emits turn_ready', () => {
    const { runtime, player, eventBus } = fixture()

    const events: string[] = []
    eventBus.on('turn_ready', () => events.push('turn_ready'))

    runtime.notifyReadyActor(player)

    expect(runtime.getAnimationState('player')).toBe('ready')
    expect(runtime.isActionPlaybackWaiting()).toBe(true)
    expect(events).toContain('turn_ready')
  })

  it('acknowledgeTurnReady → declares action → getAnimationState reports cast + emits attack', () => {
    const { runtime, player, eventBus } = fixture()

    const events: string[] = []
    eventBus.on('attack', () => events.push('attack'))

    runtime.notifyReadyActor(player)
    runtime.acknowledgeTurnReady()

    expect(runtime.getAnimationState('player')).toBe('cast')
    expect(events).toContain('attack')
  })

  it('acknowledgeActionImpact → applies impact → getAnimationState reports standby + emits action_impact', () => {
    const { runtime, player, eventBus } = fixture()

    const events: string[] = []
    eventBus.on('action_impact', () => events.push('action_impact'))

    runtime.notifyReadyActor(player)
    runtime.acknowledgeTurnReady()
    runtime.acknowledgeActionImpact()

    expect(runtime.getAnimationState('player')).toBe('standby')
    expect(events).toContain('action_impact')
  })

  it('acknowledgeActionComplete → clears pending phase, emits turn_standby_complete, syncs legacy state', () => {
    const { runtime, player, eventBus, syncLegacyBattleState } = fixture()

    const events: string[] = []
    eventBus.on('turn_standby_complete', () => events.push('turn_standby_complete'))

    runtime.notifyReadyActor(player)
    runtime.acknowledgeTurnReady()
    runtime.acknowledgeActionImpact()
    runtime.acknowledgeActionComplete()

    expect(runtime.getAnimationState('player')).toBe('idle')
    expect(runtime.isActionPlaybackWaiting()).toBe(false)
    expect(events).toContain('turn_standby_complete')
    expect(syncLegacyBattleState).toHaveBeenCalled()
  })

  it('acknowledgeTurnReady with a stale token is a no-op', () => {
    const { runtime, player } = fixture()

    runtime.notifyReadyActor(player)

    const currentToken = runtime.getPendingPlaybackToken()

    expect(currentToken).not.toBeNull()

    runtime.acknowledgeTurnReady('some-other-stale-token')

    // Stale ack ignored — actor still pending in the ready phase.
    expect(runtime.getAnimationState('player')).toBe('ready')
    expect(runtime.getPendingPlaybackToken()).toBe(currentToken)
  })

  it('manual mode: acknowledgeTurnReady on a manual player actor pauses instead of declaring', () => {
    const { runtime, player, eventBus } = fixture()

    const attackEvents: string[] = []
    eventBus.on('attack', () => attackEvents.push('attack'))

    runtime.setBattleManualMode(true)
    runtime.notifyReadyActor(player)
    runtime.acknowledgeTurnReady()

    expect(runtime.isAwaitingManualTurnChoice()).toBe(true)
    expect(runtime.getAwaitedManualActor()?.id).toBe('player')
    expect(attackEvents).toEqual([])
  })

  it('submitTurnChoice resolves the paused manual turn and clears the pause', () => {
    const { runtime, player, syncLegacyBattleState } = fixture()

    runtime.setBattleManualMode(true)
    runtime.notifyReadyActor(player)
    runtime.acknowledgeTurnReady()

    expect(runtime.isAwaitingManualTurnChoice()).toBe(true)

    const submitted = runtime.submitTurnChoice('basic')

    expect(submitted).toBe(true)
    expect(runtime.isAwaitingManualTurnChoice()).toBe(false)
    expect(syncLegacyBattleState).toHaveBeenCalled()
  })

  it('submitTurnChoice with no pending pause is a safe no-op (returns false)', () => {
    const { runtime } = fixture()

    expect(runtime.submitTurnChoice('basic')).toBe(false)
  })

  it('disabling manual mode mid-pause cancels the pause', () => {
    const { runtime, player } = fixture()

    runtime.setBattleManualMode(true)
    runtime.notifyReadyActor(player)
    runtime.acknowledgeTurnReady()

    expect(runtime.isAwaitingManualTurnChoice()).toBe(true)

    runtime.setBattleManualMode(false)

    expect(runtime.isAwaitingManualTurnChoice()).toBe(false)
    expect(runtime.isBattleManualMode()).toBe(false)
  })

  it('setPresentationActive(false) drains a pending ready-phase immediately (idempotent teardown)', () => {
    const { runtime, player } = fixture()

    runtime.setPresentationActive(true)
    runtime.notifyReadyActor(player)

    expect(runtime.isActionPlaybackWaiting()).toBe(true)

    runtime.setPresentationActive(false)

    expect(runtime.isActionPlaybackWaiting()).toBe(false)

    // Idempotent — calling again does nothing further.
    runtime.setPresentationActive(false)

    expect(runtime.isActionPlaybackWaiting()).toBe(false)
  })

  it('isAwaitingPresentationLayer gates only after expectPresentationLayer(), releases on setPresentationActive(true)', () => {
    const { runtime } = fixture()

    expect(runtime.isAwaitingPresentationLayer()).toBe(false)

    runtime.expectPresentationLayer()

    expect(runtime.isAwaitingPresentationLayer()).toBe(true)

    runtime.setPresentationActive(true)

    expect(runtime.isAwaitingPresentationLayer()).toBe(false)
  })

  it('isPresentationActive reflects the last setPresentationActive() call', () => {
    const { runtime } = fixture()

    expect(runtime.isPresentationActive()).toBe(false)

    runtime.setPresentationActive(true)

    expect(runtime.isPresentationActive()).toBe(true)
  })

  it('resetPendingState clears ready/manual-pause phases at once', () => {
    const { runtime, player } = fixture()

    runtime.setBattleManualMode(true)
    runtime.notifyReadyActor(player)
    runtime.acknowledgeTurnReady()

    expect(runtime.isAwaitingManualTurnChoice()).toBe(true)

    runtime.resetPendingState()

    expect(runtime.isAwaitingManualTurnChoice()).toBe(false)
    expect(runtime.isActionPlaybackWaiting()).toBe(false)
    expect(runtime.getAwaitedManualActor()).toBeNull()
  })

  it('getPendingPlaybackToken is null when nothing is pending', () => {
    const { runtime } = fixture()

    expect(runtime.getPendingPlaybackToken()).toBeNull()
  })

  it('reads getTurnBattleSystem() live at call time, not a value captured at construction', () => {
    // Regression guard: GameManager reassigns its this.turnBattleSystem
    // field wholesale on restartTurnBattleCycle()/startStage() (new
    // instance carrying the live buff registry + spawnEnemy factory).
    // If CombatAnimationRuntime captured the instance by value instead of
    // through a getter, every acknowledge*/submitTurnChoice call would
    // silently keep using the FIRST (stale) instance forever.
    const eventBus = new EventBus()
    const combatSystem = new CombatSystem(eventBus)
    let turnBattleSystem = new TurnBattleSystem(combatSystem)

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
    const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting', totalTurnsElapsed: 0 }

    const runtime = new CombatAnimationRuntime({
      getTurnBattleSystem: () => turnBattleSystem,
      eventBus,
      getBattle: () => battle,
      syncLegacyBattleState: vi.fn(),
    })

    // Reassign to a brand-new instance AFTER the runtime was constructed —
    // mirrors a stage restart happening mid-session.
    const nextTurnBattleSystem = new TurnBattleSystem(combatSystem)
    const declareSpy = vi.spyOn(nextTurnBattleSystem, 'declareActorAction')
    turnBattleSystem = nextTurnBattleSystem

    runtime.notifyReadyActor(player)
    runtime.acknowledgeTurnReady()

    expect(declareSpy).toHaveBeenCalled()
  })
})
