import { expect, test } from './fixtures'

import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'

/**
 * E2E lifecycle spec 2/3 (tech-debt-test-coverage-plan.md sec3.3) - tao
 * nhan vat qua UI that (ten -> 1 thien phu -> phan bo 5 diem) -> vao Dong
 * Phu -> mo Truyen Tong Tran (chon man) -> Bat Dau -> cho ket qua
 * Thang/Thua hien tren DOM (khong assert pixel canvas).
 */
test.describe('Create character to combat', () => {
  test('creates a character, starts a stage battle and shows a result', async ({ page }) => {
    test.setTimeout(360_000)

    await bootToGuestHome(page)

    await createCharacterThroughUi(page, 'E2E Chiến Đầu')

    // Da vao Dong Phu: LeftPanel chrome + command wheel exists (DOM, not canvas).
    await enterHome(page)

    // Mo man chon ai qua command wheel slot Truyen Tong Tran (data-wheel-slot attr).
    // Phaser canvas click risk: AVOID clicking the canvas character trigger; instead
    // use the keyboard shortcut Tab (DongFuStage.vue listens for Tab keydown)
    // to open the command wheel deterministically.
    await page.keyboard.press('`')

    const teleportSlot = page.locator('[data-wheel-slot="teleport_array"]')
    await expect(teleportSlot).toBeVisible({ timeout: 10_000 })
    await teleportSlot.click()

    // Son Ha Do exploration scene opens (functionType 'stage_select').
    const overlay = page.locator('.exploration-scene')
    await expect(overlay).toBeVisible({ timeout: 10_000 })

    // A stage is auto-selected (first unlocked in zone). Bat Dau should enable.
    const startButton = page.getByTestId('stage-start-button')
    await expect(startButton).toBeEnabled({ timeout: 10_000 })
    await startButton.click()

    // Combat scene takes over the full screen - top bar shows zone + progress text.
    const combatTopBar = page.locator('.combat-top-bar')
    await expect(combatTopBar).toBeVisible({ timeout: 15_000 })
    await expect(combatTopBar.getByText('quái')).toBeVisible()

    // Battle runs real-time through the turn loop (turn N/20 cap). A fresh
    // mortal character on stage 1 (116 enemies) reliably ends in DEFEAT;
    // victory (clearing all) is a valid end state too. The observed defeat
    // lands well inside the budget on a fast host, but presentation-deadline
    // scaling + parallel-worker contention stretch a turn past 10s on slow
    // filesystems - the cap alone is ~20 turns of rendered combat.
    const resultModal = page.locator('.combat-result-modal')
    await expect
      .poll(async () => resultModal.isVisible(), {
        timeout: 300_000,
        message: 'Combat result modal (victory/defeat) should appear',
      })
      .toBe(true)

    // DOM assertion on the outcome - victory OR defeat, both end the battle.
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
