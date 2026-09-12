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

  it('acknowledgeTurnReady → declares action → getAnimationState reports cast + emits turn_cast_start', () => {
    const { runtime, player, eventBus } = fixture()

    const events: string[] = []
    eventBus.on('turn_cast_start', () => events.push('turn_cast_start'))

    runtime.notifyReadyActor(player)
    const token = runtime.getPendingPlaybackToken()!
    runtime.acknowledgeTurnReady(token)

    expect(runtime.getAnimationState('player')).toBe('cast')
    expect(events).toContain('turn_cast_start')
  })

  it('acknowledgeActionImpact → applies impact → getAnimationState reports standby + emits action_impact', () => {
    const { runtime, player, eventBus } = fixture()

    const events: string[] = []
    eventBus.on('action_impact', () => events.push('action_impact'))

    runtime.notifyReadyActor(player)
    const token = runtime.getPendingPlaybackToken()!
    runtime.acknowledgeTurnReady(token)
    runtime.acknowledgeActionImpact(token)

    expect(runtime.getAnimationState('player')).toBe('standby')
    expect(events).toContain('action_impact')
  })

  it('acknowledgeActionComplete → clears pending phase, emits turn_standby_complete, syncs legacy state', () => {
    const { runtime, player, eventBus, syncLegacyBattleState } = fixture()

    const events: string[] = []
    eventBus.on('turn_standby_complete', () => events.push('turn_standby_complete'))

    runtime.notifyReadyActor(player)
    const token = runtime.getPendingPlaybackToken()!
    runtime.acknowledgeTurnReady(token)
    runtime.acknowledgeActionImpact(token)
    runtime.acknowledgeActionComplete(token)

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

  it('AR-20: when presentation is active, acknowledgeTurnReady and acknowledgeActionImpact reject missing or stale tokens', () => {
    const { runtime, player } = fixture()

    runtime.setPresentationActive(true)
    runtime.notifyReadyActor(player)

    const readyToken = runtime.getPendingPlaybackToken()!
    expect(readyToken).toBeTruthy()

    // 1. Empty/missing token from presentation -> rejected
    runtime.acknowledgeTurnReady('')
    expect(runtime.getAnimationState('player')).toBe('ready')

    // 2. Mismatched token -> rejected
    runtime.acknowledgeTurnReady('wrong_token')
    expect(runtime.getAnimationState('player')).toBe('ready')

    // 3. Correct token -> accepted, enters cast
    runtime.acknowledgeTurnReady(readyToken)
    expect(runtime.getAnimationState('player')).toBe('cast')

    const impactToken = runtime.getPendingPlaybackToken()!
    expect(impactToken).toBeTruthy()

    // 4. Empty/missing token on impact -> rejected
    runtime.acknowledgeActionImpact('')
    expect(runtime.getAnimationState('player')).toBe('cast')

    // 5. Correct token on impact -> accepted, enters standby
    runtime.acknowledgeActionImpact(impactToken)
    expect(runtime.getAnimationState('player')).toBe('standby')
  })

  it('manual mode: pauseForManualActor holds the turn and mints a playback token', () => {
    // Manual routing is decided by the turn token at CLAIM time (spec 3.2),
    // so a manual player-team turn never enters the renderer ready phase at
    // all - it arrives here directly.
    const { runtime, player, eventBus } = fixture()

    const attackEvents: string[] = []
    eventBus.on('attack', () => attackEvents.push('attack'))

    runtime.setBattleManualMode(true)
    runtime.pauseForManualActor(player)

    expect(runtime.isAwaitingManualTurnChoice()).toBe(true)
    expect(runtime.getAwaitedManualActor()?.id).toBe('player')
    expect(runtime.isActionPlaybackWaiting()).toBe(false)
    expect(attackEvents).toEqual([])
  })

  it('acknowledgeTurnReady declares even with manual mode on (toggle is a boundary command)', () => {
    // Flipping the manual toggle mid-turn is an external command and takes
    // effect at the NEXT turn boundary (spec 9.1). A turn already in flight
    // must finish, never strand its pipeline waiting for a choice.
    const { runtime, player } = fixture()

    runtime.notifyReadyActor(player)
    runtime.setBattleManualMode(true)
    runtime.acknowledgeTurnReady(runtime.getPendingPlaybackToken()!)

    expect(runtime.isAwaitingManualTurnChoice()).toBe(false)
    expect(runtime.getAnimationState('player')).toBe('cast')
  })

  it('submitTurnChoice declares the paused manual turn and clears the pause', () => {
    // Both modes declare and wait: the resolution pipeline owns impact and
    // completion from here, so the runtime no longer resolves inline.
    const { runtime, player } = fixture()

    runtime.setBattleManualMode(true)
    runtime.pauseForManualActor(player)

    expect(runtime.isAwaitingManualTurnChoice()).toBe(true)

    const submitted = runtime.submitTurnChoice('basic')

    expect(submitted).toBe(true)
    expect(runtime.isAwaitingManualTurnChoice()).toBe(false)
    expect(runtime.isActionPlaybackWaiting()).toBe(true)
    expect(runtime.getAnimationState('player')).toBe('cast')
  })

  it('submitTurnChoice with no pending pause is a safe no-op (returns false)', () => {
    const { runtime } = fixture()

    expect(runtime.submitTurnChoice('basic')).toBe(false)
  })

  it('disabling manual mode mid-pause cancels the pause', () => {
    const { runtime, player } = fixture()

    runtime.setBattleManualMode(true)
    runtime.pauseForManualActor(player)

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

  it('isPresentationActive reflects the last setPresentationActive() call', () => {
    const { runtime } = fixture()

    expect(runtime.isPresentationActive()).toBe(false)

    runtime.setPresentationActive(true)

    expect(runtime.isPresentationActive()).toBe(true)
  })

  it('resetPendingState clears ready/manual-pause phases at once', () => {
    const { runtime, player } = fixture()

    runtime.setBattleManualMode(true)
    runtime.pauseForManualActor(player)

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
    const token = runtime.getPendingPlaybackToken()!
    runtime.acknowledgeTurnReady(token)

    expect(declareSpy).toHaveBeenCalled()
  })

  describe('Task 3: hold-safe action runtime and preparePresentationResume', () => {
    it('returns null from preparePresentationResume when no phase is pending', () => {
      const { runtime } = fixture()
      expect(runtime.preparePresentationResume()).toBeNull()
    })

    it('resumes pending ready phase, renews token, invalidates old token', () => {
      const { runtime, player } = fixture()
      runtime.setPresentationActive(true)
      runtime.notifyReadyActor(player)
      const oldToken = runtime.getPendingPlaybackToken()!

      const resume = runtime.preparePresentationResume()!
      expect(resume).toBeDefined()
      expect(resume.phase).toBe('ready')
      if (resume.phase === 'ready') {
        expect(resume.actorId).toBe(player.id)
        expect(resume.token).not.toBe(oldToken)

        // Old token rejected
        runtime.acknowledgeTurnReady(oldToken)
        expect(runtime.getAnimationState(player.id)).toBe('ready')

        // New token accepted
        runtime.acknowledgeTurnReady(resume.token)
        expect(runtime.getAnimationState(player.id)).toBe('cast')
      }
    })

    it('resumes pending cast phase, renews token, invalidates old token', () => {
      const { runtime, player } = fixture()
      runtime.setPresentationActive(true)
      runtime.notifyReadyActor(player)
      const readyToken = runtime.getPendingPlaybackToken()!
      runtime.acknowledgeTurnReady(readyToken)
      const oldCastToken = runtime.getPendingPlaybackToken()!
      expect(runtime.getAnimationState(player.id)).toBe('cast')

      const resume = runtime.preparePresentationResume()!
      expect(resume).toBeDefined()
      expect(resume.phase).toBe('cast')
      if (resume.phase === 'cast') {
        expect(resume.actorId).toBe(player.id)
        expect(resume.skillId).toBeDefined()
        expect(resume.targetIds).toBeDefined()
        expect(resume.token).not.toBe(oldCastToken)

        // Old token rejected
        runtime.acknowledgeActionImpact(oldCastToken)
        expect(runtime.getAnimationState(player.id)).toBe('cast')

        // New token accepted -> advances to standby
        runtime.acknowledgeActionImpact(resume.token)
        expect(runtime.getAnimationState(player.id)).toBe('standby')
      }
    })

    it('resumes pending complete phase, renews token, completes action on new token', () => {
      const { runtime, player } = fixture()
      runtime.setPresentationActive(true)
      runtime.notifyReadyActor(player)
      runtime.acknowledgeTurnReady(runtime.getPendingPlaybackToken()!)
      runtime.acknowledgeActionImpact(runtime.getPendingPlaybackToken()!)
      const oldCompleteToken = runtime.getPendingPlaybackToken()!
      expect(runtime.getAnimationState(player.id)).toBe('standby')

      const resume = runtime.preparePresentationResume()!
      expect(resume).toBeDefined()
      expect(resume.phase).toBe('complete')
      if (resume.phase === 'complete') {
        expect(resume.actorId).toBe(player.id)
        expect(resume.targetIds).toBeDefined()
        expect(resume.token).not.toBe(oldCompleteToken)

        // Old token rejected
        runtime.acknowledgeActionComplete(oldCompleteToken)
        expect(runtime.isActionPlaybackWaiting()).toBe(true)

        // New token accepted -> completes
        runtime.acknowledgeActionComplete(resume.token)
        expect(runtime.isActionPlaybackWaiting()).toBe(false)
      }
    })

    it('resumes pending manual choice phase', () => {
      const { runtime, player } = fixture()
      runtime.setPresentationActive(true)
      runtime.setBattleManualMode(true)
      runtime.pauseForManualActor(player)

      expect(runtime.isAwaitingManualTurnChoice()).toBe(true)

      const resume = runtime.preparePresentationResume()!
      expect(resume).toBeDefined()
      expect(resume.phase).toBe('manual')
      if (resume.phase === 'manual') {
        expect(resume.actorId).toBe(player.id)
      }

      // Choice still works
      expect(runtime.submitTurnChoice('basic')).toBe(true)
      expect(runtime.isAwaitingManualTurnChoice()).toBe(false)
    })

    it('rejects all acknowledgments and manual choice while isSessionBlocking is true', () => {
      let blocking = true
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
      const battle: TurnBattle = { players: [player], enemies: [enemy], state: 'fighting', totalTurnsElapsed: 0 }

      const runtime = new CombatAnimationRuntime({
        getTurnBattleSystem: () => turnBattleSystem,
        eventBus,
        getBattle: () => battle,
        syncLegacyBattleState: vi.fn(),
        isSessionBlocking: () => blocking,
      })

      runtime.setPresentationActive(true)
      runtime.notifyReadyActor(player)
      const token = runtime.getPendingPlaybackToken()!

      // Blocked: acknowledgeTurnReady is rejected
      runtime.acknowledgeTurnReady(token)
      expect(runtime.getAnimationState(player.id)).toBe('ready')

      // Unblock: acknowledgeTurnReady is accepted
      blocking = false
      runtime.acknowledgeTurnReady(token)
      expect(runtime.getAnimationState(player.id)).toBe('cast')

      // Blocked again: acknowledgeActionImpact is rejected
      blocking = true
      runtime.acknowledgeActionImpact(token)
      expect(runtime.getAnimationState(player.id)).toBe('cast')

      // Unblock: accepted
      blocking = false
      runtime.acknowledgeActionImpact(token)
      expect(runtime.getAnimationState(player.id)).toBe('standby')

      // Blocked again: acknowledgeActionComplete rejected
      blocking = true
      runtime.acknowledgeActionComplete(token)
      expect(runtime.isActionPlaybackWaiting()).toBe(true)

      // Unblock: accepted
      blocking = false
      runtime.acknowledgeActionComplete(token)
      expect(runtime.isActionPlaybackWaiting()).toBe(false)
    })

    it('detachPresentation("hold") preserves pending work without drain', () => {
      const { runtime, player, battle } = fixture()
      runtime.setPresentationActive(true)
      runtime.notifyReadyActor(player)
      expect(runtime.isActionPlaybackWaiting()).toBe(true)

      runtime.detachPresentation('hold')
      expect(runtime.isActionPlaybackWaiting()).toBe(true)
      expect(battle.totalTurnsElapsed).toBe(0)
    })

    it('detachPresentation("headless") drains pending work', () => {
      const { runtime, player, battle } = fixture()
      runtime.setPresentationActive(true)
      runtime.notifyReadyActor(player)
      expect(runtime.isActionPlaybackWaiting()).toBe(true)

      runtime.detachPresentation('headless')
      expect(runtime.isActionPlaybackWaiting()).toBe(false)
      expect(battle.totalTurnsElapsed).toBe(1)
      expect(runtime.isPresentationActive()).toBe(false)
    })

    it('resetPendingState clears playbackToken so late callbacks cannot match', () => {
      const { runtime, player } = fixture()
      runtime.setPresentationActive(true)
      runtime.notifyReadyActor(player)
      const token = runtime.getPendingPlaybackToken()!

      runtime.resetPendingState()
      expect(runtime.getPendingPlaybackToken()).toBeNull()

      // Late ready callback with old token
      runtime.acknowledgeTurnReady(token)
      expect(runtime.isActionPlaybackWaiting()).toBe(false)
    })
  })
})
