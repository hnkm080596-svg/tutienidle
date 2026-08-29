import { expect, test } from '@playwright/test'

import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'

/**
 * E2E lifecycle spec 2/3 (tech-debt-test-coverage-plan.md §3.3) — tạo
 * nhân vật qua UI thật (tên → 1 thiên phú → phân bổ 5 điểm) → vào Động
 * Phủ → mở Truyền Tống Trận (chọn màn) → Bắt Đầu → chờ kết quả
 * Thắng/Thua hiện trên DOM (không assert pixel canvas).
 */
test.describe('Create character to combat', () => {
  test('creates a character, starts a stage battle and shows a result', async ({ page }) => {
    test.setTimeout(210_000)

    await bootToGuestHome(page)

    await createCharacterThroughUi(page, 'E2E Chiến Đầu')

    // Đã vào Động Phủ: LeftPanel chrome + command wheel exists (DOM, not canvas).
    await enterHome(page)

    // Mở màn chọn ải qua command wheel slot Truyền Tống Trận (data-wheel-slot attr).
    // Phaser canvas click risk: AVOID clicking the canvas character trigger; instead
    // use the keyboard shortcut Tab (DongFuCommandWheel.vue listens for Tab keydown)
    // to open the command wheel deterministically.
    await page.keyboard.press('Tab')

    const teleportSlot = page.locator('[data-wheel-slot="teleport_array"]')
    await expect(teleportSlot).toBeVisible({ timeout: 10_000 })
    await teleportSlot.click()

    // Stage select overlay opens (functionType 'stage_select').
    const overlay = page.getByTestId('function-overlay-panel')
    await expect(overlay).toBeVisible({ timeout: 10_000 })

    // A stage is auto-selected (selectFirstStageInChapter). Bắt Đầu should enable.
    const startButton = page.getByTestId('stage-start-button')
    await expect(startButton).toBeEnabled({ timeout: 10_000 })
    await startButton.click()

    // Combat scene takes over the full screen — top bar shows zone + progress text.
    const combatTopBar = page.locator('.combat-top-bar')
    await expect(combatTopBar).toBeVisible({ timeout: 15_000 })
    await expect(combatTopBar.getByText('quái')).toBeVisible()

    // Battle runs in REAL TIME (100ms tick). A fresh mortal character on stage 1
    // (116 enemies) reliably ends in DEFEAT after ~100s of combat (observed in
    // error snapshots: rewards Linh Thạch +9 granted along the way). Victory
    // (clearing all 116) would also be a valid end state. Poll generously.
    const resultModal = page.locator('.combat-result-modal')
    await expect
      .poll(async () => resultModal.isVisible(), {
        timeout: 180_000,
        message: 'Combat result modal (victory/defeat) should appear',
      })
      .toBe(true)

    // DOM assertion on the outcome — victory OR defeat, both end the battle.
    const victory = page.locator('.combat-victory-panel')
    const defeat = page.locator('.combat-defeat-panel')
    await expect
      .poll(async () => (await victory.isVisible()) || (await defeat.isVisible()), {
        timeout: 10_000,
        message: 'Victory or defeat panel visible',
      })
      .toBe(true)
  })
})
