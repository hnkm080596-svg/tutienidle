import { expect, test } from './fixtures'
import {
  assertNoBrowserErrors,
  bootToGuestHome,
  collectBrowserErrors,
  enterHome,
  waitForPresentationIdle,
} from './helpers'

// huyen-kim reference fidelity - structural geometry assertions at the
// canonical 1280x720 runtime space (design space 1440x810 scaled).
// Composition claims live in data-hk-scene / data-hk-region anchors and the
// G3 landscape chrome classes so selectors assert regions, not pixels.
test.describe('huyen-kim reference fidelity', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('S01 login: vista + logo opening, right-anchored credential drawer', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const scene = page.locator('[data-hk-scene="login"]')
    await expect(scene).toBeVisible({ timeout: 15_000 })
    await waitForPresentationIdle(page)

    const rootBox = (await scene.boundingBox())!
    const logo = scene.locator('[data-hk-region="logo-block"]')
    await expect(logo).toBeVisible()
    const logoBox = (await logo.boundingBox())!
    expect(logoBox.x).toBeGreaterThanOrEqual(rootBox.x)
    expect(logoBox.x + logoBox.width).toBeLessThanOrEqual(rootBox.x + rootBox.width + 1)

    // Opening menu buttons all live inside the root.
    for (const testid of [
      'opening-login-button',
      'opening-register-button',
      'auth-guest-button',
      'opening-settings-button',
      'opening-exit-button',
    ]) {
      const button = scene.getByTestId(testid)
      await expect(button).toBeVisible()
      const box = (await button.boundingBox())!
      expect(box.x + box.width).toBeLessThanOrEqual(rootBox.x + rootBox.width + 1)
      expect(box.y + box.height).toBeLessThanOrEqual(rootBox.y + rootBox.height + 1)
    }

    // Login drawer slides in right-anchored and holds the credential form.
    await scene.getByTestId('opening-login-button').click()
    const drawer = page.getByTestId('entry-drawer')
    await expect(drawer).toBeVisible()
    const drawerBox = (await drawer.boundingBox())!
    // Right-anchored panel: starts right of ~45% of the root, right edge
    // kisses the viewport edge (design right:18px x scale).
    expect(drawerBox.x).toBeGreaterThanOrEqual(rootBox.x + rootBox.width * 0.4)
    expect(drawerBox.x + drawerBox.width).toBeLessThanOrEqual(rootBox.x + rootBox.width + 1)

    const form = drawer.locator('[data-hk-region="form"]')
    await expect(form).toBeVisible()
    await expect(drawer.locator('#auth-input-id')).toBeVisible()
    await expect(drawer.locator('#auth-input-password')).toBeVisible()
    await expect(drawer.locator('[data-hk-region="primary-action"]')).toBeVisible()

    await page.getByTestId('entry-drawer-close').click()
    await expect(drawer).toHaveCount(0)

    assertNoBrowserErrors(errors)
  })

  test('S02 creation: right scroll card + compact 3x3 talent grid', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const scene = page.locator('[data-hk-scene="login"]')
    await expect(scene).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('auth-guest-button').click()

    const creation = page.locator('[data-hk-scene="creation"]')
    await expect(creation).toBeVisible({ timeout: 15_000 })
    await waitForPresentationIdle(page)
    const card = creation.locator('[data-hk-region="creation-card"]')
    const grid = creation.locator('[data-hk-region="talent-grid"]')
    await expect(grid.locator('button')).toHaveCount(9, { timeout: 15_000 })

    const rootBox = (await creation.boundingBox())!
    const cardBox = (await card.boundingBox())!
    // Right-anchored panel: starts right of ~40% (measured 48.6% at the
    // 1280 runtime for the approved trial board), stays in root.
    expect(cardBox.x).toBeGreaterThanOrEqual(rootBox.x + rootBox.width * 0.4)
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(rootBox.x + rootBox.width + 1)

    // 3x3 grid: nine cards on exactly three columns, two rows of three
    // aligned tops visible inside the card without the CTA falling off.
    const gridBox = (await grid.boundingBox())!
    const cardW = gridBox.width
    const tops = await grid.locator('button').evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)),
    )
    const widths = await grid.locator('button').evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().width)),
    )
    const rows = new Set(tops)
    expect(rows.size).toBe(3)
    for (const w of widths) {
      expect(w).toBeGreaterThanOrEqual(cardW / 3 - 12)
      expect(w).toBeLessThanOrEqual(cardW / 3)
    }

    const primary = creation.locator('[data-hk-region="primary-action"]')
    await expect(primary).toBeVisible()
    const primaryBox = (await primary.boundingBox())!
    expect(primaryBox.y + primaryBox.height).toBeLessThanOrEqual(rootBox.y + rootBox.height + 1)

    await waitForPresentationIdle(page)
    assertNoBrowserErrors(errors)
  })

  test('S03 home reachable after creation (smoke for scene handoff)', async ({ page }) => {
    await bootToGuestHome(page)
    await page.getByTestId('creation-name-input').fill('Fidelity Pilot')
    await page.locator('[data-hk-region="talent-grid"] button').first().click()
    await page.getByTestId('creation-finish').click()
    await enterHome(page)
    await expect(page.locator('[data-hk-scene="dong-fu"]')).toBeVisible({ timeout: 15_000 })
  })

  test('S03 dong-fu: landscape chrome - profile, rail, wheel, board', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await bootToGuestHome(page)
    await page.getByTestId('creation-name-input').fill('Fidelity Dong Fu')
    await page.locator('[data-hk-region="talent-grid"] button').first().click()
    await page.getByTestId('creation-finish').click()
    await enterHome(page)
    await waitForPresentationIdle(page)

    const scene = page.locator('[data-hk-scene="dong-fu"]')
    await expect(scene).toBeVisible({ timeout: 15_000 })

    // Landscape chrome: profile block top-left, currency chips, left rail.
    const profile = scene.locator('.home-design-profile')
    await expect(profile).toBeVisible()
    const profileBox = (await profile.boundingBox())!
    expect(profileBox.x).toBeGreaterThanOrEqual(0)
    expect(profileBox.y).toBeLessThanOrEqual(120)

    const chips = scene.locator('.home-design-currencies > *')
    expect(await chips.count()).toBeGreaterThanOrEqual(1)
    const chipBox = (await chips.last().boundingBox())!
    expect(chipBox.x + chipBox.width).toBeLessThanOrEqual(1280 + 1)

    const railButtons = scene.locator('.home-navigation-surface nav button')
    expect(await railButtons.count()).toBeGreaterThanOrEqual(15)

    // Wheel opens on Backquote: orbit nodes with hanging labels inside
    // the viewport.
    await page.keyboard.press('`')
    const wheel = scene.locator('.df-wheel')
    await expect(wheel).toBeVisible({ timeout: 10_000 })

    const nodes = wheel.locator('.df-node')
    expect(await nodes.count()).toBeGreaterThanOrEqual(8)
    const labels = wheel.locator('.df-node__label')
    expect(await labels.count()).toBeGreaterThanOrEqual(8)
    for (const label of await labels.all()) {
      const box = (await label.boundingBox())!
      expect(box.y + box.height).toBeLessThanOrEqual(720 + 1)
    }

    // Close the wheel before touching the board.
    await page.keyboard.press('Escape')
    await expect(wheel).toBeHidden({ timeout: 10_000 })

    // Thien Co board chip collapses + expands (mounts open by default).
    const board = scene.locator('.df-board')
    await expect(board).toBeAttached()
    const heading = board.locator('.df-board__heading')
    await expect(board.locator('.df-board__entries')).toBeVisible()
    await heading.click()
    await expect(board.locator('.df-board__entries')).toBeHidden()
    await heading.click()
    await expect(board.locator('.df-board__entries')).toBeVisible()

    assertNoBrowserErrors(errors)
  })
})
