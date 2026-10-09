import { chromium } from 'playwright-core'
const b = await chromium.connectOverCDP('http://localhost:29229')
const page = b.contexts()[0].pages().find(p => p.url().includes('5393')) ?? b.contexts()[0].pages()[0]
await page.goto('http://localhost:5393/')
await page.waitForTimeout(3500)
const cont = page.locator('button:has-text("Tiếp Tục"), button:has-text("Tiếp tục")')
if (await cont.count()) { await cont.first().click(); await page.waitForTimeout(3000) }
const setUi = (patch) => page.evaluate((p) => {
  const app = document.querySelector('#app').__vue_app__
  const pin = app.config.globalProperties.$pinia
  const ui = pin._s.get('ui')
  Object.assign(ui, p)
}, patch)
await setUi({ leftPanelMode: 'equipment_hall' })
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/prod-equipment.png' })
await setUi({ leftPanelMode: null, standalonePanel: 'body' })
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/prod-body.png' })
console.log('done')
