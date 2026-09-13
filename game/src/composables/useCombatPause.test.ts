// @vitest-environment jsdom
// Task 8 (A11) — the unwatched pause. A hidden tab freezes combat with
// reason 'tab-hidden'; becoming visible again must NOT resume it (spec
// §6.1: "Returning attention is not consent to resume"). Only
// continueBattle() (wired to the player's Continue button) may resume.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCombatPause } from './useCombatPause'

describe('useCombatPause', () => {
  let visibility: DocumentVisibilityState = 'visible'

  function stubVisibility() {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    })
  }

  afterEach(() => {
    visibility = 'visible'
    vi.restoreAllMocks()
  })

  it('pauses when hidden and does NOT resume when visible again', () => {
    stubVisibility()
    const calls: string[] = []
    const gameManager = {
      freezeCombat: (r: string) => calls.push(`freeze:${r}`),
      resumeCombat: (r: string) => calls.push(`resume:${r}`),
    }

    const { isPaused, continueBattle, dispose } = useCombatPause(gameManager as any)

    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(isPaused.value).toBe(true)
    expect(calls).toEqual(['freeze:tab-hidden'])

    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(isPaused.value).toBe(true)
    expect(calls).toEqual(['freeze:tab-hidden'])

    continueBattle()
    expect(isPaused.value).toBe(false)
    expect(calls).toEqual(['freeze:tab-hidden', 'resume:tab-hidden'])

    dispose()
  })

  it('does not pause when not in combat', () => {
    stubVisibility()
    const calls: string[] = []
    const gameManager = {
      freezeCombat: (r: string) => calls.push(`freeze:${r}`),
      resumeCombat: (r: string) => calls.push(`resume:${r}`),
    }

    const { isPaused, dispose } = useCombatPause(gameManager as any, {
      isCombatActive: () => false,
    })

    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))

    expect(isPaused.value).toBe(false)
    expect(calls).toEqual([])

    dispose()
  })
})
