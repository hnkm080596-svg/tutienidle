import { chromium } from 'playwright-core'
const browser = await chromium.connectOverCDP('http://localhost:29229')
const ctx = browser.contexts()[0]
const page = ctx.pages()[0]
const info = await page.evaluate(() => ({
  screen: !!document.querySelector('[data-testid="character-creation-screen"]'),
  enabled: [...document.querySelectorAll('[data-testid^="creation-"]')].filter(e => !e.disabled && e.tagName === 'BUTTON').map(e => e.dataset.testid + '|' + e.textContent.replace(/\s+/g, ' ').trim().slice(0, 30)),
  disabled: [...document.querySelectorAll('[data-testid^="creation-"]')].filter(e => e.disabled).map(e => e.dataset.testid),
}))
console.log(JSON.stringify(info, null, 1))
await browser.close()
