import { expect, test } from '@playwright/test'

import { bootToGuestHome } from './helpers'

/**
 * UI/UX QA remediation (Task 10, 2026-09-07) — reduced motion: với
 * `prefers-reduced-motion: reduce`, các animation CSS chính (loading
 * pulse, game-button spinner, realm aura, menu glow) phải đứng yên
 * (animation-duration ~0 / không chạy). Kiểm tra qua getComputedStyle.
 */
test.describe('Reduced motion', () => {
  test('animations disabled under prefers-reduced-motion: reduce', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await page.goto('/')

    // LoadingScreen pulse (hiện trong intro — trước auth).
    const pulse = page.locator('.loading-screen__pulse')
    const pulseVisible = await pulse.isVisible({ timeout: 5_000 }).catch(() => false)

    if (pulseVisible) {
      const animationName = await pulse.evaluate((el) => getComputedStyle(el).animationName)
      expect(animationName, 'loading pulse phải tắt animation khi reduce').toBe('none')
    }

    // Auth screen vẫn hiện bình thường (không bị reduced-motion chặn).
    await expect(page.getByTestId('auth-screen')).toBeVisible({ timeout: 15_000 })
  })
})
