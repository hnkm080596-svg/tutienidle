import { chromium } from 'playwright-core'
const browser = await chromium.connectOverCDP('http://localhost:29229')
const ctx = browser.contexts()[0]
const page = ctx.pages()[0]
console.log('URL:', page.url())
const info = await page.evaluate(() => ({
  title: document.title,
  hasGame: !!window.__tutienPhaserGame,
  buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean).slice(0, 15),
  testids: [...document.querySelectorAll('[data-testid]')].map(e => e.dataset.testid).slice(0, 15),
}))
console.log(JSON.stringify(info, null, 1))
await page.screenshot({ path: '/tmp/where.png' })
await browser.close()
