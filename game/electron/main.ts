import { app, BrowserWindow, dialog, ipcMain, powerMonitor } from 'electron'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  createCombatClockHost,
  attachPowerMonitorToClockHost,
} from '../src/main-process/combatClockHost'
import { createQuitFlush } from '../src/main-process/quitFlush'
import {
  DiagnosticBundle,
  sanitizeReportIdForFilename,
} from '../src/main-process/DiagnosticBundle'
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

  // BETA-FINAL PR11 / spec B8 - the local diagnostic bundle. One writer
  // owns <userData>/diagnostics; renderer events arrive over
  // 'diagnostic:record' and are re-validated before persistence (a hostile
  // renderer can never smuggle payloads - freeform/unknown keys reject).
  // Built eagerly so early process-level failures still land in the trail;
  // denied disk access degrades to no-op inside the bundle itself.
  const diagnostics = new DiagnosticBundle({
    directory: path.join(app.getPath('userData'), 'diagnostics'),
    identity: BUILD_IDENTITY,
    fs,
    platform: {
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      osType: os.type(),
      versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
      },
    },
  })

  const recordMain = (input: unknown) => {
    void diagnostics.append(input)
  }

  process.on('uncaughtException', (error) => {
    recordMain({
      source: 'main',
      severity: 'fatal',
      category: 'main-error',
      code: 'UNCAUGHT_EXCEPTION',
      message: error.message,
      stack: error.stack,
      details: { errorName: error.name },
    })
  })

  process.on('unhandledRejection', (reason) => {
    recordMain({
      source: 'main',
      severity: 'error',
      category: 'main-error',
      code: 'UNHANDLED_REJECTION',
      message: reason instanceof Error ? reason.message : String(reason),
      ...(reason instanceof Error && reason.stack ? { stack: reason.stack } : {}),
    })
  })

  ipcMain.on('diagnostic:record', (_event, payload) => {
    // The renderer asserts 'renderer' as source; anything else it claims is
    // rewritten - a forged 'main' label can never masquerade as main-side.
    const tagged =
      payload !== null && typeof payload === 'object' && !Array.isArray(payload)
        ? { ...(payload as Record<string, unknown>), source: 'renderer' }
        : payload
    recordMain(tagged)
  })

  ipcMain.handle('diagnostic:report-id', () => diagnostics.reportId())

  // The renderer supplies the save/revision metadata only - the PATH comes
  // exclusively from the main-side save dialog, and the bundle bytes are
  // generated here: nothing renderer-controlled can reach the filesystem
  // outside this channel.
  ipcMain.handle('diagnostic:export', async (_event, payload) => {
    const context: { revision?: number; saveHash?: string } = {}
    if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
      const raw = payload as Record<string, unknown>
      if (Number.isSafeInteger(raw.revision) && (raw.revision as number) >= 0) {
        context.revision = raw.revision as number
      }
      if (
        typeof raw.saveHash === 'string' &&
        /^[a-zA-Z0-9]{1,128}$/.test(raw.saveHash)
      ) {
        context.saveHash = raw.saveHash
      }
    }
    const reportId = await diagnostics.reportId()
    const dialogOptions = {
      title: 'Export diagnostic report',
      defaultPath: path.join(
        app.getPath('documents'),
        `tutienidle-diagnostics-${sanitizeReportIdForFilename(reportId)}.json`,
      ),
      filters: [{ name: 'Diagnostic report', extensions: ['json'] }],
    }
    const parent = BrowserWindow.getFocusedWindow() ?? mainWindow
    const picked = parent
      ? await dialog.showSaveDialog(parent, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions)
    if (picked.canceled || !picked.filePath) {
      return { status: 'cancelled' }
    }
    return diagnostics.export(picked.filePath, context)
  })

  ipcMain.on('app:flush-result', (_event, payload) => {
    // Parallel observation only: quitFlush's own listener still drives the
    // close protocol. Field-picked (never spread) so a crafted payload can
    // carry at most these scalars into the trail.
    if (payload === null || typeof payload !== 'object') return
    const raw = payload as Record<string, unknown>
    const status = raw.status
    if (status !== 'saved' && status !== 'blocked' && status !== 'failed') return
    const details: Record<string, string | number> = { status }
    if (typeof raw.requestId === 'string') details.requestId = raw.requestId
    if (Number.isSafeInteger(raw.generation)) details.generation = raw.generation as number
    if (Number.isSafeInteger(raw.revision)) details.revision = raw.revision as number
    if (typeof raw.code === 'string') details.code = raw.code
    recordMain({
      source: 'main',
      severity: status === 'saved' ? 'info' : 'error',
      category: 'quit-flush',
      code: `FLUSH_RESULT_${status.toUpperCase()}`,
      message: `quit flush result observed: ${status}`,
      details,
    })
  })

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

    // A crashed/killed renderer still leaves a marker in the trail.
    win.webContents.on('render-process-gone', (_event, details) => {
      recordMain({
        source: 'main',
        severity: 'fatal',
        category: 'render-process-gone',
        code: 'RENDER_PROCESS_GONE',
        message: `render process gone: ${details.reason}`,
        details: { reason: details.reason, exitCode: details.exitCode },
      })
    })

    win.on('close', event => onQuitFlushClose(win, event))

    win.on('closed', () => {
      mainWindow = null
    })

    return win
  }
}

