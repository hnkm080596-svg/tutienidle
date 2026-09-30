import { contextBridge, ipcRenderer } from 'electron'

// Uncommitted audit followup plan, Ưu tiên 2 (2026-08-24) — bề mặt API DUY
// NHẤT renderer được phép thấy, đúng 6 field, không expose ipcRenderer/
// require thô ra window. Xem game/src/composables/useElectronBridge.ts cho
// phía renderer tiêu thụ các hàm này (interface ElectronBridgeAPI ở đó
// phải khớp đúng shape object bên dưới).
//
// combatClock (Task 7, 2026-09-10) - main-process clock host
// (src/main-process/combatClockHost.ts) wrapped as onTick/stop only; không
// thêm global window.combatClock riêng để giữ đúng bất biến "1 bề mặt duy
// nhất". MainProcessClockSource (src/presentation/clock/) tiêu thụ field này.
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Mỗi onX TRẢ VỀ hàm unsubscribe (gỡ đúng handler đã đăng ký) — giữ
  // symmetric với combatClock.onTick và để renderer teardown/HMR có thể
  // gỡ subscription thay vì chồng listener (xem useElectronBridge: App
  // gọi disposer khi unmount — ARCH-013/L04).
  onSystemSuspend(callback: (timestamp: number) => void) {
    const handler = (_event: Electron.IpcRendererEvent, timestamp: number) => callback(timestamp)
    ipcRenderer.on('system:suspend', handler)
    return () => {
      ipcRenderer.removeListener('system:suspend', handler)
    }
  },

  onSystemResume(callback: (timestamp: number) => void) {
    const handler = (_event: Electron.IpcRendererEvent, timestamp: number) => callback(timestamp)
    ipcRenderer.on('system:resume', handler)
    return () => {
      ipcRenderer.removeListener('system:resume', handler)
    }
  },

  // B1-D result-bearing quit flush: the request carries an opaque
  // requestId the reply must quote; the main side closes the window only
  // on a 'saved' result bound to the pending attempt (see
  // src/main-process/quitFlush.ts). A failed/blocked/timeout attempt
  // returns as 'app:flush-failed'; retry/cancel/force-close are explicit
  // user choices quoting the failed requestId - a timeout NEVER closes.
  onBeforeQuitFlush(callback: (requestId: string) => void) {
    const handler = (_event: Electron.IpcRendererEvent, payload: { requestId?: string }) =>
      callback(typeof payload?.requestId === 'string' ? payload.requestId : '')
    ipcRenderer.on('app:before-quit-flush', handler)
    return () => {
      ipcRenderer.removeListener('app:before-quit-flush', handler)
    }
  },

  notifyFlushResult(result: unknown) {
    ipcRenderer.send('app:flush-result', result)
  },

  onFlushFailed(callback: (notice: { requestId: string; status: string; code?: string }) => void) {
    const handler = (
      _event: Electron.IpcRendererEvent,
      notice: { requestId: string; status: string; code?: string },
    ) => callback(notice)
    ipcRenderer.on('app:flush-failed', handler)
    return () => {
      ipcRenderer.removeListener('app:flush-failed', handler)
    }
  },

  retryQuitFlush(requestId: string) {
    ipcRenderer.send('app:flush-retry', { requestId })
  },

  cancelQuitClose(requestId: string) {
    ipcRenderer.send('app:close-cancel', { requestId })
  },

  forceQuitClose(requestId: string) {
    ipcRenderer.send('app:force-close', { requestId })
  },

  combatClock: {
    onTick(callback: (elapsedSeconds: number) => void) {
      const handler = (_event: Electron.IpcRendererEvent, elapsed: number) => callback(elapsed)
      ipcRenderer.on('combat-clock:tick', handler)
      ipcRenderer.send('combat-clock:start')

      // Only unregisters the renderer-side listener. Sending
      // 'combat-clock:stop' is left to the dedicated stop() below -
      // MainProcessClockSource.stop() (src/presentation/clock/) always calls
      // both, and having both send the same IPC message was a redundant
      // double-send noted in Task 7 review.
      return () => {
        ipcRenderer.removeListener('combat-clock:tick', handler)
      }
    },

    stop() {
      ipcRenderer.send('combat-clock:stop')
    },
  },

  // B1.8 durable guest identity - the ONLY seam to the OS-protected
  // credential store (src/main-process/GuestCredentialStore.ts). The
  // renderer gets operations and the session record; filesystem paths and
  // raw bytes never cross this bridge. Shape must match
  // GuestCredentialBridge in src/services/supabase/SupabaseSession.ts.
  guestCredentials: {
    load() {
      return ipcRenderer.invoke('guest-credential:load')
    },
    save(record: unknown) {
      return ipcRenderer.invoke('guest-credential:save', record)
    },
    clear() {
      return ipcRenderer.invoke('guest-credential:clear')
    },
  },
})
