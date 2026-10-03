import { chromium } from '@playwright/test'

const BASE = process.env.BASE || 'http://localhost:5955'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } })
await page.route('**/fonts.googleapis.com/**', (r) => r.abort())
await page.route('**/fonts.gstatic.com/**', (r) => r.abort())
await page.goto(BASE)
await page.getByTestId('auth-guest-button').click()
await page.getByTestId('character-creation-screen').waitFor({ state: 'visible' })
await page.getByTestId('creation-name-input').fill('Badge Repro')
await page.locator('[data-testid^="creation-talent-"]').first().click()
await page.getByTestId('creation-finish').click()
await page.locator('.game-root').waitFor({ state: 'visible', timeout: 30000 })
const skip = page.locator('.tutorial-overlay .game-button')
try { await skip.first().click({ timeout: 4000 }) } catch { await page.locator('.tutorial-overlay').evaluate((el) => el.remove()).catch(() => {}) }
await page.waitForTimeout(600)

// Save, then seed realmLevel 12 + full cultivation into the guest save.
await page.evaluate(async () => {
  const { useUiStore } = await import('/src/stores/ui.ts')
  useUiStore().openLeftPanel('settings')
})
await page.getByTestId('settings-save-button').click({ timeout: 10000 })
await page.evaluate(async () => {
  const { useUiStore } = await import('/src/stores/ui.ts')
  useUiStore().closeHomeOverlays()
})
const save = await page.evaluate(() => JSON.parse(localStorage.getItem('tien-hiep-idle-save:guest') ?? 'null'))
console.log('save player keys:', Object.keys(save?.player ?? {}).slice(0, 20).join(','))
await page.addInitScript((payload) => {
  localStorage.setItem('tien-hiep-idle-save:guest', JSON.stringify(payload))
}, { ...save, player: { ...save.player, realmLevel: 12, cultivation: 0 } })
await page.reload()
await page.getByTestId('auth-guest-button').click()
try {
  await page.locator('.game-root').waitFor({ state: 'visible', timeout: 30000 })
} catch (e) {
  await page.screenshot({ path: '/tmp/audit/badge-stuck.png' })
  console.log('BODY:', (await page.locator('body').innerText()).slice(0, 400))
  throw e
}
await page.locator('.tutorial-overlay').evaluate((el) => el.remove()).catch(() => {})
await page.waitForTimeout(800)

await page.evaluate(async () => {
  const { useUiStore } = await import('/src/stores/ui.ts')
  useUiStore().isCommandWheelOpen = true
})
await page.waitForTimeout(900)
const data = await page.evaluate(() => {
  const badges = [...document.querySelectorAll('.df-node__badge')].map((b) => ({
    slot: b.closest('.df-node__orb')?.dataset?.wheelSlot,
    cls: b.className,
  }))
  const hits = {}
  for (const o of document.querySelectorAll('.df-node__orb')) {
    const r = o.getBoundingClientRect()
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    hits[o.dataset.wheelSlot] = el?.closest?.('.df-node__orb')?.dataset?.wheelSlot ?? String(el?.className)
  }
  return { badges, hits }
})
console.log('BADGES:', JSON.stringify(data.badges))
console.log('HITS:', JSON.stringify(data.hits))
await page.screenshot({ path: '/tmp/audit/fix-wheel-lv12.png' })
await browser.close()
console.log('DONE')
