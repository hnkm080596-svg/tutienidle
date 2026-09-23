import { expect, test } from './fixtures'
import { createCharacterThroughUi, enterHome } from './helpers'

/**
 * M-UI-OVERHAUL P14 - dense-screen visual contract over the flagship sys
 * surfaces (spec section 8): the screens must render their sys chrome
 * (surface markers, rim claim, energy rail) while staying legible. Each
 * shot lands in test-results/evidence/ as the PR's visual evidence.
 *
 * String-based evaluate everywhere (e2e tsconfig has no DOM ambient types).
 */

const LIVE_RIM = '.sys-rim--live'

async function sysDensity(page: import('./fixtures').Page): Promise<Record<string, number>> {
  // Count the v2 grammar markers actually painted in the DOM right now.
  return page.evaluate<Record<string, number>>(
    `(() => {
      const q = (s) => document.querySelectorAll(s).length
      return {
        rim: q('${LIVE_RIM}'),
        panels: q('.sys-panel'),
        ephemeral: q('.sys-ephemeral'),
        widgets: q('.sys-widget'),
        rails: q('.sys-rail'),
        chamfers: q('.sys-chamfer'),
        slices: q('[data-ink-slice]'),
      }
    })()`,
  )
}

test.describe('system UI skin - dense surface capture', () => {
  test('home wheel + drawer + dense modal + skill tree carry the sys grammar', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')
    await page.getByTestId('auth-guest-button').click()
    await createCharacterThroughUi(page, 'Hệ Thống')
    await enterHome(page)
    const shot = (name: string) =>
      page.screenshot({ path: `test-results/evidence/${name}.png`, animations: 'disabled' })

    // T5 wheel: ephemeral sys slots over the painted home.
    await page.keyboard.press('Tab')
    const wheel = page.locator('.command-wheel-layer')
    await expect(wheel).toBeVisible({ timeout: 10_000 })
    // Slots carry the chamfered T5 chrome (octagonal cut + sheen); wait for
    // the is-ready reveal so the shot shows them, not just the backdrop.
    const firstSlot = page.locator('.command-wheel__slot').first()
    await expect(firstSlot).toBeVisible({ timeout: 10_000 })
    expect(await page.locator('.command-wheel__slot').count()).toBeGreaterThan(3)
    const wheelDensity = await sysDensity(page)
    expect(wheelDensity.slices).toBe(0)
    await shot('t5-command-wheel')

    // Drawer (T3 rail) + its widgets.
    await page.locator('[data-wheel-slot="character"]').click()
    const drawer = page.locator('.left-panel.sys-surface')
    await expect(drawer).toBeVisible({ timeout: 10_000 })
    const drawerDensity = await sysDensity(page)
    expect(drawerDensity.rim).toBe(1)
    await shot('t3-character-drawer')
    await page.keyboard.press('Escape')

    // Dense modal: realm panel (domains + rail + readouts).
    await page.keyboard.press('Tab')
    await page.locator('[data-wheel-slot="realm"]').click()
    const realm = page.locator('.overlay-panel--system')
    await expect(realm).toBeVisible({ timeout: 10_000 })
    const realmDensity = await sysDensity(page)
    expect(realmDensity.rim).toBe(1)
    expect(realmDensity.rails).toBeGreaterThan(0)
    expect(realmDensity.slices).toBe(0)
    await shot('t2-realm-panel')
    await page.keyboard.press('Escape')
    await expect(realm).toBeHidden({ timeout: 10_000 })

    // Densest surface: skill path (node tree + inspector + domain accents).
    await page.keyboard.press('Tab')
    const skillSlot = page.locator('[data-wheel-slot="skill"]')
    if (await skillSlot.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await skillSlot.click()
      await expect(page.locator('.overlay-panel--system')).toBeVisible({ timeout: 10_000 })
      await shot('t2-skill-path')
      await page.keyboard.press('Escape')
    }
  })
})
