import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Uncommitted audit followup plan, Ưu tiên 2 "xử lý khi đóng gói Electron"
// (2026-08-24) — main process cho bản desktop, mục đích DUY NHẤT là
// backgroundThrottling:false bên dưới (giữ nhịp setInterval(tick, 200) của
// App.vue mượt khi cửa sổ bị ẩn/minimize/mất focus, thay vì Chromium tự
// throttle). Correctness của combat/GameClock KHÔNG phụ thuộc file này —
// GameManager.updateBattleFixedStep()/GameClock đã tự đúng với deltaSeconds
// bất kỳ độ lớn nào từ trước (xem core/game/GameManager.ts).
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

  powerMonitor.on('resume', () => {
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

    win.on('close', event => bindQuitFlush(win, event))

    win.on('closed', () => {
      mainWindow = null
    })

    return win
  }
}

const FLUSH_TIMEOUT_MS = 2000

// Autosave khi đóng cửa sổ — lần 'close' ĐẦU chặn lại, yêu cầu renderer
// flush save (đường IPC 'app:flush-complete', xem electron/preload.ts) rồi
// mới tự gọi lại win.close(). `saveFlushed` phải sống NGOÀI hàm này (đóng
// theo `win`, không phải theo lần gọi) — win.close() ở dưới tự kích hoạt
// lại đúng sự kiện 'close' này; không có cờ nhớ trạng thái thì sẽ
// preventDefault() vô hạn, cửa sổ không bao giờ đóng được thật.
const flushedWindows = new WeakSet<BrowserWindow>()

function bindQuitFlush(win: BrowserWindow, event: Electron.Event) {
  if (flushedWindows.has(win)) {
    return
  }

  event.preventDefault()

  let settled = false

  const finish = () => {
    if (settled) {
      return
    }

    settled = true

    clearTimeout(timeoutHandle)
    ipcMain.removeListener('app:flush-complete', finish)

    flushedWindows.add(win)
    win.close()
  }

  ipcMain.once('app:flush-complete', finish)
  win.webContents.send('app:before-quit-flush')

  const timeoutHandle = setTimeout(finish, FLUSH_TIMEOUT_MS)
}
