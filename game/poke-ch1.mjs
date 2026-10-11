import { chromium } from 'playwright-core'
const OUT = '/tmp/map-panel'
const browser = await chromium.connectOverCDP('http://localhost:29229')
const ctx = browser.contexts()[0]
const page = ctx.pages()[0]
await page.setViewportSize({ width: 1600, height: 900 })
await page.goto('http://localhost:5999/index.html', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3500)
// guest continue (existing save)
for (const tid of ['auth-continue-button', 'auth-guest-button']) {
  const el = page.locator(`[data-testid="${tid}"]`).first()
  if (await el.count()) { await el.click(); await page.waitForTimeout(4000); break }
}
await page.waitForTimeout(2000)
// dismiss tutorial modal if it pops again
const skip = page.locator('button', { hasText: 'Bỏ Qua' }).first()
if (await skip.count()) { await skip.click(); await page.waitForTimeout(600) }
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__._context.config.globalProperties.$pinia
  pinia._s.get('ui').leftPanelMode = 'stage_select'
})
await page.waitForTimeout(1500)
const styles = await page.evaluate(() => {
  const d = document.querySelector('.exploration-details')
  if (!d) return { missing: true }
  const cs = getComputedStyle(d)
  return { bg: cs.backgroundImage.slice(0, 80), color: cs.color }
})
console.log(JSON.stringify(styles))
await page.screenshot({ path: `${OUT}-live.png` })
for (const id of ['2', '3']) {
  await page.evaluate(cid => { document.querySelector(`[data-chapter-id="${cid}"]`)?.click() }, id)
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}-ch${id}.png` })
}
await browser.close()
