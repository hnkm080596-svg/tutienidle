// Combat-scene audit re-check capture at 1440x810.
// Drives guest -> creation -> home -> stage battle via the same pokes the
// e2e specs use, then screenshots fighting / victory / home states and
// dumps DOM rects for the flagged regions.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.QA_BASE ?? 'http://localhost:5864'
const OUT = process.env.QA_OUT ?? '/tmp/combat-audit'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 810 } })
await context.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }))
const page = await context.newPage()

const shot = (name) => page.screenshot({ type: 'png', path: `${OUT}/${name}.png` })

// --- boot -> guest -> create character ----------------------------------
await page.goto(BASE + '/')
await page.getByTestId('auth-screen').waitFor({ state: 'visible', timeout: 20000 })
await page.getByTestId('auth-guest-button').click()

const creation = page.getByTestId('character-creation-screen')
await creation.waitFor({ state: 'visible', timeout: 20000 })
await page.getByTestId('creation-name-input').fill('Audit Fix')
const talent = creation.locator('[data-testid^="creation-talent-"]').first()
await talent.waitFor({ state: 'visible', timeout: 10000 })
await talent.click()
const finish = page.getByTestId('creation-finish')
await page.waitForFunction((el) => el && !el.disabled && el.getAttribute('aria-disabled') !== 'true', await finish.elementHandle(), { timeout: 8000 }).catch(async () => {
  await finish.dispatchEvent('click')
})
await finish.click({ timeout: 5000 }).catch(() => finish.dispatchEvent('click'))

await page.locator('.game-root').waitFor({ state: 'visible', timeout: 30000 })
const overlay = page.getByTestId('presentation-overlay')
await page.waitForFunction(() => {
  const el = document.querySelector('[data-testid="presentation-overlay"]')
  return el && el.dataset.phase === 'idle' && el.dataset.curtain === 'opened'
}, undefined, { timeout: 30000 })

// tutorial overlay
const tutorial = page.locator('.tutorial-overlay')
if (await tutorial.isVisible({ timeout: 5000 }).catch(() => false)) {
  await page.getByRole('button', { name: 'Bỏ Qua' }).click()
  await tutorial.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
}
await page.waitForTimeout(1200)

// --- home scene (thien-co board + quest tracker region) ------------------
await shot('home')
const homeRects = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  }
  return {
    board: pick('.df-board'),
    quest: pick('.df-quest'),
    hud: pick('.df-hud'),
    autofarm: pick('.auto-farm-indicator'),
    feedbackLog: pick('.feedback-log'),
    viewport: { w: innerWidth, h: innerHeight },
  }
})
console.log('HOME RECTS', JSON.stringify(homeRects, null, 1))

// --- open exploration (stage select) surface -----------------------------
await page.evaluate(async () => {
  const { useUiStore } = await import('/src/stores/ui.ts')
  useUiStore().openLeftPanel('stage_select')
})
await page.locator('.exploration-scene').waitFor({ state: 'visible', timeout: 15000 })
await page.waitForTimeout(900)
await shot('exploration')
const exploRects = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cls: el.className }
  }
  const all = [...document.querySelectorAll('[data-hk-region]')].map((el) => {
    const r = el.getBoundingClientRect()
    return { region: el.dataset.hkRegion, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  })
  return { all, paper: pick('.exploration-scene .paper'), details: pick('.exploration-details, .details, aside') }
})
console.log('EXPLORATION RECTS', JSON.stringify(exploRects, null, 1))

// --- start a stage battle -------------------------------------------------
const start = page.locator('.exploration-scene .stage-start-button, .exploration-scene [data-testid="stage-start-button"]').first()
await start.waitFor({ state: 'visible', timeout: 10000 })
await start.click()
await page.locator('.combat-scene-overlay').waitFor({ state: 'visible', timeout: 20000 })

// wait until fighting + orbs render
await page.waitForFunction(() => {
  const w = window
  const b = w.__tutienPhaserGame?.registry.get('gameManager')?.getTurnBattle()
  return b && b.state === 'fighting'
}, undefined, { timeout: 60000 })
await page.waitForTimeout(1500)
await shot('combat-fighting')

const combatRects = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), visible: getComputedStyle(el).visibility, display: getComputedStyle(el).display }
  }
  // canvas HUD objects (Phaser side)
  const w = window
  const scene = w.__tutienPhaserGame?.scene?.getScene?.('CombatScene')
  const hud = scene?.playerHud
  const hudState = hud ? {
    hpVisible: hud.hpFill?.visible,
    hpX: hud.hpFill?.x, hpY: hud.hpFill?.y,
    mpVisible: hud.mpGroupVisible,
    kiemVisible: hud.kiemGroupVisible,
    theVisible: hud.theGroupVisible,
  } : null
  return {
    overlay: pick('.combat-scene-overlay'),
    topBar: pick('.combat-scene-overlay__top-bar'),
    dock: pick('.combat-action-dock'),
    dockPanel: pick('.combat-skill-dock-panel'),
    battlefield: pick('.combat-scene-overlay__battlefield'),
    aiPanel: pick('.combat-scene-overlay__ai-panel'),
    aiRail: pick('.combat-ai-rail'),
    turnStrip: pick('.combat-scene-overlay__turn-order-strip'),
    logFeed: pick('.combat-log-feed'),
    hudState,
  }
})
console.log('COMBAT RECTS', JSON.stringify(combatRects, null, 1))

// --- victory envelope ------------------------------------------------------
for (let i = 0; i < 240; i++) {
  const state = await page.evaluate(() => {
    const b = window.__tutienPhaserGame?.registry.get('gameManager')?.getTurnBattle()
    if (!b) return 'none'
    for (const e of b.enemies ?? []) { e.alive = false; if (e.entity) { e.entity.alive = false; e.entity.currentHp = 0 } }
    return b.state
  })
  if (state === 'victory') break
  await page.waitForTimeout(250)
}
await page.locator('.combat-victory-panel').waitFor({ state: 'visible', timeout: 30000 })
await page.waitForTimeout(900)
await shot('combat-victory')
const vicRects = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  }
  return { victoryPanel: pick('.combat-victory-panel'), victoryScene: pick('.victory-scene') }
})
console.log('VICTORY RECTS', JSON.stringify(vicRects))

// --- back home for defeat ---------------------------------------------------
await page.getByRole('button', { name: /Tiếp Tục/ }).click()
await page.waitForTimeout(1500)
await page.evaluate(async () => {
  const { useUiStore } = await import('/src/stores/ui.ts')
  useUiStore().openLeftPanel('stage_select')
})
await page.locator('.exploration-scene').waitFor({ state: 'visible', timeout: 15000 })
await page.waitForTimeout(600)
await start.click().catch(async () => {
  await page.locator('.exploration-scene .stage-start-button').first().click()
})
await page.locator('.combat-scene-overlay').waitFor({ state: 'visible', timeout: 20000 })
// AI plays for the player so turns actually cycle to defeat.
await page.evaluate(async () => {
  const { useUiStore } = await import('/src/stores/ui.ts')
  useUiStore().combatInputMode = 'auto'
})
let lastLogged = ''
for (let i = 0; i < 240; i++) {
  const state = await page.evaluate(() => {
    const b = window.__tutienPhaserGame?.registry.get('gameManager')?.getTurnBattle()
    if (!b) return 'none'
    // hp->1 lets the ENEMIES land the real killing blow through the
    // engine's own damage/death pipeline - the defeat panel only mounts
    // on a natural defeat (direct entity kills flip state without the
    // battle_end emission that bumps the modal open).
    for (const p of b.players ?? []) { if (p.entity && p.entity.alive) p.entity.currentHp = 1 }
    return b.state
  })
  if (state !== lastLogged) { console.log('defeat-drive state:', state); lastLogged = state }
  if (state === 'defeat') break
  await page.waitForTimeout(500)
}
await page.waitForTimeout(2000)
await shot('combat-defeat-attempt')
const defeatDebug = await page.evaluate(async () => {
  const { useUiStore } = await import('/src/stores/ui.ts')
  const b = window.__tutienPhaserGame?.registry.get('gameManager')?.getTurnBattle()
  const modal = document.querySelector('.combat-result-modal')
  const panel = document.querySelector('.combat-defeat-panel')
  return {
    state: b?.state,
    combatOrigin: useUiStore().combatOrigin,
    resultModal: modal ? modal.getBoundingClientRect().width : null,
    panelRect: panel ? { w: panel.getBoundingClientRect().width, h: panel.getBoundingClientRect().height } : null,
  }
})
console.log('DEFEAT DEBUG', JSON.stringify(defeatDebug))
const defeated = await page.locator('.combat-defeat-panel').isVisible({ timeout: 30000 }).catch(() => false)
if (defeated) {
  await shot('combat-defeat')
  const defRects = await page.evaluate(() => {
    const el = document.querySelector('.combat-defeat-panel')
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  })
  console.log('DEFEAT RECTS', JSON.stringify(defRects))
  // click retry quickly to keep the session inside the 10s auto-return window
  await page.locator('.combat-defeat-panel__retry').click().catch(() => {})
} else {
  console.log('DEFEAT not reached in time')
}

writeFileSync(`${OUT}/done.json`, JSON.stringify({ ok: true }))
await browser.close()
console.log('DONE', OUT)
