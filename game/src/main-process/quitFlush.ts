import type { QuitFlushFailedNotice, QuitFlushResultMessage } from '../shared/session/FlushResult'

/**
 * B1-D - the result-bearing quit flush (replaces the untyped
 * 'app:flush-complete' ACK + unconditional 2s auto-close).
 *
 * Protocol per close request:
 *   main -> renderer 'app:before-quit-flush'  { requestId }
 *   renderer -> main 'app:flush-result'       { requestId, generation,
 *                                             status, revision?, code? }
 *   close       : only on status 'saved' whose requestId matches the
 *                 PENDING attempt AND whose sender is that window's own
 *                 webContents - a late ack or a forged sender can never
 *                 close the window.
 *   failure     : 'blocked'/'failed'/timeout -> 'app:flush-failed'
 *                 { requestId, status, code } to the renderer, which
 *                 offers retry (a NEW requestId), cancel, or
 *                 'app:force-close'. A timeout NEVER closes the window.
 *
 * The renderer's flush is the OnlineSessionController's result-bearing
 * flush: it drains the one save queue and waits for the remote ack, so
 * the updater install path (PR12) consumes the same contract - an
 * unsuccessful flush can never reach close/install.
 */

export interface QuitFlushWindow {
  webContents: {
    send: (channel: string, payload?: unknown) => void
  }
  close: () => void
}

export interface QuitFlushCloseEvent {
  preventDefault: () => void
}

export interface QuitFlushIpcMain {
  on: (channel: string, listener: (event: unknown, payload: unknown) => void) => void
  removeListener: (channel: string, listener: (...args: unknown[]) => void) => void
}

export interface QuitFlushDeps {
  ipcMain: QuitFlushIpcMain
  /** The flush request deadline; timeout notifies the renderer (no close). */
  timeoutMs?: number
  /** Test seam for deterministic request ids. */
  requestIdFactory?: () => string
}

export const FLUSH_TIMEOUT_MS = 10_000

export function createQuitFlush(deps: QuitFlushDeps): (win: QuitFlushWindow, event: QuitFlushCloseEvent) => void {
  const timeoutMs = deps.timeoutMs ?? FLUSH_TIMEOUT_MS
  const mintRequestId = deps.requestIdFactory ?? (() => crypto.randomUUID())

  const flushed = new WeakSet<QuitFlushWindow>()
  const pending = new WeakMap<QuitFlushWindow, { requestId: string; timeout: ReturnType<typeof setTimeout> }>()
  /** The most recent FAILED attempt per window - retry/cancel/force-close
   *  must quote its requestId or they are ignored (late/forged ack). */
  const failed = new WeakMap<QuitFlushWindow, { requestId: string }>()
  /** webContents identity -> window, for BOTH pending and failed attempts;
   *  deleted only on close/cancel - a forged sender resolves nothing. */
  const windowBySender = new Map<unknown, QuitFlushWindow>()

  function resolveWindow(event: unknown): QuitFlushWindow | undefined {
    return windowBySender.get((event as { sender?: unknown }).sender)
  }

  function unbindWindow(win: QuitFlushWindow): void {
    const entry = pending.get(win)
    if (entry) {
      clearTimeout(entry.timeout)
      pending.delete(win)
    }
    windowBySender.delete(win.webContents)
  }

  function markFailed(win: QuitFlushWindow, notice: QuitFlushFailedNotice): void {
    const entry = pending.get(win)
    if (entry) {
      clearTimeout(entry.timeout)
      pending.delete(win)
    }
    failed.set(win, { requestId: notice.requestId })
    win.webContents.send('app:flush-failed', notice)
  }

  function issueRequest(win: QuitFlushWindow): void {
    const requestId = mintRequestId()
    const timeout = setTimeout(() => {
      markFailed(win, { requestId, status: 'timeout', code: 'FLUSH_TIMEOUT' })
    }, timeoutMs)
    pending.set(win, { requestId, timeout })
    windowBySender.set(win.webContents, win)
    win.webContents.send('app:before-quit-flush', { requestId })
  }

  deps.ipcMain.on('app:flush-result', (event, payload) => {
    const result = payload as QuitFlushResultMessage
    const win = resolveWindow(event)
    if (!win) return
    const entry = pending.get(win)
    if (!entry || result.requestId !== entry.requestId) return

    if (result.status === 'saved') {
      unbindWindow(win)
      flushed.add(win)
      win.close()
      return
    }

    markFailed(win, {
      requestId: entry.requestId,
      status: result.status,
      code: result.code,
    })
  })

  deps.ipcMain.on('app:flush-retry', (event, payload) => {
    const win = resolveWindow(event)
    const body = payload as { requestId?: string } | undefined
    const last = win ? failed.get(win) : undefined
    if (!win || !last || body?.requestId !== last.requestId) return
    failed.delete(win)
    issueRequest(win)
  })

  deps.ipcMain.on('app:force-close', (event, payload) => {
    const win = resolveWindow(event)
    const body = payload as { requestId?: string } | undefined
    const last = win ? failed.get(win) : undefined
    if (!win || !last || body?.requestId !== last.requestId) return
    failed.delete(win)
    unbindWindow(win)
    flushed.add(win)
    win.close()
  })

  deps.ipcMain.on('app:close-cancel', (event, payload) => {
    const win = resolveWindow(event)
    const body = payload as { requestId?: string } | undefined
    const last = win ? failed.get(win) : undefined
    if (!win || !last || body?.requestId !== last.requestId) return
    failed.delete(win)
    unbindWindow(win)
  })

  return function onWindowClose(win: QuitFlushWindow, event: QuitFlushCloseEvent): void {
    if (flushed.has(win)) {
      return
    }
    event.preventDefault()
    // One attempt at a time: a second close event while a flush is pending
    // or the failed-offer is up just waits on the same attempt.
    if (pending.has(win) || failed.has(win)) {
      return
    }
    issueRequest(win)
  }
}
