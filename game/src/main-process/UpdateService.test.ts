// BETA-FINAL PR12 / spec B6 - the update state machine proven in-process:
// check/download/install transitions, the full rejection taxonomy (older
// version, wrong channel/environment, wrong publisher, corrupt, invalid
// manifest), and the install-admission gate (requestId + generation +
// sender + FlushResult binding - a failed or stale flush can NEVER reach
// quitAndInstall, and recovery choices never turn failure into success).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpdateService, verifyCandidate, type ProviderCheckResult, type ProviderDownloadResult, type UpdateProvider } from './UpdateService'
import { EXPECTED_UPDATE_FEED, type UpdateState } from '../shared/update/UpdateState'
import type { BuildIdentity } from '../shared/build/BuildIdentity'

const VALID_FEED = [
  'provider: github',
  'owner: hnkm080596-svg',
  'repo: tutienidle',
  'channel: beta',
].join('\n')

const BETA_IDENTITY: BuildIdentity = {
  productName: 'Tien Hiep Idle',
  appVersion: '0.1.0-beta.0',
  buildId: 'beta-build-1',
  gitSha: 'a'.repeat(40),
  saveSchemaVersion: 87,
  backendEnvironment: 'beta',
  releaseChannel: 'beta',
  builtAtUtc: '2026-09-29T00:00:00Z',
}

const NEXT_CANDIDATE = {
  version: '0.2.0-beta.0',
  files: [{ url: 'Tien-Hiep-Idle-0.2.0-beta.0-setup.exe', sha512: 'abc=' }],
  releaseName: 'Beta 0.2.0',
  releaseNotes: 'Fixes and upgrades',
  releaseDate: '2026-09-30',
}

interface ScriptedProvider extends UpdateProvider {
  checkResult: ProviderCheckResult
  downloadResult: ProviderDownloadResult
  /** Optional override bodies - used to hold a call open while the test
   *  drives cancellation mid-flight. */
  checkImpl?: () => Promise<ProviderCheckResult>
  downloadImpl?: () => Promise<ProviderDownloadResult>
  emitProgress: (percent: number) => void
  quitCalls: number
  cancelCalls: number
  checkCalls: number
  downloadCalls: number
}

function makeProvider(overrides: Partial<ScriptedProvider> = {}): ScriptedProvider {
  const progress = new Set<(p: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void>()
  const provider: ScriptedProvider = {
    checkResult: { status: 'none' },
    downloadResult: { status: 'downloaded' },
    quitCalls: 0,
    cancelCalls: 0,
    checkCalls: 0,
    downloadCalls: 0,
    emitProgress(percent: number) {
      for (const l of progress) l({ percent, bytesPerSecond: 1, transferred: percent, total: 100 })
    },
    async check() {
      provider.checkCalls += 1
      return provider.checkImpl ? provider.checkImpl() : provider.checkResult
    },
    async download() {
      provider.downloadCalls += 1
      return provider.downloadImpl ? provider.downloadImpl() : provider.downloadResult
    },
    cancelDownload() {
      provider.cancelCalls += 1
    },
    quitAndInstall() {
      provider.quitCalls += 1
    },
    onProgress(l) {
      progress.add(l)
      return () => progress.delete(l)
    },
    ...overrides,
  }
  return provider
}

function makeFixture(overrides: {
  feedText?: string | null
  identity?: BuildIdentity
  provider?: ScriptedProvider
  record?: (input: unknown) => void
} = {}) {
  const handlers = new Map<string, (event: unknown, payload: unknown) => void>()
  const invokes = new Map<string, (event: unknown) => unknown>()
  const ipcMain = {
    on: vi.fn((channel: string, listener: (event: unknown, payload: unknown) => void) => {
      handlers.set(channel, listener)
    }),
    handle: vi.fn((channel: string, listener: (event: unknown) => unknown) => {
      invokes.set(channel, listener)
    }),
    removeListener: vi.fn(),
    removeHandler: vi.fn(),
  }
  const webContents = { id: 1 }
  const send = vi.fn()
  const records: Array<Record<string, unknown>> = []
  let minted = 0
  const approved = vi.fn()
  const provider = overrides.provider ?? makeProvider()

  const service = new UpdateService({
    provider,
    ipcMain,
    send,
    senderIsTrusted: (sender) => sender === webContents,
    identity: overrides.identity ?? BETA_IDENTITY,
    expectedFeed: EXPECTED_UPDATE_FEED,
    readFeedText: () => (overrides.feedText === undefined ? VALID_FEED : overrides.feedText),
    record: overrides.record ?? ((input) => records.push(input as Record<string, unknown>)),
    onInstallApproved: approved,
    requestIdFactory: () => `upd-${++minted}`,
    installTimeoutMs: 10_000,
  })

  const emit = (channel: string, payload: unknown, sender: unknown = webContents) =>
    handlers.get(channel)!({ sender }, payload)

  const statePushes = () =>
    send.mock.calls.filter(([ch]) => ch === 'update:state').map(([, p]) => p as UpdateState)

  const driveToDownloaded = async () => {
    provider.checkResult = { status: 'available', info: NEXT_CANDIDATE }
    await service.check()
    await service.download()
  }

  return { service, provider, ipcMain, handlers, invokes, webContents, send, records, emit, statePushes, driveToDownloaded, approved }
}

describe('UpdateService - feed verification and check', () => {
  afterEach(() => vi.useRealTimers())

  it('parks at unsupported when no packaged manifest exists (dev build)', async () => {
    const { service, provider, records } = makeFixture({ feedText: null })
    expect(service.currentState.phase).toBe('unsupported')
    await service.check()
    expect(provider.checkCalls).toBe(0)
    expect(records.some((r) => r.code === 'FEED_CONFIG_INVALID')).toBe(true)
  })

  it('parks at unsupported on a mismatched feed (wrong publisher)', async () => {
    const { service, provider, records } = makeFixture({
      feedText: 'provider: github\nowner: hnkm080596-svg\nrepo: tutienidle\nchannel: beta\npublisherName: Evil Corp',
    })
    expect(service.currentState.phase).toBe('unsupported')
    await service.check()
    expect(provider.checkCalls).toBe(0)
    expect(records.some((r) => r.code === 'PUBLISHER_MISMATCH')).toBe(true)
  })

  it('no-update -> unavailable, no candidate', async () => {
    const { service, send, statePushes } = makeFixture()
    await service.check()
    expect(service.currentState.phase).toBe('unavailable')
    expect(statePushes().at(-1)).toMatchObject({ phase: 'unavailable' })
    expect(send).toHaveBeenCalled()
  })

  it('check error -> retryable error, stays independent of gameplay', async () => {
    const { service, provider, statePushes } = makeFixture()
    provider.checkResult = { status: 'error', code: 'CHECK_FAILED', message: 'network down', retryable: true }
    await service.check()
    expect(service.currentState.phase).toBe('error')
    expect(service.currentState.error).toMatchObject({ code: 'CHECK_FAILED', retryable: true })
    // Check failures never touch the install/admission channels.
    expect(statePushes().every((s) => s.phase !== 'installing')).toBe(true)
  })

  it('a thrown provider rejection is still a classified CHECK_FAILED', async () => {
    const { service, provider } = makeFixture()
    provider.check = async () => { throw new Error('socket hangup') }
    await service.check()
    expect(service.currentState.phase).toBe('error')
    expect(service.currentState.error?.code).toBe('CHECK_FAILED')
  })

  it('available -> verified candidate with metadata', async () => {
    const { service, provider } = makeFixture()
    provider.checkResult = { status: 'available', info: NEXT_CANDIDATE }
    await service.check()
    expect(service.currentState.phase).toBe('available')
    expect(service.currentState.candidate).toMatchObject({
      version: '0.2.0-beta.0',
      channel: 'beta',
      releaseName: 'Beta 0.2.0',
    })
  })

  it('rejects an older-or-equal version', async () => {
    const { service, provider } = makeFixture()
    provider.checkResult = { status: 'available', info: { ...NEXT_CANDIDATE, version: '0.1.0-beta.0' } }
    await service.check()
    expect(service.currentState.phase).toBe('error')
    expect(service.currentState.error?.code).toBe('OLDER_VERSION')
    expect(service.currentState.error?.retryable).toBe(false)
  })

  it('rejects a stable candidate on a beta build (wrong environment)', async () => {
    const { service, provider } = makeFixture()
    provider.checkResult = { status: 'available', info: { ...NEXT_CANDIDATE, version: '0.2.0' } }
    await service.check()
    expect(service.currentState.error?.code).toBe('WRONG_ENVIRONMENT')
  })

  it('rejects a candidate on a different channel tag', async () => {
    const { service, provider } = makeFixture()
    provider.checkResult = { status: 'available', info: { ...NEXT_CANDIDATE, version: '0.2.0-alpha.1' } }
    await service.check()
    expect(service.currentState.error?.code).toBe('WRONG_ENVIRONMENT')
  })

  it('rejects a manifest without sha512 for every file', async () => {
    const { service, provider } = makeFixture()
    provider.checkResult = { status: 'available', info: { ...NEXT_CANDIDATE, files: [{ url: 'x.exe' }] } }
    await service.check()
    expect(service.currentState.error?.code).toBe('MANIFEST_INVALID')
  })

  it('rejects an unparseable version', async () => {
    const { service, provider } = makeFixture()
    provider.checkResult = { status: 'available', info: { ...NEXT_CANDIDATE, version: 'latest' } }
    await service.check()
    expect(service.currentState.error?.code).toBe('MANIFEST_INVALID')
  })

  it('a concurrent check does not double-call the provider', async () => {
    const { service, provider } = makeFixture()
    provider.check = async () => { provider.checkCalls += 1; await new Promise((r) => setTimeout(r, 5)); return { status: 'none' } }
    const a = service.check()
    const b = service.check()
    await Promise.all([a, b])
    expect(provider.checkCalls).toBe(1)
  })
})

describe('UpdateService - download lifecycle', () => {
  afterEach(() => vi.useRealTimers())

  it('download -> progress pushes -> downloaded', async () => {
    const { service, provider, statePushes } = makeFixture()
    provider.checkResult = { status: 'available', info: NEXT_CANDIDATE }
    await service.check()
    const pending = service.download()
    provider.emitProgress(42)
    provider.emitProgress(99)
    await pending
    expect(service.currentState.phase).toBe('downloaded')
    const progressStates = statePushes().filter((s) => s.phase === 'downloading')
    expect(progressStates.some((s) => s.progress?.percent === 42)).toBe(true)
    expect(progressStates.at(-1)?.progress?.percent).toBe(99)
  })

  it('download failure -> retryable error, candidate retained (interrupted transport)', async () => {
    const { service, provider } = makeFixture()
    provider.checkResult = { status: 'available', info: NEXT_CANDIDATE }
    await service.check()
    provider.downloadResult = { status: 'error', code: 'DOWNLOAD_FAILED', message: 'connection reset', retryable: true }
    await service.download()
    expect(service.currentState.phase).toBe('error')
    expect(service.currentState.error?.code).toBe('DOWNLOAD_FAILED')
    // The candidate is kept - an explicit retry resumes the download.
    expect(service.currentState.candidate?.version).toBe('0.2.0-beta.0')
    provider.downloadResult = { status: 'downloaded' }
    await service.download()
    expect(service.currentState.phase).toBe('downloaded')
  })

  it('corrupt candidate (sha512 mismatch) -> CANDIDATE_CORRUPT, candidate kept for retry', async () => {
    const { service, provider } = makeFixture()
    provider.checkResult = { status: 'available', info: NEXT_CANDIDATE }
    await service.check()
    provider.downloadResult = { status: 'error', code: 'CANDIDATE_CORRUPT', message: 'sha512 checksum mismatch', retryable: true }
    await service.download()
    expect(service.currentState.error?.code).toBe('CANDIDATE_CORRUPT')
    expect(service.currentState.candidate).toBeDefined()
  })

  it('cancel returns to available without an error surface', async () => {
    const { service, provider, handlers, webContents } = makeFixture()
    provider.checkResult = { status: 'available', info: NEXT_CANDIDATE }
    await service.check()
    // Hold the provider download open so the cancel lands mid-flight.
    let resolveDownload!: (r: ProviderDownloadResult) => void
    provider.downloadImpl = () => new Promise((r) => { resolveDownload = r })
    const pending = service.download()
    handlers.get('update:cancel-download')!({ sender: webContents }, undefined)
    resolveDownload({ status: 'error', code: 'DOWNLOAD_CANCELLED', message: 'cancelled', retryable: true })
    await pending
    expect(provider.cancelCalls).toBe(1)
    expect(service.currentState.phase).toBe('available')
    expect(service.currentState.error).toBeUndefined()
  })

  it('download without a candidate is a no-op', async () => {
    const { service, provider } = makeFixture()
    await service.download()
    expect(provider.downloadCalls).toBe(0)
  })
})

describe('UpdateService - install admission', () => {
  afterEach(() => vi.useRealTimers())

  it('install requires phase downloaded; anything else is ignored', async () => {
    const { service, emit, provider } = makeFixture()
    emit('update:install-request', { generation: 4 })
    expect(provider.quitCalls).toBe(0)
    expect(service.currentState.phase).not.toBe('installing')
  })

  it('saved FlushResult bound to requestId + generation installs exactly once', async () => {
    const { service, emit, send, provider, driveToDownloaded, approved } = makeFixture()
    await driveToDownloaded()

    emit('update:install-request', { generation: 4 })
    expect(service.currentState.phase).toBe('installing')
    expect(send).toHaveBeenLastCalledWith('update:prepare-install', { requestId: 'upd-1' })

    emit('update:install-result', { status: 'saved', requestId: 'upd-1', generation: 4, revision: 12 })
    expect(provider.quitCalls).toBe(1)
    expect(approved).toHaveBeenCalledTimes(1)
  })

  it('a failed flush never installs - candidate stays downloaded, install-failed notice sent', async () => {
    const { service, emit, send, provider, driveToDownloaded } = makeFixture()
    await driveToDownloaded()
    emit('update:install-request', { generation: 4 })

    const installCallsForFailedFlush = provider.quitCalls
    emit('update:install-result', { status: 'failed', requestId: 'upd-1', generation: 4, code: 'FLUSH_FAILED' })

    expect(installCallsForFailedFlush).toBe(0)
    expect(provider.quitCalls).toBe(0)
    expect(service.currentState.phase).toBe('downloaded')
    expect(service.currentState.candidate?.version).toBe('0.2.0-beta.0')
    expect(send).toHaveBeenLastCalledWith('update:install-failed', {
      requestId: 'upd-1',
      status: 'failed',
      code: 'FLUSH_FAILED',
    })
  })

  it('a stale generation refuses install (STALE_GENERATION)', async () => {
    const { service, emit, provider, driveToDownloaded } = makeFixture()
    await driveToDownloaded()
    emit('update:install-request', { generation: 4 })

    const installCallsForStaleGeneration = provider.quitCalls
    // The flush drained under a NEWER generation than the one quoted at
    // request time - admission was invalidated mid-drain; never install.
    emit('update:install-result', { status: 'saved', requestId: 'upd-1', generation: 5, revision: 9 })

    expect(installCallsForStaleGeneration).toBe(0)
    expect(provider.quitCalls).toBe(0)
    expect(service.currentState.phase).toBe('downloaded')
  })

  it('a flush reply with status blocked refuses install', async () => {
    const { service, emit, send, provider, driveToDownloaded } = makeFixture()
    await driveToDownloaded()
    emit('update:install-request', { generation: 4 })
    emit('update:install-result', { status: 'blocked', requestId: 'upd-1', generation: 4, code: 'AUTHORITY_TERMINAL' })
    expect(provider.quitCalls).toBe(0)
    expect(send).toHaveBeenLastCalledWith('update:install-failed', {
      requestId: 'upd-1',
      status: 'blocked',
      code: 'AUTHORITY_TERMINAL',
    })
  })

  it('retry mints a NEW requestId and a saved retry installs', async () => {
    const { service, emit, send, provider, driveToDownloaded } = makeFixture()
    await driveToDownloaded()
    emit('update:install-request', { generation: 4 })
    emit('update:install-result', { status: 'failed', requestId: 'upd-1', generation: 4, code: 'FLUSH_FAILED' })
    expect(provider.quitCalls).toBe(0)

    emit('update:install-request', { generation: 4 })
    expect(send).toHaveBeenLastCalledWith('update:prepare-install', { requestId: 'upd-2' })
    emit('update:install-result', { status: 'saved', requestId: 'upd-2', generation: 4, revision: 9 })
    expect(provider.quitCalls).toBe(1)
  })

  it('a forged sender cannot satisfy the pending install', async () => {
    const { service, emit, provider, driveToDownloaded } = makeFixture()
    await driveToDownloaded()
    emit('update:install-request', { generation: 4 })
    emit('update:install-result', { status: 'saved', requestId: 'upd-1', generation: 4, revision: 9 }, { foreign: true })
    expect(provider.quitCalls).toBe(0)
    expect(service.currentState.phase).toBe('installing')
  })

  it('a stale requestId is ignored', async () => {
    const { emit, provider, driveToDownloaded } = makeFixture()
    await driveToDownloaded()
    emit('update:install-request', { generation: 4 })
    emit('update:install-result', { status: 'saved', requestId: 'upd-99', generation: 4, revision: 9 })
    expect(provider.quitCalls).toBe(0)
  })

  it('a malformed result is ignored - the pending install stays armed', async () => {
    const { service, emit, provider, driveToDownloaded } = makeFixture()
    await driveToDownloaded()
    emit('update:install-request', { generation: 4 })
    emit('update:install-result', { status: 'saved', requestId: 'upd-1' })
    emit('update:install-result', 'garbage')
    expect(provider.quitCalls).toBe(0)
    expect(service.currentState.phase).toBe('installing')
  })

  it('install timeout never installs - notice + candidate parked', async () => {
    vi.useFakeTimers()
    const { service, emit, send, provider, driveToDownloaded } = makeFixture()
    await driveToDownloaded()
    emit('update:install-request', { generation: 4 })
    vi.advanceTimersByTime(10_001)
    expect(provider.quitCalls).toBe(0)
    expect(service.currentState.phase).toBe('downloaded')
    expect(send).toHaveBeenLastCalledWith('update:install-failed', {
      requestId: 'upd-1',
      status: 'timeout',
      code: 'INSTALL_TIMEOUT',
    })
    vi.useRealTimers()
  })

  it('an install request without a generation is ignored', async () => {
    const { service, emit, send, driveToDownloaded } = makeFixture()
    await driveToDownloaded()
    emit('update:install-request', {})
    emit('update:install-request', { generation: 'latest' })
    expect(service.currentState.phase).toBe('downloaded')
    expect(send).not.toHaveBeenCalledWith('update:prepare-install', expect.anything())
  })

  it('an untrusted sender cannot drive check/download/cancel/install', async () => {
    const { service, handlers, provider } = makeFixture()
    const foreign = { foreign: true }
    handlers.get('update:check')!({ sender: foreign }, undefined)
    handlers.get('update:download')!({ sender: foreign }, undefined)
    handlers.get('update:cancel-download')!({ sender: foreign }, undefined)
    handlers.get('update:install-request')!({ sender: foreign }, { generation: 0 })
    await Promise.resolve()
    expect(provider.checkCalls).toBe(0)
    expect(provider.downloadCalls).toBe(0)
    expect(provider.cancelCalls).toBe(0)
    expect(service.currentState.phase).toBe('idle')
  })

  it('get-state replies with the current projection to the trusted sender only', async () => {
    const { service, invokes, provider, webContents } = makeFixture()
    provider.checkResult = { status: 'available', info: NEXT_CANDIDATE }
    await service.check()
    expect(invokes.get('update:get-state')!({ sender: webContents })).toEqual(service.currentState)
    expect(invokes.get('update:get-state')!({ sender: { id: 999 } })).toBeNull()
  })

  it('dispose removes all listeners and cancels the pending install', async () => {
    vi.useFakeTimers()
    const { service, emit, ipcMain, send, provider, driveToDownloaded } = makeFixture()
    await driveToDownloaded()
    emit('update:install-request', { generation: 4 })
    service.dispose()
    vi.advanceTimersByTime(20_000)
    expect(provider.quitCalls).toBe(0)
    expect(ipcMain.removeListener).toHaveBeenCalled()
    expect(ipcMain.removeHandler).toHaveBeenCalledWith('update:get-state')
    expect(send.mock.calls.filter(([ch]) => ch === 'update:install-failed')).toHaveLength(0)
    vi.useRealTimers()
  })
})

describe('verifyCandidate - version integrity', () => {
  it('the accepted candidate carries the exact manifest version (buildId parity seam)', () => {
    const verdict = verifyCandidate(NEXT_CANDIDATE, BETA_IDENTITY, EXPECTED_UPDATE_FEED)
    expect(verdict.status).toBe('ok')
    if (verdict.status === 'ok') {
      // The buildId the app will run after install is the candidate the
      // feed declared - renderer/main never rewrites it.
      expect(verdict.candidate.version).toBe(NEXT_CANDIDATE.version)
    }
  })
})
