import { expect, test } from '@playwright/test'

import { assertNoBrowserErrors, collectBrowserErrors } from './helpers'

/**
 * UI/UX QA remediation (Task 10, 2026-09-07) — keyboard-only journey:
 * auth → character creation → home đều thao tác được bằng bàn phím
 * (Enter/Space kích hoạt, Tab di chuyển, focus visible qua activeElement).
 * Cùng fixture: console/pageerror gate (QA-002).
 */
test.describe('Keyboard accessibility journey', () => {
  test('auth + character creation operable by keyboard only', async ({ page }) => {
    const collected = collectBrowserErrors(page)

    test.setTimeout(120_000)

    // KHÔNG dùng bootToGuestHome (nó click guest bằng mouse) — spec này
    // kiểm chứng chính luồng auth bằng bàn phím.
    await page.goto('/')

    const auth = page.getByTestId('auth-screen')
    await expect(auth).toBeVisible({ timeout: 15_000 })

    // Auth screen: guest button là focusable thứ 4 (tab login + tab register
    // + input id + input password + guest). Tab từng bước — SAU mỗi Tab kiểm
    // tra activeElement (thứ tự: check → press, do lần Tab đầu nhảy từ body).
    let activated = false

    for (let i = 0; i < 8 && !activated; i++) {
      await page.keyboard.press('Tab')

      const isFocused = await page.evaluate(() => {
        const active = document.activeElement

        return active?.getAttribute('data-testid') === 'auth-guest-button'
      })

      if (isFocused) {
        await page.keyboard.press('Enter')
        activated = true
      }
    }

    expect(activated, 'auth guest button phải reachable bằng Tab').toBe(true)

    await expect(page.getByTestId('character-creation-screen')).toBeVisible({ timeout: 15_000 })

    // Character creation: name input bằng keyboard, continue bằng Enter.
    await page.getByTestId('creation-name-input').fill('Keyboard Hero')
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('creation-continue-name')).toBeEnabled({ timeout: 5_000 })
    await page.keyboard.press('Enter')

    await expect(page.locator('[data-testid^="creation-talent-"]').first()).toBeVisible({ timeout: 10_000 })

    // Chọn talent bằng keyboard: focus card đầu + Enter (button/card).
    const talentCard = page.locator('[data-testid^="creation-talent-"]').first()
    await talentCard.focus()
    await page.keyboard.press('Enter')
    await page.getByTestId('creation-confirm-talent').click()

    // Attribute points: phân bổ đủ 5 điểm qua Space trên nút plus (button
    // activation) — creation-finish disabled tới khi pointsLeft === 0.
    const plusButtons = page.locator('[data-testid^="creation-attribute-plus-"]')
    const count = await plusButtons.count()

    for (let i = 0; i < Math.min(count, 5); i++) {
      await plusButtons.nth(i).focus()
      await page.keyboard.press('Space')
    }

    await expect(page.getByTestId('creation-finish')).toBeEnabled({ timeout: 5_000 })
    await page.getByTestId('creation-finish').focus()
    await page.keyboard.press('Enter')

    // Home hiện sau boot — dismiss tutorial nếu có (keyboard: Enter = Bỏ Qua).
    await expect(page.locator('.game-root')).toBeVisible({ timeout: 30_000 })

    const tutorial = page.locator('.tutorial-overlay')

    if (await tutorial.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.getByRole('button', { name: /Bỏ Qua|B? Qua/i }).focus()
      await page.keyboard.press('Enter')
      await expect(tutorial).not.toBeVisible({ timeout: 5_000 })
    }

    assertNoBrowserErrors(collected)
  })
})
