import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const baseURL = process.env.TEST_SANDBOX_URL ?? 'http://127.0.0.1:5188'
const runId = Date.now()
const evidence = path.resolve(`docs/qa/test-sandbox/browser-${runId}`)
fs.mkdirSync(evidence, { recursive: true })
// Keep browser databases outside Vite's watched source tree. The profile
// is intentionally retained; no cleanup or file deletion is performed.
const context = await chromium.launchPersistentContext(path.resolve(`node_modules/.cache/test-sandbox-browser/${runId}`), {
  channel: 'msedge', headless: true, viewport: { width: 1440, height: 900 },
})
const page = context.pages()[0] ?? await context.newPage()
page.setDefaultTimeout(60_000)
const errors = []
const consoleMessages = []
const remoteRequests = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (['error', 'warning'].includes(message.type())) consoleMessages.push(message.text().slice(0, 1200))
})
page.on('request', (request) => {
  if (/\/(auth|rest|functions)\/v1\//.test(request.url())) remoteRequests.push(request.url().split('?')[0])
})
const sandboxKey = 'tien-hiep-idle-save:local-test-sandbox-v1'
const ordinaryKey = 'tien-hiep-idle-save:guest'
const sentinel = 'ordinary-save-must-survive'
async function readSave() {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), sandboxKey)
}
async function openTools() {
  await page.locator('.dev-panel-open').click()
  await page.getByTestId('dev-tools-panel').waitFor({ state: 'visible' })
}
async function waitForGame() {
  await page.locator('.dev-panel-open').waitFor({ state: 'visible' })
  await page.locator('[data-testid="presentation-overlay"][data-phase="idle"]').waitFor({ state: 'attached' })
}
try {
  await page.goto(baseURL)
  console.log('Opened normal entry')
  await page.getByTestId('test-sandbox-switch').waitFor()
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: ordinaryKey, value: sentinel })
  await page.screenshot({ path: path.join(evidence, '01-entry.png') })
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.getByTestId('test-sandbox-switch').click(),
  ])
  console.log('Selected sandbox; awaiting game')
  await waitForGame()
  assert.match(await page.getByTestId('test-sandbox-controls').innerText(), /TEST/)
  assert.equal((await readSave()).player.realmId, 'mortal')
  await openTools()
  await page.screenshot({ path: path.join(evidence, '02-mortal-tools.png') })
  await page.getByTestId('sandbox-preset-body').click()
  await page.getByRole('alert').filter({ hasText: /chưa mở|outside/ }).waitFor()
  assert.equal((await readSave()).player.realmId, 'mortal')
  await page.getByTestId('sandbox-preset-spell').click()
  await page.getByRole('alertdialog').locator('.ornate-dialog__close').click()
  assert.equal((await readSave()).player.realmId, 'mortal')
  for (const preset of ['spell', 'mortal']) {
    if (preset !== 'spell') await openTools()
    await page.getByTestId(`sandbox-preset-${preset}`).click()
    await page.getByRole('alertdialog').waitFor()
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.getByRole('alertdialog').locator('.confirm-modal__confirm').click(),
    ])
    await waitForGame()
    await page.waitForFunction(({ key, preset }) => {
      const player = JSON.parse(localStorage.getItem(key) ?? '{}').player
      return player && (preset === 'mortal' ? player.realmId === 'mortal' : player.cultivationPath === preset)
    }, { key: sandboxKey, preset })
    await page.screenshot({ path: path.join(evidence, `03-preset-${preset}.png`) })
    await page.reload()
    await waitForGame()
    const save = await readSave()
    assert.equal(save.player.realmId, preset === 'mortal' ? 'mortal' : 'qi_refining')
    assert.equal(save.player.cultivationPath, preset === 'mortal' ? undefined : preset)
    console.log(`Preset ${preset} persisted across reload`)
  }
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), ordinaryKey), sentinel)
  const beforeExit = await readSave()
  await page.evaluate((saveKey) => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === saveKey) throw new DOMException('Test storage refusal', 'QuotaExceededError')
      original.call(this, key, value)
    }
  }, sandboxKey)
  await page.getByTestId('test-sandbox-switch').click()
  await page.getByTestId('test-sandbox-controls').getByRole('alert').waitFor()
  assert.equal(await page.evaluate(() => localStorage.getItem('tutienidle-test-sandbox-v1')), '1')
  await page.screenshot({ path: path.join(evidence, '04-save-failure-retains-sandbox.png') })
  await page.reload()
  await waitForGame()
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.getByTestId('test-sandbox-switch').click(),
  ])
  await page.waitForFunction(() => localStorage.getItem('tutienidle-test-sandbox-v1') === '0')
  await page.getByTestId('auth-screen').waitFor({ state: 'visible' })
  assert.equal(await page.locator('.dev-panel-open').count(), 0)
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), ordinaryKey), sentinel)
  assert.equal((await readSave()).player.name, beforeExit.player.name)
  await page.screenshot({ path: path.join(evidence, '05-normal-mode.png') })
  assert.equal(remoteRequests.length, 0, 'sandbox must not call a remote backend')
  assert.deepEqual(errors, [], 'no unhandled runtime errors')
  fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify({ status: 'PASS', baseURL, remoteRequests, errors }, null, 2))
  console.log(`PASS: entry, allowed presets, scope refusal, cancel, reload, save-failure handling, return, ordinary save isolation; ${evidence}`)
} catch (error) {
  await page.screenshot({ path: path.join(evidence, 'failure.png') }).catch(() => {})
  fs.writeFileSync(path.join(evidence, 'failure.json'), JSON.stringify({ message: String(error), errors, remoteRequests, consoleMessages, body: (await page.locator('body').innerText()).slice(0, 3000) }, null, 2))
  throw error
} finally {
  await context.close()
}
