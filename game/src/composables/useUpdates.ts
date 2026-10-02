import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useNotificationStore } from '../stores/notification'
import { useGameManager } from './useGameState'
import { i18n } from '@/i18n'
import type { GameManager } from '../core/game/GameManager'
import type { FlushResult } from '../shared/session/FlushResult'
import type { UpdateInstallFailedNotice } from '../shared/update/UpdateState'
import { parseUpdateState, type UpdateState } from '../shared/update/UpdateState'
import { recordDiagnostic } from '../services/diagnostics/DiagnosticRecorder'
import type { ElectronBridgeAPI } from './useElectronBridge'

// BETA-FINAL PR12 / spec B6 - the renderer half of the update contract.
// The composable consumes ONLY the sanitized UpdateState push/get and the
// prepare-install / install-failed handshake; every action it can send is
// the four allowlisted channels - there is no path to a feed URL, file
// path or publisher.
//
// Install admission: when main asks to prepare an install, the renderer
// pauses the SIMULATION (not the authority - pausing the authority would
// bump its generation and self-sabotage the equality fence), drains the
// ONE save queue through flush(requestId), and replies with the
// FlushResult. A non-saved result comes back as 'update:install-failed'
// and the user picks explicit retry (a NEW requestId) or later - failure
// never becomes success and never auto-retries.
//
// Check/download failures stay independent of gameplay: they never pause
// the simulation and never touch the authority.

export interface UseUpdatesDeps {
  /** The authority's result-bearing flush (or the plain local save when
   *  no authority is bound - same fallback contract as the quit flush). */
  flush?: (requestId: string) => Promise<FlushResult>
  /** Pause gameplay while the install flush drains + the app quits.
   *  lifecycle.pauseSimulation - NOT authority.pause (that bumps the
   *  generation and would break the admission equality check). */
  pauseAdmission?: () => void
  resumeAdmission?: () => void
  /** The authority generation at request time; main verifies the flush
   *  reply carries exactly this generation. */
  generation?: () => number
}

export interface UseUpdatesHandle {
  state: Readonly<Ref<UpdateState | null>>
  installFailed: Readonly<Ref<UpdateInstallFailedNotice | null>>
  /** Convenience for UI: candidate version when one is known. */
  candidateVersion: ComputedRef<string | null>
  check(): void
  download(): void
  cancelDownload(): void
  install(): void
  /** Retry after a failed install - mints a NEW main-side requestId. */
  retryInstall(): void
  /** Keep the downloaded candidate parked without installing now. */
  later(): void
  dispose(): void
}

/** The ONE update surface, bound by App.vue at setup. There is exactly
 *  one prepare-install flush owner: panels (settings, error screen)
 *  consume this bound handle instead of constructing their own
 *  subscriptions - two owners would double-drain the install request. */
let boundSurface: UseUpdatesHandle | null = null

export function bindUpdateSurface(handle: UseUpdatesHandle | undefined | null): UseUpdatesHandle | null {
  boundSurface = handle ?? null
  return boundSurface
}

/** App teardown disposes its surface - unbind so a remounted App rebinds
 *  a fresh instance instead of panels driving dead subscriptions. */
export function unbindUpdateSurface(handle: UseUpdatesHandle | null): void {
  if (boundSurface === handle) {
    boundSurface = null
  }
}

/** The bound update surface for consumers outside App's setup scope
 *  (settings panel, error screen). null on web builds / pre-bind. */
export function useActiveUpdates(): UseUpdatesHandle | null {
  return boundSurface
}

export function useUpdates(
  deps: UseUpdatesDeps = {},
  gameManagerOverride?: GameManager,
): UseUpdatesHandle | undefined {
  const electronAPI: ElectronBridgeAPI | undefined = window.electronAPI
  if (!electronAPI) {
    return undefined
  }

  const player = usePlayerStore()
  const notification = useNotificationStore()
  const gameManager = gameManagerOverride ?? useGameManager()

  const state = ref<UpdateState | null>(null)
  const installFailed = ref<UpdateInstallFailedNotice | null>(null)
  const candidateVersion = computed(() => state.value?.candidate?.version ?? null)

  const offState = electronAPI.onUpdateState((raw) => {
    const parsed = parseUpdateState(raw)
    // A half-valid projection is dropped whole - never rendered.
    if (parsed === null) {
      recordDiagnostic({
        source: 'renderer',
        severity: 'warning',
        category: 'update',
        code: 'UPDATE_STATE_DROPPED',
        message: 'dropped an unparsable update state push',
      })
      return
    }
    const previous = state.value
    state.value = parsed
    // Availability surfaces through the banner + settings row - no toast
    // (NotificationKind has no neutral/info kind). A check/download
    // failure stays visible but never touches gameplay admission.
    if (parsed.phase === 'error' && previous?.phase !== 'error') {
      notification.push('error', i18n.global.t('updates.failed'))
    }
  })

  // Late-mounted panels (or a renderer reload) re-sync through invoke.
  void electronAPI
    .getUpdateState()
    .then((raw) => {
      const parsed = parseUpdateState(raw)
      if (parsed !== null) state.value = parsed
    })
    .catch(() => {
      // No state reply just means no push has happened yet.
    })

  const runInstallFlush = async (requestId: string): Promise<FlushResult> => {
    recordDiagnostic({
      source: 'renderer',
      severity: 'info',
      category: 'update',
      code: 'UPDATE_FLUSH_REQUESTED',
      message: 'install flush requested',
      correlationId: requestId,
      details: { requestId },
    })
    deps.pauseAdmission?.()
    const result = await (async (): Promise<FlushResult> => {
      if (deps.flush) {
        return deps.flush(requestId)
      }
      try {
        const write = await player.save(gameManager)
        if (write.status === 'ok') {
          return { status: 'saved', requestId, generation: deps.generation?.() ?? 0, revision: write.revision }
        }
        return {
          status: 'failed',
          requestId,
          generation: deps.generation?.() ?? 0,
          code: write.status === 'conflict' ? 'SAVE_CONFLICT' : 'FLUSH_FAILED',
        }
      } catch {
        return { status: 'failed', requestId, generation: deps.generation?.() ?? 0, code: 'FLUSH_FAILED' }
      }
    })()
    recordDiagnostic({
      source: 'renderer',
      severity: result.status === 'saved' ? 'info' : 'error',
      category: 'update',
      code: `UPDATE_FLUSH_${result.status.toUpperCase()}`,
      message: `install flush ${result.status}`,
      correlationId: result.requestId,
      revision: result.status === 'saved' ? result.revision : undefined,
      details: {
        requestId: result.requestId,
        status: result.status,
        generation: result.generation,
        ...(result.status === 'saved' ? { revision: result.revision } : { code: result.code }),
      },
    })
    electronAPI.notifyUpdateInstallResult(result)
    return result
  }

  const offPrepareInstall = electronAPI.onUpdatePrepareInstall((request) => {
    if (request.requestId === '') return
    void runInstallFlush(request.requestId).catch(() => {
      // flush() is contract-bound to always resolve a FlushResult; the
      // catch guards the bridge call itself. The main-side install
      // timeout is the backstop if the reply never lands.
    })
  })

  const offInstallFailed = electronAPI.onUpdateInstallFailed((notice) => {
    // The candidate stays downloaded; the simulation resumes while the
    // user decides. A retry re-pauses through its own prepare roundtrip.
    deps.resumeAdmission?.()
    installFailed.value = notice
    recordDiagnostic({
      source: 'renderer',
      severity: 'error',
      category: 'update',
      code: 'UPDATE_INSTALL_REFUSED',
      message: `install refused (${notice.status})`,
      correlationId: notice.requestId,
      details: {
        requestId: notice.requestId,
        status: notice.status,
        ...(notice.code !== undefined ? { code: notice.code } : {}),
      },
    })
  })

  let disposed = false

  return {
    state,
    installFailed,
    candidateVersion,

    check() {
      if (disposed) return
      electronAPI.checkForUpdate()
    },

    download() {
      if (disposed || state.value?.candidate === undefined) return
      electronAPI.downloadUpdate()
    },

    cancelDownload() {
      if (disposed || state.value?.phase !== 'downloading') return
      electronAPI.cancelUpdateDownload()
    },

    install() {
      if (disposed || state.value?.phase !== 'downloaded') return
      installFailed.value = null
      electronAPI.requestUpdateInstall(deps.generation?.() ?? 0)
    },

    retryInstall() {
      if (disposed || installFailed.value === null || state.value?.phase !== 'downloaded') return
      installFailed.value = null
      electronAPI.requestUpdateInstall(deps.generation?.() ?? 0)
    },

    later() {
      installFailed.value = null
    },

    dispose() {
      if (disposed) return
      disposed = true
      offState()
      offPrepareInstall()
      offInstallFailed()
    },
  }
}
