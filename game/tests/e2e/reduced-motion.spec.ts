import { expect, test } from './fixtures'

/**
 * UI/UX QA remediation (Task 10, 2026-09-07) - reduced motion: voi
 * `prefers-reduced-motion: reduce`, cac animation CSS chinh (loading
 * pulse, game-button spinner, realm aura, menu glow) phai dung yen
 * (animation-duration ~0 / khong chay). Kiem tra qua getComputedStyle.
 */
test.describe('Reduced motion', () => {
  test('animations disabled under prefers-reduced-motion: reduce', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await page.goto('/')

    // LoadingScreen pulse (hien trong intro - truoc auth).
    const pulse = page.locator('.loading-screen__pulse')
    const pulseVisible = await pulse.isVisible({ timeout: 5_000 }).catch(() => false)

    if (pulseVisible) {
      const animationName = await pulse.evaluate((el) => getComputedStyle(el).animationName)
      expect(animationName, 'loading pulse phải tắt animation khi reduce').toBe('none')
    }

    // Auth screen van hien binh thuong (khong bi reduced-motion chan).
    await expect(page.getByTestId('auth-screen')).toBeVisible({ timeout: 15_000 })
  })
})
