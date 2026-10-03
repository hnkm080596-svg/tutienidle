import { chromium } from '@playwright/test'

const BASE = process.env.BASE || 'http://localhost:5955'
const browser = await chromium.launch()
const OUT = '/tmp/audit/fix'

async function boot(viewport, zoom) {
  const page = await browser.newPage({ viewport })
  await page.route('**/fonts.googleapis.com/**', (r) => r.abort())
  await page.route('**/fonts.gstatic.com/**', (r) => r.abort())
  await page.goto(BASE)
  if (zoom) await page.evaluate((z) => { document.documentElement.style.zoom = String(z) }, zoom)
  await page.getByTestId('auth-guest-button').click()
  await page.getByTestId('character-creation-screen').waitFor({ state: 'visible' })
  await page.getByTestId('creation-name-input').fill('Audit Repro')
  await page.locator('[data-testid^="creation-talent-"]').first().click()
  await page.getByTestId('creation-finish').click()
  await page.locator('.game-root').waitFor({ state: 'visible', timeout: 30000 })
  const skip = page.locator('.tutorial-overlay .game-button')
  try { await skip.first().click({ timeout: 4000 }) } catch { await page.locator('.tutorial-overlay').evaluate((el) => el.remove()).catch(() => {}) }
  await page.waitForTimeout(800)
  return page
}

const openWheel = (page) => page.evaluate(async () => {
  const { useUiStore } = await import('/src/stores/ui.ts')
  const ui = useUiStore()
  ui.isCommandWheelOpen = true
})
const openLeft = (page, mode) => page.evaluate(async (m) => {
  const { useUiStore } = await import('/src/stores/ui.ts')
  useUiStore().openLeftPanel(m)
}, mode)
const openStandalone = (page, panel) => page.evaluate(async (p) => {
  const { useUiStore } = await import('/src/stores/ui.ts')
  useUiStore().openStandalonePanel(p)
}, panel)

// ---------- F1: wheel hit-routing + geometry ----------
{
  const page = await boot({ width: 1440, height: 810 })
  await openWheel(page)
  await page.waitForTimeout(900)
  const data = await page.evaluate(() => {
    const out = {}
    const orbs = [...document.querySelectorAll('.df-node__orb')]
    const rects = orbs.map((o) => {
      const r = o.getBoundingClientRect()
      return { id: o.dataset.wheelSlot, cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width }
    })
    for (const it of rects) {
      const el = document.elementFromPoint(it.cx, it.cy)
      out[it.id] = { hit: el?.dataset?.wheelSlot ?? (el?.closest?.('.df-node__orb')?.dataset?.wheelSlot ?? String(el?.className?.baseVal ?? el?.className)) }
    }
    // badge presence
    const badge = [...document.querySelectorAll('.df-node__badge')].map((b) => b.closest('.df-node__orb')?.dataset?.wheelSlot)
    return { rects, hits: out, badge }
  })
  console.log('WHEEL hits:', JSON.stringify(data.hits))
  console.log('WHEEL badge:', JSON.stringify(data.badge))
  await page.screenshot({ path: `${OUT}-wheel.png` })
  // Real click on an inner-ring orb must route to its own panel.
  await page.locator('.df-node__orb[data-wheel-slot="character"]').click()
  await page.waitForTimeout(900)
  const routed = await page.evaluate(async () => {
    const { useUiStore } = await import('/src/stores/ui.ts')
    const ui = useUiStore()
    return { overlay: ui.characterOverlayOpen, tab: ui.characterSceneTab, standalone: ui.standalonePanel }
  })
  console.log('WHEEL click character ->', JSON.stringify(routed))
  await page.close()
}

// ---------- F2+F6: paper rail on character surface ----------
{
  const page = await boot({ width: 1440, height: 810 })
  await page.mouse.move(0, 0)
  await openLeft(page, 'character')
  await page.waitForTimeout(1400)
  const data = await page.evaluate(() => {
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), bottom: Math.round(r.bottom), right: Math.round(r.right) } }
    const items = [...document.querySelectorAll('.paper-navigation-item')].map((el) => ({ id: el.dataset.navId, ...rect(el) }))
    const box = document.querySelector('.paper-navigation-items')
    const nav = document.querySelector('.paper-navigation')
    const stats = document.querySelector('.cf-stats')
    const elems = document.querySelector('.cf-element-summary')
    const notice = document.querySelector('.cf-notice')
    const paper = document.querySelector('.cf-paper')
    return {
      navTop: nav && Math.round(nav.getBoundingClientRect().top),
      navBottom: nav && Math.round(nav.getBoundingClientRect().bottom),
      paperBottom: paper && Math.round(paper.getBoundingClientRect().bottom),
      itemsCount: items.length,
      itemIds: items.map((i) => i.id),
      itemsOverflow: box ? box.scrollHeight - box.clientHeight : null,
      itemsBox: rect(box),
      lastItem: items.at(-1) ?? null,
      statsScroll: stats ? { scrollH: stats.scrollHeight, clientH: stats.clientHeight } : null,
      elements: rect(elems),
      statsBottom: stats ? Math.round(stats.getBoundingClientRect().bottom) : null,
      notice: rect(notice),
    }
  })
  console.log('CHARACTER:', JSON.stringify(data, null, 1))
  await page.screenshot({ path: `${OUT}-character.png` })
  await page.close()
}

// ---------- F2: scroll rail (inventory) + plaque + bag hover ----------
{
  const page = await boot({ width: 1440, height: 810 })
  await page.mouse.move(0, 0)
  await openLeft(page, 'inventory')
  await page.waitForTimeout(1500)
  const data = await page.evaluate(() => {
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), bottom: Math.round(r.bottom), right: Math.round(r.right), h: Math.round(r.height) } }
    const rail = document.querySelector('.hk-scroll__rail')
    const items = [...document.querySelectorAll('.hk-scroll__rail .paper-navigation-item')].map((el) => ({ id: el.dataset.navId, active: el.classList.contains('active'), ...rect(el) }))
    const box = document.querySelector('.hk-scroll__rail .paper-navigation-items')
    const plaque = document.querySelector('.hk-scroll__plaque')
    const tabs = [...document.querySelectorAll('.toolbar nav button')].map((b) => ({ label: b.textContent.trim(), ...rect(b) }))
    const bag = document.querySelector('.inventory-scene .bag')
    return {
      railRect: rect(rail),
      railIsPaperNav: rail?.classList.contains('paper-navigation'),
      itemIds: items.map((i) => i.id),
      activeIds: items.filter((i) => i.active).map((i) => i.id),
      railOverflow: box ? box.scrollHeight - box.clientHeight : null,
      plaque: rect(plaque),
      tabs,
      bagOverflow: bag ? bag.scrollHeight - bag.clientHeight : null,
    }
  })
  console.log('INVENTORY rail+plaque:', JSON.stringify(data, null, 1))
  await page.screenshot({ path: `${OUT}-inventory.png` })

  // hover an empty bag cell -> check computed hover art + visual
  const cell = page.locator('.bag-section__slot').last()
  await cell.hover()
  await page.waitForTimeout(350)
  const hover = await page.evaluate(() => {
    const slot = [...document.querySelectorAll('.slot-view--item')].find((s) => s.matches(':hover'))
    if (!slot) return null
    const frame = slot.querySelector('.slot-view__hover-frame')
    const cs = getComputedStyle(frame)
    return { img: cs.backgroundImage.slice(0, 120), opacity: cs.opacity }
  })
  console.log('BAG hover frame:', JSON.stringify(hover))
  await page.screenshot({ path: `${OUT}-bag-hover.png` })
  await page.close()
}

// ---------- F3: plaque at 960 + zoom150 ----------
for (const [name, zoom] of [['960', 0], ['960-zoom150', 1.5]]) {
  const page = await boot({ width: 960, height: 540 }, zoom)
  await page.mouse.move(0, 0)
  await openLeft(page, 'inventory')
  await page.waitForTimeout(1500)
  const data = await page.evaluate(() => {
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), bottom: Math.round(r.bottom), right: Math.round(r.right) } }
    const plaque = document.querySelector('.hk-scroll__plaque')
    const tabs = [...document.querySelectorAll('.toolbar nav button')].map((b) => ({ label: b.textContent.trim(), ...rect(b) }))
    return { plaque: rect(plaque), tabs }
  })
  console.log(`PLAQUE ${name}:`, JSON.stringify(data))
  await page.screenshot({ path: `${OUT}-inv-${name}.png` })
  await page.close()
}

// ---------- Directive B: plaque->building lands on nav tab ----------
{
  const page = await boot({ width: 1440, height: 810 })
  await page.mouse.move(0, 0)
  // simulate the plaque path: useBuildingNavigation.openBuilding('equipment_hall')
  await page.evaluate(async () => {
    const { useUiStore } = await import('/src/stores/ui.ts')
    useUiStore().openLeftPanel('equipment_hall')
  })
  await page.waitForTimeout(1600)
  const data = await page.evaluate(() => {
    const actives = [...document.querySelectorAll('.paper-navigation-item.active')].map((el) => el.dataset.navId)
    const items = [...document.querySelectorAll('.paper-navigation-item')].map((el) => el.dataset.navId)
    return { actives, items }
  })
  console.log('EQUIPMENT hall open:', JSON.stringify(data))
  await page.screenshot({ path: `${OUT}-equipment.png` })
  await page.close()
}
await browser.close()
console.log('DONE')
