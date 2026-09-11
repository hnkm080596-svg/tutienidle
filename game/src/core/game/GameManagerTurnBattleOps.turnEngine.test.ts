import { describe, expect, it, vi } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '@/core/battle/turn/CombatClock'
import { GAUGE_MAX } from '@/core/battle/turn/ActionGauge'
import { GameManager } from './GameManager'
import { startAStage } from './__fixtures__/startAStage'

// The turn token and the resolution pipeline exist to be the SINGLE authority
// on whether combat is between turns or inside one. These tests drive the real
// public surface end to end: a gauge fills, the token is claimed, the clock
// freezes, the renderer's three-signal handshake completes the pipeline's
// asynchronous steps, and only then does the token return to IDLE.
describe('turn engine is actually wired', () => {
  it('claims, resolves through the pipeline, and returns to IDLE', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    manager.setPresentationActive(true)
    startAStage(manager)

    // Run past intro and countdown into fighting.
    source.advance(COMBAT_STEP_SECONDS * 60)
    expect(manager.getTurnBattle()?.state).toBe('fighting')

    // A gauge fills and claims the token; the clock freezes.
    source.advance(COMBAT_STEP_SECONDS * 200)
    expect(manager.getTurnTokenState()).not.toBe('IDLE')
    expect(manager.getCombatClockState()).toBe('frozen')

    // Nothing advances until the renderer acknowledges each step.
    const gaugeWhileHeld = manager.getTurnBattle()?.enemies[0]?.actionGauge
    source.advance(COMBAT_STEP_SECONDS * 100)
    expect(manager.getTurnBattle()?.enemies[0]?.actionGauge).toBe(gaugeWhileHeld)

    // Drive the handshake the way Phaser does.
    manager.acknowledgeTurnReady(manager.getPendingPlaybackToken()!)
    manager.acknowledgeActionImpact(manager.getPendingPlaybackToken()!)
    manager.acknowledgeActionComplete(manager.getPendingPlaybackToken()!)

    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getCombatClockState()).toBe('running')
  })

  it('does not let intro or countdown claim the token', () => {
    // Spec 3.3: the token is active only while the phase is fighting.
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)

    expect(manager.getTurnBattle()?.state).toBe('intro')
    source.advance(COMBAT_STEP_SECONDS * 10)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getTurnBattle()?.state).toBe('intro')
  })

  it('resets a COMBAT_OVER token when the next battle starts', () => {
    // Spec 3.3 / blocker A5: a terminal token inherited by a fresh battle
    // rejects its first claim and freezes that battle forever.
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)
    manager.abandonBattle()

    startAStage(manager)

    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getCombatClockState()).toBe('running')

    // And the fresh battle really does advance - a stale terminal token would
    // have frozen it on its first claim.
    source.advance(COMBAT_STEP_SECONDS * 25)
    expect(manager.getTurnBattle()?.introTurnsRemaining).toBe(0)
  })

  it('completes a parked step on the fallback timer when no ack arrives', () => {
    // Spec 4.1a: a missing renderer event must not park the pipeline forever,
    // because that leaves the token non-IDLE and the clock frozen for good.
    vi.useFakeTimers()

    try {
      const manager = new GameManager()
      const source = new ManualClockSource()
      manager.setCombatClockSource(source)
      manager.setPresentationActive(true)
      startAStage(manager)
      source.advance(COMBAT_STEP_SECONDS * 260)

      expect(manager.getTurnTokenState()).not.toBe('IDLE')

      // No acknowledgement at all - simulate a destroyed sprite.
      vi.advanceTimersByTime(30_000)

      expect(manager.getTurnTokenState()).toBe('IDLE')
      expect(manager.getCombatClockState()).toBe('running')
    } finally {
      vi.useRealTimers()
    }
  })

  it('the fallback resolves the turn, it does not merely unpark the pipeline', () => {
    // A step that "completes" has to mean the turn made progress. A bare
    // done() would leave the token IDLE and the clock running (which the test
    // above already checks) while skipping declareActorAction,
    // applyActionImpact and completeAction entirely - so the gauge would never
    // be consumed and the very next step would re-claim the SAME turn forever.
    vi.useFakeTimers()

    try {
      const manager = new GameManager()
      const source = new ManualClockSource()
      manager.setCombatClockSource(source)
      manager.setPresentationActive(true)
      startAStage(manager)
      source.advance(COMBAT_STEP_SECONDS * 260)

      expect(manager.getTurnTokenState()).not.toBe('IDLE')
      expect(manager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBe(0)

      const battle = manager.getTurnBattle()!
      const claimant = [...battle.players, ...battle.enemies].find(
        (participant) => participant.actionGauge >= GAUGE_MAX,
      )

      expect(claimant, 'an actor should be holding the turn').toBeDefined()

      // Not one acknowledgement arrives - every step falls back.
      vi.advanceTimersByTime(30_000)

      expect(manager.getTurnTokenState()).toBe('IDLE')

      // declareActorAction ran (it is what counts a turn).
      expect(manager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBe(1)

      // completeAction ran, so the gauge was consumed: the claimant cannot
      // immediately re-claim the turn it just took.
      expect(claimant!.actionGauge).toBeLessThan(GAUGE_MAX)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('turn engine integration - manual mode', () => {
  it('reports a non-idle token state during a manual wait', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    manager.setBattleManualMode(true)
    startAStage(manager)

    source.advance(COMBAT_STEP_SECONDS * 200)

    expect(manager.getTurnTokenState()).toBe('AWAITING_INPUT')
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getFreezeReasons()).toContain('turn-in-flight')
  })

  it('announces the claim with a ready cue before pausing for input', () => {
    // Manual mode gates the primary ACTION, never the presentation (spec
    // section 7), and the flourish belongs to the claim (section 3's
    // CLAIMED -> AWAITING_INPUT is state routing, not a presentation change).
    // Without this the skill panel appears in silence, with no actor animation.
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    manager.setPresentationActive(true)
    manager.setBattleManualMode(true)
    startAStage(manager)

    const readyCues: string[] = []
    manager.eventBus.on('turn_ready', (event) =>
      readyCues.push((event as { actorId: string }).actorId),
    )

    source.advance(COMBAT_STEP_SECONDS * 200)

    expect(manager.getTurnTokenState()).toBe('AWAITING_INPUT')
    expect(readyCues).toHaveLength(1)
    expect(readyCues[0]).toBe(manager.consumeAwaitedActorId())

    // The cue is announced WITHOUT entering the renderer's pending-ready
    // phase, so the ack CombatScene fires when its flourish tween ends cannot
    // auto-declare the default skill behind the player's back.
    expect(manager.isActionPlaybackWaiting()).toBe(false)

    manager.acknowledgeTurnReady(manager.getPendingPlaybackToken() ?? 'playback-1')

    expect(manager.getTurnTokenState()).toBe('AWAITING_INPUT')
    expect(manager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBe(0)

    // And the cue is not replayed when the player's choice resumes the turn.
    manager.submitTurnChoice('basic')

    expect(readyCues).toHaveLength(1)
  })

  it('returns to idle after a manual choice resolves', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    manager.setBattleManualMode(true)
    startAStage(manager)

    source.advance(COMBAT_STEP_SECONDS * 200)
    manager.submitTurnChoice('basic')

    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getCombatClockState()).toBe('running')

    // And the battle keeps advancing afterwards.
    const turnsAfterSubmit = manager.getTurnBattle()?.totalTurnsElapsed ?? 0
    source.advance(COMBAT_STEP_SECONDS * 5)
    expect(manager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBeGreaterThanOrEqual(
      turnsAfterSubmit,
    )
  })
})
