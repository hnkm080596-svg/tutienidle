// @vitest-environment jsdom
//
// ARCH-013/L04 — the bridge subscriptions are owned resources: every
// ipcRenderer.on must be removable through the returned disposer, or an
// App unmount/remount (HMR) stacks a second quit-flush save handler.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { GameManager } from '../core/game/GameManager'
import { useElectronBridge, type ElectronBridgeAPI } from './useElectronBridge'

function makeApi() {
  // Each subscription gets its own remover, like the real preload.
  const removers = {
    flush: [] as Array<ReturnType<typeof vi.fn>>,
    suspend: [] as Array<ReturnType<typeof vi.fn>>,
    resume: [] as Array<ReturnType<typeof vi.fn>>,
  }

  const api: ElectronBridgeAPI = {
    isElectron: true,
    onBeforeQuitFlush: vi.fn(() => {
      const remover = vi.fn()
      removers.flush.push(remover)
      return remover
    }),
    onSystemSuspend: vi.fn(() => {
      const remover = vi.fn()
      removers.suspend.push(remover)
      return remover
    }),
    onSystemResume: vi.fn(() => {
      const remover = vi.fn()
      removers.resume.push(remover)
      return remover
    }),
    notifyFlushComplete: vi.fn(),
    combatClock: {
      onTick: vi.fn(() => vi.fn()),
      stop: vi.fn(),
    },
  }

  return { api, removers }
}

const fakeGameManager = {} as GameManager

describe('useElectronBridge — subscription disposal (ARCH-013/L04)', () => {
  afterEach(() => {
    delete window.electronAPI
  })

  it('returns undefined when no electronAPI exists (plain web build)', () => {
    setActivePinia(createPinia())
    expect(useElectronBridge(fakeGameManager)).toBeUndefined()
  })

  it('returns a disposer that removes every subscription it registered', () => {
    setActivePinia(createPinia())
    const { api, removers } = makeApi()
    window.electronAPI = api

    const dispose = useElectronBridge(fakeGameManager)

    expect(api.onBeforeQuitFlush).toHaveBeenCalledTimes(1)
    expect(api.onSystemSuspend).toHaveBeenCalledTimes(1)
    expect(api.onSystemResume).toHaveBeenCalledTimes(1)

    dispose?.()

    expect(removers.flush[0]).toHaveBeenCalledTimes(1)
    expect(removers.suspend[0]).toHaveBeenCalledTimes(1)
    expect(removers.resume[0]).toHaveBeenCalledTimes(1)
  })

  it('dispose then re-subscribe does not stack handlers (remount safety)', () => {
    setActivePinia(createPinia())
    const { api, removers } = makeApi()
    window.electronAPI = api

    const first = useElectronBridge(fakeGameManager)
    first?.()

    const second = useElectronBridge(fakeGameManager)
    second?.()

    // Two registrations happened, and each generation's own remover ran —
    // a quit flush cannot reach a dead handler and double-save.
    expect(api.onBeforeQuitFlush).toHaveBeenCalledTimes(2)
    expect(removers.flush).toHaveLength(2)
    expect(removers.flush[0]).toHaveBeenCalledTimes(1)
    expect(removers.flush[1]).toHaveBeenCalledTimes(1)
  })
})
