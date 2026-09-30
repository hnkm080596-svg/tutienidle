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

// Uncommitted audit followup plan, Ưu tiên 2 "xử lý khi đóng gói Electron"
// (2026-08-24) — cầu nối renderer ↔ main process, CHỈ tồn tại khi chạy
// trong bản Electron (window.electronAPI do electron/preload.ts expose qua
// contextBridge — interface bên dưới PHẢI khớp đúng shape object export ở
// đó). Bản build web thường (npm run dev/build) không có window.electronAPI
// -> mọi hàm ở đây no-op ngay, không ảnh hưởng gì tới target web.
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
  // Mỗi onX trả về hàm unsubscribe (preload.ts gỡ đúng ipcRenderer handler
  // đã đăng ký) — teardown gọi được, không chồng listener qua HMR/remount
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

// `gameManagerOverride` — cùng lý do useBreakthrough.ts's tham số cùng tên:
// App.vue gọi composable này trên CHÍNH cây component đã provide()
// GameManager ra, useGameManager() inject bên trong sẽ throw nếu tự gọi
// trên chính App.vue — truyền thẳng instance cục bộ để bỏ qua inject.
//
// Trả về disposer gỡ cả 3 subscription (ARCH-013/L04): trước đây các
// ipcRenderer.on này không có đường gỡ — App unmount/HMR để lại handler
// mồ côi, và mount lại sẽ đăng ký TRÙNG (quit-flush save chạy kép).
// Caller giữ disposer; gọi lại useElectronBridge sau khi đã dispose, hoặc
// dispose trước khi subscribe lần nữa.
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
