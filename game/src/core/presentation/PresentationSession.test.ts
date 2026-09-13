import { describe, expect, it, vi } from 'vitest'
import {
  PresentationSession,
  SessionAllocator,
} from './PresentationSession'

describe('PresentationSession primitive', () => {
  it('implements the exact representative oracle from the spec', () => {
    const gate = new PresentationSession()
    const session = { kind: 'combat', sessionId: 1 } as const

    gate.begin(session, 'interactive')
    const token = gate.hold(session)!

    expect(token).toBeDefined()
    expect(token.sessionId).toBe(1)
    expect(token.generation).toBe(1)
    expect(gate.isBlocking()).toBe(true)

    // Release before attach must fail and remain blocking
    expect(gate.release(token)).toBe(false)
    expect(gate.isBlocking()).toBe(true)

    // Attach succeeds and remains blocking until release
    expect(gate.attach(token)).toBe(true)
    expect(gate.isBlocking()).toBe(true)

    // Release after attach succeeds and unblocks
    expect(gate.release(token)).toBe(true)
    expect(gate.isBlocking()).toBe(false)

    // Re-hold acquires a new generation and re-blocks
    const retry = gate.hold(session)!
    expect(retry.generation).toBe(2)
    expect(gate.isBlocking()).toBe(true)

    // Old token release is rejected (stale generation)
    expect(gate.release(token)).toBe(false)

    // New token attach succeeds
    expect(gate.attach(retry)).toBe(true)
    expect(gate.isBlocking()).toBe(true)
  })

  it('headless begin is unblocked', () => {
    const gate = new PresentationSession()
    const session = { kind: 'combat', sessionId: 1 } as const

    gate.begin(session, 'headless')

    expect(gate.isBlocking()).toBe(false)
    expect(gate.getCurrentSession()).toEqual(session)
    expect(gate.getMode()).toBe('headless')
  })

  it('begin session 2 invalidates session 1 tokens and hold calls', () => {
    const gate = new PresentationSession()
    const session1 = { kind: 'combat', sessionId: 1 } as const
    const session2 = { kind: 'combat', sessionId: 2 } as const

    gate.begin(session1, 'interactive')
    const token1 = gate.hold(session1)!
    expect(token1).toBeDefined()

    gate.begin(session2, 'interactive')
    expect(gate.getCurrentSession()).toEqual(session2)

    // Stale session 1 token operations fail
    expect(gate.attach(token1)).toBe(false)
    expect(gate.release(token1)).toBe(false)
    expect(gate.detach(token1, 'hold')).toBe(false)
    expect(gate.detach(token1, 'headless')).toBe(false)

    // Stale hold for session 1 returns null
    expect(gate.hold(session1)).toBeNull()

    // Valid hold for session 2 succeeds
    const token2 = gate.hold(session2)!
    expect(token2).toBeDefined()
    expect(token2.sessionId).toBe(2)
    expect(gate.attach(token2)).toBe(true)
  })

  it('stale hold returns null when session kind or ID does not match current session', () => {
    const gate = new PresentationSession()
    const session = { kind: 'combat', sessionId: 42 } as const

    gate.begin(session, 'interactive')

    expect(gate.hold({ kind: 'combat', sessionId: 999 })).toBeNull()
    expect(gate.hold({ kind: 'tribulation', sessionId: 42 })).toBeNull()
  })

  it('repeated queries do not change state (query purity)', () => {
    const gate = new PresentationSession()
    const session = { kind: 'combat', sessionId: 1 } as const

    gate.begin(session, 'interactive')
    const token = gate.hold(session)!

    expect(gate.isBlocking()).toBe(true)
    expect(gate.isBlocking()).toBe(true)
    expect(gate.getCurrentSession()).toEqual(session)
    expect(gate.getCurrentSession()).toEqual(session)

    gate.attach(token)
    expect(gate.isBlocking()).toBe(true)
    expect(gate.isBlocking()).toBe(true)

    gate.release(token)
    expect(gate.isBlocking()).toBe(false)
    expect(gate.isBlocking()).toBe(false)
  })

  it('advancing fake time 60 seconds does not release interactive hold (no wall-clock timeout)', () => {
    vi.useFakeTimers()
    try {
      const gate = new PresentationSession()
      const session = { kind: 'combat', sessionId: 1 } as const

      gate.begin(session, 'interactive')
      gate.hold(session)

      expect(gate.isBlocking()).toBe(true)

      vi.advanceTimersByTime(60_000)

      expect(gate.isBlocking()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('detach with policy "hold" keeps runtime blocked and invalidates attachment', () => {
    const gate = new PresentationSession()
    const session = { kind: 'combat', sessionId: 1 } as const

    gate.begin(session, 'interactive')
    const token = gate.hold(session)!
    gate.attach(token)

    // Detach with hold policy
    expect(gate.detach(token, 'hold')).toBe(true)
    expect(gate.isBlocking()).toBe(true)

    // Release without re-attaching fails
    expect(gate.release(token)).toBe(false)

    // Re-attaching the same generation token succeeds and allows release
    expect(gate.attach(token)).toBe(true)
    expect(gate.release(token)).toBe(true)
    expect(gate.isBlocking()).toBe(false)
  })

  it('detach with policy "headless" unblocks runtime and switches mode to headless', () => {
    const gate = new PresentationSession()
    const session = { kind: 'combat', sessionId: 1 } as const

    gate.begin(session, 'interactive')
    const token = gate.hold(session)!
    gate.attach(token)

    expect(gate.detach(token, 'headless')).toBe(true)
    expect(gate.isBlocking()).toBe(false)
    expect(gate.getMode()).toBe('headless')
  })

  it('end is idempotent and clears current session', () => {
    const gate = new PresentationSession()
    const session = { kind: 'combat', sessionId: 1 } as const

    gate.begin(session, 'interactive')
    gate.hold(session)
    expect(gate.getCurrentSession()).toEqual(session)

    // First end clears session
    gate.end(session)
    expect(gate.getCurrentSession()).toBeNull()
    expect(gate.isBlocking()).toBe(false)

    // Second end is safe no-op
    expect(() => gate.end(session)).not.toThrow()
    expect(gate.getCurrentSession()).toBeNull()

    // Calling end with non-matching session does nothing
    expect(() => gate.end({ kind: 'combat', sessionId: 999 })).not.toThrow()
  })

  it('rejects a fabricated token before any hold has been taken', () => {
    const gate = new PresentationSession()
    const session = { kind: 'combat', sessionId: 1 } as const

    gate.begin(session, 'interactive')

    const forged = { sessionId: 1, generation: 0 }

    expect(gate.attach(forged)).toBe(false)
    expect(gate.release(forged)).toBe(false)
    expect(gate.detach(forged, 'headless')).toBe(false)
    expect(gate.isBlocking()).toBe(true)
  })

  it('allocator allocates monotonic positive IDs', () => {
    const allocator = new SessionAllocator()
    const id1 = allocator.allocate()
    const id2 = allocator.allocate()
    const id3 = allocator.allocate()

    expect(id1).toBe(1)
    expect(id2).toBe(2)
    expect(id3).toBe(3)

    const gate = new PresentationSession(allocator)
    expect(gate.allocate()).toBe(4)
  })
})
