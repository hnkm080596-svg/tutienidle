import { expect, test, type Page } from './fixtures'

import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'

/**
 * T8.3 (2026-09-02) - combat overlay layout smoke: sau khi vao tran,
 * cac panel overlay neo DUNG vi tri va khong de nhau:
 * - root phu toan viewport (full-canvas coverage)
 * - AI panel (bang chon muc tieu) neo trai-tren, nam trong battlefield
 * - Build HUD neo giua-duoi, khong xam pham vung HUD canvas trai-duoi
 * Chay o 3 viewports (desktop/compact/tall) - screenshot kem theo.
 * Khong assert pixel canvas - chi DOM geometry (boundingBox).
 */
const VIEWPORTS = [
  { name: 'desktop', width: 1600, height: 900 },
  { name: 'compact', width: 1366, height: 768 },
  { name: 'tall', width: 900, height: 1200 },
] as const

/** Vao duoc tran: guest -> tao NV -> home -> teleport -> Bat dau. */
async function enterBattle(page: Page, name: string): Promise<void> {
  await bootToGuestHome(page)
  await createCharacterThroughUi(page, name)
  await enterHome(page)

  await page.keyboard.press('`')

  const teleportSlot = page.locator('[data-wheel-slot="teleport_array"]')
  await expect(teleportSlot).toBeVisible({ timeout: 10_000 })
  await teleportSlot.click()

  const overlay = page.getByTestId('function-overlay-panel')
  await expect(overlay).toBeVisible({ timeout: 10_000 })

  const startButton = page.getByTestId('stage-start-button')
  await expect(startButton).toBeEnabled({ timeout: 10_000 })
  await startButton.click()

  const combatTopBar = page.locator('.combat-top-bar')
  await expect(combatTopBar).toBeVisible({ timeout: 15_000 })
}

test.describe('Combat overlay layout (T8.3)', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}: panels anchored, no canvas-HUD overlap`, async ({ page }, testInfo) => {
      test.setTimeout(120_000)
      await page.setViewportSize(viewport)

      await enterBattle(page, `T83 ${viewport.name}`)

      // Root phu toan viewport (T8.1 regression guard - tung bi xoa styles).
      const root = page.locator('.combat-scene-overlay')
      await expect(root).toBeVisible()
      const rootBox = await root.boundingBox()
      expect(rootBox).not.toBeNull()
      expect(rootBox!.width).toBe(viewport.width)
      expect(rootBox!.height).toBe(viewport.height)

      // AI panel neo trai-tren, NAM TRONG viewport (khong tran flow).
      const aiPanel = page.locator('.combat-scene-overlay__ai-panel')
      await expect(aiPanel).toBeVisible()
      const aiBox = await aiPanel.boundingBox()
      expect(aiBox).not.toBeNull()
      expect(aiBox!.x).toBeGreaterThanOrEqual(0)
      expect(aiBox!.y).toBeGreaterThanOrEqual(0)
      expect(aiBox!.x + aiBox!.width).toBeLessThanOrEqual(viewport.width)
      expect(aiBox!.y + aiBox!.height).toBeLessThanOrEqual(viewport.height)

      // Combat Art Pipeline Task 7 (2026-09-05) - Build HUD + skill bar roi
      // slot bottom-center cu (class `combat-scene-overlay__build-hud`, da
      // XOA) vao CombatSkillDockPanel.vue (`.combat-skill-dock-panel`), dock
      // neo MEP PHAI. Vung HUD canvas trai-duoi: chi content-co-chua (con
      // dock thuc - TurnCombatSkillBar) moi can ne, con container tu no da o
      // ben phai nen khong de trai-duoi - do con dau tien thay vi container.
      //
      // Layout fix (2026-09-06) - dock KHONG con full-height (top:0) nhu
      // comment cu mo ta: de len enemy counter mep phai cua TopBar la bug
      // da duoc review phat hien. Nay `top: var(--combat-topbar-h)` - dock
      // bat dau ngay duoi TopBar. Assert them: dock khong con bat dau o
      // y=0 ma bat dau tu (hoac sau) mep duoi TopBar that.
      const combatTopBar = page.locator('.combat-top-bar')
      const topBarBox = await combatTopBar.boundingBox()
      expect(topBarBox).not.toBeNull()

      const skillDock = page.locator('.combat-skill-dock-panel')
      await expect(skillDock).toBeVisible()
      const hudBox = await skillDock.boundingBox()
      expect(hudBox).not.toBeNull()
      expect(hudBox!.y + hudBox!.height).toBeLessThanOrEqual(viewport.height)
      expect(hudBox!.y).toBeGreaterThanOrEqual(topBarBox!.y + topBarBox!.height)

      const contentBox = await skillDock.locator('*').first().boundingBox()
      expect(contentBox).not.toBeNull()
      // Spec 13 player-hud zone is canvas-left TOP (16/72 of 1672x941) -
      // the dock is right-edge so the guard still only needs the left
      // strip + spec band height.
      const canvasHudZoneRight = 350
      const canvasHudZoneBottom = viewport.height * (202 / 941)
      const overlapsCanvasHud =
        contentBox!.x < canvasHudZoneRight &&
        contentBox!.x + contentBox!.width > 0 &&
        contentBox!.y < canvasHudZoneBottom
      expect(overlapsCanvasHud, 'Skill dock content must not overlap canvas HUD zone (top-left)').toBe(false)

      await page.screenshot({
        path: testInfo.outputPath(`overlay-${viewport.name}.png`),
        animations: 'disabled',
      })
    })
  }
})
