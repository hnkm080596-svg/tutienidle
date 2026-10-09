import { chromium } from 'playwright-core'
const browser = await chromium.connectOverCDP('http://localhost:29229')
const ctx = browser.contexts()[0]
let page = ctx.pages().find(p => p.url().includes('5393')) ?? ctx.pages()[0]
const url = page.url()
const info = await page.evaluate(() => {
  const el = document.querySelector('#app')
  const app = el?.__vue_app__
  if (!app) return { noApp: true, text: document.body.innerText.slice(0,200) }
  const pinia = app.config.globalProperties.$pinia
  return { ids: [...pinia._s.keys()], title: document.title, text: document.body.innerText.slice(0,200) }
})
console.log(url, JSON.stringify(info))
await browser.close()
