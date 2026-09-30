// @vitest-environment jsdom
//
// ARCH-013/L04 - the bridge subscriptions are owned resources: every
// ipcRenderer.on must be removable through the returned disposer, or an
// App unmount/remount (HMR) stacks a second quit-flush save handler.
// B1-D - the flush is result-bearing: the request carries a requestId,
// the reply binds {requestId, status}; a failed save is a 'failed'
// result, never an implicit close.
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
    failed: [] as Array<ReturnType<typeof vi.fn>>,
  }

  const onBeforeQuitFlush = vi.fn<(callback: (requestId: string) => void) => () => void>(() => {
    const remover = vi.fn()
    removers.flush.push(remover)
    return remover
  })

  const onFlushFailed = vi.fn(() => {
    const remover = vi.fn()
    removers.failed.push(remover)
    return remover
  })

  const onSystemSuspend = vi.fn<(callback: (timestamp: number) => void) => () => void>(() => {
    const remover = vi.fn()
    removers.suspend.push(remover)
    return remover
  })

  const onSystemResume = vi.fn<(callback: (timestamp: number) => void) => () => void>(() => {
    const remover = vi.fn()
    removers.resume.push(remover)
    return remover
  })

  const api: ElectronBridgeAPI = {
    isElectron: true,
    onBeforeQuitFlush,
    onSystemSuspend,
    onSystemResume,
    notifyFlushResult: vi.fn(),
    onFlushFailed,
    retryQuitFlush: vi.fn(),
    cancelQuitClose: vi.fn(),
    forceQuitClose: vi.fn(),
    combatClock: {
      onTick: vi.fn(() => vi.fn()),
      stop: vi.fn(),
    },
  }

  return { api, removers, onBeforeQuitFlush, onFlushFailed, onSystemSuspend, onSystemResume }
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

    // Two registrations happened, and each generation's own remover ran -
    // a quit flush cannot reach a dead handler and double-save.
    expect(api.onBeforeQuitFlush).toHaveBeenCalledTimes(2)
    expect(removers.flush).toHaveLength(2)
    expect(removers.flush[0]).toHaveBeenCalledTimes(1)
    expect(removers.flush[1]).toHaveBeenCalledTimes(1)
  })
})

describe('useElectronBridge — result-bearing quit flush (B1-D)', () => {
  afterEach(() => {
    delete window.electronAPI
  })

  it('authority flush resolves saved → request-bound saved result to main', async () => {
    setActivePinia(createPinia())
    const { api, onBeforeQuitFlush } = makeApi()
    window.electronAPI = api

    const flush = vi.fn(async (requestId: string) => ({
      status: 'saved' as const,
      requestId,
      generation: 3,
      revision: 9,
    }))

    useElectronBridge(fakeGameManager, { flush })
    onBeforeQuitFlush.mock.calls[0]![0]('req-1')

    await vi.waitFor(() =>
      expect(api.notifyFlushResult).toHaveBeenCalledWith({
        status: 'saved',
        requestId: 'req-1',
        generation: 3,
        revision: 9,
      }),
    )
  })

  it('no authority flush → local save still binds the result to the request; a failed save is a failed result', async () => {
    setActivePinia(createPinia())
    const { api, onBeforeQuitFlush } = makeApi()
    window.electronAPI = api

    const saveSpy = vi.spyOn(usePlayerStore(), 'save').mockResolvedValue({
      status: 'unavailable',
      message: 'quota full',
      retryable: false,
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    useElectronBridge(fakeGameManager)
    onBeforeQuitFlush.mock.calls[0]![0]('req-7')

    await vi.waitFor(() =>
      expect(api.notifyFlushResult).toHaveBeenCalledWith({
        status: 'failed',
        requestId: 'req-7',
        generation: 0,
        code: 'FLUSH_FAILED',
      }),
    )
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(useNotificationStore().toasts.some((toast) => toast.kind === 'error')).toBe(true)

    errorSpy.mockRestore()
  })

  it('local save resolves ok → saved result, no error log, no error toast', async () => {
    setActivePinia(createPinia())
    const { api, onBeforeQuitFlush } = makeApi()
    window.electronAPI = api

    vi.spyOn(usePlayerStore(), 'save').mockResolvedValue({ status: 'ok', revision: 1 })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    useElectronBridge(fakeGameManager)
    onBeforeQuitFlush.mock.calls[0]![0]('req-3')

    await vi.waitFor(() =>
      expect(api.notifyFlushResult).toHaveBeenCalledWith({
        status: 'saved',
        requestId: 'req-3',
        generation: 0,
        revision: 1,
      }),
    )
    expect(errorSpy).not.toHaveBeenCalled()
    expect(useNotificationStore().toasts).toHaveLength(0)

    errorSpy.mockRestore()
  })

  it('suspend/resume handlers fire through to the authority', () => {
    setActivePinia(createPinia())
    const { api, onSystemSuspend, onSystemResume } = makeApi()
    window.electronAPI = api

    const suspend = vi.fn()
    const resume = vi.fn()
    useElectronBridge(fakeGameManager, { suspend, resume })

    const suspendCb = onSystemSuspend.mock.calls[0]![0]
    const resumeCb = onSystemResume.mock.calls[0]![0]
    suspendCb(1000)
    resumeCb(2000)

    expect(suspend).toHaveBeenCalledTimes(1)
    expect(resume).toHaveBeenCalledTimes(1)
  })
})
