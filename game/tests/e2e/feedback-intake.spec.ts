import { expect, test } from './fixtures'
import {
  bootToGuestHome,
  createCharacterThroughUi,
  enterHome,
} from './helpers'

/**
 * BETA-FINAL PR13 / spec B7 - the feedback intake journey against the live
 * app (mock backend): the settings entry opens the dialog, submit is
 * disabled until a description exists, a failed submit preserves the
 * draft, the honest 'unavailable' status renders, and local export stays
 * available without any auth or network.
 */

async function openSettings(page: import('./fixtures').Page) {
  await page.keyboard.press('`')
  const settingsSlot = page.locator('[data-wheel-slot="settings"]')
  await expect(settingsSlot).toBeVisible({ timeout: 10_000 })
  await settingsSlot.click()
}

test.describe('feedback intake dialog', () => {
  test('opens from settings, preserves a failed draft, stays exportable', async ({ page }) => {
    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'Phan Hoi')
    await enterHome(page)

    await openSettings(page)
    // Scene 17 seal nav: the feedback entry lives in the support section.
    const supportSeal = page.locator('.settings-panel__nav-seal[data-section="support"]')
    await expect(supportSeal).toBeVisible({ timeout: 10_000 })
    await supportSeal.click()
    const feedbackButton = page.getByTestId('settings-feedback-button')
    await expect(feedbackButton).toBeVisible({ timeout: 10_000 })
    await feedbackButton.click()

    const dialog = page.getByTestId('feedback-dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // Submit is gated on a non-empty description.
    const submit = page.getByTestId('feedback-submit')
    await expect(submit).toBeDisabled()

    const description = 'e2e: merge gate stayed open after the wave ended'
    await page.getByTestId('feedback-description').fill(description)
    await expect(submit).toBeEnabled()
    await submit.click()

    // Mock backend -> LocalFeedbackService honestly reports 'unavailable';
    // nothing fabricates an acceptance.
    const status = page.getByTestId('feedback-status')
    await expect(status).toBeVisible({ timeout: 10_000 })
    // The draft survived the failure (B7 acceptance).
    await expect(page.getByTestId('feedback-description')).toHaveValue(description)

    // Local export never needs auth or a backend.
    await expect(page.getByTestId('feedback-export')).toBeEnabled()

    // Draft persists across close + reopen.
    await page.getByTestId('feedback-dialog').press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })
    await feedbackButton.click()
    await expect(page.getByTestId('feedback-description')).toHaveValue(description)
  })
})
