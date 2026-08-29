import { expect, test } from '@playwright/test'

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

    // Step 1 is the name step — verify its real Vietnamese copy from the template.
    await expect(creation.getByText('Đạo danh', { exact: false })).toBeVisible()
    await expect(page.getByTestId('creation-name-input')).toBeVisible()
    await expect(creation.getByText('Bước 1 / 3')).toBeVisible()
  })
})
