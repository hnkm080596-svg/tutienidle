// BETA-FINAL PR12 / spec B6 - the UpdateProvider adapter for
// electron-updater. This is the ONLY place electron-updater enters the
// codebase; everything upstream (UpdateService) sees the normalized
// Provider* shapes, which is what keeps the whole failure taxonomy
// provable without a running Electron.
//
// Deliberate config choices:
//  - autoDownload = false: a check never silently downloads an installer;
//    the user downloads explicitly.
//  - autoInstallOnAppQuit = false: installing happens only through the
//    verified flush-gated install path (quitAndInstall is called by the
//    service only after a 'saved' FlushResult). Otherwise a quitting app
//    would install bypassing the gate.
//  - allowDowngrade = false.
//  - allowPrerelease = true: beta candidates are prerelease-tagged.
//  - No setFeedURL, no repo token: the packaged app-update.yml is the
//    single feed authority, verified by updateFeed.ts.
//
// Error mapping is conservative: transport/auth failures stay retryable
// CHECK_FAILED / DOWNLOAD_FAILED; integrity mismatches map to
// CANDIDATE_CORRUPT (sha512 is verified by electron-updater itself before
// 'update-downloaded'); a cancellation maps to DOWNLOAD_CANCELLED.

import type {
  UpdateProvider,
  ProviderCheckResult,
  ProviderDownloadResult,
  ProviderCandidateInfo,
} from './UpdateService'
import type { UpdateProgress } from '../shared/update/UpdateState'

/** The slice of electron-updater's API the adapter uses. Typed as an
 *  interface so the adapter's mapping logic itself is testable with a
 *  fake; the real object is autoUpdater. */
export interface AutoUpdaterLike {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  allowDowngrade: boolean
  allowPrerelease: boolean
  on(event: string, listener: (...args: unknown[]) => void): unknown
  checkForUpdates(): Promise<unknown>
  downloadUpdate(cancellationToken?: CancellationTokenLike): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
}

export interface CancellationTokenLike {
  cancel(): void
}

/** electron-updater's CancellationToken is constructed by the caller and
 *  passed into downloadUpdate; injected so the adapter never imports
 *  electron-updater at module load (main.ts passes the real constructor). */
export type CancellationTokenFactory = () => CancellationTokenLike

interface ProgressInfoLike {
  percent?: unknown
  bytesPerSecond?: unknown
  transferred?: unknown
  total?: unknown
}

function toUpdateProgress(info: unknown): UpdateProgress {
  const record = (info ?? {}) as ProgressInfoLike
  return {
    percent: typeof record.percent === 'number' && Number.isFinite(record.percent) ? record.percent : 0,
    bytesPerSecond:
      typeof record.bytesPerSecond === 'number' && Number.isFinite(record.bytesPerSecond)
        ? record.bytesPerSecond
        : 0,
    transferred:
      typeof record.transferred === 'number' && Number.isFinite(record.transferred) ? record.transferred : 0,
    total: typeof record.total === 'number' && Number.isFinite(record.total) ? record.total : 0,
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Maps a raw updater info object onto ProviderCandidateInfo. The release
 *  metadata is display-only; the trust fields are version + files+sha512. */
function toCandidateInfo(info: unknown): ProviderCandidateInfo {
  const record = (info ?? {}) as Record<string, unknown>
  const files = Array.isArray(record.files) ? record.files : []
  return {
    version: typeof record.version === 'string' ? record.version : '',
    files: files.map((file) => {
      const f = (file ?? {}) as Record<string, unknown>
      return {
        url: typeof f.url === 'string' ? f.url : undefined,
        sha512: typeof f.sha512 === 'string' ? f.sha512 : undefined,
      }
    }),
    releaseName: typeof record.releaseName === 'string' ? record.releaseName : undefined,
    releaseNotes: toReleaseNotes(record.releaseNotes),
    releaseDate: typeof record.releaseDate === 'string' ? record.releaseDate : undefined,
  }
}

function toReleaseNotes(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => (entry !== null && typeof entry === 'object' ? (entry as { note?: unknown }).note : null))
      .filter((note): note is string => typeof note === 'string' && note.length > 0)
    return parts.length > 0 ? parts.join('\n\n') : undefined
  }
  return undefined
}

function isIntegrityError(message: string): boolean {
  return /sha512|digest|checksum|integrity/i.test(message)
}

function isCancelledError(message: string): boolean {
  return /cancelled|canceled/i.test(message)
}

/** Creates the UpdateProvider for a packaged build. The caller decides
 *  when to construct this (only when app.isPackaged and the packaged feed
 *  verified) - constructing it in dev would touch electron-updater's
 *  app paths. */
export function createElectronUpdateProvider(
  autoUpdater: AutoUpdaterLike,
  createCancellationToken: CancellationTokenFactory,
): UpdateProvider {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowDowngrade = false
  autoUpdater.allowPrerelease = true

  const progressListeners = new Set<(progress: UpdateProgress) => void>()
  autoUpdater.on('download-progress', (info: unknown) => {
    const progress = toUpdateProgress(info)
    for (const listener of progressListeners) listener(progress)
  })

  let downloadToken: CancellationTokenLike | null = null

  return {
    async check(): Promise<ProviderCheckResult> {
      try {
        const result = await autoUpdater.checkForUpdates()
        const record = (result ?? {}) as Record<string, unknown>
        const updateInfo = record.updateInfo
        const isUpdateAvailable = record.isUpdateAvailable === true
        if (updateInfo === null || updateInfo === undefined || !isUpdateAvailable) {
          return { status: 'none' }
        }
        const info = toCandidateInfo(updateInfo)
        if (info.version === '') {
          return {
            status: 'error',
            code: 'MANIFEST_INVALID',
            message: 'update manifest carried no version',
            retryable: false,
          }
        }
        return { status: 'available', info }
      } catch (error) {
        return {
          status: 'error',
          code: 'CHECK_FAILED',
          message: messageOf(error),
          retryable: true,
        }
      }
    },

    async download(): Promise<ProviderDownloadResult> {
      try {
        const token = createCancellationToken()
        downloadToken = token
        try {
          // downloadUpdate resolves with the verified file paths once
          // 'update-downloaded' fired and sha512 checks passed.
          await autoUpdater.downloadUpdate(token)
        } finally {
          if (downloadToken === token) downloadToken = null
        }
        return { status: 'downloaded' }
      } catch (error) {
        const message = messageOf(error)
        if (isCancelledError(message)) {
          return { status: 'error', code: 'DOWNLOAD_CANCELLED', message, retryable: true }
        }
        if (isIntegrityError(message)) {
          return { status: 'error', code: 'CANDIDATE_CORRUPT', message, retryable: true }
        }
        return { status: 'error', code: 'DOWNLOAD_FAILED', message, retryable: true }
      }
    },

    cancelDownload(): void {
      downloadToken?.cancel()
    },

    quitAndInstall(): void {
      // isSilent=false keeps the (oneClick: false) NSIS wizard visible so
      // the user sees install progress; isForceRunAfter=true relaunches
      // the NEW build when the wizard finishes - the update journey ends
      // inside the updated app, not back at the desktop.
      autoUpdater.quitAndInstall(false, true)
    },

    onProgress(listener: (progress: UpdateProgress) => void): () => void {
      progressListeners.add(listener)
      return () => {
        progressListeners.delete(listener)
      }
    },
  }
}
