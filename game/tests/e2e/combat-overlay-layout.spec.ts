import { expect, test, type Page } from '@playwright/test'

import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'

/**
 * T8.3 (2026-09-02) — combat overlay layout smoke: sau khi vào trận,
 * các panel overlay neo ĐÚNG vị trí và không đè nhau:
 * - root phủ toàn viewport (full-canvas coverage)
 * - AI panel (bảng chọn mục tiêu) neo trái-trên, nằm trong battlefield
 * - Build HUD neo giữa-dưới, không xâm phạm vùng HUD canvas trái-dưới
 * Chạy ở 3 viewports (desktop/compact/tall) — screenshot kèm theo.
 * Không assert pixel canvas — chỉ DOM geometry (boundingBox).
 */
const VIEWPORTS = [
  { name: 'desktop', width: 1600, height: 900 },
  { name: 'compact', width: 1366, height: 768 },
  { name: 'tall', width: 900, height: 1200 },
] as const

/** Vào được trận: guest → tạo NV → home → teleport → Bắt đầu. */
async function enterBattle(page: Page, name: string): Promise<void> {
  await bootToGuestHome(page)
  await createCharacterThroughUi(page, name)
  await enterHome(page)

  await page.keyboard.press('Tab')

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

      // Root phủ toàn viewport (T8.1 regression guard — từng bị xóa styles).
      const root = page.locator('.combat-scene-overlay')
      await expect(root).toBeVisible()
      const rootBox = await root.boundingBox()
      expect(rootBox).not.toBeNull()
      expect(rootBox!.width).toBe(viewport.width)
      expect(rootBox!.height).toBe(viewport.height)

      // AI panel neo trái-trên, NẰM TRONG viewport (không tràn flow).
      const aiPanel = page.locator('.combat-scene-overlay__ai-panel')
      await expect(aiPanel).toBeVisible()
      const aiBox = await aiPanel.boundingBox()
      expect(aiBox).not.toBeNull()
      expect(aiBox!.x).toBeGreaterThanOrEqual(0)
      expect(aiBox!.y).toBeGreaterThanOrEqual(0)
      expect(aiBox!.x + aiBox!.width).toBeLessThanOrEqual(viewport.width)
      expect(aiBox!.y + aiBox!.height).toBeLessThanOrEqual(viewport.height)

      // Combat Art Pipeline Task 7 (2026-09-05) — Build HUD + skill bar rời
      // slot bottom-center cũ (class `combat-scene-overlay__build-hud`, đã
      // XÓA) vào CombatSkillDockPanel.vue (`.combat-skill-dock-panel`), dock
      // full-height neo MÉP PHẢI (top:0/right:0/bottom:0). Vùng HUD canvas
      // trái-dưới: chỉ content-có-chứa (con dock thực — CombatBuildHud) mới
      // cần né, còn container tự nó đã ở bên phải nên không đè trái-dưới —
      // đo con đầu tiên thay vì container.
      const skillDock = page.locator('.combat-skill-dock-panel')
      await expect(skillDock).toBeVisible()
      const hudBox = await skillDock.boundingBox()
      expect(hudBox).not.toBeNull()
      expect(hudBox!.y + hudBox!.height).toBeLessThanOrEqual(viewport.height)

      const contentBox = await skillDock.locator('*').first().boundingBox()
      expect(contentBox).not.toBeNull()
      const canvasHudZoneRight = 210
      const canvasHudZoneTop = viewport.height - 100
      const overlapsCanvasHud =
        contentBox!.x < canvasHudZoneRight &&
        contentBox!.x + contentBox!.width > 0 &&
        contentBox!.y + contentBox!.height > canvasHudZoneTop
      expect(overlapsCanvasHud, 'Skill dock content must not overlap canvas HUD zone (bottom-left)').toBe(false)

      await page.screenshot({
        path: testInfo.outputPath(`overlay-${viewport.name}.png`),
        animations: 'disabled',
      })
    })
  }
})
