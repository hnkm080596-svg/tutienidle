import { expect, test, type Page } from './fixtures'

import {
  assertNoBrowserErrors,
  bootToGuestHome,
  collectBrowserErrors,
  enterHome,
} from './helpers'

/**
 * P4 adversarial QA - imperial-scroll lifecycle attacks.
 *
 * The imperial shell is a stateful Vue transition surface: unfold plays
 * over ~0.5s while Pinia flags already show 'open'. These tests attack
 * the boundary: interruption (Esc/scrim) mid-unfold, rapid sequential
 * nav swaps, and the character-detail dock crossing the
 * character/inventory tab boundary. Oracles are user-observable DOM
 * states, not transition internals.
 */

async function createBetaCharacter(page: Page, name: string): Promise<void> {
  const creation = page.getByTestId('character-creation-screen')
  await expect(creation).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('creation-name-input').fill(name)
  const talents = creation.locator('[data-testid^="creation-talent-"]')
  await expect(talents.first()).toBeVisible({ timeout: 10_000 })
  await talents.first().click()
  await expect(page.getByTestId('creation-finish')).toBeEnabled({ timeout: 5_000 })
  await page.getByTestId('creation-finish').click()
}

async function bootFreshMortal(page: Page): Promise<void> {
  await bootToGuestHome(page)
  await createBetaCharacter(page, 'QA Scroll')
  await enterHome(page)
}

const UI_STORE_URL = '/src/stores/ui.ts'

async function openLeftMode(page: Page, mode: string): Promise<void> {
  await page.evaluate(async ([m, url]) => {
    const { useUiStore } = await import(/* @vite-ignore */ url)
    useUiStore().openLeftPanel(m as never)
  }, [mode, UI_STORE_URL])
}

test.describe('imperial scroll lifecycle - adversarial', () => {
  test('Esc fired DURING the unfold still leaves zero scroll mounted', async ({ page }) => {
    const collected = collectBrowserErrors(page)
    await bootFreshMortal(page)

    await openLeftMode(page, 'character')
    // Do NOT wait for the unfold to settle - press Esc while the clip
    // is still opening.
    await expect(page.locator('.hk-scroll')).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Escape')

    await expect(page.locator('.hk-scroll')).toHaveCount(0, { timeout: 5_000 })
    // Home chrome is restored - the wheel layer is back in the DOM.
    await expect(page.locator('.command-wheel-layer')).toHaveCount(1)

    assertNoBrowserErrors(collected)
  })

  test('scrim click DURING the unfold still closes the scroll', async ({ page }) => {
    const collected = collectBrowserErrors(page)
    await bootFreshMortal(page)

    await openLeftMode(page, 'character')
    const scroll = page.locator('.hk-scroll')
    await expect(scroll).toBeVisible({ timeout: 10_000 })

    // Click the scrim area (the scroll root itself, not the envelope)
    // while the unfold may still be playing.
    await scroll.click({ position: { x: 12, y: 12 }, timeout: 5_000 })

    await expect(page.locator('.hk-scroll')).toHaveCount(0, { timeout: 5_000 })
    assertNoBrowserErrors(collected)
  })

  test('rapid sequential nav swaps leave exactly one scroll on the last target', async ({ page }) => {
    const collected = collectBrowserErrors(page)
    await bootFreshMortal(page)

    await openLeftMode(page, 'character')
    const rail = page.locator('.hk-nav-seal[data-scene="realm"]')
    await expect(rail).toBeVisible({ timeout: 10_000 })

    // Fire three nav activations back-to-back without presentation-idle
    // waits - the last click wins and no second scroll mounts.
    await page.locator('.hk-nav-seal[data-scene="realm"]').click()
    await page.locator('.hk-nav-seal[data-scene="quest"]').click()
    await page.locator('.hk-nav-seal[data-scene="technique"]').click()

    // Last click wins. Crossfade briefly mounts leaving+entering
    // scrolls together (the leaver's rail still answers until it
    // detaches), so poll until exactly one active seal survives - it
    // must be the last-clicked scene. (A fresh mortal renders the empty
    // technique surface, so the seal is the content-independent oracle.)
    await expect
      .poll(
        async () => {
          const scenes = await page
            .locator('.hk-nav-seal.is-active')
            .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-scene')))
          return scenes.join(',')
        },
        { timeout: 15_000 },
      )
      .toBe('technique')
    await expect(page.locator('.hk-scroll')).toHaveCount(1, { timeout: 15_000 })

    assertNoBrowserErrors(collected)
  })

  test('character detail dock cannot leak across the inventory tab swap', async ({ page }) => {
    const collected = collectBrowserErrors(page)
    await bootFreshMortal(page)

    await openLeftMode(page, 'character')
    const detailBtn = page.locator('.character-panel__details-btn')
    await expect(detailBtn).toBeVisible({ timeout: 10_000 })
    await detailBtn.click()
    await expect(page.getByTestId('character-detail-card')).toBeVisible()

    // Swap to inventory inside the same scroll - the dock is a
    // character-scene overlay and must not render over the bag.
    await page.locator('.hk-nav-seal[data-scene="inventory"]').click()
    await expect(page.locator('.inventory-panel')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('character-detail-card')).toHaveCount(0)

    // Back to character: the card stays closed (closeHomeOverlays reset
    // it during the swap - it must not resurrect stale UI state).
    await page.locator('.hk-nav-seal[data-scene="character"]').click()
    await expect(page.locator('.character-panel')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('character-detail-card')).toHaveCount(0)

    assertNoBrowserErrors(collected)
  })

  test('scope-hidden scenes never render a rail seal', async ({ page }) => {
    const collected = collectBrowserErrors(page)
    await bootFreshMortal(page)

    await openLeftMode(page, 'character')
    const railList = page.locator('.hk-nav__list')
    await expect(railList).toBeVisible({ timeout: 10_000 })

    // The rail admits exactly the beta-live scenes; scope-hidden ids
    // (artifact/companion/tran_phap etc.) have no seal at all - absence,
    // not a disabled affordance.
    const seals = page.locator('.hk-nav-seal')
    const sceneIds = await seals.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute('data-scene')),
    )
    expect(sceneIds.sort()).toEqual(
      ['alchemy', 'body', 'character', 'equipment', 'exploration', 'inventory', 'quest', 'realm', 'settings', 'skill', 'technique'].sort(),
    )

    assertNoBrowserErrors(collected)
  })
})
