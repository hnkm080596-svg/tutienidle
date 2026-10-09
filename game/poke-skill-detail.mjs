import { chromium } from 'playwright-core'
const browser = await chromium.connectOverCDP('http://localhost:29229')
const ctx = browser.contexts()[0]
let page = ctx.pages().find(p => p.url().includes('5393')) ?? ctx.pages()[0]
await page.goto('http://localhost:5393/index.html', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
// enter game via "Tiep Tuc" (guest continue)
const btn = page.locator('button, a', { hasText: 'Tiếp Tục' }).first()
if (await btn.count()) { await btn.click(); await page.waitForTimeout(3000) }
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const ui = pinia._s.get('ui')
  ui.standalonePanel = 'skill'
})
await page.waitForTimeout(1200)
const texts = await page.evaluate(() => {
  const card = document.querySelector('.skill-detail-card')
  if (!card) return { missing: true, panels: [...document.querySelectorAll('[class*=panel],[class*=scene]')].map(e=>e.className).slice(0,10) }
  const body = card.querySelector('.skill-detail-body')
  return { items: [...body.children].map(el => `${el.tagName.toLowerCase()} => "${el.textContent.replace(/\s+/g,' ').slice(0, 80)}"`) }
})
console.log(JSON.stringify(texts, null, 1))
await browser.close()
