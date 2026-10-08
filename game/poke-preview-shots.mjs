import { chromium } from 'playwright-core'
const browser = await chromium.connectOverCDP('http://localhost:29229')
const ctx = browser.contexts()[0]
const page = ctx.pages()[0]
await page.goto('http://localhost:5393/ui-landscape-design.html', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
// begin if opening gate shown
const begin = page.locator('button', { hasText: 'Bắt' }).first()
if (await begin.count()) { await begin.click().catch(()=>{}); await page.waitForTimeout(800) }
for (const id of ['equipment', 'body']) {
  const nav = page.locator(`button[aria-label="${id}"]`).first()
  if (await nav.count()) { await nav.click(); await page.waitForTimeout(1000) }
  await page.screenshot({ path: `/tmp/preview-${id}.png` })
}
console.log('done', page.url())
await browser.close()
