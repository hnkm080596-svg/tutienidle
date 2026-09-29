// FE-17 only: mortal L12 -> Quan Khi -> qi_refining -> seed TC -> ceiling note
import { chromium } from '@playwright/test'

const BASE = 'http://localhost:5608'
const SAVE_KEY = 'tien-hiep-idle-save:guest'
const NAME = 'Trần Trần'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 300)))

const readSave = () =>
  page.evaluate((k) => {
    const raw = localStorage.getItem(k)
    return raw ? JSON.parse(raw) : null
  }, SAVE_KEY)

async function openWheel() {
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(600)
    if (await page.locator('[data-wheel-slot="realm"]').isVisible().catch(() => false)) return true
  }
  return false
}

// Post-reload landing: intro -> auth -> home, with a curtain lock and
// possible tutorial/offline blockers (mirrors helpers.ts reauth flow).
async function settleHome() {
  await page.getByTestId('auth-screen').waitFor({ state: 'visible', timeout: 20_000 })
  await page.getByTestId('auth-guest-button').click()
  await page.locator('.game-root').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(2500) // curtain settle
  const tut2 = page.locator('.tutorial-overlay')
  if (await tut2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Bỏ Qua' }).click()
    await page.waitForTimeout(600)
  }
  const offline = page.locator('.offline-summary')
  if (await offline.isVisible({ timeout: 2000 }).catch(() => false)) {
    await offline.getByRole('button', { name: 'Tiếp Tục' }).click()
    await page.waitForTimeout(600)
  }
}

await page.goto(BASE)
await page.waitForTimeout(3500)
await page.getByTestId('auth-guest-button').click()
await page.waitForTimeout(1200)
await page.getByTestId('creation-name-input').fill(NAME)
await page.locator('[data-testid^="creation-talent-"]').first().click()
await page.getByTestId('creation-skill-tram').click()
await page.getByTestId('creation-finish').click()
await page.waitForTimeout(2500)
const tut = page.locator('.tutorial-overlay')
if (await tut.isVisible({ timeout: 5000 }).catch(() => false)) {
  await page.getByRole('button', { name: 'Bỏ Qua' }).click()
  await page.waitForTimeout(600)
}
await page.waitForTimeout(1500)

// Save exists by now (autosave/post-creation write). Patch mortal L12.
const save = await readSave()
if (!save) {
  console.log('no save after creation — abort')
  await browser.close()
  process.exit(1)
}
save.player = { ...save.player, realmLevel: 12, cultivation: 0 }
await page.addInitScript(
  ({ key, payload }) => localStorage.setItem(key, JSON.stringify(payload)),
  { key: SAVE_KEY, payload: save },
)
await page.reload()
await settleHome()

if (!(await openWheel())) {
  console.log('wheel never opened after reload — abort')
  await browser.close()
  process.exit(1)
}
await page.locator('[data-wheel-slot="realm"]').click()
await page.waitForTimeout(1500)
const realmDialog = page.getByRole('dialog', { name: 'Cảnh Giới' })
const quanKhi = realmDialog.getByRole('button', { name: 'Quán Khí' })
console.log('quanKhi enabled:', await quanKhi.isEnabled().catch(() => false))
await quanKhi.click()
const confirm = page.getByRole('dialog', { name: /Độ kiếp cũng là độ thân/ })
await confirm.getByRole('button', { name: 'Đã hiểu' }).click()
await page.waitForTimeout(2500)

for (let i = 0; i < 240; i += 1) {
  const state = await page.evaluate(() => {
    const game = window.__tutienPhaserGame
    const d = game?.registry?.get('gameManager')?.tribulationDirector
    if (!d) return 'missing'
    d.answerQuestion?.(0)
    d.update(4)
    return d.getState()?.state ?? 'cleared'
  })
  if (state !== 'ongoing') {
    console.log('tribulation resolved:', state)
    break
  }
  await page.waitForTimeout(120)
}
await page.waitForTimeout(2000)

const modal = page.locator('[data-testid="talent-entitlement-modal"]')
if (await modal.isVisible({ timeout: 15000 }).catch(() => false)) {
  await modal.locator('button').first().click()
  await page.waitForTimeout(1000)
}
// The outcome commits on the drain tick; the QuanKhi panel auto-opens
// via standalonePanel after the curtain. Poll for it generously.
const ann = page.locator('.world-announcement')
for (let i = 0; i < 30; i += 1) {
  if (await ann.isVisible().catch(() => false)) await ann.click()
  if (await page.locator('.quan-khi-panel__choice').first().isVisible().catch(() => false)) break
  await page.waitForTimeout(1000)
}

const choice = page.locator('.quan-khi-panel__choice').first()
if (await choice.isVisible({ timeout: 5000 }).catch(() => false)) {
  await choice.click()
  const ok = page.locator('.confirm-modal__confirm')
  if (await ok.isVisible({ timeout: 6000 }).catch(() => false)) await ok.click()
  await page.waitForTimeout(1500)
} else {
  console.log('quan-khi choice never appeared — dumping visible overlays')
  const dump = await page.evaluate(() =>
    [...document.querySelectorAll('.overlay-panel, .world-announcement, [data-testid]')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => el.className || el.getAttribute('data-testid'))
      .slice(0, 30),
  )
  console.log('VISIBLE:', JSON.stringify(dump))
  await page.screenshot({ path: 'verify-fe17-mid.png' })
}
if (await ann.isVisible().catch(() => false)) await ann.click()
await page.waitForTimeout(2000)

const qiSave = await readSave()
console.log('realm after ritual:', qiSave?.player?.realmId)
if (qiSave?.player?.realmId !== 'qi_refining') {
  await page.screenshot({ path: 'verify-fe17-fail.png' })
  await browser.close()
  process.exit(1)
}

const seeded = {
  ...qiSave,
  player: { ...qiSave.player, realmId: 'foundation_establishment', realmLevel: 1, cultivation: 0 },
  techniques: (qiSave.techniques ?? []).map((t) => ({
    ...t,
    gradeHistory: { 1: { finalRank: 0, completionState: 'partial' } },
  })),
}
await page.addInitScript(
  ({ key, payload }) => localStorage.setItem(key, JSON.stringify(payload)),
  { key: SAVE_KEY, payload: seeded },
)
await page.reload()
await settleHome()

const realm = await page.evaluate(() => {
  const raw = localStorage.getItem('tien-hiep-idle-save:guest')
  return raw ? JSON.parse(raw).player.realmId : null
})
console.log('seeded realm:', realm)

if (!(await openWheel())) {
  console.log('wheel never opened at TC — abort')
  await browser.close()
  process.exit(1)
}
await page.locator('[data-wheel-slot="realm"]').click()
await page.waitForTimeout(1500)
const note = page.locator('.realm-ceiling-note')
const visible = await note.isVisible({ timeout: 8000 }).catch(() => false)
console.log('FE-17 ceiling note:', visible ? 'PASS' : 'FAIL')
if (visible) console.log('text:', await note.textContent())
await page.screenshot({ path: 'verify-fe17-realm.png' })
await browser.close()
console.log('DONE')
