import { expect, test } from './fixtures'
import {
  assertNoBrowserErrors,
  bootToGuestHome,
  collectBrowserErrors,
  enterHome,
  waitForPresentationIdle,
} from './helpers'

// huyen-kim reference fidelity - structural geometry assertions at the
// canonical 1280x720 runtime space (design space 1672x941 x 0.7655).
// Composition claims live in data-hk-scene / data-hk-region anchors so
// selectors assert regions, not pixel snapshots of AI references.
test.describe('huyen-kim reference fidelity', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('S01 login: auth scroll is right-anchored, vista holds the left', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const scene = page.locator('[data-hk-scene="login"]')
    await expect(scene).toBeVisible({ timeout: 15_000 })
    const card = scene.locator('[data-hk-region="auth-card"]')
    await expect(card).toBeVisible()

    const rootBox = (await scene.boundingBox())!
    const cardBox = (await card.boundingBox())!
    // Plan example: card starts at least 56% across the root and stays
    // fully inside it (design x=1016/1672 = 60.8%; 56% leaves slack for
    // the 1280 runtime's tighter margin).
    expect(cardBox.x).toBeGreaterThanOrEqual(rootBox.x + rootBox.width * 0.56)
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(rootBox.x + rootBox.width + 1)

    const guest = card.locator('[data-hk-region="guest-action"]')
    const primary = card.locator('[data-hk-region="primary-action"]')
    await expect(guest).toBeVisible()
    await expect(primary).toBeVisible()
    const guestBox = (await guest.boundingBox())!
    const primaryBox = (await primary.boundingBox())!
    for (const box of [guestBox, primaryBox]) {
      expect(box.x).toBeGreaterThanOrEqual(cardBox.x)
      expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1)
      expect(box.y + box.height).toBeLessThanOrEqual(rootBox.y + rootBox.height + 1)
    }

    // Real chrome path: the card must paint the delivered scroll art
    // (border-image on the InkNineSlice), not the retired CSS chrome.
    const slice = card.locator('.ink-nine-slice').first()
    const painted = await slice.evaluate((el) => {
      const s = getComputedStyle(el)
      return { border: s.borderImageSource, mask: s.webkitMaskBoxImageSource }
    })
    expect(`${painted.border}${painted.mask}`).toContain('surface-xl-scroll')

    await waitForPresentationIdle(page)
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
    // Right-anchored panel: starts right of the midpoint, stays in root.
    expect(cardBox.x).toBeGreaterThanOrEqual(rootBox.x + rootBox.width * 0.52)
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
    await expect(page.locator('.home-scene')).toBeVisible({ timeout: 15_000 })
  })

  test('S03 dong-fu: hud regions, vertical plaques, two-orbit wheel', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await bootToGuestHome(page)
    await page.getByTestId('creation-name-input').fill('Fidelity Dong Fu')
    await page.locator('[data-hk-region="talent-grid"] button').first().click()
    await page.getByTestId('creation-finish').click()
    await enterHome(page)
    await waitForPresentationIdle(page)

    const scene = page.locator('[data-hk-scene="dong-fu"]')
    await expect(scene).toBeVisible({ timeout: 15_000 })

    // Top bar: inside the viewport, icon-only utility seals (no text
    // overflow past the right edge), exactly three spirit-stone pills.
    const topBar = page.locator('[data-hk-region="top-bar"]')
    await expect(topBar).toBeVisible()
    const topBox = (await topBar.boundingBox())!
    expect(topBox.x + topBox.width).toBeLessThanOrEqual(1280 + 1)
    await expect(topBar.locator('.currency-hud__chip')).toHaveCount(3)
    const seals = topBar.locator('.global-top-bar__seal')
    expect(await seals.count()).toBeGreaterThanOrEqual(3)

    // Building nameplates are vertical hanging tags (taller than wide).
    const nameplates = page.locator('.building-nameplate__tag')
    expect(await nameplates.count()).toBeGreaterThanOrEqual(2)
    for (const tag of await nameplates.all()) {
      const box = (await tag.boundingBox())!
      expect(box.height).toBeGreaterThan(box.width)
    }

    // Wheel open: hub at ~(640, 475); inner orbit r ~=142px, outer
    // ~=202px at the 1280x720 runtime scale (design 185/264 x 0.7655).
    await page.locator('.home-player').click()
    const wheel = page.locator('.df-wheel.is-ready')
    await expect(wheel).toBeVisible({ timeout: 10_000 })

    const inner = wheel.locator('[data-hk-region="wheel-inner-orbit"]')
    const outer = wheel.locator('[data-hk-region="wheel-outer-orbit"]')
    const innerBox = (await inner.boundingBox())!
    const outerBox = (await outer.boundingBox())!
    expect(innerBox.width / 2).toBeGreaterThanOrEqual(120)
    expect(innerBox.width / 2).toBeLessThanOrEqual(160)
    expect(outerBox.width / 2).toBeGreaterThanOrEqual(175)
    expect(outerBox.width / 2).toBeLessThanOrEqual(215)
    expect(Math.abs(innerBox.x + innerBox.width / 2 - 640)).toBeLessThanOrEqual(12)
    expect(Math.abs(innerBox.y + innerBox.height / 2 - 475)).toBeLessThanOrEqual(12)

    // Slot labels hang below the node discs (never wrap inside).
    const labels = wheel.locator('.df-node__label')
    expect(await labels.count()).toBeGreaterThanOrEqual(8)
    for (const label of await labels.all()) {
      const box = (await label.boundingBox())!
      expect(box.y + box.height).toBeLessThanOrEqual(720 + 1)
    }

    // Thien Co collapsed chip + expandable drawer.
    const chip = page.locator('.thien-co-rail__chip')
    await expect(chip).toBeVisible()
    await chip.click()
    const drawer = page.locator('[data-hk-region="thien-co-open"]')
    await expect(drawer).toBeVisible()
    const drawerBox = (await drawer.boundingBox())!
    expect(drawerBox.x + drawerBox.width).toBeLessThanOrEqual(1280 + 1)
    await chip.click()
    await expect(drawer).toBeHidden()

    assertNoBrowserErrors(errors)
  })
})
