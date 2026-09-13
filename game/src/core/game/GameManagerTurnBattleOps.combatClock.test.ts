import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '@/core/battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { startAStage } from './__fixtures__/startAStage'

// Combat used to ride the world tick: App.vue's 1 Hz interval reached
// updateBattleFixedStep(), which sliced it into ten 0.1s steps inside ONE JS
// frame. Phaser therefore rendered at 60fps but received combat data once a
// second, in bursts of ten - which is why a three-second countdown showed as
// three beats. Combat now counts on its own CombatClock; the world tick's
// cadence is unchanged and still owns cultivation, production and auto-farm.
describe('combat runs on CombatClock, not the world tick', () => {
  it('does not advance the battle when only the world clock ticks', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)

    const stateBefore = manager.getTurnBattle()?.state
    const introBefore = manager.getTurnBattle()?.introTurnsRemaining

    manager.tickOps.update(1)

    expect(manager.getTurnBattle()?.state).toBe(stateBefore)
    expect(manager.getTurnBattle()?.introTurnsRemaining).toBe(introBefore)
  })

  it('advances the battle when its own clock advances', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)

    source.advance(COMBAT_STEP_SECONDS * 25)

    expect(manager.getTurnBattle()?.introTurnsRemaining).toBe(0)
  })

  it('stops while off screen and never banks that time', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    startAStage(manager)

    manager.freezeCombat('not-revealed')
    source.advance(COMBAT_STEP_SECONDS * 500)
    manager.resumeCombat('not-revealed')

    const before = manager.getTurnBattle()?.introTurnsRemaining
    source.advance(COMBAT_STEP_SECONDS)

    expect(manager.getTurnBattle()?.introTurnsRemaining).toBe((before ?? 0) - 1)
  })

  it('freezes the clock while a turn is in flight, not merely the gauge', () => {
    const manager = new GameManager()
    const source = new ManualClockSource()
    manager.setCombatClockSource(source)
    manager.setBattleManualMode(true)
    startAStage(manager)

    // Reach a manual actor's turn.
    source.advance(COMBAT_STEP_SECONDS * 200)

    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getFreezeReasons()).toContain('turn-in-flight')

    const stepsBefore = manager.getElapsedCombatSteps()
    source.advance(COMBAT_STEP_SECONDS * 600)

    // No step was consumed while the token was held.
    expect(manager.getElapsedCombatSteps()).toBe(stepsBefore)
  })
})
