import { expect, test, type Page } from './fixtures'

import {
  assertNoBrowserErrors,
  bootToGuestHome,
  collectBrowserErrors,
  enterHome,
  waitForPresentationIdle,
} from './helpers'

/**
 * P13/P14 runtime gate for the Huyen Kim imperial-scroll rebuild.
 *
 * Proves, in a real browser, that the major functional scenes no longer
 * ride the legacy ~900px OverlayPanel: they mount inside the imperial
 * scroll shell (92.1vw x 89.3vh envelope, rollers + plaque + close), the
 * unfold transition resolves, Esc closes, and every evidence screenshot
 * lands in test-results/huyen-kim/.
 */

const SHOT_DIR = 'test-results/huyen-kim'

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` })
}

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
  await createBetaCharacter(page, 'E2E Imperial')
  await enterHome(page)
}

const UI_STORE_URL = '/src/stores/ui.ts'

async function openStandalone(page: Page, panel: string): Promise<void> {
  await page.evaluate(async ([p, url]) => {
    const { useUiStore } = await import(/* @vite-ignore */ url)
    useUiStore().openStandalonePanel(p as never)
  }, [panel, UI_STORE_URL])
}

async function openLeftMode(page: Page, mode: string): Promise<void> {
  await page.evaluate(async ([m, url]) => {
    const { useUiStore } = await import(/* @vite-ignore */ url)
    useUiStore().openLeftPanel(m as never)
  }, [mode, UI_STORE_URL])
}

/** The scroll is the ONLY mounted shell - the legacy 900px OverlayPanel
 *  must not be standing in for a redesigned scene. */
async function expectImperialScroll(page: Page): Promise<void> {
  const scroll = page.locator('.hk-scroll')
  await expect(scroll).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.overlay-panel')).toHaveCount(0)

  const envelope = scroll.locator('.hk-scroll__envelope')
  const box = await envelope.boundingBox()
  expect(box).not.toBeNull()
  const viewport = page.viewportSize()!
  // Envelope ≈ 92.1vw x 89.3vh - far beyond the old 900px card.
  expect(box!.width).toBeGreaterThan(viewport.width * 0.85)
  expect(box!.height).toBeGreaterThan(viewport.height * 0.8)

  // Furniture: rollers + title plaque + close affordance + nav rail.
  await expect(envelope.locator('.hk-scroll__roller')).toHaveCount(2)
  await expect(envelope.locator('.hk-scroll__close')).toBeVisible()
  await expect(envelope.locator('.hk-scroll__rail')).toBeVisible()
}

/** Wait for the unfold signature (clip reveal + chrome fade) to land.
 *  The transition is ~0.6s; poll the clip until it is fully revealed so
 *  evidence captures never catch a mid-open frame. */
async function waitForScrollSettled(page: Page): Promise<void> {
  const clip = page.locator('.hk-scroll__clip').last()
  // The settled inset serializes to the collapsed shorthand 'inset(0px)';
  // mid-unfold it carries a 50% lateral clamp, so equality is the gate.
  await expect
    .poll(
      async () => clip.evaluate((el) => getComputedStyle(el).clipPath),
      { timeout: 10_000 },
    )
    .toBe('inset(0px)')
  // Chrome fades in last (delay 0.3s + 0.28s duration).
  await expect
    .poll(
      async () => page.locator('.hk-scroll__chrome').last().evaluate((el) => getComputedStyle(el).opacity),
      { timeout: 10_000 },
    )
    .toBe('1')
}

test.describe('Huyen Kim imperial scroll scenes', () => {
  test('scroll shell: unfold -> furniture -> Esc/scrim close', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)

    await openStandalone(page, 'realm')
    const scroll = page.locator('.hk-scroll')
    await expect(scroll).toBeVisible({ timeout: 15_000 })
    await expectImperialScroll(page)
    await waitForScrollSettled(page)

    // Esc closes through the same dialog contract as the old overlay.
    await page.keyboard.press('Escape')
    await expect(scroll).toHaveCount(0, { timeout: 10_000 })

    // Scrim click (envelope padding around the scroll) also closes.
    await openStandalone(page, 'realm')
    await expect(scroll).toBeVisible({ timeout: 15_000 })
    await waitForScrollSettled(page)
    await page.mouse.click(page.viewportSize()!.width / 2, 4)
    await expect(scroll).toHaveCount(0, { timeout: 10_000 })
    assertNoBrowserErrors(errors)
  })

  test('scene 03 dong phu stays world-dominant under the new chrome', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)
    await waitForPresentationIdle(page)
    // World chrome: top bar + building hotspots + command wheel toggle.
    await expect(page.locator('.global-top-bar')).toBeVisible({ timeout: 10_000 })
    await shot(page, '03-dong-phu')
    assertNoBrowserErrors(errors)
  })

  test('scene 04 character: imperial scroll + hero/stats/element columns', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)
    await openLeftMode(page, 'character')
    const scroll = page.locator('[data-testid="home-scroll-scene"]')
    await expect(scroll).toBeVisible({ timeout: 15_000 })
    await expectImperialScroll(page)
    await expect(scroll.locator('.character-panel__figure')).toBeVisible({ timeout: 10_000 })
    await expect(scroll.locator('.character-panel__stats')).toBeVisible()
    await waitForScrollSettled(page)
    await shot(page, '04-character')
    assertNoBrowserErrors(errors)
  })

  test('scene 09 inventory: imperial scroll + tabs + bag grid', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)
    await openLeftMode(page, 'inventory')
    const scroll = page.locator('[data-testid="home-scroll-scene"]')
    await expect(scroll).toBeVisible({ timeout: 15_000 })
    await expectImperialScroll(page)
    await expect(scroll.locator('.bag-grid, .inventory-panel').first()).toBeVisible({
      timeout: 10_000,
    })
    await waitForScrollSettled(page)
    await shot(page, '09-inventory')
    assertNoBrowserErrors(errors)
  })

  test('scene 11 alchemy: imperial scroll + cauldron centerpiece', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)
    await openLeftMode(page, 'pill_room')
    const scroll = page.getByTestId('function-overlay-panel')
    await expect(scroll).toBeVisible({ timeout: 15_000 })
    await expectImperialScroll(page)
    const cauldron = scroll.locator('img[src*="alchemy-cauldron-prop"]')
    await expect(cauldron).toBeVisible({ timeout: 10_000 })
    await waitForScrollSettled(page)
    await shot(page, '11-alchemy')
    assertNoBrowserErrors(errors)
  })

  test('scene 17 settings: imperial scroll + seal nav + workspace', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)
    await openLeftMode(page, 'settings')
    const scroll = page.getByTestId('function-overlay-panel')
    await expect(scroll).toBeVisible({ timeout: 15_000 })
    await expectImperialScroll(page)
    const nav = scroll.locator('.settings-panel__nav')
    await expect(nav).toBeVisible({ timeout: 10_000 })
    expect(await nav.locator('.settings-panel__nav-seal').count()).toBeGreaterThan(3)
    await waitForScrollSettled(page)
    await shot(page, '17-settings')
    assertNoBrowserErrors(errors)
  })

  test('scene 18 quest: imperial scroll + list rail + detail', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)
    await openStandalone(page, 'quest')
    await expectImperialScroll(page)
    const scroll = page.locator('.hk-scroll')
    await expect(scroll.locator('.quest-scene__rail')).toBeVisible({ timeout: 10_000 })
    await waitForScrollSettled(page)
    await shot(page, '18-quest')
    assertNoBrowserErrors(errors)
  })

  test('scenes 13+15 combat: HUD chrome + victory ceremony', async ({ page }) => {
    test.setTimeout(240_000)
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)

    // Enter a stage-1 battle through the real flow.
    await page.keyboard.press('Tab')
    const teleport = page.locator('[data-wheel-slot="teleport_array"]')
    await expect(teleport).toBeVisible({ timeout: 10_000 })
    await teleport.click()
    const scroll = page.getByTestId('function-overlay-panel')
    await expect(scroll).toBeVisible({ timeout: 15_000 })
    const start = scroll.locator('.stage-start-button, [data-testid="stage-start-button"]').first()
    await expect(start).toBeEnabled({ timeout: 10_000 })
    await start.click()

    // Combat HUD: top bar + skill dock orb frames.
    await expect(page.locator('.combat-scene-overlay')).toBeVisible({ timeout: 20_000 })
    const orb = page.locator('.turn-combat-skill-bar__orb-frame')
    await expect
      .poll(async () => orb.count(), { timeout: 30_000 })
      .toBeGreaterThan(0)
    await waitForPresentationIdle(page)
    await shot(page, '13-combat')

    // Drive to victory through the domain battle object (waves respawn -
    // keep flattening until the director reports victory).
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const w = window as unknown as {
              __tutienPhaserGame?: { registry: { get(key: string): any } }
            }
            const battle = w.__tutienPhaserGame?.registry.get('gameManager')?.getTurnBattle()
            if (!battle) return 'none'
            for (const e of battle.enemies ?? []) {
              e.alive = false
              if (e.entity) {
                e.entity.alive = false
                e.entity.currentHp = 0
              }
            }
            return battle.state as string
          }),
        { timeout: 180_000, intervals: [250] },
      )
      .toBe('victory')

    const victory = page.locator('.combat-victory-panel')
    await expect(victory).toBeVisible({ timeout: 30_000 })
    await waitForPresentationIdle(page)
    await shot(page, '15-victory')
    assertNoBrowserErrors(errors)
  })

  test('scene 16 defeat: ink/cinnabar ceremony surface', async ({ page }) => {
    test.setTimeout(240_000)
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)

    await page.keyboard.press('Tab')
    const teleport = page.locator('[data-wheel-slot="teleport_array"]')
    await expect(teleport).toBeVisible({ timeout: 10_000 })
    await teleport.click()
    const scroll = page.getByTestId('function-overlay-panel')
    await expect(scroll).toBeVisible({ timeout: 15_000 })
    const start = scroll.locator('.stage-start-button, [data-testid="stage-start-button"]').first()
    await expect(start).toBeEnabled({ timeout: 10_000 })
    await start.click()
    await expect(page.locator('.combat-scene-overlay')).toBeVisible({ timeout: 20_000 })

    // Defeat: leave auto mode on, drop the player to 1hp and let the
    // enemies land the finishing blow through the real turn loop.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const w = window as unknown as {
              __tutienPhaserGame?: { registry: { get(key: string): any } }
            }
            const battle = w.__tutienPhaserGame?.registry.get('gameManager')?.getTurnBattle()
            if (!battle) return 'none'
            if (battle.state !== 'fighting') return battle.state as string
            for (const p of battle.players ?? []) {
              if (p.entity) p.entity.currentHp = 1
            }
            return battle.state as string
          }),
        { timeout: 180_000, intervals: [500] },
      )
      .toBe('defeat')

    const defeat = page.locator('.combat-defeat-panel')
    // The panel auto-returns home - capture immediately on mount.
    await expect(defeat).toBeVisible({ timeout: 30_000 })
    await shot(page, '16-defeat')
    assertNoBrowserErrors(errors)
  })
})
