// @vitest-environment jsdom
//
// ARCH-013/L04 — the bridge subscriptions are owned resources: every
// ipcRenderer.on must be removable through the returned disposer, or an
// App unmount/remount (HMR) stacks a second quit-flush save handler.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { GameManager } from '../core/game/GameManager'
import { useElectronBridge, type ElectronBridgeAPI } from './useElectronBridge'
import { usePlayerStore } from '../stores/player'
import { useNotificationStore } from '../stores/notification'

function makeApi() {
  // Each subscription gets its own remover, like the real preload.
  const removers = {
    flush: [] as Array<ReturnType<typeof vi.fn>>,
    suspend: [] as Array<ReturnType<typeof vi.fn>>,
    resume: [] as Array<ReturnType<typeof vi.fn>>,
  }

  const onBeforeQuitFlush = vi.fn<(callback: () => void) => () => void>(() => {
    const remover = vi.fn()
    removers.flush.push(remover)
    return remover
  })

  const api: ElectronBridgeAPI = {
    isElectron: true,
    onBeforeQuitFlush,
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

  return { api, removers, onBeforeQuitFlush }
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

describe('useElectronBridge — quit-flush save result (audit T1-2)', () => {
  afterEach(() => {
    delete window.electronAPI
  })

  it('flush save resolves non-ok → still notifies main (2s backstop must not hang the app) BUT logs + surfaces the failure', async () => {
    setActivePinia(createPinia())
    const { api, onBeforeQuitFlush } = makeApi()
    window.electronAPI = api

    const playerStore = usePlayerStore()
    const saveSpy = vi.spyOn(playerStore, 'save').mockResolvedValue({
      status: 'unavailable',
      message: 'quota full',
      retryable: false,
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    useElectronBridge(fakeGameManager)
    const flushCallback = onBeforeQuitFlush.mock.calls[0]![0]
    flushCallback()

    // notifyFlushComplete must still fire — a failed save never blocks the close.
    await vi.waitFor(() => expect(api.notifyFlushComplete).toHaveBeenCalledTimes(1))
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      '[electron] quit flush save failed',
      expect.objectContaining({ status: 'unavailable' }),
    )
    expect(useNotificationStore().toasts.some((toast) => toast.kind === 'error')).toBe(true)

    errorSpy.mockRestore()
  })

  it('flush save resolves ok → notify, no error log, no error toast', async () => {
    setActivePinia(createPinia())
    const { api, onBeforeQuitFlush } = makeApi()
    window.electronAPI = api

    vi.spyOn(usePlayerStore(), 'save').mockResolvedValue({ status: 'ok', revision: 1 })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    useElectronBridge(fakeGameManager)
    onBeforeQuitFlush.mock.calls[0]![0]()

    await vi.waitFor(() => expect(api.notifyFlushComplete).toHaveBeenCalledTimes(1))
    expect(errorSpy).not.toHaveBeenCalled()
    expect(useNotificationStore().toasts).toHaveLength(0)

    errorSpy.mockRestore()
  })
})
