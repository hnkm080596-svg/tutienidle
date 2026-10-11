import { chromium } from 'playwright-core'
const OUT = process.env.POKE_OUT || '/tmp/map-panel'
const browser = await chromium.connectOverCDP('http://localhost:29229')
const ctx = browser.contexts()[0]
const page = ctx.pages()[0]
await page.setViewportSize({ width: 1600, height: 900 })
await page.goto('http://localhost:5999/index.html', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)
const clickTid = async (tid, wait = 1200) => {
  const el = page.locator(`[data-testid="${tid}"]`).first()
  if (await el.count()) { await el.click(); await page.waitForTimeout(wait); return true }
  return false
}
await clickTid('auth-guest-button', 3500)
// character creation: starter + talent + begin
const nameInput = page.locator('[data-testid="creation-name-input"] input, input[data-testid="creation-name-input"]').first()
if (await nameInput.count()) { await nameInput.fill('Devin Map') ; await page.waitForTimeout(400) }
await clickTid('creation-random-all', 800)
await clickTid('creation-starter-linh_bao', 600)
await clickTid('creation-talent-bach_luyen_thanh_khi', 600)
await clickTid('creation-finish', 4500)
const inGame = await page.evaluate(() => !!window.__tutienPhaserGame)
console.log('inGame:', inGame)
await page.evaluate(() => {
  const pinia = document.querySelector('#app').__vue_app__._context.config.globalProperties.$pinia
  pinia._s.get('ui').leftPanelMode = 'stage_select'
})
await page.waitForTimeout(1600)
const audit = await page.evaluate(() => {
  const r = sel => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map(v => Math.round(v * 10) / 10) }
  return {
    scene: !!document.querySelector('.exploration-scene'),
    sheet: r('.map-sheet'), head: r('.map-head'), grid: r('.map-grid'),
    h1: document.querySelector('.map-head h1')?.textContent,
    identity: document.querySelector('.map-identity')?.textContent,
    rail: r('.map-chapters'),
    railButtons: [...document.querySelectorAll('.map-chapters button')].map(b => ({ id: b.dataset.chapterId, text: b.textContent.replace(/\s+/g, ' ').trim(), sel: b.classList.contains('selected'), locked: b.classList.contains('is-locked') })),
    map: r('.exploration-map'), mapName: document.querySelector('.map-name')?.textContent,
    nodes: document.querySelectorAll('.stage-node').length,
    nodeStates: [...document.querySelectorAll('.stage-node')].map(n => n.dataset.stageId + ':' + [...n.classList].filter(c => ['cleared','current','available','locked','boss','selected','perfect'].includes(c)).join('+')),
    caption: document.querySelector('.map-caption')?.textContent,
    details: r('.exploration-details'),
    detailsTitle: document.querySelector('.exploration-details .stage-title')?.textContent,
    modeChips: document.querySelectorAll('.mode-chip').length,
    startBtn: !!document.querySelector('[data-testid="stage-start-button"]'),
    progressBarExists: !!document.querySelector('.exploration-scene .progress'),
    zonesExist: !!document.querySelector('.exploration-zones'),
    legacyPaper: !!document.querySelector('.exploration-scene .paper'),
  }
})
console.log(JSON.stringify(audit, null, 1))
await page.screenshot({ path: `${OUT}-live.png` })
for (const id of ['2', '3']) {
  await page.evaluate(cid => { document.querySelector(`[data-chapter-id="${cid}"]`)?.click() }, id)
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}-ch${id}.png` })
}
await browser.close()
