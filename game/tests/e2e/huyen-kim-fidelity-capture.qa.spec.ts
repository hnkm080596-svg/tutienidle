import { expect, test, type Page } from './fixtures'

import {
  bootToGuestHome,
  collectBrowserErrors,
  enterHome,
  waitForPresentationIdle,
} from './helpers'

/**
 * Task-0 before-capture for the Huyen Kim reference-fidelity mission
 * (docs/superpowers/plans/2026-10-02-huyen-kim-reference-fidelity-devin-plan.md).
 *
 * Every reachable scene is captured at the canonical 1280x720 viewport into
 * docs/qa/huyen-kim-reference-fidelity/evidence/before/. These are NOT golden
 * baselines - they are the rejected-PR97-state record each scene's
 * reference/after review is compared against.
 *
 * Reused post-implementation as the after-capture driver: HK_FIDELITY_DIR
 * switches the output root so the same flows produce the after set.
 */

const OUT_ROOT = process.env.HK_FIDELITY_DIR ?? 'docs/design/tien-hiep-ui-redesign-2026-10-05/runtime-evidence'

test.use({ viewport: { width: 1280, height: 720 } })

async function shot(page: Page, name: string): Promise<void> {
  for (const scene of ['alchemy', 'exploration']) {
    const surface = page.locator(`.${scene}-scene .${scene}-paper`)
    if (await surface.isVisible()) {
      expect(await surface.evaluate(element => getComputedStyle(element, '::before').backgroundImage)).not.toBe('none')
      await expect(surface).toHaveCSS('border-image-slice', '240 320')
    }
  }
  await page.screenshot({ path: `${OUT_ROOT}/${name}.png` })
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

async function closeAll(page: Page): Promise<void> {
  await page.evaluate(async (url) => {
    const { useUiStore } = await import(/* @vite-ignore */ url)
    useUiStore().closeHomeOverlays()
  }, UI_STORE_URL)
  await expect(page.locator('.hk-scroll')).toHaveCount(0, { timeout: 10_000 })
}

async function settle(page: Page): Promise<void> {
  await waitForPresentationIdle(page)
  // Let the unfold transition fully land before exposing the scene.
  await page.waitForTimeout(800)
}

async function createBetaCharacter(page: Page, name: string): Promise<void> {
  const creation = page.getByTestId('character-creation-screen')
  await expect(creation).toBeVisible({ timeout: 15_000 })
  await waitForPresentationIdle(page)
  await page.waitForTimeout(1200) // parallax decode + curtain fully open
  await shot(page, '02-character-creation')
  await page.getByTestId('creation-name-input').fill(name)
  const talents = creation.locator('[data-testid^="creation-talent-"]')
  await expect(talents.first()).toBeVisible({ timeout: 10_000 })
  await talents.first().click()
  await expect(page.getByTestId('creation-finish')).toBeEnabled({ timeout: 5_000 })
  await page.getByTestId('creation-finish').click()
}

test.describe('huyen-kim reference fidelity - scene capture', () => {
  test('S01 login: vista + right scroll card', async ({ page }) => {
    await page.goto('/')
    const auth = page.getByTestId('auth-screen')
    await expect(auth).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(1200) // parallax stack paint + image decode
    await shot(page, '01-login')
  })

  test('fresh mortal sweep: creation, dong-fu, panels', async ({ page }) => {
    test.setTimeout(180_000)
    const errors = collectBrowserErrors(page)
    await bootToGuestHome(page)
    await createBetaCharacter(page, 'Fidelity Before')
    await enterHome(page)
    await settle(page)
    await shot(page, '03-dong-fu-closed')

    // Wheel open state - Tab is the shipped shortcut.
    await page.locator('.df-cultivator').click()
    const wheel = page.locator('[data-wheel-slot="settings"]')
    await expect(wheel).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(700)
    await shot(page, '03-dong-fu-open')
    await page.keyboard.press('Escape')

    // Fidelity-migrated surfaces mount their own paper scene root; the
    // unmigrated modes still open inside the imperial scroll.
    const leftModes: Array<[string, string, string]> = [
      ['character', '04-character', '.cf-scene'],
      ['inventory', '09-inventory', '.inventory-scene'],
      ['stage_select', '10-exploration', '.exploration-scene'],
      ['exploration', '11b-production-outpost', '.hk-scroll'],
      ['pill_room', '11-alchemy', '.alchemy-scene'],
      ['equipment_hall', '12-equipment', '.equipment-scene'],
      ['settings', '17-settings', '.settings-scene'],
    ]
    for (const [mode, name, root] of leftModes) {
      await openLeftMode(page, mode)
      await expect(page.locator(root)).toBeVisible({ timeout: 15_000 })
      await settle(page)
      if (root === '.hk-scroll') {
        const plaque = await page.locator('.hk-scroll__plaque').boundingBox()
        const heading = await page.locator('.building-heading').boundingBox()
        const rail = await page.locator('.hk-scroll__rail').boundingBox()
        const envelope = await page.locator('.hk-scroll__envelope').boundingBox()
        expect(heading!.y).toBeGreaterThanOrEqual(plaque!.y + plaque!.height)
        expect(rail!.y + rail!.height).toBeLessThanOrEqual(envelope!.y + envelope!.height)
      }
      await shot(page, name)
      if (root === '.hk-scroll') {
        const lastAction = page.locator('.production-panel button').last()
        await lastAction.scrollIntoViewIfNeeded()
        const action = await lastAction.boundingBox()
        const content = await page.locator('.hk-scroll__main').boundingBox()
        expect(action!.y).toBeGreaterThanOrEqual(content!.y)
        expect(action!.y + action!.height).toBeLessThanOrEqual(content!.y + content!.height + 1)
        await shot(page, '11c-production-actions')
      }
      await closeAll(page)
    }

    const standalones: Array<[string, string, string]> = [
      ['realm', '05-realm', '.realm-paper-scene'],
      ['technique', '06-technique', '.technique-paper-scene'],
      ['skill', '07-skill', '.skill-paper-scene'],
      ['body', '08-body', '.body-paper-scene'],
      ['quest', '18-quest', '.quest-scene'],
    ]
    for (const [panel, name, root] of standalones) {
      if (panel === 'technique') {
        // The current beta gate rejects this route for a fresh mortal.
        // Capture the real locked affordance instead of bypassing eligibility.
        await openLeftMode(page, 'character')
        await expect(page.locator('[data-nav-id="technique"]')).toHaveAttribute('aria-disabled', 'true')
        await shot(page, '06-technique-locked')
        await closeAll(page)
        continue
      }
      await openStandalone(page, panel)
      await expect(page.locator(root)).toBeVisible({ timeout: 15_000 })
      await settle(page)
      await shot(page, name)
      await closeAll(page)
    }
  })

  test('S13/S15/S16 combat-victory-defeat live battle', async ({ page }) => {
    test.setTimeout(300_000)
    const errors = collectBrowserErrors(page)
    await bootToGuestHome(page)
    await createBetaCharacter(page, 'Fidelity Battle')
    await enterHome(page)

    await page.locator('.df-cultivator').click()
    const teleport = page.locator('[data-wheel-slot="teleport_array"]')
    await expect(teleport).toBeVisible({ timeout: 10_000 })
    await teleport.click()
    const scroll = page.locator('.exploration-scene')
    await expect(scroll).toBeVisible({ timeout: 15_000 })
    const start = scroll.locator('.stage-start-button, [data-testid="stage-start-button"]').first()
    await expect(start).toBeEnabled({ timeout: 10_000 })
    await start.click()

    await expect(page.locator('.combat-scene-overlay')).toBeVisible({ timeout: 20_000 })
    // Mid-fight frame: wait until actors + turn strip actually render so the
    // capture carries the full HUD, not the 'Vao Tran' intro card.
    const orb = page.locator('.turn-combat-skill-bar__orb-frame')
    await expect
      .poll(async () => orb.count(), { timeout: 30_000 })
      .toBeGreaterThan(0)
    await waitForPresentationIdle(page)
    await page.waitForTimeout(1200)
    await shot(page, '13-combat')

    // Defeat first on this run would end the battle - push victory via the
    // domain battle object (same poke the imperial-shell spec uses).
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
    await page.waitForTimeout(900)
    await shot(page, '15-victory')

    // Continue home, then re-enter the same stage for the defeat frame.
    await victory.getByRole('button', { name: /Tiếp Tục/ }).click()
    await waitForPresentationIdle(page)
    await page.locator('.df-cultivator').click()
    await expect(teleport).toBeVisible({ timeout: 10_000 })
    await teleport.click()
    await expect(scroll).toBeVisible({ timeout: 15_000 })
    await expect(start).toBeEnabled({ timeout: 10_000 })
    await start.click()
    await expect(page.locator('.combat-scene-overlay')).toBeVisible({ timeout: 20_000 })

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
              if (p.entity) {
                // Capture-only terminal fixture, symmetric with the enemy victory fixture.
                p.entity.currentHp = 0
                p.entity.alive = false
              }
            }
            return battle.state as string
          }),
        { timeout: 180_000, intervals: [500] },
      )
      .toBe('defeat')
    const defeat = page.locator('.combat-defeat-panel')
    await expect(defeat).toBeVisible({ timeout: 30_000 })
    await shot(page, '16-defeat')
  })

  test('S14 tribulation + S16 defeat', async ({ page }) => {
    test.setTimeout(300_000)
    const errors = collectBrowserErrors(page)
    await bootToGuestHome(page)
    await createBetaCharacter(page, 'Fidelity Trib')
    await enterHome(page)

    // Quan Khi needs realm level 12 - seed it into the save like
    // cultivation-path-ritual.spec.ts does, then reload.
    await page.evaluate(async (url) => {
      const { useUiStore } = await import(/* @vite-ignore */ url)
      useUiStore().openLeftPanel('settings')
    }, UI_STORE_URL)
    const saveButton = page.getByTestId('settings-save-button')
    await expect(saveButton).toBeVisible({ timeout: 10_000 })
    await saveButton.click()
    await closeAll(page)
    const save = await page.evaluate(
      () => JSON.parse(localStorage.getItem('tien-hiep-idle-save:guest') ?? 'null') as { player?: Record<string, unknown> } | null,
    )
    expect(save?.player).toBeTruthy()
    await page.addInitScript((payload) => {
      localStorage.setItem('tien-hiep-idle-save:guest', JSON.stringify(payload))
    }, { ...save, player: { ...save!.player, realmLevel: 12, cultivation: 0 } })
    await page.reload()
    await page.getByTestId('auth-screen').waitFor({ state: 'visible', timeout: 15_000 })
    await page.getByTestId('opening-login-button').click()
    await page.getByTestId('auth-guest-button').click()
    await enterHome(page)

    // Real entry: realm panel -> breakthrough ritual -> tribulation route.
    await openStandalone(page, 'realm')
    const realmScene = page.locator('.realm-paper-scene')
    await expect(realmScene).toBeVisible({ timeout: 15_000 })
    const breakthroughButton = realmScene.getByRole('button', { name: 'Quán Khí' })
    await expect(breakthroughButton).toBeEnabled({ timeout: 10_000 })
    await breakthroughButton.click()
    const confirmDialog = page.getByRole('dialog', { name: /Độ kiếp cũng là độ thân/ })
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 })
    await confirmDialog.getByRole('button', { name: 'Đã hiểu' }).click()

    const tribulationUi = page.locator('.tribulation-ui')
    await expect(tribulationUi).toBeVisible({ timeout: 30_000 })
    // The director state goes live a beat before the route adapter flips -
    // wait for the scroll chrome to detach so the capture can't race the
    // leaving scroll's rollers/seals (probe evidence: scrolls are fully
    // unmounted once the tribulation route owns the screen).
    await expect(page.locator('.hk-scroll')).toHaveCount(0, { timeout: 10_000 })
    await waitForPresentationIdle(page)
    await page.waitForTimeout(1200)
    await shot(page, '14-tribulation')

    // Let the tribulation resolve itself - strikes land through the real
    // director's own update loop (same seam tribulation-flow.spec.ts uses).
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const w = window as unknown as {
              __tutienPhaserGame?: { registry: { get(key: string): any } }
            }
            const director = w.__tutienPhaserGame?.registry.get('gameManager')?.tribulationDirector
            if (!director) return 'missing-director'
            director.update(30)
            return director.getState()?.state ?? 'cleared'
          }),
        { timeout: 120_000, intervals: [500] },
      )
      .toMatch(/victory|defeat|cleared/)
  })
})
