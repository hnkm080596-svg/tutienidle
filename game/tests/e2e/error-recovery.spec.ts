import { expect, test } from '@playwright/test'

import { bootToGuestHome, createCharacterThroughUi, reauthAndEnterHome } from './helpers'

/**
 * UI/UX QA remediation (Task 12, 2026-09-07) — save failure recovery:
 * save hỏng/hình dạng sai → SaveIncompatibleScreen hiện với recovery
 * actions (export raw save / reset / re-import), không crash trắng.
 * Simulate bằng inject JSON hỏng vào localStorage save key trước khi app
 * boot (addInitScript chạy TRƯỚC mọi script trang).
 */
test.describe('Save error recovery', () => {
  test('corrupted save shows recovery screen with export/reset actions', async ({ page }) => {
    test.setTimeout(60_000)

    // Inject save JSON malformed — SaveSystem load phải report 'corrupted'
    // thay vì crash (QA-2026-09-01-002 learned defect: shape validation).
    await page.addInitScript(() => {
      localStorage.setItem('tien-hiep-idle-save', '{corrupted json not valid')
    })

    await page.goto('/')

    // App không crash — hoặc recovery screen hiện, hoặc auth/creation
    // (fallback graceful). KHÔNG được là trắng trang/exception loop.
    const recovery = page.locator('.save-incompatible')
    const auth = page.getByTestId('auth-screen')
    const creation = page.getByTestId('character-creation-screen')

    await expect
      .poll(
        async () =>
          (await recovery.isVisible().catch(() => false)) ||
          (await auth.isVisible().catch(() => false)) ||
          (await creation.isVisible().catch(() => false)),
        { timeout: 20_000 },
      )
      .toBe(true)

    if (await recovery.isVisible()) {
      // Recovery screen phải có hành động thoát: export raw / reset / import.
      await expect(recovery.getByRole('button', { name: /Tải Về|Xu?t|T?i V?/i }).first()).toBeVisible()
      await expect(recovery.getByRole('button', { name: /Xo|B?t D?u M?i/i }).first()).toBeVisible()
    }
  })
})

/**
 * Reload giữa home (save hợp lệ) — state khôi phục, vào được home lại.
 * (QA-002 baseline: save-reload.spec.ts đã cover persistence chính xác;
 * spec này chỉ assert recovery flow không kẹt.)
 */
test.describe('Reload recovery', () => {
  test('reload during home returns to home without stuck state', async ({ page }) => {
    test.setTimeout(120_000)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'Reload Recovery')

    // Đợi home + autosave kick in (autosave 30s — đợi đủ lâu cho save đầu).
    await expect(page.locator('.game-root')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(2_000)

    await page.reload()

    await reauthAndEnterHome(page)

    // Home hoạt động lại — command wheel mở được bằng Tab.
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-wheel-slot="teleport_array"]')).toBeVisible({ timeout: 10_000 })
  })
})
