import { expect, test } from './fixtures'
import {
  assertNoBrowserErrors,
  bootToGuestHome,
  collectBrowserErrors,
  createCharacterThroughUi,
  enterHome,
  openSettingsAndSave,
  reauthAndEnterHome,
} from './helpers'

/**
 * M-F-BODY-PERFECTION (spec S6/S10, plan Step 6 P13/P14) - production
 * runtime evidence for the hidden-surface contract: the shipped
 * registry is all-empty, so the perfection col can NEVER render in
 * production. This spec drives the real RealmPanel flow and asserts
 * the surface is structurally ABSENT (no col, no title text, no
 * console errors) on a fresh boot AND after a save+reload - the
 * "hidden until first discovery" boundary at the production seam.
 * Reveal/partial-reveal/perfect flows are covered on injected fixture
 * registries (BodyPerfectionSection.test.ts), not production.
 */
test.describe('Body perfection hidden surface (production)', () => {
  test('realm panel renders NO perfection col before any discovery', async ({ page }) => {
    const collected = collectBrowserErrors(page)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Thể Phách')
    await enterHome(page)

    // Open the realm panel via the command wheel.
    await page.keyboard.press('Tab')
    const realmSlot = page.locator('[data-wheel-slot="realm"]')
    await expect(realmSlot).toBeVisible({ timeout: 10_000 })
    await realmSlot.click()

    const realmDialog = page.getByRole('dialog', { name: 'Cảnh Giới' })
    await expect(realmDialog).toBeVisible({ timeout: 15_000 })

    // Exactly the three standing cols (refinement + meridian + chu-thien
    // after the base merge) - the hidden perfection col must not exist
    // at all, not merely invisible.
    await expect(realmDialog.locator('.realm-panel__body-col')).toHaveCount(3)
    await expect(realmDialog.locator('.body-perfection-section')).toHaveCount(0)
    await expect(realmDialog).not.toContainText('Thể Phách Hoàn Thiện')

    assertNoBrowserErrors(collected)
  })

  test('the hidden state persists across save + reload', async ({ page }) => {
    const collected = collectBrowserErrors(page)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Hoàn Thiện')
    await enterHome(page)
    await openSettingsAndSave(page)

    await page.reload()
    await reauthAndEnterHome(page)

    await page.keyboard.press('Tab')
    const realmSlot = page.locator('[data-wheel-slot="realm"]')
    await expect(realmSlot).toBeVisible({ timeout: 10_000 })
    await realmSlot.click()

    const realmDialog = page.getByRole('dialog', { name: 'Cảnh Giới' })
    await expect(realmDialog).toBeVisible({ timeout: 15_000 })

    await expect(realmDialog.locator('.realm-panel__body-col')).toHaveCount(3)
    await expect(realmDialog.locator('.body-perfection-section')).toHaveCount(0)
    await expect(realmDialog).not.toContainText('Thể Phách Hoàn Thiện')

    assertNoBrowserErrors(collected)
  })
})
