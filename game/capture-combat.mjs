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

await page.keyboard.press('Tab')
await page.waitForSelector('[data-wheel-slot=teleport_array]', { timeout: 10000 })
await page.click('[data-wheel-slot=teleport_array]')
await page.waitForTimeout(1200)
await page.click('[data-testid=stage-start-button]')

await page.waitForFunction(
  () => {
    const gm = window.__tutienPhaserGame?.registry?.get('gameManager')
    const b = gm?.getTurnBattle?.()
    return b && b.state === 'fighting' && (b.enemies?.length ?? 0) > 0
  },
  { timeout: 40000 },
)
await page.waitForTimeout(5000)
await page.screenshot({ path: '/tmp/scene-combat.png', type: 'png' })
console.log('combat shot done')
await browser.close()
