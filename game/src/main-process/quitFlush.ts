/**
 * Quit-flush close handler for the Electron main process. Extracted from
 * electron/main.ts so this glue has test coverage - main.ts itself has
 * none (same precedent as combatClockHost.ts). The renderer saves on
 * 'app:before-quit-flush' and acks via 'app:flush-complete'; a timeout
 * backstop closes anyway if the ack never arrives.
 *
 * Two WeakSets split the two reasons a 'close' event must be ignored:
 * - flushedWindows: finish() already ran and called win.close() - this
 *   re-entrant event is the intended final close, let it through.
 * - flushingWindows: a second user close landed during the flush window.
 *   It must stay blocked (preventDefault) but must NOT re-send the flush
 *   request or stack a second 'app:flush-complete' listener - the in-flight
 *   finish() still owns the close.
 */
export const FLUSH_TIMEOUT_MS = 2000

export interface QuitFlushWindow {
  webContents: { send(channel: 'app:before-quit-flush'): void }
  close(): void
}

export interface QuitFlushCloseEvent {
  preventDefault(): void
}

export interface QuitFlushIpcMain {
  once(channel: string, listener: () => void): void
  removeListener(channel: string, listener: () => void): void
}

export function createQuitFlush(deps: {
  ipcMain: QuitFlushIpcMain
  timeoutMs?: number
}): (win: QuitFlushWindow, event: QuitFlushCloseEvent) => void {
  const timeoutMs = deps.timeoutMs ?? FLUSH_TIMEOUT_MS
  const flushedWindows = new WeakSet<QuitFlushWindow>()
  const flushingWindows = new WeakSet<QuitFlushWindow>()

  return function bindQuitFlush(win, event) {
    if (flushedWindows.has(win)) {
      return
    }

    event.preventDefault()

    if (flushingWindows.has(win)) {
      return
    }

    flushingWindows.add(win)

    let settled = false

    const finish = () => {
      if (settled) {
        return
      }

      settled = true

      clearTimeout(timeoutHandle)
      deps.ipcMain.removeListener('app:flush-complete', finish)

      flushingWindows.delete(win)
      flushedWindows.add(win)
      win.close()
    }

    deps.ipcMain.once('app:flush-complete', finish)
    win.webContents.send('app:before-quit-flush')

    const timeoutHandle = setTimeout(finish, timeoutMs)
  }
}
