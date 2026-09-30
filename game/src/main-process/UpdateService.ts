// BETA-FINAL PR12 / spec B6 - the main-process update authority.
//
// One service owns the whole update state machine and the allowlisted IPC
// surface. The renderer receives ONLY the sanitized UpdateState projection
// plus four action channels - never a feed URL, a file path, a publisher
// blob or an updater primitive:
//
//   renderer -> main  'update:check' / 'update:download' (no payload)
//   renderer -> main  'update:install-request' { generation }
//   main -> renderer  'update:prepare-install' { requestId }
//   renderer -> main  'update:install-result'  FlushResult
//   main -> renderer  'update:install-failed'  { requestId, status, code }
//   main -> renderer  'update:state'           UpdateState (push)
//   renderer -> main  'update:get-state'       UpdateState (invoke reply)
//
// Install admission (B1.9a applied to updates): an install request mints a
// pending attempt, the renderer pauses admission and drains the ONE save
// queue through OnlineSessionController.flush(requestId), and the reply
// must quote the pending requestId, the generation captured at request
// time, a 'saved' status and the committed remote revision. A forged
// sender, a stale request, a stale generation or any non-saved result can
// never reach quitAndInstall - the verified candidate stays downloaded and
// the user picks an explicit retry/later. Timeout NEVER installs.
//
// Feed trust: no setFeedURL, no repo token - the packaged
// resources/app-update.yml (written by electron-builder from the publish
// block) is verified verbatim against EXPECTED_UPDATE_FEED before any
// check. Development builds have no manifest and are 'unsupported'.

import type { BuildIdentity } from '../shared/build/BuildIdentity'
import type { UpdateInstallFailedNotice, UpdateInstallResult } from '../shared/update/UpdateState'
import {
  compareVersions,
  expectedChannelTag,
  parseUpdateInstallResult,
  parseVersion,
  type UpdateCandidate,
  type UpdateError,
  type UpdateErrorCode,
  type UpdateFeedExpectation,
  type UpdatePhase,
  type UpdateProgress,
  type UpdateState,
} from '../shared/update/UpdateState'
import { parsePackagedFeed, verifyPackagedFeed, type PackagedFeedConfig } from './updateFeed'

// ---------------------------------------------------------------------------
// Provider boundary - the normalized contract the electron-updater adapter
// implements. Keeping it injectable is what makes the state machine and the
// whole failure taxonomy provable in-process.
// ---------------------------------------------------------------------------

export interface ProviderCandidateInfo {
  version: string
  files: ReadonlyArray<{ url?: string; sha512?: string }>
  releaseName?: string
  releaseNotes?: string
  releaseDate?: string
}

export type ProviderCheckResult =
  | { status: 'none' }
  | { status: 'available'; info: ProviderCandidateInfo }
  | {
      status: 'error'
      code: 'CHECK_FAILED' | 'MANIFEST_INVALID'
      message: string
      retryable: boolean
    }

export type ProviderDownloadResult =
  | { status: 'downloaded' }
  | {
      status: 'error'
      code: 'DOWNLOAD_FAILED' | 'CANDIDATE_CORRUPT' | 'DOWNLOAD_CANCELLED'
      message: string
      retryable: boolean
    }

export interface UpdateProvider {
  check(): Promise<ProviderCheckResult>
  download(): Promise<ProviderDownloadResult>
  cancelDownload(): void
  quitAndInstall(): void
  onProgress(listener: (progress: UpdateProgress) => void): () => void
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface UpdateIpcMain {
  on: (channel: string, listener: (event: unknown, payload: unknown) => void) => void
  handle: (channel: string, listener: (event: unknown) => unknown) => void
  removeListener: (channel: string, listener: (...args: unknown[]) => void) => void
  removeHandler?: (channel: string) => void
}

export interface UpdateServiceDeps {
  provider: UpdateProvider
  ipcMain: UpdateIpcMain
  /** Push to the one BrowserWindow (webContents.send). */
  send: (channel: string, payload: unknown) => void
  /** event.sender === the game's own webContents - a forged sender must
   *  never drive check/download/install or satisfy a pending install. */
  senderIsTrusted: (sender: unknown) => boolean
  identity: BuildIdentity
  expectedFeed: UpdateFeedExpectation
  /** Reads the packaged app-update.yml contents; null when unpackaged. */
  readFeedText: () => string | null
  record?: (input: unknown) => void
  /** Fires after a 'saved' install result, immediately before
   *  quitAndInstall: the caller marks the window so the quit-flush
   *  close interceptor does not hold the install's own quit (its flush
   *  already succeeded - a second drain would deadlock the relaunch). */
  onInstallApproved?: () => void
  requestIdFactory?: () => string
  /** Deadline for the install flush roundtrip; timeout never installs. */
  installTimeoutMs?: number
}

export const INSTALL_TIMEOUT_MS = 15_000

interface PendingInstall {
  requestId: string
  expectedGeneration: number
  timeout: ReturnType<typeof setTimeout>
}

export function verifyCandidate(
  info: ProviderCandidateInfo,
  identity: BuildIdentity,
  expectedFeed: UpdateFeedExpectation,
): { status: 'ok'; candidate: UpdateCandidate } | { status: 'rejected'; error: UpdateError } {
  const version = parseVersion(info.version)
  if (version === null) {
    return {
      status: 'rejected',
      error: { code: 'MANIFEST_INVALID', message: `unparseable candidate version`, retryable: false },
    }
  }

  const current = parseVersion(identity.appVersion)
  // A build that cannot parse its own version has no valid update basis.
  if (current === null || compareVersions(version, current) <= 0) {
    return {
      status: 'rejected',
      error: {
        code: 'OLDER_VERSION',
        message: 'candidate is not newer than the running build',
        retryable: false,
      },
    }
  }

  // Environment binding: a beta build only installs beta-tagged
  // candidates - a stable/production-shaped version on this feed is the
  // wrong environment for this binary, not a lucky upgrade.
  const channelTag = expectedChannelTag(identity.releaseChannel)
  if (channelTag === null) {
    return {
      status: 'rejected',
      error: {
        code: 'WRONG_ENVIRONMENT',
        message: 'this build has no update channel',
        retryable: false,
      },
    }
  }
  if (version.prerelease === null || version.prerelease[0] !== channelTag) {
    return {
      status: 'rejected',
      error: {
        code: 'WRONG_ENVIRONMENT',
        message: `candidate ${info.version} is not a ${expectedFeed.channel} build`,
        retryable: false,
      },
    }
  }

  // Integrity manifest: every file must carry a sha512 the downloader can
  // verify; a manifest without checksums is invalid, not "trustable".
  if (!Array.isArray(info.files) || info.files.length === 0) {
    return {
      status: 'rejected',
      error: { code: 'MANIFEST_INVALID', message: 'candidate lists no files', retryable: false },
    }
  }
  for (const file of info.files) {
    if (typeof file.sha512 !== 'string' || file.sha512 === '') {
      return {
        status: 'rejected',
        error: { code: 'MANIFEST_INVALID', message: 'candidate file missing sha512', retryable: false },
      }
    }
  }

  const candidate: UpdateCandidate = { version: info.version, channel: channelTag }
  if (typeof info.releaseName === 'string' && info.releaseName !== '') {
    candidate.releaseName = info.releaseName
  }
  if (typeof info.releaseNotes === 'string' && info.releaseNotes !== '') {
    candidate.releaseNotes = info.releaseNotes
  }
  if (typeof info.releaseDate === 'string' && info.releaseDate !== '') {
    candidate.releaseDate = info.releaseDate
  }
  return { status: 'ok', candidate }
}

export class UpdateService {
  private state: UpdateState
  private pendingInstall: PendingInstall | null = null
  private readonly mintRequestId: () => string
  private readonly installTimeoutMs: number
  private disposed = false
  private unsubscribeProgress: (() => void) | undefined
  private provider: UpdateProvider
  private readonly listeners: Array<readonly [string, (event: unknown, payload: unknown) => void]> = []

  constructor(private readonly deps: UpdateServiceDeps) {
    this.mintRequestId = deps.requestIdFactory ?? (() => crypto.randomUUID())
    this.installTimeoutMs = deps.installTimeoutMs ?? INSTALL_TIMEOUT_MS

    this.state = {
      phase: 'idle',
      currentVersion: deps.identity.appVersion,
      currentBuildId: deps.identity.buildId,
    }

    // Feed verification is eager: a packaged manifest that does not match
    // the expected feed contract means these bytes point somewhere we did
    // not build - the service parks at 'unsupported' rather than follow it.
    const packaged = parsePackaged(this.deps.readFeedText())
    const feed = verifyPackagedFeed(packaged, deps.expectedFeed)
    if (feed.status !== 'ok') {
      this.state = { ...this.state, phase: 'unsupported' }
      this.deps.record?.({
        source: 'main',
        severity: 'error',
        category: 'update',
        code: feed.code,
        message: `update feed rejected: ${feed.message}`,
      })
    }

    this.provider = deps.provider
    this.unsubscribeProgress = deps.provider.onProgress((progress) => {
      if (this.disposed || this.state.phase !== 'downloading') return
      this.setState({ ...this.state, progress })
    })

    this.listen('update:check', () => void this.check())
    this.listen('update:download', () => void this.download())
    this.listen('update:cancel-download', () => {
      if (this.state.phase === 'downloading') this.provider.cancelDownload()
    })
    this.listen('update:install-request', (_event, payload) => {
      const generation = readGeneration(payload)
      if (generation === null) return
      this.requestInstall(generation)
    })
    this.listen('update:install-result', (event, payload) => {
      this.onInstallResult(event, payload)
    })
    deps.ipcMain.handle('update:get-state', (event: unknown) =>
      this.deps.senderIsTrusted((event as { sender?: unknown }).sender) ? this.state : null,
    )
  }

  get currentState(): UpdateState {
    return this.state
  }

  /** Live phase read that control-flow narrowing cannot pin to an earlier
   *  guard - post-await checks compare against the state as it is NOW. */
  private phase(): UpdateState['phase'] {
    return this.state.phase
  }

  /** Swaps the provider after construction - used when the concrete
   *  updater module loads lazily (electron-updater only exists packaged).
   *  Re-subscribes the progress forwarder; a download already running
   *  keeps finishing on the old provider. */
  bindProvider(provider: UpdateProvider): void {
    if (this.disposed) return
    this.unsubscribeProgress?.()
    this.provider = provider
    this.unsubscribeProgress = provider.onProgress((progress) => {
      if (this.disposed || this.state.phase !== 'downloading') return
      this.setState({ ...this.state, progress })
    })
  }

  /** One shot - a concurrent check just returns the in-flight state. */
  async check(): Promise<UpdateState> {
    if (
      this.disposed ||
      this.state.phase === 'unsupported' ||
      this.state.phase === 'checking' ||
      this.state.phase === 'downloading' ||
      this.state.phase === 'installing'
    ) {
      return this.state
    }

    this.setState({ ...this.state, phase: 'checking', error: undefined, progress: undefined })
    this.deps.record?.({
      source: 'main',
      severity: 'info',
      category: 'update',
      code: 'UPDATE_CHECK_START',
      message: 'update check started',
    })

    let result: ProviderCheckResult
    try {
      result = await this.provider.check()
    } catch (error) {
      result = {
        status: 'error',
        code: 'CHECK_FAILED',
        message: error instanceof Error ? error.message : 'update check failed',
        retryable: true,
      }
    }
    if (this.disposed || this.phase() !== 'checking') {
      // A late resolution must not stomp a state that moved on.
      return this.state
    }

    if (result.status === 'none') {
      this.deps.record?.({
        source: 'main',
        severity: 'info',
        category: 'update',
        code: 'UPDATE_NONE',
        message: 'no update available',
      })
      this.setState({ ...this.state, phase: 'unavailable', candidate: undefined })
      return this.state
    }

    if (result.status === 'error') {
      this.failCheck(result.code, result.message, result.retryable)
      return this.state
    }

    const verdict = verifyCandidate(result.info, this.deps.identity, this.deps.expectedFeed)
    if (verdict.status === 'rejected') {
      this.deps.record?.({
        source: 'main',
        severity: 'error',
        category: 'update',
        code: verdict.error.code,
        message: `update candidate rejected: ${verdict.error.message}`,
        details: { reason: verdict.error.code },
      })
      this.setState({ ...this.state, phase: 'error', candidate: undefined, error: verdict.error })
      return this.state
    }

    this.deps.record?.({
      source: 'main',
      severity: 'info',
      category: 'update',
      code: 'UPDATE_AVAILABLE',
      message: `update available: ${verdict.candidate.version}`,
    })
    this.setState({ ...this.state, phase: 'available', candidate: verdict.candidate })
    return this.state
  }

  async download(): Promise<UpdateState> {
    const candidate = this.state.candidate
    if (
      this.disposed ||
      candidate === undefined ||
      (this.state.phase !== 'available' && !(this.state.phase === 'error' && this.state.error?.retryable === true))
    ) {
      return this.state
    }

    this.setState({ ...this.state, phase: 'downloading', error: undefined })
    this.deps.record?.({
      source: 'main',
      severity: 'info',
      category: 'update',
      code: 'UPDATE_DOWNLOAD_START',
      message: `downloading update ${candidate.version}`,
    })

    let result: ProviderDownloadResult
    try {
      result = await this.provider.download()
    } catch (error) {
      result = {
        status: 'error',
        code: 'DOWNLOAD_FAILED',
        message: error instanceof Error ? error.message : 'update download failed',
        retryable: true,
      }
    }
    if (this.disposed || this.phase() !== 'downloading') {
      return this.state
    }

    if (result.status === 'downloaded') {
      this.deps.record?.({
        source: 'main',
        severity: 'info',
        category: 'update',
        code: 'UPDATE_DOWNLOADED',
        message: `update ${candidate.version} downloaded and verified`,
      })
      this.setState({ ...this.state, phase: 'downloaded', progress: undefined })
      return this.state
    }

    if (result.code === 'DOWNLOAD_CANCELLED') {
      // An explicit cancel returns to 'available' - the candidate stays
      // downloadable and no error surface is needed.
      this.setState({ ...this.state, phase: 'available', progress: undefined })
      return this.state
    }

    this.deps.record?.({
      source: 'main',
      severity: 'warning',
      category: 'update',
      code: result.code,
      message: `update download failed: ${result.message}`,
    })
    this.setState({
      ...this.state,
      phase: 'error',
      progress: undefined,
      error: { code: result.code, message: result.message, retryable: result.retryable },
    })
    return this.state
  }

  /** The install admission gate: mint a pending attempt and ask the
   *  renderer to pause admission + drain the flush. Only a verified
   *  downloaded candidate can enter. */
  requestInstall(expectedGeneration: number): void {
    if (this.disposed || this.state.phase !== 'downloaded' || this.pendingInstall !== null) {
      return
    }
    const requestId = this.mintRequestId()
    const pending: PendingInstall = {
      requestId,
      expectedGeneration,
      timeout: setTimeout(() => this.onInstallTimeout(requestId), this.installTimeoutMs),
    }
    this.pendingInstall = pending
    this.setState({ ...this.state, phase: 'installing' })
    this.deps.record?.({
      source: 'main',
      severity: 'info',
      category: 'update',
      code: 'UPDATE_INSTALL_REQUESTED',
      message: 'install requested - waiting on flush',
      details: { requestId, generation: expectedGeneration },
    })
    this.deps.send('update:prepare-install', { requestId })
  }

  private onInstallResult(event: unknown, payload: unknown): void {
    const pending = this.pendingInstall
    if (pending === null) return
    if (!this.deps.senderIsTrusted((event as { sender?: unknown }).sender)) return

    const result = parseUpdateInstallResult(payload)
    if (result === null || result.requestId !== pending.requestId) return
    if (result.generation !== pending.expectedGeneration) {
      // The generation quoted at request time is stale: admission was
      // invalidated between request and drain - never install.
      this.failInstall(pending, { requestId: pending.requestId, status: 'failed', code: 'STALE_GENERATION' })
      return
    }

    if (result.status === 'saved') {
      clearTimeout(pending.timeout)
      this.pendingInstall = null
      this.deps.record?.({
        source: 'main',
        severity: 'info',
        category: 'update',
        code: 'UPDATE_INSTALL_ACCEPTED',
        message: 'flush saved - installing update',
        details: { requestId: pending.requestId, generation: result.generation, revision: result.revision },
      })
      try {
        this.deps.onInstallApproved?.()
        this.provider.quitAndInstall()
      } catch (error) {
        // The flush already succeeded; a launch failure must not wedge the
        // state at 'installing' - park back at 'downloaded' and let the
        // user pick an explicit retry.
        this.setState({ ...this.state, phase: 'downloaded' })
        this.deps.record?.({
          source: 'main',
          severity: 'error',
          category: 'update',
          code: 'INSTALL_LAUNCH_FAILED',
          message: error instanceof Error ? error.message : 'quitAndInstall failed',
        })
        this.deps.send('update:install-failed', {
          requestId: pending.requestId,
          status: 'failed',
          code: 'INSTALL_LAUNCH_FAILED',
        })
      }
      return
    }

    this.failInstall(pending, { requestId: pending.requestId, status: result.status, code: result.code })
  }

  private onInstallTimeout(requestId: string): void {
    const pending = this.pendingInstall
    if (pending === null || pending.requestId !== requestId) return
    this.failInstall(pending, { requestId, status: 'timeout', code: 'INSTALL_TIMEOUT' })
  }

  private failInstall(pending: PendingInstall, notice: UpdateInstallFailedNotice): void {
    clearTimeout(pending.timeout)
    this.pendingInstall = null
    // The verified candidate stays downloaded: explicit retry mints a new
    // requestId; 'later' just leaves the candidate parked. A failure never
    // becomes a success and never auto-retries.
    this.setState({ ...this.state, phase: 'downloaded' })
    this.deps.record?.({
      source: 'main',
      severity: 'warning',
      category: 'update',
      code: notice.code ?? 'UPDATE_INSTALL_FAILED',
      message: `update install refused (${notice.status}) - candidate kept`,
      details: { requestId: notice.requestId, status: notice.status, ...(notice.code ? { code: notice.code } : {}) },
    })
    this.deps.send('update:install-failed', notice)
  }

  private failCheck(code: UpdateErrorCode, message: string, retryable: boolean): void {
    this.deps.record?.({
      source: 'main',
      severity: 'warning',
      category: 'update',
      code,
      message: `update check failed: ${message}`,
    })
    this.setState({ ...this.state, phase: 'error', error: { code, message, retryable } })
  }

  private setState(next: UpdateState): void {
    if (this.disposed) return
    this.state = next
    this.deps.send('update:state', next)
  }

  private listen(channel: string, listener: (event: unknown, payload: unknown) => void): void {
    const guarded = (event: unknown, payload: unknown) => {
      if (this.disposed) return
      if (!this.deps.senderIsTrusted((event as { sender?: unknown }).sender)) return
      listener(event, payload)
    }
    this.listeners.push([channel, guarded])
    this.deps.ipcMain.on(channel, guarded)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.unsubscribeProgress?.()
    if (this.pendingInstall !== null) {
      clearTimeout(this.pendingInstall.timeout)
      this.pendingInstall = null
    }
    for (const [channel, listener] of this.listeners) {
      this.deps.ipcMain.removeListener(channel, listener)
    }
    this.deps.ipcMain.removeHandler?.('update:get-state')
  }
}

function readGeneration(payload: unknown): number | null {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null
  const generation = (payload as Record<string, unknown>).generation
  return Number.isSafeInteger(generation) && (generation as number) >= 0 ? (generation as number) : null
}

function parsePackaged(text: string | null): PackagedFeedConfig | null {
  if (text === null) return null
  return parsePackagedFeed(text)
}
