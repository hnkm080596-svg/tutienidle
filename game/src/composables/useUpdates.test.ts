// @vitest-environment jsdom
//
// BETA-FINAL PR12 / spec B6 - the renderer half of the update contract:
// the composable consumes only the sanitized UpdateState and the
// install handshake; install admission pauses the SIMULATION (not the
// authority), drains the one flush, and a failed install resumes play
// and waits for an explicit retry/later - never an implicit install.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { GameManager } from '../core/game/GameManager'
import type { ElectronBridgeAPI } from './useElectronBridge'
import type { UpdateInstallFailedNotice } from '../shared/update/UpdateState'
import { bindUpdateSurface, unbindUpdateSurface, useUpdates } from './useUpdates'
import { usePlayerStore } from '../stores/player'

const fakeGameManager = {} as GameManager

interface Captured {
  stateCb: ((state: unknown) => void) | null
  prepareCb: ((request: { requestId: string }) => void) | null
  failedCb: ((notice: UpdateInstallFailedNotice) => void) | null
}

function makeApi() {
  const captured: Captured = { stateCb: null, prepareCb: null, failedCb: null }
  const removers: Array<ReturnType<typeof vi.fn>> = []

  const api: ElectronBridgeAPI = {
    isElectron: true,
    onSystemSuspend: vi.fn(() => vi.fn()),
    onSystemResume: vi.fn(() => vi.fn()),
    onBeforeQuitFlush: vi.fn(() => vi.fn()),
    notifyFlushResult: vi.fn(),
    onFlushFailed: vi.fn(() => vi.fn()),
    retryQuitFlush: vi.fn(),
    cancelQuitClose: vi.fn(),
    forceQuitClose: vi.fn(),
    reportDiagnosticEvent: vi.fn(),
    getDiagnosticReportId: vi.fn(() => Promise.resolve('rid')),
    exportDiagnostics: vi.fn(() => Promise.resolve({ status: 'cancelled' as const })),
    getUpdateState: vi.fn(() => Promise.resolve(null)),
    onUpdateState: vi.fn((cb: (state: unknown) => void) => {
      captured.stateCb = cb
      const remover = vi.fn()
      removers.push(remover)
      return remover
    }),
    checkForUpdate: vi.fn(),
    downloadUpdate: vi.fn(),
    cancelUpdateDownload: vi.fn(),
    requestUpdateInstall: vi.fn(),
    onUpdatePrepareInstall: vi.fn((cb: (request: { requestId: string }) => void) => {
      captured.prepareCb = cb
      const remover = vi.fn()
      removers.push(remover)
      return remover
    }),
    notifyUpdateInstallResult: vi.fn(),
    onUpdateInstallFailed: vi.fn((cb: (notice: UpdateInstallFailedNotice) => void) => {
      captured.failedCb = cb
      const remover = vi.fn()
      removers.push(remover)
      return remover
    }),
    combatClock: { onTick: vi.fn(() => vi.fn()), stop: vi.fn() },
  }
  return { api, captured, removers }
}

const STATE = {
  downloaded: {
    phase: 'downloaded',
    currentVersion: '0.1.0-beta.0',
    currentBuildId: 'b1',
    candidate: { version: '0.2.0-beta.0', channel: 'beta' },
  },
  available: {
    phase: 'available',
    currentVersion: '0.1.0-beta.0',
    currentBuildId: 'b1',
    candidate: { version: '0.2.0-beta.0', channel: 'beta' },
  },
}

describe('useUpdates', () => {
  afterEach(() => {
    delete window.electronAPI
    unbindUpdateSurface(boundForTests ?? null)
    boundForTests = null
  })

  let boundForTests: ReturnType<typeof useUpdates> | null = null
  function create(deps: Parameters<typeof useUpdates>[0]) {
    boundForTests = bindUpdateSurface(useUpdates(deps, fakeGameManager))
    return boundForTests
  }

  it('returns undefined on a plain web build (no electronAPI)', () => {
    setActivePinia(createPinia())
    expect(useUpdates({}, fakeGameManager)).toBeUndefined()
  })

  it('renders only parsed state pushes; a malformed push is dropped whole', async () => {
    setActivePinia(createPinia())
    const { api, captured } = makeApi()
    window.electronAPI = api
    const updates = create({})!

    expect(updates.state.value).toBeNull()
    captured.stateCb!('not-a-state')
    expect(updates.state.value).toBeNull()
    captured.stateCb!(STATE.available)
    expect(updates.state.value?.phase).toBe('available')
    expect(updates.candidateVersion.value).toBe('0.2.0-beta.0')
    expect(api.checkForUpdate).not.toHaveBeenCalled()
  })

  it('check/download/cancel send the allowlisted channels only', async () => {
    setActivePinia(createPinia())
    const { api, captured } = makeApi()
    window.electronAPI = api
    const updates = create({})!

    updates.check()
    expect(api.checkForUpdate).toHaveBeenCalledTimes(1)

    captured.stateCb!(STATE.available)
    updates.download()
    expect(api.downloadUpdate).toHaveBeenCalledTimes(1)

    captured.stateCb!({ ...STATE.downloaded, phase: 'downloading', progress: { percent: 10, bytesPerSecond: 1, transferred: 1, total: 10 } })
    updates.cancelDownload()
    expect(api.cancelUpdateDownload).toHaveBeenCalledTimes(1)
  })

  it('install is gated on phase downloaded and quotes the authority generation', () => {
    setActivePinia(createPinia())
    const { api, captured } = makeApi()
    window.electronAPI = api
    const generation = vi.fn(() => 7)
    const updates = create({ generation })!

    captured.stateCb!(STATE.available)
    updates.install()
    expect(api.requestUpdateInstall).not.toHaveBeenCalled()

    captured.stateCb!(STATE.downloaded)
    updates.install()
    expect(api.requestUpdateInstall).toHaveBeenCalledWith(7)
  })

  it('prepare-install pauses the SIMULATION then drains the flush and replies bound', async () => {
    setActivePinia(createPinia())
    const { api, captured } = makeApi()
    window.electronAPI = api
    const order: string[] = []
    const pause = vi.fn(() => { order.push('pause') })
    const flush = vi.fn(async (requestId: string) => {
      order.push('flush')
      return { status: 'saved' as const, requestId, generation: 7, revision: 12 }
    })
    const updates = create({ pauseAdmission: pause, flush, generation: () => 7 })!
    captured.stateCb!(STATE.downloaded)

    captured.prepareCb!({ requestId: 'upd-1' })
    await vi.waitFor(() =>
      expect(api.notifyUpdateInstallResult).toHaveBeenCalledWith({
        status: 'saved', requestId: 'upd-1', generation: 7, revision: 12,
      }),
    )
    expect(order).toEqual(['pause', 'flush'])
  })

  it('install-failed resumes admission and surfaces the notice; later clears it, retry re-requests', async () => {
    setActivePinia(createPinia())
    const { api, captured } = makeApi()
    window.electronAPI = api
    const resume = vi.fn()
    const updates = create({ resumeAdmission: resume, generation: () => 8 })!
    captured.stateCb!(STATE.downloaded)

    captured.failedCb!({ requestId: 'upd-1', status: 'failed', code: 'FLUSH_FAILED' })
    expect(resume).toHaveBeenCalledTimes(1)
    expect(updates.installFailed.value).toEqual({ requestId: 'upd-1', status: 'failed', code: 'FLUSH_FAILED' })

    updates.later()
    expect(updates.installFailed.value).toBeNull()

    captured.failedCb!({ requestId: 'upd-2', status: 'timeout', code: 'INSTALL_TIMEOUT' })
    updates.retryInstall()
    expect(api.requestUpdateInstall).toHaveBeenCalledWith(8)
    expect(updates.installFailed.value).toBeNull()
  })

  it('falls back to the local save when no authority flush is bound', async () => {
    setActivePinia(createPinia())
    const { api, captured } = makeApi()
    window.electronAPI = api
    vi.spyOn(usePlayerStore(), 'save').mockResolvedValue({ status: 'ok', revision: 5 })
    create({ generation: () => 3 })

    captured.prepareCb!({ requestId: 'upd-9' })
    await vi.waitFor(() =>
      expect(api.notifyUpdateInstallResult).toHaveBeenCalledWith({
        status: 'saved', requestId: 'upd-9', generation: 3, revision: 5,
      }),
    )
  })

  it('check/download failures never touch admission (no pause, no flush)', async () => {
    setActivePinia(createPinia())
    const { api, captured } = makeApi()
    window.electronAPI = api
    const pause = vi.fn()
    const flush = vi.fn()
    create({ pauseAdmission: pause, flush })!

    captured.stateCb!({ phase: 'error', currentVersion: '0.1.0-beta.0', currentBuildId: 'b1', error: { code: 'CHECK_FAILED', message: 'x', retryable: true } })
    expect(pause).not.toHaveBeenCalled()
    expect(flush).not.toHaveBeenCalled()
  })

  it('dispose unsubscribes every renderer-side handler', () => {
    setActivePinia(createPinia())
    const { api, removers } = makeApi()
    window.electronAPI = api
    const updates = create({})!
    updates.dispose()
    for (const remover of removers) expect(remover).toHaveBeenCalledTimes(1)
    // Post-dispose actions are inert.
    updates.check()
    expect(api.checkForUpdate).not.toHaveBeenCalled()
  })
})
