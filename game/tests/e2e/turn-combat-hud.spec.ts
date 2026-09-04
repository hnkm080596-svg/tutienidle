import { expect, test } from '@playwright/test'

import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'

/**
 * Slice 7 e2e (master plan Task 7/8 Step 5 smoke test, 2026-09-04):
 *
 * 1. Tạo nhân vật → trận Tầng 1 chạy trọn vẹn (unified flow — kết quả
 *    Thắng/Thua hiển thị) → "Đánh Lại" tạo trận mới (regression fix
 *    StageManager release, merge 70cb22e).
 * 2. HUD path hiển thị slot combat (mới — thay legacy slider/Ult đã gỡ),
 *    legacy controls KHÔNG còn xuất hiện.
 * 3. Refight không crash, không ErrorScreen.
 *
 * Note pacing: trận Tầng 1 kết thúc nhanh (~0.6s fighting sau countdown
 * 3s < 1 stateVersion tick 1s) nên TurnCombatSkillBar/turn-order strip có
 * thể không kịp render trước khi trận xong — assertion chấp nhận b HEẾ
 * slot HUD (render ngay khi battle mount) thay vì bar (cần fighting state
 * render window).
 */
test.describe('Slice 7 — turn combat HUD', () => {
  test('battle runs, combat slots render, legacy controls gone, refight works', async ({ page }) => {
    test.setTimeout(210_000)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Turn HUD')
    await enterHome(page)

    // Open stage select via keyboard Tab (deterministic) and start battle 1.
    await page.keyboard.press('Tab')

    const teleportSlot = page.locator('[data-wheel-slot="teleport_array"]')
    await expect(teleportSlot).toBeVisible({ timeout: 10_000 })
    await teleportSlot.click()

    const overlay = page.getByTestId('function-overlay-panel')
    await expect(overlay).toBeVisible({ timeout: 10_000 })

    const startButton = page.getByTestId('stage-start-button')
    await expect(startButton).toBeEnabled({ timeout: 10_000 })
    await startButton.click()

    // Battle 1 runs to a result panel (victory expected on stage 1).
    const victory = page.locator('.combat-victory-panel')
    await expect(victory).toBeVisible({ timeout: 120_000 })

    // Legacy Kiếm Tu controls must be GONE (retired in Task 7).
    await expect(page.locator('.kiem-tu-combat-hud__ult')).toHaveCount(0)
    await expect(page.getByText('Nhịp Tụ Lực')).toHaveCount(0)

    // Refight — regression guard for the StageManager-release fix.
    await page.locator('.combat-victory-panel__retry').click()
    await expect(victory).toBeHidden({ timeout: 15_000 })

    // During battle 2, scan for combat skill slots (HUD mounts with the
    // battle — independent of the fast fighting window).
    let sawSlot = false

    for (let i = 0; i < 300; i++) {
      const slotCount = await page
        .locator('.combat-scene-overlay .combat-skill-slot')
        .count()
        .catch(() => 0)

      if (slotCount >= 1) {
        sawSlot = true
        break
      }

      if ((await victory.isVisible().catch(() => false)) === true) {
        break
      }

      await page.waitForTimeout(100)
    }

    expect(sawSlot, 'Ít nhất 1 combat skill slot phải render trong trận 2').toBe(true)

    // Battle 2 eventually resolves (no crash, no error screen).
    await expect(victory.or(page.locator('.combat-defeat-panel'))).toBeVisible({
      timeout: 120_000,
    })

    // No error boundary triggered.
    await expect(page.locator('.error-screen')).toHaveCount(0)
  })
})
