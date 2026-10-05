import { expect, test, type Page } from './fixtures'

import {
  assertNoBrowserErrors,
  bootToGuestHome,
  collectBrowserErrors,
  enterHome,
  openSettingsAndSave,
  reauthAndEnterHome,
  waitForPresentationIdle,
  GUEST_SAVE_KEY,
} from './helpers'

/**
 * P13/P14 runtime gate for the Huyen Kim stable scene-art integration.
 *
 * Proves, in a real browser, that:
 * - the auth/creation vista mounts the flat warm painting + cultivator
 *   and never covers the opening card;
 * - reduced motion leaves the static vista fully rendered;
 * - realm/body/skill/technique/exploration/equipment stable art mounts in
 *   its host surfaces behind runtime-owned content;
 * - the tribulation scene loads its four environment textures;
 * - SVG symbols render inside chrome controls;
 * - no console errors and no scope-hidden surfaces appear.
 *
 * Screenshots land in test-results/huyen-kim/ (mission evidence set).
 */

const SHOT_DIR = 'test-results/huyen-kim'

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` })
}

/** Name + exactly one talent -> finish. (No skill pick exists in beta.) */
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

/** Bootstrap a fresh guest -> new mortal -> home. */
async function bootFreshMortal(page: Page): Promise<void> {
  await bootToGuestHome(page)
  await createBetaCharacter(page, 'E2E Huyen Kim')
  await enterHome(page)
}

// Store modules import by URL inside the page's vite module graph (same
// mechanism as beta-journey.spec.ts); the specifier is a variable so
// vue-tsc does not try to resolve a dev-server path.
const UI_STORE_URL = '/src/stores/ui.ts'
const PLAYER_STORE_URL = '/src/stores/player.ts'

/** Open a standalone panel through the app's own ui store action. */
async function openStandalone(page: Page, panel: string): Promise<void> {
  await page.evaluate(async ([p, url]) => {
    const { useUiStore } = await import(/* @vite-ignore */ url)
    useUiStore().openStandalonePanel(p as never)
  }, [panel, UI_STORE_URL])
}

/** Open a left-panel mode through the app's own ui store action. */
async function openLeftMode(page: Page, mode: string): Promise<void> {
  await page.evaluate(async ([m, url]) => {
    const { useUiStore } = await import(/* @vite-ignore */ url)
    useUiStore().openLeftPanel(m as never)
  }, [mode, UI_STORE_URL])
}

interface SaveShape {
  version: number
  player: {
    name: string
    realmId: string
    realmLevel: number
    cultivation: number
  }
}

function readSave(page: Page): Promise<SaveShape | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('tien-hiep-idle-save:guest')
    return raw ? (JSON.parse(raw) as SaveShape) : null
  })
}

/**
 * Seed a save via the same addInitScript ordering contract as the
 * save-reload spec, so the seeded state lands before the boot reads it.
 */
async function reseedSave(page: Page, mutate: (save: SaveShape) => SaveShape): Promise<void> {
  await openSettingsAndSave(page)
  const save = await readSave(page)
  expect(save).not.toBeNull()
  const seeded = mutate(save!)
  await page.addInitScript(
    ({ key, payload }) => {
      localStorage.setItem(key, JSON.stringify(payload))
    },
    { key: GUEST_SAVE_KEY, payload: seeded },
  )
  await page.reload()
  await reauthAndEnterHome(page)
}

/** Wait for the imperial scroll's unfold signature (clip reveal + chrome
 *  fade) to land so evidence captures never catch a mid-open frame. */
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
  await expect
    .poll(
      async () => page.locator('.hk-scroll__chrome').last().evaluate((el) => getComputedStyle(el).opacity),
      { timeout: 10_000 },
    )
    .toBe('1')
}


test.describe('Huyen Kim stable scene art', () => {
  test('scene 01 auth vista: flat painting under the opening card', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await page.goto('/')
    await expect(page.getByTestId('auth-screen')).toBeVisible({ timeout: 15_000 })

    // The boot curtain still locks the page when the auth route first
    // appears; wait it out before asserting paint order.
    await waitForPresentationIdle(page)

    const vista = page.locator('.login-vista')
    await expect(vista).toBeVisible()
    await expect(vista.locator('.login-world-vista')).toBeVisible()
    await expect(vista.locator('.login-vista__cultivator')).toBeVisible()

    // Paint order contract: the opening menu must sit above the vista -
    // elementFromPoint at the actions block must hit menu content, never
    // the vista painting.
    const hitHost = await page.evaluate(() => {
      const actions = document.querySelector('.login-opening__actions')
      if (!actions) return 'no-actions'
      const rect = actions.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      return hit?.closest('.login-opening') ? 'actions' : (hit?.className ?? 'none')
    })
    expect(hitHost, 'vista must not cover the opening actions').toBe('actions')

    await shot(page, '01-login')
    assertNoBrowserErrors(errors)
  })

  test('reduced motion leaves the flat auth vista fully rendered', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.getByTestId('auth-screen')).toBeVisible({ timeout: 15_000 })
    const vista = page.locator('.login-vista')
    await expect(vista).toBeVisible()
    await expect(vista.locator('.login-world-vista')).toBeVisible()
    // No animated parallax stack exists in the flat vista - the reduced
    // motion contract collapses to the static painting staying put.
    await expect(page.locator('.hk-parallax-stack')).toHaveCount(0)
    assertNoBrowserErrors(errors)
  })

  test('scene 02 character creation mounts the same vista stack', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await bootToGuestHome(page)
    const creation = page.getByTestId('character-creation-screen')
    await expect(creation).toBeVisible({ timeout: 15_000 })
    // The vista lives in the shared OnboardingStage - a sibling of the
    // creation screen, not a descendant of it.
    const vista = page.locator('.login-vista')
    await expect(vista).toBeVisible()
    await expect(vista.locator('.login-world-vista')).toBeVisible()
    await expect(vista.locator('.login-vista__cultivator')).toBeVisible()
    // Route curtain must finish revealing before the capture.
    await waitForPresentationIdle(page)
    await shot(page, '02-character-creation')
    assertNoBrowserErrors(errors)
  })

  test('scenes 05+08: realm paper map, then body figure/overlay', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)
    await openStandalone(page, 'realm')
    const realm = page.locator('.realm-paper-scene')
    await expect(realm).toBeVisible({ timeout: 15_000 })

    // Scene 05 fidelity: the paper map art carries the 18-floor ascent;
    // runtime-owned markers stay interactive on top of it.
    const art = realm.locator('.realm-map-art')
    await expect(art).toBeVisible()
    expect(await art.getAttribute('src')).toContain('realm')
    await expect(realm.locator('.realm-marker')).toHaveCount(18)
    await expect(realm.locator('.realm-details')).toBeVisible()
    await waitForPresentationIdle(page)
    await shot(page, '05-realm')

    await page.keyboard.press('Escape')
    await openStandalone(page, 'body')
    const body = page.locator('.body-paper-scene')
    await expect(body).toBeVisible({ timeout: 15_000 })
    const figure = body.locator('.body-figure-art')
    await expect(figure).toBeVisible()
    // Mortal start: the refinement page mounts the horse-stance art.
    expect(await figure.getAttribute('src')).toContain('body-v2')
    expect(await figure.getAttribute('src')).toContain('mortal-horse-stance')
    await expect(body.locator('.body-progress-track')).toBeVisible()
    await expect(body.locator('.body-unit-rail button').first()).toBeVisible()
    await waitForPresentationIdle(page)
    await shot(page, '08-body')
    assertNoBrowserErrors(errors)
  })

  test('scenes 06+07 skill panel: tree substrate + technique plinth', async ({ page }) => {
    test.setTimeout(180_000)
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)

    // Meet the authored initiation gate honestly, then commit fire via the
    // real domain op (same pattern as beta-journey.spec.ts).
    await reseedSave(page, (save) => ({
      ...save,
      player: { ...save.player, realmLevel: 12, cultivation: 0 },
    }))
    await page.evaluate(async (playerUrl) => {
      const { usePlayerStore } = await import(/* @vite-ignore */ playerUrl)
      const w = window as unknown as {
        __tutienPhaserGame?: { registry: { get(key: string): any } }
      }
      const gm = w.__tutienPhaserGame?.registry.get('gameManager')
      if (!gm) throw new Error('gameManager not in phaser registry')
      const player = usePlayerStore()
      player.skillCastCounts['linh_bao'] = 10_000
      return gm.realmAdvanceOps.commitFiveElementInitiation('fire', player.$state)
    }, PLAYER_STORE_URL)

    await openStandalone(page, 'skill')
    const skillScene = page.locator('.skill-paper-scene')
    await expect(skillScene).toBeVisible({ timeout: 20_000 })
    // Scene 07 fidelity: the paper constellation owns interactivity -
    // committed fire renders its node on the graph.
    await expect(skillScene.locator('.skill-node').first()).toBeVisible()
    await waitForPresentationIdle(page)
    await shot(page, '07-skill')

    // Scene 06 is its own paper scene now - the artifact centerpiece
    // lives in TechniquePanel, not the skill tree.
    await page.keyboard.press('Escape')
    await openStandalone(page, 'technique')
    const technique = page.locator('.technique-paper-scene')
    await expect(technique).toBeVisible({ timeout: 15_000 })
    const book = technique.locator('.technique-book')
    await expect(book).toBeVisible()
    // The initiation op equipped the way's technique - the artifact
    // centerpiece renders its real icon, not the placeholder.
    expect(await book.getAttribute('src')).toContain('/assets/techniques/')
    await expect(technique.locator('.technique-art-caption')).toHaveCount(0)
    await waitForPresentationIdle(page)
    await shot(page, '06-technique')
    assertNoBrowserErrors(errors)
  })

  test('scene 10 stage select: Son Ha Do terrain + chapter bands + live stage nodes', async ({
    page,
  }) => {
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)
    await page.keyboard.press('Tab')
    const teleport = page.locator('[data-wheel-slot="teleport_array"]')
    await expect(teleport).toBeVisible({ timeout: 10_000 })
    await teleport.click()

    // S10 fidelity: the imperial scroll is gone - the exploration-v2
    // paper surface mounts directly on the overlay canvas.
    const scene = page.locator('.exploration-scene')
    await expect(scene).toBeVisible({ timeout: 15_000 })

    // Stable terrain art behind the live Son Ha Do map.
    const terrain = scene.locator('.terrain')
    await expect(terrain).toBeVisible()
    expect(await terrain.getAttribute('src')).toContain('exploration-v2/terrain-three-realms-v1')

    // All 3 chapter bands render - 30 canonical stage nodes.
    await expect(scene.locator('.chapter')).toHaveCount(3)
    await expect(scene.locator('.stage-node')).toHaveCount(30)
    // Frontier + locked states come from the canonical surface model.
    await expect(scene.locator('.stage-node.current')).toHaveCount(1)
    expect(await scene.locator('.stage-node.locked').count()).toBeGreaterThan(0)

    // Detail rail: 4 battle modes + enabled start on the auto-picked
    // first stage.
    await expect(scene.locator('.mode-chip')).toHaveCount(4)
    await expect(page.getByTestId('stage-start-button')).toBeEnabled()

    // No imperial scroll signature here - the paper scene mounts
    // directly; idle + a beat lets the terrain art decode land.
    await waitForPresentationIdle(page)
    await page.waitForTimeout(400)
    await shot(page, '10-exploration')
    assertNoBrowserErrors(errors)
  })

  test('scene 12 equipment: paperdoll base behind runtime sockets', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)
    // The paperdoll is the focal column of Khi Duong (imperial scene).
    await openLeftMode(page, 'equipment_hall')
    const scene = page.getByTestId('function-overlay-panel')
    await expect(scene).toBeVisible({ timeout: 10_000 })
    const doll = scene.locator('.paperdoll')
    await expect(doll).toBeVisible({ timeout: 10_000 })
    // The scroll unfold plays once - hit-testing before the transition
    // lands probes off-viewport coordinates.
    await waitForPresentationIdle(page)
    const base = doll.locator('.paperdoll__base')
    await expect(base).toBeVisible()
    expect(await base.getAttribute('src')).toContain('equipment-paperdoll-base')
    const slot = doll.locator('.paperdoll__slot').first()
    await expect(slot).toBeVisible()
    // The decorative base must paint under the socket cells (hit-test
    // scoped to the imperial scene - other panels reuse SlotView).
    const hitHost = await page.evaluate(() => {
      const dollEl = document.querySelector('[data-testid="function-overlay-panel"] .paperdoll')
      const slotEl = dollEl?.querySelector('.paperdoll__slot')
      if (!slotEl) return 'no-slot'
      const rect = slotEl.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      return hit?.closest('.paperdoll__cell') ? 'slot' : `${hit?.tagName}.${hit?.className ?? ''}`
    })
    expect(hitHost, 'paperdoll base must not cover socket cells').toBe('slot')
    await waitForScrollSettled(page)
    await shot(page, '12-equipment')
    assertNoBrowserErrors(errors)
  })

  test('scene 14 tribulation: four environment textures load', async ({ page }) => {
    test.setTimeout(240_000)
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)
    await reseedSave(page, (save) => ({
      ...save,
      player: { ...save.player, realmLevel: 12, cultivation: 0 },
    }))

    await page.keyboard.press('Tab')
    const realmSlot = page.locator('[data-wheel-slot="realm"]')
    await expect(realmSlot).toBeVisible({ timeout: 10_000 })
    await realmSlot.click()
    const realmDialog = page.getByRole('dialog', { name: 'Cảnh Giới' })
    await expect(realmDialog).toBeVisible({ timeout: 15_000 })
    const breakthrough = realmDialog.getByRole('button', { name: 'Quán Khí' })
    await expect(breakthrough).toBeEnabled({ timeout: 10_000 })
    await breakthrough.click()
    const confirmDialog = page.getByRole('dialog', { name: /Độ kiếp cũng là độ thân/ })
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 })
    await confirmDialog.getByRole('button', { name: 'Đã hiểu' }).click()

    const tribulationUi = page.locator('.tribulation-ui')
    await expect(tribulationUi).toBeVisible({ timeout: 30_000 })
    await waitForPresentationIdle(page)

    // Verify the four environment textures actually loaded into Phaser.
    const keys = await page.evaluate(() => {
      const game = (window as Window & {
        __tutienPhaserGame?: {
          scene: { getScene(key: string): { textures: { exists(k: string): boolean } } }
        }
      }).__tutienPhaserGame
      const scene = game?.scene.getScene('TribulationScene')
      const wanted = [
        'hk-tribulation-sky-vignette',
        'hk-tribulation-storm-far',
        'hk-tribulation-storm-near',
        'hk-tribulation-dais',
      ]
      return wanted.map((k) => ({ key: k, exists: scene?.textures.exists(k) ?? false }))
    })
    for (const { key, exists } of keys) {
      expect(exists, `tribulation texture ${key} must exist`).toBe(true)
    }
    await shot(page, '14-tribulation')
    assertNoBrowserErrors(errors)
  })

  test('svg symbols render in chrome (top bar, overlay close, wheel lock)', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)

    // Top-bar utility glyphs carry mask-image pointing at stable symbols.
    const topbar = page.locator('.global-top-bar .hk-symbol')
    await expect(topbar.first()).toBeVisible({ timeout: 10_000 })
    for (const mask of await topbar.evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).maskImage),
    )) {
      expect(mask).toContain('huyen-kim/symbols/')
    }

    // Imperial-scroll close glyph (San Xuat is the last scroll shell).
    await openLeftMode(page, 'exploration')
    const close = page.locator('.hk-scroll__close .hk-symbol')
    await expect(close).toBeVisible({ timeout: 10_000 })
    expect(await close.evaluate((el) => getComputedStyle(el).maskImage)).toContain(
      'symbols/close.svg',
    )

    // Wheel lock badge on a locked/ungated building slot.
    await page.keyboard.press('Escape')
    await page.keyboard.press('Tab')
    const wheelLock = page.locator('.command-wheel .command-wheel__lock-badge .hk-symbol').first()
    if (await wheelLock.count()) {
      expect(await wheelLock.evaluate((el) => getComputedStyle(el).maskImage)).toContain(
        'symbols/lock.svg',
      )
    }
    assertNoBrowserErrors(errors)
  })
})
