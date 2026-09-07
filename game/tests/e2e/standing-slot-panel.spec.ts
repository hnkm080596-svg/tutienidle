import { expect, test } from '@playwright/test'

/**
 * P14 verification (standing-slot plan Task 6 Step 7, 2026-09-07):
 * Trận Pháp panel with the 3x3 standing-slot grid.
 *
 * 1. Open the panel, select Hon Don Tran (TEST-ONLY formation opening all
 *    9 slots).
 * 2. Grant test companions, drag player + a companion into cells (real
 *    DragEvent dispatch -- native dragTo does not fire this codebase's
 *    Vue @dragstart/@drop handlers, see P14).
 * 3. Assert: no crash (Phaser.Game bootstrap with the missing physics
 *    config fix), 3x3 overlay grid (9 cells, not 36), occupied cells get
 *    the distinct green background class, Phaser canvas renders.
 *
 * The webServer (port 5175) is started/killed by playwright.config.ts.
 */
test.describe('Standing slot panel (P14)', () => {
  test('panel opens, drag-drop works without crash, 3x3 grid with distinct occupied state', async ({ page }) => {
    test.setTimeout(120_000)

    // Guest auth + character creation (same flow as helpers.ts).
    await page.goto('/')
    await expect(page.getByTestId('auth-screen')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('auth-guest-button').click()
    await expect(page.getByTestId('character-creation-screen')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('creation-name-input').fill('P14 Slot Panel')
    await page.getByTestId('creation-continue-name').click()
    await page.locator('[data-testid^="creation-talent-"]').first().click()
    await page.getByTestId('creation-confirm-talent').click()
    const plusButtons = page.locator('[data-testid^="creation-attribute-plus-"]')
    const count = await plusButtons.count()

    for (let i = 0; i < Math.min(count, 5); i++) {
      await plusButtons.nth(i).click()
    }

    await page.getByTestId('creation-finish').click()

    await expect(page.locator('.game-root')).toBeVisible({ timeout: 30_000 })

    // Dismiss tutorial overlay if present (blocks pointer events).
    const tutorial = page.locator('.tutorial-overlay')

    if (await tutorial.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await page.getByRole('button', { name: /Bỏ Qua/i }).click()
      await expect(tutorial).not.toBeVisible({ timeout: 5_000 })
    }

    // Collect console errors (crash fix evidence).
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })
    page.on('pageerror', (error) => {
      consoleErrors.push(`pageerror: ${String(error)}`)
    })

    // Open the command wheel and the formation panel.
    await page.keyboard.press('Tab')
    const formationSlot = page.locator('[data-wheel-slot="formation_slot"]')
    await expect(formationSlot).toBeVisible({ timeout: 10_000 })
    await formationSlot.click()

    const panel = page.locator('.tran-phap-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Select the TEST-ONLY formation (opens all 9 standing slots).
    await panel.locator('.tran-phap-panel__formation-button', { hasText: 'Hỗn Độn Trận' }).click()

    // Grid must be 3x3 = 9 cells now (was 36 pre-rework).
    const cellCount = await panel.locator('.tran-phap-panel__cell').count()
    expect(cellCount, 'overlay grid must be 3x3 = 9 cells').toBe(9)

    // All 9 cells enabled (Hon Don Tran opens every slot).
    const enabledCount = await panel.locator('.tran-phap-panel__cell--enabled').count()
    expect(enabledCount).toBe(9)

    // Phaser canvas must exist underneath (scene bootstrap did not crash).
    await expect(panel.locator('.tran-phap-panel__preview-canvas canvas')).toBeVisible({ timeout: 10_000 })

    // Grant the 5 test companions so a companion card appears in the queue.
    const grantButton = panel.locator('.tran-phap-panel__grant-test')
    await expect(grantButton).toBeVisible()
    await grantButton.click()
    await expect(grantButton).toBeHidden()

    // Drag player card into cell (1,1) -- real DragEvent via evaluate (P14).
    await page.evaluate(() => {
      const card = document.querySelector('.tran-phap-panel__card') as HTMLElement | null
      const target = document.querySelectorAll('.tran-phap-panel__cell')[4] as HTMLElement | undefined

      if (!card || !target) {
        throw new Error('card or cell missing')
      }

      const dataTransfer = new DataTransfer()
      card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }))
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }))
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }))
    })

    // Vue updates on the next microtask -- separate call (P14 gotcha).
    await page.waitForTimeout(300)

    // Exactly one occupied cell, and it carries the occupied class
    // (CSS state fix evidence: green background class present).
    const occupied = panel.locator('.tran-phap-panel__cell--occupied')
    await expect(occupied).toHaveCount(1)
    await expect(occupied).toContainText('player')

    // Sprite materialized on the Phaser canvas for the assignment
    // (syncAssignments ran -- canvas scene alive, no crash).
    const canvasStillAlive = await panel.locator('.tran-phap-panel__preview-canvas canvas').isVisible()
    expect(canvasStillAlive, 'Phaser canvas must still be alive after drop (crash fix)').toBe(true)

    // Drag a companion into another cell (0,0).
    await page.evaluate(() => {
      const cards = document.querySelectorAll('.tran-phap-panel__card')
      const card = cards[0] as HTMLElement | undefined
      const target = document.querySelectorAll('.tran-phap-panel__cell')[0] as HTMLElement | undefined

      if (!card || !target) {
        throw new Error('companion card or cell missing')
      }

      const dataTransfer = new DataTransfer()
      card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }))
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }))
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }))
    })

    await page.waitForTimeout(300)

    await expect(panel.locator('.tran-phap-panel__cell--occupied')).toHaveCount(2)

    // Save formation (confirm button enabled after assignments exist).
    const confirmButton = panel.locator('.tran-phap-panel__confirm')
    await expect(confirmButton).toBeEnabled()
    await confirmButton.click()

    // No crash anywhere: zero console errors / page errors.
    expect(consoleErrors, `unexpected console errors: ${consoleErrors.join(' | ')}`).toEqual([])
  })
})
