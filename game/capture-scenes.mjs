import { chromium } from 'playwright'

const BASE = 'http://localhost:5338'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
await context.route('https://fonts.googleapis.com/**', (r) =>
  r.fulfill({ status: 200, contentType: 'text/css', body: '' }),
)
const page = await context.newPage()

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('[data-testid=auth-guest-button]', { timeout: 20000 })
await page.click('[data-testid=auth-guest-button]')
await page.waitForSelector('[data-testid=creation-name-input]', { timeout: 20000 })
await page.fill('[data-testid=creation-name-input]', 'QA Minh')
await page.locator('[data-testid^=creation-talent-]').first().click()
await page.locator('[data-testid^=creation-starter-]').first().click()
await page.click('[data-testid=creation-finish]')
await page.waitForSelector('.game-root', { timeout: 30000 })
await page.waitForSelector('[data-testid=presentation-overlay][data-curtain=opened]', { timeout: 30000 })

const skip = page.locator('text=Bỏ Qua')
if (await skip.isVisible().catch(() => false)) await skip.click()
await page.waitForTimeout(600)

// ---- 1) COMBAT: wheel -> first stage -> start -> wait fighting ----
await page.keyboard.press('Tab')
await page.waitForSelector('[data-wheel-slot=teleport_array]', { timeout: 10000 })
await page.click('[data-wheel-slot=teleport_array]')
await page.waitForTimeout(1200)
await page.click('[data-testid=stage-start-button]')

await page.waitForFunction(
  () => {
    const gm = window.__tutienPhaserGame?.registry?.get('gameManager')
    const b = gm?.getTurnBattle?.()
    return b && (b.state === 'fighting' || b.state === 'countdown')
  },
  { timeout: 30000 },
)
await page.waitForTimeout(2500)
await page.screenshot({ path: '/tmp/scene-combat.png', type: 'png' })
console.log('combat shot done')

// ---- 2) TRIBULATION: exit battle, poke realm to peak, start ----
await page.evaluate(() => {
  const gm = window.__tutienPhaserGame?.registry?.get('gameManager')
  gm?.eventBus?.emit('combat_exit_request', undefined)
})
await page.waitForTimeout(1500)

await page.evaluate(() => {
  const gm = window.__tutienPhaserGame?.registry?.get('gameManager')
  const player = gm?.getPlayer?.() ?? gm?.getActivePlayer?.()
  if (player) {
    player.realmId = 'mortal'
    player.realmLevel = 18
    player.chapters = player.chapters ?? {}
  }
})

const started = await page.evaluate(() => {
  const gm = window.__tutienPhaserGame?.registry?.get('gameManager')
  const player = gm?.getPlayer?.() ?? gm?.getActivePlayer?.()
  try {
    return gm?.startTribulation?.(player, 'qi_refining') ?? false
  } catch (e) {
    return 'ERR:' + e.message
  }
})
console.log('tribulation started:', started)
await page.waitForTimeout(4000)
await page.screenshot({ path: '/tmp/scene-tribulation.png', type: 'png' })
console.log('tribulation shot done')

await browser.close()
