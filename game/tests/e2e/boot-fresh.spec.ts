import { expect, test } from './fixtures'

/**
 * E2E lifecycle spec 1/3 (tech-debt-test-coverage-plan.md §3.3) — boot
 * KHÔNG có save: LoadingScreen → AuthEntryScreen → guest →
 * CharacterCreationScreen hiển thị.
 */
test.describe('Boot fresh (no saved state)', () => {
  test('boots to character-creation when no save exists', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear()
    })

    await page.goto('/')

    // Intro loading screen runs ~3s before auth entry (see App.vue introHandle).
    const auth = page.getByTestId('auth-screen')
    await expect(auth).toBeVisible({ timeout: 15_000 })

    // "Chơi ngay" (guest) skips credentials; MockAuthService resolves after 250ms.
    await page.getByTestId('auth-guest-button').click()

    // Empty save → bootFlow.requireCharacter() → creation screen.
    const creation = page.getByTestId('character-creation-screen')
    await expect(creation).toBeVisible({ timeout: 15_000 })

    // BETA-CREATION - one unified screen, no stepper: name + talent +
    // starting-skill sections all visible at once.
    await expect(creation.getByText('Đạo danh', { exact: false })).toBeVisible()
    await expect(page.getByTestId('creation-name-input')).toBeVisible()
    await expect(page.getByTestId('creation-skill-tram')).toBeVisible()
  })
})
