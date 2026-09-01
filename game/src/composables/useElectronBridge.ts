import { usePlayerStore } from '../stores/player'
import { useGameManager } from './useGameState'
import type { GameManager } from '../core/game/GameManager'

// Uncommitted audit followup plan, Ưu tiên 2 "xử lý khi đóng gói Electron"
// (2026-08-24) — cầu nối renderer ↔ main process, CHỈ tồn tại khi chạy
// trong bản Electron (window.electronAPI do electron/preload.ts expose qua
// contextBridge — interface bên dưới PHẢI khớp đúng shape object export ở
// đó). Bản build web thường (npm run dev/build) không có window.electronAPI
// -> mọi hàm ở đây no-op ngay, không ảnh hưởng gì tới target web.
//
// suspend/resume CHỈ để log/quan sát — KHÔNG có nghĩa vụ đúng đắn nào.
// GameClock (core/idle/GameClock.ts) đã tự đúng qua Date.now()-diff bất kể
// lý do gián đoạn (throttle, minimize, OS sleep...); core KHÔNG phụ thuộc
// event này để catch-up đúng (xem GameManager.updateBattleFixedStep()).
// KHÔNG nối event này vào OfflineProgressSystem — hệ thống đó chỉ chạy 1
// lần lúc player.load() (app khởi động lại), không dành cho gián đoạn
// giữa phiên.
export interface ElectronBridgeAPI {
  isElectron: true
  onSystemSuspend(callback: (timestamp: number) => void): void
  onSystemResume(callback: (timestamp: number) => void): void
  onBeforeQuitFlush(callback: () => void): void
  notifyFlushComplete(): void
}

declare global {
  interface Window {
    electronAPI?: ElectronBridgeAPI
  }
}

// `gameManagerOverride` — cùng lý do useBreakthrough.ts's tham số cùng tên:
// App.vue gọi composable này trên CHÍNH cây component đã provide()
// GameManager ra, useGameManager() inject bên trong sẽ throw nếu tự gọi
// trên chính App.vue — truyền thẳng instance cục bộ để bỏ qua inject.
export function useElectronBridge(gameManagerOverride?: GameManager) {
  const electronAPI = window.electronAPI

  if (!electronAPI) {
    return
  }

  const player = usePlayerStore()
  const gameManager = gameManagerOverride ?? useGameManager()

  // Autosave khi đóng cửa sổ (electron/main.ts's bindQuitFlush()) — tái
  // dùng ĐÚNG action save() đã có (SettingsPanel.vue's nút Save gọi cùng
  // hàm này), không tạo cơ chế save mới.
  electronAPI.onBeforeQuitFlush(() => {
    // Audit fix 2026-08-31 — PHẢI đợi write xong: player.save chạy async qua
    // cloudSaveCoordinator → LocalCloudSaveService; flush-complete trước đó
    // khiến main process đóng app tin rằng đã lưu (silent data loss khi
    // quota fail). IIFE async vì ipcRenderer.on callback không handle
    // promise; FLUSH_TIMEOUT_MS (main.ts) vẫn là backstop nếu save treo.
    void (async () => {
      try {
        await player.save(gameManager)
      } catch (error: unknown) {
        console.error('[electron] quit flush save failed', error)
      } finally {
        electronAPI.notifyFlushComplete()
      }
    })()
  })

  electronAPI.onSystemSuspend(timestamp => {
    console.info('[electron] system suspend', new Date(timestamp).toISOString())
  })

  electronAPI.onSystemResume(timestamp => {
    console.info('[electron] system resume', new Date(timestamp).toISOString())
  })
}
