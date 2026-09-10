import { describe, expect, it } from 'vitest'
import { TurnToken } from './TurnToken'

describe('TurnToken', () => {
  it('starts idle', () => {
    const token = new TurnToken()
    expect(token.getState()).toBe('IDLE')
  })

  it('routes a player-team claim into awaiting-input under manual mode', () => {
    const token = new TurnToken()
    token.claim({ actorId: 'p1', isPlayerTeam: true, manualMode: true })
    expect(token.getState()).toBe('AWAITING_INPUT')
  })

  it('routes an auto or enemy claim straight to resolving', () => {
    const auto = new TurnToken()
    auto.claim({ actorId: 'p1', isPlayerTeam: true, manualMode: false })
    expect(auto.getState()).toBe('RESOLVING')

    const enemy = new TurnToken()
    enemy.claim({ actorId: 'e1', isPlayerTeam: false, manualMode: true })
    expect(enemy.getState()).toBe('RESOLVING')
  })

  it('releases the token back to idle when resolution ends', () => {
    const token = new TurnToken()
    token.claim({ actorId: 'e1', isPlayerTeam: false, manualMode: false })
    expect(token.getState()).toBe('RESOLVING')

    token.resolve({ bothSidesAlive: true })
    expect(token.getState()).toBe('IDLE')
  })

  it('transitions to COMBAT_OVER when one side has no living actor', () => {
    const token = new TurnToken()
    token.claim({ actorId: 'e1', isPlayerTeam: false, manualMode: false })
    token.resolve({ bothSidesAlive: false })
    expect(token.getState()).toBe('COMBAT_OVER')
  })

  it('refuses to claim while not idle', () => {
    const token = new TurnToken()
    token.claim({ actorId: 'e1', isPlayerTeam: false, manualMode: false })
    expect(() =>
      token.claim({ actorId: 'e2', isPlayerTeam: false, manualMode: false }),
    ).toThrow(/not idle/i)
  })

  it('notifies subscribers on every state change', () => {
    const token = new TurnToken()
    const states: string[] = []
    token.onStateChange((s) => states.push(s))

    token.claim({ actorId: 'e1', isPlayerTeam: false, manualMode: false })
    token.resolve({ bothSidesAlive: true })

    expect(states).toEqual(['CLAIMED', 'RESOLVING', 'IDLE'])
  })
})
