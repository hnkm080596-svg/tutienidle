import { app, BrowserWindow, ipcMain, powerMonitor, safeStorage } from 'electron'
import path from 'node:path'
import { promises as fsp } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  createCombatClockHost,
  attachPowerMonitorToClockHost,
} from '../src/main-process/combatClockHost'
import { createQuitFlush } from '../src/main-process/quitFlush'
import {
  GuestCredentialStore,
  registerGuestCredentialIpc,
} from '../src/main-process/GuestCredentialStore'
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

// B1.8 test accommodation: headless/CI boxes ship no OS keyring
// (safeStorage.isEncryptionAvailable() is false there and kwallet prompts
// for a wallet it cannot create unattended). TUTIEN_E2E_CREDENTIAL_CIPHER=e2e
// swaps ONLY the cipher primitive inside the real GuestCredentialStore -
// base64 with an integrity marker, so corrupted-detection still works -
// while the store, IPC allowlist, atomic write and disk path stay the
// production ones. Never set on packaged builds; the e2e spec asserts the
// file is not plaintext.
const e2eCipher = process.env.TUTIEN_E2E_CREDENTIAL_CIPHER === 'e2e'
  ? {
      canEncrypt: () => true,
      encrypt: (plaintext: string) =>
        Buffer.from(Buffer.from(`e2e:${plaintext}`, 'utf8').toString('base64'), 'utf8'),
      decrypt: (ciphertext: Uint8Array) => {
        const decoded = Buffer.from(Buffer.from(ciphertext).toString('utf8'), 'base64').toString('utf8')
        if (!decoded.startsWith('e2e:')) throw new Error('e2e cipher integrity marker missing')
        return decoded.slice(4)
      },
    }
  : null

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
    // B1.8 - the OS-protected durable guest credential (spec: safeStorage
    // behind a fixed app-data path, allowlisted IPC only). Registration is
    // inside whenReady so userData is resolved; safeStorage availability is
    // queried per-call - unavailability surfaces as a typed recovery error,
    // never a plaintext fallback.
    const guestCredentialStore = new GuestCredentialStore({
      credentialPath: path.join(app.getPath('userData'), 'guest-credential.bin'),
      canEncrypt: e2eCipher?.canEncrypt ?? (() => safeStorage.isEncryptionAvailable()),
      encrypt: e2eCipher?.encrypt ?? (plaintext => safeStorage.encryptString(plaintext)),
      decrypt: e2eCipher?.decrypt ?? (ciphertext => safeStorage.decryptString(Buffer.from(ciphertext))),
      readFile: p => fsp.readFile(p),
      writeFile: (p, data) => fsp.writeFile(p, data),
      renameFile: (from, to) => fsp.rename(from, to),
      removeFile: p => fsp.rm(p, { force: true }),
    })
    registerGuestCredentialIpc(guestCredentialStore, ipcMain)

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

    win.on('close', event => onQuitFlushClose(win, event))

    win.on('closed', () => {
      mainWindow = null
    })

    return win
  }
}

