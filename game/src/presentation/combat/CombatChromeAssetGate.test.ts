// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CoordinatorSnapshot } from '@/presentation/PresentationContracts'
import {
  bindCombatChromeAssetGate,
  mountCombatChromeRoot,
  type CombatChromeAssetGateTarget,
} from './CombatChromeAssetGate'

function makeSnapshot(overrides: Partial<CoordinatorSnapshot> = {}): CoordinatorSnapshot {
  return {
    currentRoute: 'home',
    renderRoute: null,
    targetRoute: null,
    currentSession: null,
    targetSession: null,
    phase: 'idle',
    transitionId: 0,
    bootSubphase: null,
    error: null,
    ...overrides,
  }
}

describe('CombatChromeAssetGate', () => {
  let unmountRoot: (() => void) | undefined
  let unbindGate: (() => void) | undefined

  afterEach(() => {
    unmountRoot?.()
    unmountRoot = undefined
    unbindGate?.()
    unbindGate = undefined
    vi.restoreAllMocks()
  })

  it('arms ui-assets on mount, decodes chrome images and battle skill icons, then resumes', async () => {
    let heldTruth: (() => boolean) | undefined
    const unregister = vi.fn()
    const freezeCombat = vi.fn()
    const resumeCombat = vi.fn()

    const target: CombatChromeAssetGateTarget = {
      registerFreezeLatchTruth: vi.fn((reason, isHeld) => {
        expect(reason).toBe('ui-assets')
        heldTruth = isHeld
        return unregister
      }),
      freezeCombat,
      resumeCombat,
      getTurnBattle: () => ({
        players: [
          {
            basic: { id: 'basic_strike' },
            special: { skill: { id: 'flame_palms' } },
            ultimate: null,
          },
        ],
      }),
    }

    const listeners = new Set<(snapshot: CoordinatorSnapshot) => void>()
    unbindGate = bindCombatChromeAssetGate(
      {
        subscribe: (fn) => {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
      },
      target,
    )

    expect(heldTruth?.()).toBe(false)

    const root = document.createElement('div')
    const img = document.createElement('img')
    img.src = 'http://localhost/test-chrome.png'
    root.appendChild(img)

    unmountRoot = mountCombatChromeRoot(root)
    expect(heldTruth?.()).toBe(true)
    expect(freezeCombat).toHaveBeenCalledWith('ui-assets')

    // Flush nextTick + Promise.allSettled + fonts.ready
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(heldTruth?.()).toBe(false)
    expect(resumeCombat).toHaveBeenCalledWith('ui-assets')
  })

  it('releases ui-assets immediately on unmount and re-arms on combat session rebind', async () => {
    let heldTruth: (() => boolean) | undefined
    const freezeCombat = vi.fn()
    const resumeCombat = vi.fn()

    const target: CombatChromeAssetGateTarget = {
      registerFreezeLatchTruth: (_reason, isHeld) => {
        heldTruth = isHeld
        return () => {}
      },
      freezeCombat,
      resumeCombat,
      getTurnBattle: () => null,
    }

    let notify: ((snapshot: CoordinatorSnapshot) => void) | undefined
    unbindGate = bindCombatChromeAssetGate(
      {
        subscribe: (fn) => {
          notify = fn
          return () => {
            notify = undefined
          }
        },
      },
      target,
    )

    const root = document.createElement('div')
    unmountRoot = mountCombatChromeRoot(root)
    expect(heldTruth?.()).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(heldTruth?.()).toBe(false)

    // Session rebind (e.g. combat refight while overlay stays mounted)
    notify?.(
      makeSnapshot({
        currentRoute: 'combat',
        renderRoute: 'combat',
        targetSession: { kind: 'combat', sessionId: 42 },
      }),
    )
    expect(heldTruth?.()).toBe(true)
    expect(freezeCombat).toHaveBeenCalledTimes(2)

    // Unmount before decode settles releases immediately
    unmountRoot()
    unmountRoot = undefined
    expect(heldTruth?.()).toBe(false)
    expect(resumeCombat).toHaveBeenCalledWith('ui-assets')
  })
})
