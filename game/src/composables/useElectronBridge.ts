import { usePlayerStore } from '../stores/player'
import { useNotificationStore } from '../stores/notification'
import { useGameManager } from './useGameState'
import { i18n } from '@/i18n'
import type { GameManager } from '../core/game/GameManager'
import type { CombatClockBridge } from '../presentation/clock/MainProcessClockSource'

// Uncommitted audit followup plan, Ưu tiên 2 "xử lý khi đóng gói Electron"
// (2026-08-24) — cầu nối renderer ↔ main process, CHỈ tồn tại khi chạy
// trong bản Electron (window.electronAPI do electron/preload.ts expose qua
// contextBridge — interface bên dưới PHẢI khớp đúng shape object export ở
// đó). Bản build web thường (npm run dev/build) không có window.electronAPI
// -> mọi hàm ở đây no-op ngay, không ảnh hưởng gì tới target web.
//
// suspend/resume is for logging/observation ONLY - it carries no
// correctness obligation. GameClock (core/idle/GameClock.ts) already
// self-corrects via Date.now() diff regardless of
// interruption reasons (throttle, minimize, OS sleep...); core does NOT
// depend on this event for correct catch-up (see
// GameManager.updateBattleFixedStep()). Do NOT wire this event into
// OfflineProgressSystem - that system runs once at boot load (app
// restart), not for mid-session interruptions.
export interface ElectronBridgeAPI {
  isElectron: true
  // Mỗi onX trả về hàm unsubscribe (preload.ts gỡ đúng ipcRenderer handler
  // đã đăng ký) — teardown gọi được, không chồng listener qua HMR/remount
  // (ARCH-013/L04).
  onSystemSuspend(callback: (timestamp: number) => void): () => void
  onSystemResume(callback: (timestamp: number) => void): () => void
  onBeforeQuitFlush(callback: () => void): () => void
  notifyFlushComplete(): void
  // Task 7 (2026-09-10) — main-process clock host bridge, consumed by
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
export function useElectronBridge(gameManagerOverride?: GameManager): (() => void) | undefined {
  const electronAPI = window.electronAPI

  if (!electronAPI) {
    return undefined
  }

  const player = usePlayerStore()
  const notification = useNotificationStore()
  const gameManager = gameManagerOverride ?? useGameManager()

  // Autosave khi đóng cửa sổ (electron/main.ts's bindQuitFlush()) — tái
  // dùng ĐÚNG action save() đã có (SettingsPanel.vue's nút Save gọi cùng
  // hàm này), không tạo cơ chế save mới.
  const offBeforeQuitFlush = electronAPI.onBeforeQuitFlush(() => {
    // Audit fix 2026-08-31 — PHẢI đợi write xong: player.save chạy async qua
    // cloudSaveCoordinator → LocalCloudSaveService; flush-complete trước đó
    // khiến main process đóng app tin rằng đã lưu (silent data loss khi
    // quota fail). IIFE async vì ipcRenderer.on callback không handle
    // promise; FLUSH_TIMEOUT_MS (main.ts) vẫn là backstop nếu save treo.
    void (async () => {
      try {
        const result = await player.save(gameManager)

        // The write result is the acknowledgement contract: a resolved
        // non-ok status is still a failed save and must be logged +
        // surfaced. notifyFlushComplete stays in finally - the close is
        // never blocked by a save failure (the 2s main timeout backstops).
        if (result.status !== 'ok') {
          console.error('[electron] quit flush save failed', result)
          notification.push('error', i18n.global.t('panels.settings.notifications.saveFailed'))
        }
      } catch (error: unknown) {
        console.error('[electron] quit flush save failed', error)
        notification.push('error', i18n.global.t('panels.settings.notifications.saveFailed'))
      } finally {
        electronAPI.notifyFlushComplete()
      }
    })()
  })

  const offSystemSuspend = electronAPI.onSystemSuspend(timestamp => {
    console.info('[electron] system suspend', new Date(timestamp).toISOString())
  })

  const offSystemResume = electronAPI.onSystemResume(timestamp => {
    console.info('[electron] system resume', new Date(timestamp).toISOString())
  })

  return () => {
    offBeforeQuitFlush()
    offSystemSuspend()
    offSystemResume()
  }
}
