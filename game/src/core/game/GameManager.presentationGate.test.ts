import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'

// Defect Task 3 — PresentationGate boot-race fix: real app (App.vue) calls
// expectPresentationLayer() once at boot; CombatScene calls
// setPresentationActive(true) when mounted. Headless test instances never
// call expect → never gated.

describe('GameManager — PresentationGate (boot-race fix)', () => {
  it('does NOT gate combat ticking by default (headless/test instances never call expectPresentationLayer)', () => {
    const gameManager = new GameManager()

    expect(gameManager.isAwaitingPresentationLayer()).toBe(false)
  })

  it('gates after expectPresentationLayer(), releases after setPresentationActive(true)', () => {
    const gameManager = new GameManager()

    gameManager.expectPresentationLayer()
    expect(gameManager.isAwaitingPresentationLayer()).toBe(true)

    gameManager.setPresentationActive(true)
    expect(gameManager.isAwaitingPresentationLayer()).toBe(false)
  })

  it('markReady sticky — setPresentationActive(false) sau đó không re-block', () => {
    const gameManager = new GameManager()

    gameManager.expectPresentationLayer()
    gameManager.setPresentationActive(true)
    gameManager.setPresentationActive(false)

    expect(gameManager.isAwaitingPresentationLayer()).toBe(false)
  })
})
