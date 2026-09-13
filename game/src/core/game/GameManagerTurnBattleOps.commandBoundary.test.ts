import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '@/core/battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { startAStage } from './__fixtures__/startAStage'

describe('external commands land at a turn boundary', () => {
  function reachManualTurn(manager: GameManager, source: ManualClockSource) {
    manager.setBattleManualMode(true)
    source.advance(COMBAT_STEP_SECONDS * 200)
  }

  it('defers a command submitted while a turn is in flight', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)
    reachManualTurn(manager, source)

    const applied: string[] = []
    manager.enqueueAtTurnBoundary(() => applied.push('gear-change'))

    source.advance(COMBAT_STEP_SECONDS * 10)
    expect(applied).toEqual([])

    manager.submitTurnChoice('basic')
    source.advance(COMBAT_STEP_SECONDS * 5)

    expect(applied).toEqual(['gear-change'])
  })

  it('holds commands while a manual turn remains unresolved', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)
    reachManualTurn(manager, source)

    const applied: string[] = []
    manager.enqueueAtTurnBoundary(() => applied.push('x'))

    source.advance(COMBAT_STEP_SECONDS * 10000)
    expect(applied).toEqual([])
  })

  it('applies queued commands in submission order, once each', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)
    reachManualTurn(manager, source)

    const applied: string[] = []
    manager.enqueueAtTurnBoundary(() => applied.push('first'))
    manager.enqueueAtTurnBoundary(() => applied.push('second'))

    manager.submitTurnChoice('basic')
    source.advance(COMBAT_STEP_SECONDS * 5)

    expect(applied).toEqual(['first', 'second'])
  })

  it('discards commands queued against a battle that ended', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)
    reachManualTurn(manager, source)

    const applied: string[] = []
    manager.enqueueAtTurnBoundary(() => applied.push('stale'))

    // End this battle, then start a fresh one and let it reach a boundary.
    manager.abandonBattle()
    startAStage(manager)
    source.advance(COMBAT_STEP_SECONDS * 400)

    expect(applied).toEqual([])
  })

  it('discards commands queued against a battle that ends in victory (not abandon)', () => {
    // repeatContinuously: true is the case startStage's own clear cannot
    // cover - restartTurnBattleCycle() builds the next battle in place,
    // never through startStage, so only the COMBAT_OVER-transition clear
    // (spec section 9.2) protects it.
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager, { repeatContinuously: true })
    reachManualTurn(manager, source)

    // The last turn of this battle: knock the enemy to 1 hp so resolving the
    // manual player turn kills it outright and the battle goes straight to
    // 'victory' - never through abandonBattle. Zero evasionRate too -
    // CombatSystem.ts rolls Math.random() < hitChance per hit, and the
    // fixture enemy's default evasion makes a manual "basic" attack MISS
    // (leaving currentHp at 1, battle still 'fighting') often enough to flake
    // this test - the exact fix GameManager.actionPlayback.test.ts already
    // documents for the same root cause.
    const enemyEntity = manager.getTurnBattle()!.enemies[0]!.entity
    enemyEntity.currentHp = 1
    enemyEntity.baseStats.evasionRate = 0
    enemyEntity.stats.evasionRate = 0

    const applied: string[] = []
    manager.enqueueAtTurnBoundary(() => applied.push('stale-victory'))

    // Resolving this turn both ends THIS battle in victory and, because
    // repeat is on, restarts a fresh one in place (restartTurnBattleCycle) -
    // all synchronously inside submitTurnChoice, before any clock step gets
    // a chance to drain the queue.
    manager.submitTurnChoice('basic')

    expect(applied).toEqual([])

    // The restarted battle reaching its own boundary must not receive a
    // command that was queued against the battle that just ended.
    source.advance(COMBAT_STEP_SECONDS * 400)

    expect(applied).toEqual([])
  })

  it('routes the manual-mode flag itself through the boundary, without deferring the stranded-turn rescue', () => {
    // Manual-mode toggle is an external command (spec section 9.1): flipping
    // it must not affect the turn already resolving, only the next claim.
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    manager.setPresentationActive(true)
    startAStage(manager)

    // Past intro/countdown into fighting, then claim an actor - presentation
    // is active, so the turn parks waiting for the renderer's acknowledge
    // signals instead of resolving inline.
    source.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).not.toBe('IDLE')
    expect(manager.isBattleManualMode()).toBe(false)

    manager.setBattleManualMode(true)

    // Queued, not applied: the in-flight (auto) turn must keep resolving as
    // an auto turn, not suddenly pause mid-flight.
    expect(manager.isBattleManualMode()).toBe(false)

    manager.acknowledgeTurnReady(manager.getPendingPlaybackToken()!)
    manager.acknowledgeActionImpact(manager.getPendingPlaybackToken()!)
    manager.acknowledgeActionComplete(manager.getPendingPlaybackToken()!)

    expect(manager.getTurnTokenState()).toBe('IDLE')
    // Reaching IDLE is not itself the drain - the drain runs at the top of
    // the NEXT combat step (spec section 9.2).
    expect(manager.isBattleManualMode()).toBe(false)

    source.advance(COMBAT_STEP_SECONDS)
    expect(manager.isBattleManualMode()).toBe(true)
  })
})
