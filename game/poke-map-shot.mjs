import { chromium } from 'playwright-core'
const OUT = '/tmp/map-panel'
const browser = await chromium.connectOverCDP('http://localhost:29229')
const ctx = browser.contexts()[0]
const page = ctx.pages()[0]
await page.setViewportSize({ width: 1600, height: 900 })
// dismiss tutorial modal ("Bo Qua")
const skip = page.locator('button', { hasText: 'Bỏ Qua' }).first()
if (await skip.count()) { await skip.click(); await page.waitForTimeout(800) }
// also close any function-overlay help if present
const audit = await page.evaluate(() => ({
  scene: !!document.querySelector('.exploration-scene'),
  sheet: !!document.querySelector('.map-sheet'),
  modalStill: document.body.innerText.includes('Chào mừng Đạo Hữu'),
}))
console.log(JSON.stringify(audit))
await page.screenshot({ path: `${OUT}-live.png` })
for (const id of ['2', '3']) {
  await page.evaluate(cid => { document.querySelector(`[data-chapter-id="${cid}"]`)?.click() }, id)
  await page.waitForTimeout(700)
  const sel = await page.evaluate(() => document.querySelector('.map-chapters button.selected')?.dataset.chapterId)
  console.log('after click chapter', id, '-> selected:', sel)
  await page.screenshot({ path: `${OUT}-ch${id}.png` })
}
await browser.close()
