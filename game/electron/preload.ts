import { contextBridge, ipcRenderer } from 'electron'

// Uncommitted audit followup plan, Ưu tiên 2 (2026-08-24) — bề mặt API DUY
// NHẤT renderer được phép thấy, đúng 5 field, không expose ipcRenderer/
// require thô ra window. Xem game/src/composables/useElectronBridge.ts cho
// phía renderer tiêu thụ các hàm này (interface ElectronBridgeAPI ở đó
// phải khớp đúng shape object bên dưới).
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  onSystemSuspend(callback: (timestamp: number) => void) {
    ipcRenderer.on('system:suspend', (_event, timestamp: number) => callback(timestamp))
  },

  onSystemResume(callback: (timestamp: number) => void) {
    ipcRenderer.on('system:resume', (_event, timestamp: number) => callback(timestamp))
  },

  onBeforeQuitFlush(callback: () => void) {
    ipcRenderer.on('app:before-quit-flush', () => callback())
  },

  notifyFlushComplete() {
    ipcRenderer.send('app:flush-complete')
  },
})
