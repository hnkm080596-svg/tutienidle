import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { startAStage } from './__fixtures__/startAStage'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'

afterEach(() => vi.useRealTimers())
function setup() {
  vi.useFakeTimers()
  const manager = new GameManager()
  const clock = new ManualClockSource()
  manager.setCombatClockSource(clock)
  manager.setPresentationActive(true)
  manager.setPresentationMode('interactive')
  startAStage(manager)
  const port = manager.getPresentationPort()
  const initial = port.hold(port.getCurrentSession()!)!
  port.attach(initial)
  port.release(initial)
  clock.advance(COMBAT_STEP_SECONDS * 260)
  return { manager, clock }
}
describe('production presentation handshake first proof', () => {
  it('publishes cast before result while headless pipeline settles synchronously', () => {
    const manager = new GameManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    const events: string[] = []
    manager.eventBus.on('skill_presentation_cast', () => events.push('cast'))
    manager.eventBus.on('skill_presentation_resolved', () => events.push('resolved'))
    startAStage(manager)
    clock.advance(COMBAT_STEP_SECONDS * 70)
    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(events.slice(0, 2)).toEqual(['cast', 'resolved'])
    manager.abandonBattle()
  })
  it('publishes detached frozen cast and sealed result with stable resume identity', () => {
    const { manager } = setup()
    const casts: unknown[] = []
    const batches: unknown[] = []
    manager.eventBus.on('skill_presentation_cast', (value) => casts.push(value))
    manager.eventBus.on('skill_presentation_resolved', (value) => batches.push(value))
    manager.acknowledgeTurnReady(manager.getPendingPlaybackToken()!)
    expect(casts).toHaveLength(1)
    const cast = casts[0] as {
      ref: { sessionId: number; requestId: string; token: string }
      source: object
      declaredTargets: object[]
    }
    expect(Object.isFrozen(cast)).toBe(true)
    expect(Object.isFrozen(cast.source)).toBe(true)
    expect(cast.ref.sessionId).toBe(manager.getPresentationPort().getCurrentSession()!.sessionId)
    const resume = manager.preparePresentationResume() as unknown as { cast: typeof cast }
    expect(resume.cast.ref.requestId).toBe(cast.ref.requestId)
    expect(resume.cast.ref.token).not.toBe(cast.ref.token)
    manager.acknowledgeActionImpact(manager.getPendingPlaybackToken()!)
    expect(batches).toHaveLength(1)
    const batch = batches[0] as {
      sealed: boolean
      groups: { groupId: string; outcomes: { kind: string; operationId: string }[] }[]
    }
    expect(batch.sealed).toBe(true)
    expect(Object.isFrozen(batch.groups[0]!.outcomes)).toBe(true)
    expect(batch.groups[0]!.outcomes.some((o) => o.kind === 'hit' && !!o.operationId)).toBe(true)
    manager.acknowledgeActionComplete(manager.getPendingPlaybackToken()!)
    manager.abandonBattle()
  })
  it('preserves a held pending pipeline beyond watchdog and resumes once', () => {
    const { manager, clock } = setup()
    const port = manager.getPresentationPort()
    const session = port.getCurrentSession()!
    const hold = port.hold(session)!
    vi.advanceTimersByTime(16001)
    expect(manager.getTurnTokenState()).not.toBe('IDLE')
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(0)
    expect(port.attach(hold)).toBe(true)
    expect(port.release(hold)).toBe(true)
    const resume = manager.preparePresentationResume()!
    expect(resume.phase).toBe('ready')
    const token = manager.getPendingPlaybackToken()!
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(1)
    clock.advance(COMBAT_STEP_SECONDS * 200)
    expect(manager.getTurnTokenState()).not.toBe('IDLE')
    manager.abandonBattle()
  })
  it('accepts synchronous complete from impact observer without losing pipeline settlement', () => {
    const { manager } = setup()
    let impacts = 0
    manager.eventBus.on('action_impact', () => {
      impacts++
      manager.acknowledgeActionComplete(manager.getPendingPlaybackToken()!)
    })
    manager.acknowledgeTurnReady(manager.getPendingPlaybackToken()!)
    manager.acknowledgeActionImpact(manager.getPendingPlaybackToken()!)
    expect(impacts).toBe(1)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(1)
    manager.abandonBattle()
  })
})
