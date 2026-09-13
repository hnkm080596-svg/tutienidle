import { contextBridge, ipcRenderer } from 'electron'

// Uncommitted audit followup plan, Ưu tiên 2 (2026-08-24) — bề mặt API DUY
// NHẤT renderer được phép thấy, đúng 6 field, không expose ipcRenderer/
// require thô ra window. Xem game/src/composables/useElectronBridge.ts cho
// phía renderer tiêu thụ các hàm này (interface ElectronBridgeAPI ở đó
// phải khớp đúng shape object bên dưới).
//
// combatClock (Task 7, 2026-09-10) — main-process clock host
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

  onBeforeQuitFlush(callback: () => void) {
    const handler = () => callback()
    ipcRenderer.on('app:before-quit-flush', handler)
    return () => {
      ipcRenderer.removeListener('app:before-quit-flush', handler)
    }
  },

  notifyFlushComplete() {
    ipcRenderer.send('app:flush-complete')
  },

  combatClock: {
    onTick(callback: (elapsedSeconds: number) => void) {
      const handler = (_event: Electron.IpcRendererEvent, elapsed: number) => callback(elapsed)
      ipcRenderer.on('combat-clock:tick', handler)
      ipcRenderer.send('combat-clock:start')

      // Only unregisters the renderer-side listener. Sending
      // 'combat-clock:stop' is left to the dedicated stop() below —
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
})
