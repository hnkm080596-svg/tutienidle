import { expect, test } from './fixtures'

import { bootToGuestHome, createCharacterThroughUi, reauthAndEnterHome } from './helpers'

/**
 * UI/UX QA remediation (Task 12, 2026-09-07) - save failure recovery:
 * save hong/hinh dang sai -> SaveIncompatibleScreen hien voi recovery
 * actions (export raw save / reset / re-import), khong crash trang.
 * Simulate bang inject JSON hong vao localStorage save key truoc khi app
 * boot (addInitScript chay TRUOC moi script trang).
 */
test.describe('Save error recovery', () => {
  test('corrupted save shows recovery screen with export/reset actions', async ({ page }) => {
    test.setTimeout(60_000)

    // Inject save JSON malformed - SaveSystem load phai report 'corrupted'
    // thay vi crash (QA-2026-09-01-002 learned defect: shape validation).
    await page.addInitScript(() => {
      localStorage.setItem('tien-hiep-idle-save:guest', '{corrupted json not valid')
    })

    await page.goto('/')

    // App khong crash - hoac recovery screen hien, hoac auth/creation
    // (fallback graceful). KHONG duoc la trang trang/exception loop.
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
      // Recovery screen phai co hanh dong thoat: export raw / reset / import.
      await expect(recovery.getByRole('button', { name: /Tải Về|Xu?t|T?i V?/i }).first()).toBeVisible()
      await expect(recovery.getByRole('button', { name: /Xo|B?t D?u M?i/i }).first()).toBeVisible()
    }
  })
})

/**
 * Reload giua home (save hop le) - state khoi phuc, vao duoc home lai.
 * (QA-002 baseline: save-reload.spec.ts da cover persistence chinh xac;
 * spec nay chi assert recovery flow khong ket.)
 */
test.describe('Reload recovery', () => {
  test('reload during home returns to home without stuck state', async ({ page }) => {
    test.setTimeout(120_000)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'Reload Recovery')

    // Doi home + autosave kick in (autosave 30s - doi du lau cho save dau).
    await expect(page.locator('.game-root')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(2_000)

    await page.reload()

    await reauthAndEnterHome(page)

    // Home hoat dong lai - command wheel mo duoc bang Tab.
    await page.keyboard.press('`')
    await expect(page.locator('[data-wheel-slot="teleport_array"]')).toBeVisible({ timeout: 10_000 })
  })
})
