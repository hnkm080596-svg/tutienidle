import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createCombatClockHost,
  attachPowerMonitorToClockHost,
} from '../src/main-process/combatClockHost'
import { createQuitFlush } from '../src/main-process/quitFlush'
import { BUILD_IDENTITY, shortGitSha } from '../src/shared/build/BuildIdentity'

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

  // Main-process clock host (Task 7) - see src/main-process/combatClockHost.ts
  // for why this exists: Chromium can throttle the renderer's rAF, so the
  // production ClockSource under Electron ticks from here instead, over IPC.
  // One host for the one BrowserWindow this app creates (see the
  // single-instance lock above).
  const clockHost = createCombatClockHost()

  // The same injected identity the renderer/settings surfaces render - logged
  // once at boot so packaged logs can be matched to the release manifest.
  console.log(
    `[build] ${BUILD_IDENTITY.productName} ${BUILD_IDENTITY.appVersion} ` +
      `build=${BUILD_IDENTITY.buildId} sha=${shortGitSha()} ` +
      `schema=${BUILD_IDENTITY.saveSchemaVersion} env=${BUILD_IDENTITY.backendEnvironment} ` +
      `channel=${BUILD_IDENTITY.releaseChannel} at=${BUILD_IDENTITY.builtAtUtc}`,
  )

  // Autosave on window close - the first 'close' is held while the renderer
  // runs the result-bearing flush (see src/main-process/quitFlush.ts for
  // the request/generation/sender-bound protocol), then win.close()
  // re-enters and passes through. The handler keeps the flushed/flushing
  // window state; a second user close during the flush window stays
  // blocked without re-sending the flush request (audit T6-52).
  const onQuitFlushClose = createQuitFlush({ ipcMain })

  // BETA-FINAL PR8 / spec B3 - privileged IPC accepts messages only from
  // the one BrowserWindow this app creates. sender identity plus frame URL
  // must both match: the packaged page is file://, dev is the Vite ORIGIN
  // (exact match - a startsWith check would pass 'localhost:5173.evil').
  const isDevOrigin = (url: string): boolean => {
    const devUrl = process.env.VITE_DEV_SERVER_URL
    if (!devUrl) return false
    try {
      return new URL(url).origin === new URL(devUrl).origin
    } catch {
      return false
    }
  }
  const isAppFrame = (frameUrl: string): boolean =>
    frameUrl.startsWith('file://') || isDevOrigin(frameUrl)
  const isAppSender = (event: Electron.IpcMainEvent): boolean => {
    if (event.sender !== mainWindow?.webContents) return false
    return isAppFrame(event.senderFrame?.url ?? '')
  }

  ipcMain.on('combat-clock:start', (event) => {
    if (!isAppSender(event)) return
    clockHost.start(16, (elapsed) => {
      mainWindow?.webContents.send('combat-clock:tick', elapsed)
    })
  })

  ipcMain.on('combat-clock:stop', (event) => {
    if (!isAppSender(event)) return
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

  // Task 7, ruling 3 - the precise OS-resume signal re-anchors clockHost's
  // baseline (the elapsed-threshold in combatClockHost.ts stays as a backstop
  // for a stall that raises no power event). Wiring lives in
  // combatClockHost.ts, not here, so it has test coverage - main.ts itself
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

        // BETA-FINAL PR8 - dev tooling ships OFF in the packaged build.
        devTools: !app.isPackaged,

        // Fix chính của toàn bộ file này — không cho Chromium throttle
        // timer/rAF của cửa sổ này khi bị ẩn/minimize/mất focus.
        backgroundThrottling: false,
      },
    })

    // BETA-FINAL PR8 / spec B3 - navigation and new-window allowlists. The
    // app is a single-window SPA booted once via loadFile/loadURL (which do
    // not fire will-navigate); every user/page-initiated navigation and
    // window.open is denied. Dev mode still allows in-page navigations
    // under the Vite origin so HMR-style reloads keep working.
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (event, url) => {
      if (!isDevOrigin(url)) {
        event.preventDefault()
      }
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

