import { expect, test } from './fixtures'
import { createCharacterThroughUi, enterHome } from './helpers'

/**
 * M-UI-SYSTEM e2e - dialog-focus containment over the Huyen Kim chrome.
 *
 * History: this spec originally proved the sys-rim handoff between the
 * old .left-panel character drawer and the variant="system" realm modal.
 * The Huyen Kim rebuild retired both surfaces (imperial scrolls own the
 * scenes; no production OverlayPanel passes variant="system" any more),
 * so the rim-authority e2e premise no longer exists - the composable's
 * unit tests (useSystemRimAuthority.test.ts) still cover the law itself.
 *
 * What remains live here: the nested-modal focus containment regression
 * (a ConfirmModal inside the settings scroll must answer Escape without
 * closing the scroll behind it).
 */

test.describe('system UI skin - dialog containment', () => {
  test('a nested system modal answers Escape, not the background scroll', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')
    await page.getByTestId('auth-guest-button').click()
    await createCharacterThroughUi(page, 'Hệ Thống')
    await enterHome(page)

    // Settings (paper scene) -> reload opens a nested ink ConfirmModal
    // teleported over the settings surface. Clicking the modal scrim
    // must not move focus to the background scene: Escape then closes only
    // the confirm, and the settings scene stays open (QA regression -
    // useDialogFocus pointer containment).
    await page.keyboard.press('Tab')
    await page.locator('[data-wheel-slot="settings"]').click()
    const settingsScene = page.locator('.settings-scene').first()
    await expect(settingsScene).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /Tải Lại|reload/i }).first().click()
    const confirmModal = page.locator('.confirm-modal')
    await expect(confirmModal).toBeVisible({ timeout: 10_000 })

    await page.mouse.click(40, 400)
    await page.keyboard.press('Escape')
    await expect(confirmModal).toBeHidden({ timeout: 10_000 })
    await expect(settingsScene).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Escape')
  })
})
