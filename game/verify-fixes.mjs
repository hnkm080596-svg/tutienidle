// Runtime verification for round-7 fixes:
//   FE-06 nameplate = authored player name (MainScene + CombatScene)
//   FE-08 bottom-left HUD starts right of the reward gourd footprint
//   FE-17 realm ceiling note at foundation_establishment
import { chromium } from '@playwright/test'

const BASE = 'http://localhost:5608'
const SAVE_KEY = 'tien-hiep-idle-save:guest'
const NAME = 'Nghiệp Chứng'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 300)))

await page.goto(BASE)
await page.waitForTimeout(3500)
await page.getByTestId('auth-guest-button').click()
await page.waitForTimeout(1000)
await page.getByTestId('creation-name-input').fill(NAME)
await page.locator('[data-testid^="creation-talent-"]').first().click()
await page.getByTestId('creation-skill-tram').click()
await page.getByTestId('creation-finish').click()
await page.waitForTimeout(2000)
const tut = page.locator('.tutorial-overlay')
if (await tut.isVisible({ timeout: 4000 }).catch(() => false)) {
  await page.getByRole('button', { name: 'Bỏ Qua' }).click()
  await page.waitForTimeout(600)
}

// ---- FE-06 (home): MainScene label text must equal the authored name.
const homeLabels = await page.evaluate(() => {
  const game = window.__tutienPhaserGame
  const main = game?.scene?.scenes?.find((s) => s.scene?.key === 'MainScene')
  return (main?.children?.list ?? [])
    .filter((c) => c.type === 'Text')
    .map((c) => c.text)
})
console.log('MAIN_TEXTS:', JSON.stringify(homeLabels))
console.log('FE-06 home:', homeLabels.includes(NAME) ? 'PASS' : 'FAIL')

// ---- Combat: enter stage 1, check player label + bottom-left layout.
await page.keyboard.press('Tab')
await page.waitForTimeout(500)
await page.locator('[data-wheel-slot="teleport_array"]').click()
await page.waitForTimeout(900)
await page.locator('[data-testid^="stage-node"]').first().click()
await page.waitForTimeout(700)
await page.getByRole('button', { name: 'Bắt Đầu' }).first().click()
await page.waitForTimeout(9000)

const combat = await page.evaluate(() => {
  const game = window.__tutienPhaserGame
  const scene = game?.scene?.scenes?.find((s) => s.scene?.key === 'CombatScene')
  const texts = (scene?.children?.list ?? [])
    .filter((c) => c.type === 'Text')
    .map((c) => ({ text: c.text, x: Math.round(c.x), y: Math.round(c.y), visible: c.visible }))
  const playerSprite = scene?.sprites?.get?.('player')
  return {
    playerLabel: playerSprite?.label?.text ?? null,
    bottomLeft: texts.filter((t) => t.x < 200 && t.y > 700),
    nameTexts: texts.filter((t) => t.text === 'Player' || t.text?.includes('Nghi')),
  }
})
console.log('PLAYER_LABEL:', combat.playerLabel)
console.log('NAME_TEXTS:', JSON.stringify(combat.nameTexts))
console.log('BOTTOM_LEFT_TEXTS:', JSON.stringify(combat.bottomLeft))
console.log('FE-06 combat:', combat.playerLabel === NAME ? 'PASS' : 'FAIL')
// Gourd footprint: x in [18, 70] (margin 18 + width 52). HUD labels must
// start right of it - flag any HUD text whose left edge sits inside.
const overlap = combat.bottomLeft.filter((t) => t.visible !== false && t.x < 70 && t.x !== 0)
console.log('FE-08 overlap candidates:', JSON.stringify(overlap))

await page.screenshot({ path: 'verify-fixes-combat.png' })

// ---- FE-17: seed realmLevel-12 mortal, drive Quan Khi, bump to
// foundation_establishment, open the realm panel, look for the note.
// 1) save current state, patch mortal L12, reload
await page.keyboard.press('Escape').catch(() => {})
const readSave = () =>
  page.evaluate((k) => {
    const raw = localStorage.getItem(k)
    return raw ? JSON.parse(raw) : null
  }, SAVE_KEY)

// force a save via settings open/close
await page.keyboard.press('Tab')
await page.waitForTimeout(400)
const settingsSlot = page.locator('[data-wheel-slot="settings"]')
if (await settingsSlot.isVisible().catch(() => false)) {
  await settingsSlot.click()
  await page.waitForTimeout(800)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
}
await page.waitForTimeout(1500)

const save = await readSave()
if (!save) {
  console.log('FE-17: NO SAVE — skip')
} else {
  save.player = { ...save.player, realmLevel: 12, cultivation: 0 }
  await page.addInitScript(
    ({ key, payload }) => localStorage.setItem(key, JSON.stringify(payload)),
    { key: SAVE_KEY, payload: save },
  )
  await page.reload()
  await page.waitForTimeout(3500)
  await page.getByTestId('auth-guest-button').click().catch(() => {})
  await page.waitForTimeout(1500)

  // Quan Khi drive (mirrors ui-audit-progression-fixed.spec.ts)
  await page.keyboard.press('Tab')
  await page.waitForTimeout(500)
  await page.locator('[data-wheel-slot="realm"]').click()
  await page.waitForTimeout(1200)
  const realmDialog = page.getByRole('dialog', { name: 'Cảnh Giới' })
  const quanKhi = realmDialog.getByRole('button', { name: 'Quán Khí' })
  if (await quanKhi.isEnabled().catch(() => false)) {
    await quanKhi.click()
    const confirm = page.getByRole('dialog', { name: /Độ kiếp cũng là độ thân/ })
    await confirm.getByRole('button', { name: 'Đã hiểu' }).click()
    await page.waitForTimeout(2000)
    // answer via director until resolved
    for (let i = 0; i < 200; i += 1) {
      const state = await page.evaluate(() => {
        const game = window.__tutienPhaserGame
        const d = game?.registry?.get('gameManager')?.tribulationDirector
        if (!d) return 'missing'
        d.answerQuestion?.(0)
        d.update(4)
        return d.getState()?.state ?? 'cleared'
      })
      if (state !== 'ongoing') break
      await page.waitForTimeout(100)
    }
    await page.waitForTimeout(1500)
    // entitlement modal
    const modal = page.locator('[data-testid="talent-entitlement-modal"]')
    if (await modal.isVisible({ timeout: 8000 }).catch(() => false)) {
      await modal.locator('button').first().click()
      await page.waitForTimeout(800)
    }
    // announcements
    const ann = page.locator('.world-announcement')
    if (await ann.isVisible().catch(() => false)) await ann.click()
    await page.waitForTimeout(500)
    // pick a way (phap tu card / any enabled choice)
    const choice = page.locator('.quan-khi-panel__choice').first()
    if (await choice.isVisible({ timeout: 8000 }).catch(() => false)) {
      await choice.click()
      const ok = page.locator('.confirm-modal__confirm')
      if (await ok.isVisible({ timeout: 5000 }).catch(() => false)) await ok.click()
      await page.waitForTimeout(1000)
    }
    if (await ann.isVisible().catch(() => false)) await ann.click()
  }

  // 2) patch coherent qi_refining save -> foundation_establishment
  await page.waitForTimeout(1500)
  const qiSave = await readSave()
  if (qiSave?.player?.realmId !== 'qi_refining') {
    console.log('FE-17: realm after ritual =', qiSave?.player?.realmId, '— skip')
  } else {
    const seeded = {
      ...qiSave,
      player: {
        ...qiSave.player,
        realmId: 'foundation_establishment',
        realmLevel: 1,
        cultivation: 0,
      },
      techniques: (qiSave.techniques ?? []).map((t) => ({
        ...t,
        gradeHistory: { 1: { finalRank: 0, completionState: 'partial' } },
      })),
    }
    await page.addInitScript(
      ({ key, payload }) => localStorage.setItem(key, JSON.stringify(payload)),
      { key: SAVE_KEY, payload: seeded },
    )
    await page.reload()
    await page.waitForTimeout(3500)
    await page.getByTestId('auth-guest-button').click().catch(() => {})
    await page.waitForTimeout(1500)

    await page.keyboard.press('Tab')
    await page.waitForTimeout(500)
    await page.locator('[data-wheel-slot="realm"]').click()
    await page.waitForTimeout(1500)
    const note = page.locator('.realm-ceiling-note')
    const noteVisible = await note.isVisible({ timeout: 8000 }).catch(() => false)
    console.log('FE-17 ceiling note:', noteVisible ? 'PASS' : 'FAIL', noteVisible ? await note.textContent() : '')
    await page.screenshot({ path: 'verify-fixes-realm.png' })
  }
}

await browser.close()
console.log('DONE')
