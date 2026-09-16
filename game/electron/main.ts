import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createCombatClockHost,
  attachPowerMonitorToClockHost,
} from '../src/main-process/combatClockHost'
import { createQuitFlush } from '../src/main-process/quitFlush'

// Uncommitted audit followup plan, Ưu tiên 2 "xử lý khi đóng gói Electron"
// (2026-08-24) — main process cho bản desktop. Hai mục đích:
// 1) backgroundThrottling:false bên dưới, giữ nhịp setInterval(tick, 200) của
//    App.vue mượt khi cửa sổ bị ẩn/minimize/mất focus thay vì Chromium tự
//    throttle. Correctness của combat/GameClock KHÔNG phụ thuộc file này —
//    GameManager.updateBattleFixedStep()/GameClock đã tự đúng với
//    deltaSeconds bất kỳ độ lớn nào từ trước (xem core/game/GameManager.ts).
// 2) (Task 7, 2026-09-10) host combatClockHost bên dưới — nguồn ClockSource
//    "honest" hơn nữa cho renderer dưới Electron: main-process setInterval
//    không bị Chromium throttle giống rAF, kể cả khi backgroundThrottling
//    có lỡ bị bật lại. Xem src/main-process/combatClockHost.ts.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Save (SaveSystem.ts) là localStorage đồng bộ, không có coordination giữa
// nhiều tiến trình — 2 cửa sổ cùng ghi sẽ đè lẫn nhau.
const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  main()
}

function main() {
  let mainWindow: BrowserWindow | null = null

  // Main-process clock host (Task 7) — see src/main-process/combatClockHost.ts
  // for why this exists: Chromium can throttle the renderer's rAF, so the
  // production ClockSource under Electron ticks from here instead, over IPC.
  // One host for the one BrowserWindow this app creates (see the
  // single-instance lock above).
  const clockHost = createCombatClockHost()

  // Autosave on window close — the first 'close' is held while the renderer
  // flushes its save (IPC 'app:flush-complete', see electron/preload.ts),
  // then win.close() re-enters and passes through. The handler keeps the
  // flushed/flushing window state (see src/main-process/quitFlush.ts);
  // a second user close during the flush window stays blocked without
  // re-sending the flush request (audit T6-52).
  const onQuitFlushClose = createQuitFlush({ ipcMain })

  ipcMain.on('combat-clock:start', () => {
    clockHost.start(16, (elapsed) => {
      mainWindow?.webContents.send('combat-clock:tick', elapsed)
    })
  })

  ipcMain.on('combat-clock:stop', () => {
    clockHost.stop()
  })

  app.on('second-instance', () => {
    if (!mainWindow) {
      return
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.focus()
  })

  app.whenReady().then(() => {
    mainWindow = createWindow()
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  powerMonitor.on('suspend', () => {
    mainWindow?.webContents.send('system:suspend', Date.now())
  })

  // Task 7, ruling 3 — the precise OS-resume signal re-anchors clockHost's
  // baseline (the elapsed-threshold in combatClockHost.ts stays as a backstop
  // for a stall that raises no power event). Wiring lives in
  // combatClockHost.ts, not here, so it has test coverage — main.ts itself
  // has none. reset() runs before the 'system:resume' forward below, in the
  // order attachPowerMonitorToClockHost's own test asserts.
  attachPowerMonitorToClockHost(powerMonitor, clockHost, () => {
    mainWindow?.webContents.send('system:resume', Date.now())
  })

  function createWindow(): BrowserWindow {
    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      title: 'Tiên Hiệp Idle',
      icon: path.join(__dirname, '../build/icon.ico'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.mjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,

        // Fix chính của toàn bộ file này — không cho Chromium throttle
        // timer/rAF của cửa sổ này khi bị ẩn/minimize/mất focus.
        backgroundThrottling: false,
      },
    })

    if (process.env.VITE_DEV_SERVER_URL) {
      win.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
      win.loadFile(path.join(__dirname, '../dist/index.html'))
    }

    win.on('close', event => onQuitFlushClose(win, event))

    win.on('closed', () => {
      mainWindow = null
    })

    return win
  }
}

