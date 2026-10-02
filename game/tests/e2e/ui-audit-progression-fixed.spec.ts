import { expect, test } from '@playwright/test'
import { BETA_FEATURES } from '../../src/core/betaFeatureFlags'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  GUEST_SAVE_KEY,
  bootToGuestHome,
  createCharacterThroughUi,
  enterHome,
  openSettingsAndSave,
  reauthAndEnterHome,
  waitForPresentationIdle,
} from './helpers'

// Ui-audit progression fix evidence -- re-shoots every screen the slice
// report flagged, against the FIXED build. Output lands in
// docs/ui-audit/progression/fixed/ next to the report's shots/.
const SHOTS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/ui-audit/progression/fixed',
)

test.use({ viewport: { width: 1280, height: 800 } })
test.setTimeout(240_000)

function shot(page: import('@playwright/test').Page, name: string) {
  mkdirSync(SHOTS_DIR, { recursive: true })
  return page.screenshot({
    path: join(SHOTS_DIR, `${name}.jpg`),
    type: 'jpeg',
    quality: 82,
  })
}

function readSave(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('tien-hiep-idle-save:guest')
    return raw ? JSON.parse(raw) : null
  })
}

async function seedAndReload(page: import('@playwright/test').Page, playerPatch: Record<string, unknown>) {
  await openSettingsAndSave(page)
  const before = await readSave(page)
  expect(before).not.toBeNull()

  const seeded = {
    ...before,
    player: {
      ...before.player,
      ...playerPatch,
    },
  }

  await page.addInitScript(
    ({ key, payload }) => {
      localStorage.setItem(key, JSON.stringify(payload))
    },
    { key: GUEST_SAVE_KEY, payload: seeded },
  )

  await page.reload()
  await reauthAndEnterHome(page)
}

function advanceTribulation(page: import('@playwright/test').Page, seconds: number) {
  return page.evaluate((delta) => {
    const game = (window as Window & {
      __tutienPhaserGame?: { registry: { get(key: string): unknown } }
    }).__tutienPhaserGame
    const director = game?.registry.get('gameManager') as
      | { tribulationDirector: { update(s: number): void; getState(): { state: string } | null } }
      | undefined
    if (!director) return 'missing-director'
    director.tribulationDirector.update(delta)
    return director.tribulationDirector.getState()?.state ?? 'cleared'
  }, seconds)
}

async function openWheelSlot(page: import('@playwright/test').Page, slotId: string) {
  const slot = page.locator(`[data-wheel-slot="${slotId}"]`)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!(await slot.isVisible().catch(() => false))) {
      await page.keyboard.press('Tab')
    }
    // Orbit animation needs a beat before the slot is click-stable.
    await page.waitForTimeout(700)
    if (!(await slot.isVisible().catch(() => false))) continue
    try {
      await slot.click({ timeout: 5_000 })
      return
    } catch {
      continue
    }
  }
  await slot.click({ timeout: 10_000 })
}

test('progression slice fixed screens', async ({ page }) => {
  // The audit path picks Kiem Tu - swordPath is scope-hidden under the
  // beta lock, so this capture run is skipped until the flag flips.
  test.skip(!BETA_FEATURES.swordPath, 'swordPath scope-hidden under the beta lock')
  await bootToGuestHome(page)
  await createCharacterThroughUi(page, 'AuditFix')
  await enterHome(page)

  // ---- RealmPanel (mortal) — requirement row + rate/ETA + mortal home node
  // Let one cultivation tick pass so the rate readout is populated.
  await page.waitForTimeout(1_500)
  await openWheelSlot(page, 'realm')
  const realmDialog = page.getByRole('dialog', { name: 'Cảnh Giới' })
  await expect(realmDialog).toBeVisible({ timeout: 15_000 })
  await expect(realmDialog.locator('.realm-requirement').first()).toBeVisible()
  await expect(realmDialog.locator('.realm-panel__cultivation-meta')).toContainText('/giây')
  await expect(realmDialog.locator('.realm-node.is-current')).toContainText('Phàm Nhân')
  await shot(page, '04-realm-panel-mortal')
  await page.keyboard.press('Escape')

  // ---- Seed realmLevel 12 -> breakthrough-ready mortal
  await seedAndReload(page, { realmLevel: 12, cultivation: 0 })
  await openWheelSlot(page, 'realm')
  await expect(realmDialog).toBeVisible({ timeout: 15_000 })
  await expect(realmDialog.locator('.realm-requirement--met')).toContainText('Phàm Nhân tầng 12')
  await shot(page, '06-realm-lv12-ready')

  // ---- BreakthroughRequirementPanel — no gear equipped -> no equipment warning
  await realmDialog.getByRole('button', { name: 'Quán Khí' }).click()
  const confirmDialog = page.getByRole('dialog', { name: /Độ kiếp cũng là độ thân/ })
  await expect(confirmDialog).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(800)
  await shot(page, '07-breakthrough-confirm')
  await confirmDialog.getByRole('button', { name: 'Đã hiểu' }).click()

  // ---- Tribulation mind card below the THIEN KIEP title band
  const tribulationUi = page.locator('.tribulation-ui')
  await expect(tribulationUi).toBeVisible({ timeout: 30_000 })
  await waitForPresentationIdle(page)

  // Step the director in small slices until the question card is up,
  // then freeze-frame it for the screenshot.
  for (let i = 0; i < 60; i += 1) {
    if (await page.locator('.tribulation-ui__mind').isVisible().catch(() => false)) break
    const state = await advanceTribulation(page, 2)
    if (state !== 'ongoing') break
    await page.waitForTimeout(120)
  }
  await expect(page.locator('.tribulation-ui__mind')).toBeVisible({ timeout: 15_000 })
  await shot(page, '12-tribulation-mind')

  // ---- Drive the tribulation to victory (answer via director — the
  // answer buttons re-render per tick, so DOM clicks race detach).
  for (let i = 0; i < 120; i += 1) {
    const answered = await page.evaluate(() => {
      const game = (window as Window & {
        __tutienPhaserGame?: { registry: { get(key: string): unknown } }
      }).__tutienPhaserGame
      const director = game?.registry.get('gameManager') as
        | { tribulationDirector: { answerQuestion(i: number): boolean } }
        | undefined
      return director?.tribulationDirector.answerQuestion(0) ?? false
    })
    if (answered) continue
    const state = await advanceTribulation(page, 4)
    if (state !== 'ongoing') break
  }
  await expect
    .poll(() => advanceTribulation(page, 10), { timeout: 30_000 })
    .toMatch(/victory|defeat|cleared/)

  // Mandatory talent entitlement on victory — waitFor (not isVisible):
  // the modal mounts after the outcome commits.
  const entitlementModal = page.locator('[data-testid="talent-entitlement-modal"]')
  const entitlementShown = await entitlementModal
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false)
  if (entitlementShown) {
    await entitlementModal.locator('button').first().click()
    await expect(entitlementModal).toHaveCount(0)
  }

  await expect(page.locator('.command-wheel-layer')).toBeAttached({ timeout: 30_000 })
  await waitForPresentationIdle(page)

  // ---- QuanKhiPanel — the three path choices now carry descriptions + kit
  await expect(page.locator('.quan-khi-panel__choices')).toBeVisible({ timeout: 15_000 })
  // The "QUÁN KHÍ THÀNH CÔNG" world announcement overlays the panel.
  const outcomeAnnouncement = page.locator('.world-announcement')
  if (await outcomeAnnouncement.isVisible().catch(() => false)) {
    await outcomeAnnouncement.click()
    await expect(outcomeAnnouncement).toHaveCount(0, { timeout: 15_000 })
  }
  await expect(page.locator('.quan-khi-panel__choice-desc').first()).toBeVisible()
  await shot(page, '13-quankhi-path-panel')

  // Choose Kiem Tu (sword) — same path the audit walked.
  const swordChoice = page.locator('.quan-khi-panel__choice', { hasText: 'Kiếm Tu' })
  await swordChoice.click()
  const confirm = page.locator('.confirm-modal__confirm')
  await expect(confirm).toBeVisible({ timeout: 10_000 })
  await confirm.click()
  await expect(page.locator('.overlay-panel')).toHaveCount(0, { timeout: 10_000 })
  const announcement = page.locator('.world-announcement')
  if (await announcement.isVisible().catch(() => false)) {
    await announcement.click()
    await expect(announcement).toHaveCount(0, { timeout: 15_000 })
  }

  // ---- RealmPanel at qi_refining — live node reads "Đang tu hành"
  await openWheelSlot(page, 'realm')
  await expect(realmDialog).toBeVisible({ timeout: 15_000 })
  await expect(realmDialog.locator('.realm-node.is-current small')).toHaveText('Đang tu hành')
  // Panel mounts with a fade — let it settle so the shot isn't mid-transition.
  await page.waitForTimeout(800)
  await shot(page, '18-realm-panel-qi')
  await page.keyboard.press('Escape')

  // ---- Node tree — default zoom stays readable (>= FIT_ZOOM_MIN)
  await openWheelSlot(page, 'skill')
  const skillPanel = page.locator('.hk-scroll')
  await expect(skillPanel).toBeVisible({ timeout: 15_000 })
  const zoomValue = skillPanel.locator('.node-tree__zoom-value')
  await expect(zoomValue).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(async () => parseInt((await zoomValue.textContent()) ?? '0', 10), { timeout: 10_000 })
    .toBeGreaterThanOrEqual(65)
  await shot(page, '21-tree-default-zoom')
  await page.keyboard.press('Escape')

  // ---- StageSelectPanel — lock badge + reason on the floor tile and detail
  await openWheelSlot(page, 'teleport_array')
  const stageOverlay = page.getByTestId('function-overlay-panel')
  await expect(stageOverlay).toBeVisible({ timeout: 10_000 })
  const lockedNode = stageOverlay.locator('.stage-map__node.is-locked').first()
  await expect(lockedNode.locator('.stage-map__lock')).toBeAttached()
  await shot(page, '22-stage-select')
  await lockedNode.click()
  await expect(stageOverlay.locator('.stage-select__locked-hint')).toBeVisible()
  await shot(page, '23-stage-locked-detail')

  // ---- Combat top bar — formatted HP, no raw float leak
  const startButton = page.getByTestId('stage-start-button')
  const unlockedNode = stageOverlay.locator('.stage-map__node:not(.is-locked)').first()
  await unlockedNode.click()
  await expect(startButton).toBeEnabled({ timeout: 10_000 })
  await startButton.click()

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = (window as Window & {
            __tutienPhaserGame?: { registry: { get(key: string): unknown } }
          }).__tutienPhaserGame
          const manager = game?.registry.get('gameManager') as
            | { getTurnBattle(): unknown }
            | undefined
          return manager?.getTurnBattle() != null
        }),
      { timeout: 30_000 },
    )
    .toBe(true)

  // Wait until the turn strip actually renders member HP rows.
  const memberHp = page.locator('.turn-order-strip__member-hp')
  await expect(memberHp.first()).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1_000)
  const hpTexts = await memberHp.allTextContents()
  for (const text of hpTexts) {
    expect(text).not.toMatch(/\.\d{4,}/)
  }
  await shot(page, '27-battle-topbar')
})
