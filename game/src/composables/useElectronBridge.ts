import { usePlayerStore } from '../stores/player'
import { useNotificationStore } from '../stores/notification'
import { useGameManager } from './useGameState'
import { i18n } from '@/i18n'
import type { GameManager } from '../core/game/GameManager'
import type { CombatClockBridge } from '../presentation/clock/MainProcessClockSource'
import type { FlushResult, QuitFlushFailedNotice } from '../shared/session/FlushResult'
import type { UpdateInstallFailedNotice, UpdateInstallRequest, UpdateInstallResult } from '../shared/update/UpdateState'
import type { DiagnosticExportResult } from '../main-process/DiagnosticBundle'
import { recordDiagnostic } from '../services/diagnostics/DiagnosticRecorder'
import type { GuestCredentialBridge } from '../services/supabase/SupabaseSession'

// Uncommitted audit followup plan, Uu tien 2 "xu ly khi dong goi Electron"
// (2026-08-24) - cau noi renderer <-> main process, CHI ton tai khi chay
// trong ban Electron (window.electronAPI do electron/preload.ts expose qua
// contextBridge - interface ben duoi PHAI khop dung shape object export o
// do). Ban build web thuong (npm run dev/build) khong co window.electronAPI
// -> moi ham o day no-op ngay, khong anh huong gi toi target web.
//
// B1-D quits the comment's old claim: the quit flush is now a
// RESULT-BEARING protocol - 'app:before-quit-flush' carries a requestId,
// the renderer answers 'app:flush-result' {requestId, status}, and the
// main side closes ONLY on 'saved' bound to the pending attempt. A
// failed/blocked/timeout attempt comes back as 'app:flush-failed' and the
// user picks retry / cancel / force-close - an unsuccessful flush can
// never reach close (the updater install path consumes the same contract).
//
// system:suspend/resume feed the B1-D authority admission:
// suspend invalidates admission immediately, resume drives the reconnect
// pipeline. Where no authority is bound (local mode) they stay
// log-only - GameClock self-corrects via Date.now() diff regardless.
export interface ElectronBridgeAPI {
  isElectron: true
  // Moi onX tra ve ham unsubscribe (preload.ts go dung ipcRenderer handler
  // da dang ky) - teardown goi duoc, khong chong listener qua HMR/remount
  // (ARCH-013/L04).
  onSystemSuspend(callback: (timestamp: number) => void): () => void
  onSystemResume(callback: (timestamp: number) => void): () => void
  onBeforeQuitFlush(callback: (requestId: string) => void): () => void
  /** Result-bearing reply bound to the pending request id. */
  notifyFlushResult(result: FlushResult): void
  /** Main rejected/timed-out the pending attempt: retry / cancel / force-close. */
  onFlushFailed(callback: (notice: QuitFlushFailedNotice) => void): () => void
  retryQuitFlush(requestId: string): void
  cancelQuitClose(requestId: string): void
  forceQuitClose(requestId: string): void
  // BETA-FINAL PR11 / spec B8 - diagnostics bridge; must match the fields
  // added in electron/preload.ts. The export result shape is defined
  // main-side (src/main-process/DiagnosticBundle.ts).
  reportDiagnosticEvent(event: unknown): void
  getDiagnosticReportId(): Promise<string>
  exportDiagnostics(
    context: unknown,
  ): Promise<DiagnosticExportResult | { status: 'cancelled' }>
  // BETA-FINAL PR12 / spec B6 - the allowlisted update surface. Only the
  // sanitized UpdateState projection and the request/result handshake
  // cross the bridge; there is no setFeedURL, path or publisher escape
  // hatch. Shape must match the update block in electron/preload.ts.
  getUpdateState(): Promise<unknown>
  onUpdateState(callback: (state: unknown) => void): () => void
  checkForUpdate(): void
  downloadUpdate(): void
  cancelUpdateDownload(): void
  /** Carries the authority generation captured at click time; the install
   *  result must quote the pending requestId AND this generation. */
  requestUpdateInstall(generation: number): void
  onUpdatePrepareInstall(callback: (request: UpdateInstallRequest) => void): () => void
  notifyUpdateInstallResult(result: UpdateInstallResult): void
  onUpdateInstallFailed(callback: (notice: UpdateInstallFailedNotice) => void): () => void
  // Task 7 (2026-09-10) - main-process clock host bridge, consumed by
  // MainProcessClockSource (src/presentation/clock/). Shape must match
  // CombatClockBridge exactly; kept as that imported type rather than
  // redeclared here so the two cannot drift.
  combatClock: CombatClockBridge
  // B1.8 - durable guest credential seam (OS-protected, main-owned).
  // Operations only: the renderer never sees the file path or raw bytes.
  // Absent on older preloads; SupabaseSession treats a missing bridge as
  // 'no durable store', which keeps browser behavior session-scoped.
  guestCredentials?: GuestCredentialBridge
}

declare global {
  interface Window {
    electronAPI?: ElectronBridgeAPI
  }
}

/** B1-D authority handlers the bridge drives; every field optional so
 *  local/test callers keep working without a remote authority bound. */
export interface ElectronBridgeHandlers {
  /** The result-bearing flush (OnlineSessionController.flush). When
   *  absent the bridge falls back to a plain player.save, still reply-
   *  bound to the request - there is no silent local fallback. */
  flush?: (requestId: string) => Promise<FlushResult>
  /** Main-side notice that the pending attempt failed (bad result or
   *  timeout); the caller surfaces the retry/cancel/force-close offer. */
  onFlushFailed?: (notice: QuitFlushFailedNotice) => void
  /** OS suspend: the authority invalidates admission NOW. */
  suspend?: () => void
  /** OS resume: the authority starts revalidation before the sim resumes. */
  resume?: () => void
}

// `gameManagerOverride` - cung ly do useBreakthrough.ts's tham so cung ten:
// App.vue goi composable nay tren CHINH cay component da provide()
// GameManager ra, useGameManager() inject ben trong se throw neu tu goi
// tren chinh App.vue - truyen thang instance cuc bo de bo qua inject.
//
// Tra ve disposer go ca 3 subscription (ARCH-013/L04): truoc day cac
// ipcRenderer.on nay khong co duong go - App unmount/HMR de lai handler
// mo coi, va mount lai se dang ky TRUNG (quit-flush save chay kep).
// Caller giu disposer; goi lai useElectronBridge sau khi da dispose, hoac
// dispose truoc khi subscribe lan nua.
//
// B1-D adds the authority-driven handlers (suspend/resume/quit flush) to
// the same disposer contract - every subscription tears down together.
export function useElectronBridge(
  gameManagerOverride?: GameManager,
  handlers?: ElectronBridgeHandlers,
): (() => void) | undefined {
  const electronAPI = window.electronAPI

  if (!electronAPI) {
    return undefined
  }

  const player = usePlayerStore()
  const notification = useNotificationStore()
  const gameManager = gameManagerOverride ?? useGameManager()

  // B1-D result-bearing quit flush (replaces the untyped notify-in-finally
  // ACK): drains the ONE save queue through the authority flush (or the
  // plain save path in local mode) and replies bound to the requestId.
  const offBeforeQuitFlush = electronAPI.onBeforeQuitFlush((requestId) => {
    recordDiagnostic({
      source: 'renderer',
      severity: 'info',
      category: 'quit-flush',
      code: 'FLUSH_REQUESTED',
      message: 'quit flush requested',
      correlationId: requestId === '' ? undefined : requestId,
      details: { requestId },
    })
    void (async () => {
      const result = await (async (): Promise<FlushResult> => {
        if (handlers?.flush) {
          return handlers.flush(requestId)
        }
        try {
          const write = await player.save(gameManager)
          if (write.status === 'ok') {
            return { status: 'saved', requestId, generation: 0, revision: write.revision }
          }
          console.error('[electron] quit flush save failed', write)
          notification.push('error', i18n.global.t('panels.settings.notifications.saveFailed'))
          return {
            status: 'failed',
            requestId,
            generation: 0,
            code: write.status === 'conflict' ? 'SAVE_CONFLICT' : 'FLUSH_FAILED',
          }
        } catch (error: unknown) {
          console.error('[electron] quit flush save failed', error)
          notification.push('error', i18n.global.t('panels.settings.notifications.saveFailed'))
          return { status: 'failed', requestId, generation: 0, code: 'FLUSH_FAILED' }
        }
      })()
      recordDiagnostic({
        source: 'renderer',
        severity: result.status === 'saved' ? 'info' : 'error',
        category: 'quit-flush',
        code: `FLUSH_${result.status.toUpperCase()}`,
        message: `quit flush ${result.status}`,
        correlationId: result.requestId,
        revision: result.status === 'saved' ? result.revision : undefined,
        details: {
          requestId: result.requestId,
          status: result.status,
          generation: result.generation,
          ...(result.status === 'saved' ? { revision: result.revision } : { code: result.code }),
        },
      })
      electronAPI.notifyFlushResult(result)
    })()
  })

  const offFlushFailed = handlers?.onFlushFailed
    ? electronAPI.onFlushFailed((notice) => {
        recordDiagnostic({
          source: 'renderer',
          severity: 'error',
          category: 'quit-flush',
          code: 'FLUSH_FAILED_NOTICE',
          message: `quit flush failed (${notice.status})`,
          correlationId: notice.requestId,
          details: {
            requestId: notice.requestId,
            status: notice.status,
            ...(notice.code !== undefined ? { code: notice.code } : {}),
          },
        })
        handlers.onFlushFailed?.(notice)
      })
    : () => {}

  const offSystemSuspend = electronAPI.onSystemSuspend(timestamp => {
    console.info('[electron] system suspend', new Date(timestamp).toISOString())
    recordDiagnostic({
      source: 'renderer',
      severity: 'info',
      category: 'lifecycle',
      code: 'SYSTEM_SUSPEND',
      message: 'system suspended',
    })
    handlers?.suspend?.()
  })

  const offSystemResume = electronAPI.onSystemResume(timestamp => {
    console.info('[electron] system resume', new Date(timestamp).toISOString())
    recordDiagnostic({
      source: 'renderer',
      severity: 'info',
      category: 'lifecycle',
      code: 'SYSTEM_RESUME',
      message: 'system resumed',
    })
    handlers?.resume?.()
  })

  return () => {
    offBeforeQuitFlush()
    offFlushFailed()
    offSystemSuspend()
    offSystemResume()
  }
}
