// scripts/electron-quit-flush-smoke.mjs — Mission B external-audit B1
// evidence: native Electron close -> quit-flush IPC -> renderer save ->
// flush-complete ACK -> window closes -> relaunch -> state persisted.
//
// What a browser Playwright spec cannot see: the REAL native 'close'
// event held by createQuitFlush while the renderer runs the async
// player.save(). This script drives the packaged build (dist/ +
// dist-electron/) under a real Electron binary.
//
// Usage (from game/):
//   ELECTRON=1 npx vite build
//   node scripts/electron-quit-flush-smoke.mjs
//
// Env overrides (worktree runs):
//   ELECTRON_EXE            path to electron.exe (binary only — the code
//                           under test is ELECTRON_APP_MAIN)
//   ELECTRON_APP_MAIN       path to the built dist-electron/main.js
//   PLAYWRIGHT_CORE_FROM    dir whose node_modules provides playwright-core
//                           (defaults: this package, then cwd)

import { createRequire } from 'node:module'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const gameDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const APP_MAIN =
  process.env.ELECTRON_APP_MAIN ?? path.join(gameDir, 'dist-electron', 'main.js')
const SAVE_KEY = 'tien-hiep-idle-save:guest'

function requirePlaywrightCore() {
  const bases = [gameDir, process.env.PLAYWRIGHT_CORE_FROM, process.cwd()]
  for (const base of bases) {
    if (!base) continue
    try {
      return createRequire(path.join(base, 'package.json'))('playwright-core')
    } catch {
      // try next base
    }
  }
  throw new Error(
    'playwright-core not resolvable — set PLAYWRIGHT_CORE_FROM to a dir whose node_modules contains it',
  )
}

const { _electron: electronDriver } = requirePlaywrightCore()

const electronExe =
  process.env.ELECTRON_EXE ??
  path.join(gameDir, 'node_modules', 'electron', 'dist', 'electron.exe')

if (!fs.existsSync(APP_MAIN)) {
  throw new Error(`built main missing: ${APP_MAIN} — run ELECTRON=1 npx vite build first`)
}
if (!fs.existsSync(electronExe)) {
  throw new Error(`electron binary missing: ${electronExe} — set ELECTRON_EXE`)
}

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'tutien-electron-smoke-'))

// The packaged renderer references absolute /assets/... URLs which cannot
// resolve under loadFile(file://). Serve dist/ over loopback HTTP and use
// the app's own VITE_DEV_SERVER_URL hook (electron/main.ts) — the
// quit-flush IPC path under test is identical either way.
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.webp': 'image/webp', '.gif': 'image/gif' }
const distDir = path.join(gameDir, 'dist')
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
  const file = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath)
  if (!file.startsWith(distDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404)
    res.end()
    return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const devServerUrl = `http://127.0.0.1:${server.address().port}`

function fail(message) {
  console.error(`[smoke] FAIL: ${message}`)
  process.exitCode = 1
}

async function waitVisible(win, selector, timeoutMs = 30_000) {
  await win.locator(selector).waitFor({ state: 'visible', timeout: timeoutMs })
}

async function readSave(win) {
  return win.evaluate((key) => {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  }, SAVE_KEY)
}

async function waitAttribute(win, selector, name, value, timeoutMs = 30_000) {
  await win.waitForFunction(
    ({ sel, attr, expected }) => document.querySelector(sel)?.getAttribute(attr) === expected,
    { sel: selector, attr: name, expected: value },
    { timeout: timeoutMs },
  )
}

async function launch() {
  const env = { ...process.env, VITE_DEV_SERVER_URL: devServerUrl }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electronDriver.launch({
    executablePath: electronExe,
    args: [APP_MAIN, `--user-data-dir=${userData}`],
    env,
    timeout: 60_000,
  })
  return app
}

async function bootToHome(win) {
  await waitVisible(win, '[data-testid="auth-screen"]')
  await win.getByTestId('auth-guest-button').click()
}

async function createCharacter(win, name) {
  await waitVisible(win, '[data-testid="character-creation-screen"]', 15_000)
  await win.getByTestId('creation-name-input').fill(name)
  await win.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="creation-continue-name"]')
      return el instanceof HTMLButtonElement && !el.disabled
    },
    undefined,
    { timeout: 5_000 },
  )
  await win.getByTestId('creation-continue-name').click()

  const talent = win.locator('[data-testid^="creation-talent-"]').first()
  await talent.waitFor({ state: 'visible', timeout: 10_000 })
  await talent.click()
  await win.getByTestId('creation-confirm-talent').click()

  const buttons = win.locator('[data-testid^="creation-attribute-plus-"]')
  const count = await buttons.count()
  for (let i = 0; i < Math.min(count, 5); i++) {
    await buttons.nth(i).click()
  }
  await win.getByTestId('creation-finish').click()
}

async function enterHome(win) {
  await waitVisible(win, '.game-root')
  await waitAttribute(win, '[data-testid="presentation-overlay"]', 'data-phase', 'idle')
  await waitAttribute(win, '[data-testid="presentation-overlay"]', 'data-curtain', 'opened')

  const tutorial = win.locator('.tutorial-overlay')
  if (await tutorial.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await win.getByRole('button', { name: 'Bỏ Qua' }).click()
    await tutorial.waitFor({ state: 'hidden', timeout: 5_000 })
  }

  const offlineModal = win.locator('.offline-summary')
  if (await offlineModal.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await offlineModal.getByRole('button', { name: 'Tiếp Tục' }).click()
    await offlineModal.waitFor({ state: 'hidden', timeout: 5_000 })
  }
}

const launchedApps = []
try {
  console.log('[smoke] userData =', userData)
  console.log('[smoke] app main =', APP_MAIN)
  console.log('[smoke] dev url =', devServerUrl)

  // --- Launch 1: create character, mutate live state, native close ----
  const app1 = await launch()
  launchedApps.push(app1)
  const win1 = await app1.firstWindow()
  win1.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)))

  await bootToHome(win1)

  // Isolation check: a fresh userData profile must have no save yet.
  const preCreate = await readSave(win1)
  if (preCreate !== null) {
    fail(`userData not isolated — guest save already present: ${preCreate?.player?.name}`)
  }

  await createCharacter(win1, 'SmokeBot')
  await enterHome(win1)

  const baseline = await readSave(win1)
  if (baseline === null) {
    fail('no guest save after character creation (boot-transaction first save missing)')
  }
  console.log('[smoke] baseline save: name=%s lastSavedAt=%s', baseline?.player?.name, baseline?.player?.lastSavedAt)

  // Mutate LIVE state (not localStorage) so only the quit-flush write can
  // carry it to disk: Pinia reachable through the mounted Vue app. The
  // sentinel is `name` — NOT an accrued field: a per-tick authority like
  // addCultivation() would normalize a tampered cultivation value before
  // the flush save runs.
  const sentinelName = 'SmokeBotFlush'
  const mutated = await win1.evaluate((name) => {
    const el = document.getElementById('app')
    const app = el?.__vue_app__
    const provides = app?._context?.provides
    if (!provides) return 'no-app'
    const pinia = Object.getOwnPropertySymbols(provides)
      .map((s) => provides[s])
      .find((v) => v && typeof v === 'object' && v._s instanceof Map)
    const store = pinia?._s?.get('player')
    if (!store) return 'no-store'
    store.$state.name = name
    return 'ok'
  }, sentinelName)
  console.log('[smoke] live-state mutation:', mutated)

  const preClose = await readSave(win1)
  const tClose = Date.now()

  // app.close() -> 'close' event -> quit-flush holds -> IPC
  // 'app:before-quit-flush' -> renderer player.save() -> notifyFlushComplete
  // -> window actually closes. Resolves when the process exits.
  await app1.close()
  console.log('[smoke] app1 closed at', tClose)

  // --- Launch 2: relaunch, verify the flushed write --------------------
  const app2 = await launch()
  launchedApps.push(app2)
  const win2 = await app2.firstWindow()
  win2.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)))
  await waitVisible(win2, '[data-testid="auth-screen"]')

  const after = await readSave(win2)
  if (after === null) {
    fail('no guest save after relaunch')
  } else {
    if (!(after.player?.lastSavedAt > preClose.player.lastSavedAt)) {
      fail(`lastSavedAt did not advance past pre-close read (${after.player?.lastSavedAt} vs ${preClose.player.lastSavedAt}) — the quit-flush was not the last writer`)
    }
    if (mutated === 'ok' && after.player?.name !== sentinelName) {
      fail(`name sentinel not persisted: ${after.player?.name} !== ${sentinelName}`)
    }
    console.log('[smoke] relaunch save: name=%s lastSavedAt=%s', after?.player?.name, after?.player?.lastSavedAt)
  }

  // Durability end-to-end: guest re-auth restores INTO the game. The
  // boot path re-runs restore + presentation on cold caches — give the
  // home mount more room than the creation-screen default.
  await win2.getByTestId('auth-guest-button').click()
  await win2.locator('.game-root').waitFor({ state: 'visible', timeout: 60_000 })
  await enterHome(win2)
  console.log('[smoke] relaunch boot restored into game home')

  await app2.close()
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
} finally {
  for (const app of launchedApps) {
    try {
      await Promise.race([app.close(), new Promise((r) => setTimeout(r, 10_000))])
    } catch {
      // already closed
    }
  }
  server.close()
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.rmSync(userData, { recursive: true, force: true })
      break
    } catch {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}

if (process.exitCode) {
  console.error('[smoke] RESULT: FAIL')
} else {
  console.log('[smoke] RESULT: PASS — native close -> flush -> ACK -> close -> relaunch persisted')
}
