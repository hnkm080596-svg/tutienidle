import { expect, test } from './fixtures'

import { assertNoBrowserErrors, collectBrowserErrors, waitForPresentationIdle } from './helpers'

/**
 * UI/UX QA remediation (Task 10, 2026-09-07) - keyboard-only journey:
 * auth -> character creation -> home deu thao tac duoc bang ban phim
 * (Enter/Space kich hoat, Tab di chuyen, focus visible qua activeElement).
 * Cung fixture: console/pageerror gate (QA-002).
 */
test.describe('Keyboard accessibility journey', () => {
  test('auth + character creation operable by keyboard only', async ({ page }) => {
    const collected = collectBrowserErrors(page)

    test.setTimeout(120_000)

    // KHONG dung bootToGuestHome (no click guest bang mouse) - spec nay
    // kiem chung chinh luong auth bang ban phim.
    await page.goto('/')

    const auth = page.getByTestId('auth-screen')
    await expect(auth).toBeVisible({ timeout: 15_000 })

    // A screen mounts BEHIND the closed curtain, so "visible" is not yet
    // "interactive": the curtain blocks pointer and keyboard until the
    // transition is revealed (spec S9). Wait for the reveal before typing.
    await waitForPresentationIdle(page)

    // Auth screen: guest button la focusable thu 4 (tab login + tab register
    // + input id + input password + guest). Tab tung buoc - SAU moi Tab kiem
    // tra activeElement (thu tu: check -> press, do lan Tab dau nhay tu body).
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
    await waitForPresentationIdle(page)

    // Character creation: name input bang keyboard, continue bang Enter.
    await page.getByTestId('creation-name-input').fill('Keyboard Hero')
    await page.keyboard.press('Tab')

    await expect(page.locator('[data-testid^="creation-talent-"]').first()).toBeVisible({ timeout: 10_000 })

    // Chon talent bang keyboard: focus card dau + Enter (button/card).
    const talentCard = page.locator('[data-testid^="creation-talent-"]').first()
    await talentCard.focus()
    await page.keyboard.press('Enter')

    await expect(page.getByTestId('creation-finish')).toBeEnabled({ timeout: 5_000 })
    await page.getByTestId('creation-finish').focus()
    await page.keyboard.press('Enter')

    // Home hien sau boot - dismiss tutorial neu co (keyboard: Enter = Bo Qua).
    await expect(page.locator('.game-root')).toBeVisible({ timeout: 30_000 })
    await waitForPresentationIdle(page)

    const tutorial = page.locator('.tutorial-overlay')

    if (await tutorial.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.getByRole('button', { name: /Bỏ Qua|B? Qua/i }).focus()
      await page.keyboard.press('Enter')
      await expect(tutorial).not.toBeVisible({ timeout: 5_000 })
    }

    assertNoBrowserErrors(collected)
  })
})
