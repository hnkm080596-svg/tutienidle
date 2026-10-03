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
 * character/inventory boundary. Oracles are user-observable DOM
 * states, not transition internals. The rail is the shared paper nav
 * (.paper-navigation-item / [data-nav-id]) - the same component the
 * fidelity surfaces and the scroll both render.
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

    await openLeftMode(page, 'inventory')
    // Do NOT wait for the unfold to settle - press Esc while the clip
    // is still opening.
    await expect(page.locator('.hk-scroll')).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Escape')

    await expect(page.locator('.hk-scroll')).toHaveCount(0, { timeout: 5_000 })
    // Home chrome is restored - the fidelity wheel stays mounted (it is
    // v-show'd, never unmounted, on the home surface).
    await expect(page.locator('.df-wheel')).toHaveCount(1)

    assertNoBrowserErrors(collected)
  })

  test('scrim click DURING the unfold still closes the scroll', async ({ page }) => {
    const collected = collectBrowserErrors(page)
    await bootFreshMortal(page)

    await openLeftMode(page, 'inventory')
    const scroll = page.locator('.hk-scroll')
    await expect(scroll).toBeVisible({ timeout: 10_000 })

    // Click the scrim area (the scroll root itself, not the envelope)
    // while the unfold may still be playing.
    await scroll.click({ position: { x: 12, y: 12 }, timeout: 5_000 })

    await expect(page.locator('.hk-scroll')).toHaveCount(0, { timeout: 5_000 })
    assertNoBrowserErrors(collected)
  })

  test('rapid sequential nav swaps leave exactly one open surface on the last target', async ({ page }) => {
    const collected = collectBrowserErrors(page)
    await bootFreshMortal(page)

    await openLeftMode(page, 'inventory')
    const rail = page.locator('.paper-navigation-item[data-nav-id="realm"]')
    await expect(rail).toBeVisible({ timeout: 10_000 })

    // Fire three nav activations back-to-back without presentation-idle
    // waits - the last click wins and no second surface stays mounted.
    await page.locator('.paper-navigation-item[data-nav-id="realm"]').click()
    await page.locator('.paper-navigation-item[data-nav-id="quest"]').click()
    await page.locator('.paper-navigation-item[data-nav-id="technique"]').click()

    // Last click wins. Crossfade briefly mounts leaving+entering
    // surfaces together (the leaver's rail still answers until it
    // detaches), so poll until exactly one active item survives - it
    // must be the last-clicked scene. (A fresh mortal renders the empty
    // technique surface, so the rail item is the content-independent
    // oracle.)
    await expect
      .poll(
        async () => {
          const scenes = await page
            .locator('.paper-navigation-item.active')
            .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-nav-id')))
          return scenes.join(',')
        },
        { timeout: 15_000 },
      )
      .toBe('technique')

    assertNoBrowserErrors(collected)
  })

  test('character detail dock cannot leak across nav swaps', async ({ page }) => {
    const collected = collectBrowserErrors(page)
    await bootFreshMortal(page)

    await openLeftMode(page, 'character')
    const heading = page.locator('.cf-details__heading')
    await expect(heading).toBeVisible({ timeout: 10_000 })
    await heading.click()
    await expect(heading).toHaveAttribute('aria-expanded', 'true')

    // Swap to inventory via the shared rail - the dock is a
    // character-surface overlay and must not render over the bag.
    await page.locator('.paper-navigation-item[data-nav-id="inventory"]').click()
    await expect(page.locator('.inventory-panel')).toBeVisible({ timeout: 10_000 })

    // Back to character: the dock stays closed (closeHomeOverlays reset
    // it during the swap - it must not resurrect stale UI state).
    await page.locator('.paper-navigation-item[data-nav-id="character"]').click()
    await expect(page.locator('.cf-scene')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.cf-details__heading')).toHaveAttribute('aria-expanded', 'false')

    assertNoBrowserErrors(collected)
  })

  test('scope-hidden scenes never render a rail item', async ({ page }) => {
    const collected = collectBrowserErrors(page)
    await bootFreshMortal(page)

    await openLeftMode(page, 'inventory')
    const railList = page.locator('.paper-navigation-items')
    await expect(railList).toBeVisible({ timeout: 10_000 })

    // The rail admits exactly the beta-live scenes; scope-hidden ids
    // (artifact/companion/tran_phap etc.) have no item at all - absence,
    // not a disabled affordance.
    const items = page.locator('.paper-navigation-item')
    const sceneIds = await items.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute('data-nav-id')),
    )
    expect(sceneIds.sort()).toEqual(
      ['alchemy', 'body', 'character', 'equipment', 'exploration', 'inventory', 'quest', 'realm', 'settings', 'skill', 'technique'].sort(),
    )

    assertNoBrowserErrors(collected)
  })
})
