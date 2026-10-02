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
 * - the auth/creation parallax vista mounts its six ordered layers and
 *   drifts within the extension contract bounds (far < near, clamped);
 * - reduced motion pins every offset to exactly zero;
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

function stackDepths(page: Page, stackSelector: string) {
  return page.locator(`${stackSelector} .hk-parallax-stack__layer`).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-depth')),
  )
}

/**
 * Raw computed translations. The transform is
 * `translate(-50%,-50%) translate3d(x,y,0)`, so the matrix includes the
 * centering offset — always diff two states to isolate the drift delta.
 */
function layerTranslations(page: Page, stackSelector: string) {
  return page.locator(`${stackSelector} .hk-parallax-stack__layer`).evaluateAll((els) =>
    els.map((el) => {
      const m = getComputedStyle(el).transform
      const parts = m.replace('matrix(', '').replace(')', '').split(',').map(Number)
      return { x: parts[4] ?? 0, y: parts[5] ?? 0 }
    }),
  )
}

test.describe('Huyen Kim stable scene art', () => {
  test('scene 01 auth vista: six ordered layers, bounded drift', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await page.goto('/')
    await expect(page.getByTestId('auth-screen')).toBeVisible({ timeout: 15_000 })

    // The boot curtain still locks the page when the auth route first
    // appears; wait it out before asserting paint order.
    await waitForPresentationIdle(page)

    const stack = '[data-testid="auth-screen"] .hk-parallax-stack[data-stack="auth-creation"]'
    await expect(page.locator(stack)).toBeVisible()
    await expect(page.locator(`${stack} .hk-parallax-stack__layer`)).toHaveCount(6)
    expect(await stackDepths(page, stack)).toEqual(['L0', 'L1', 'L2', 'L3', 'L4', 'L5'])

    // Paint order contract: the login card must sit above the vista —
    // elementFromPoint at the card's center must hit card content, never
    // a parallax layer (regression pin for the stacking-context fix).
    const hitHost = await page.evaluate(() => {
      const card = document.querySelector('.auth-card')
      if (!card) return 'no-card'
      const rect = card.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      return hit?.closest('.auth-card') ? 'card' : (hit?.className ?? 'none')
    })
    expect(hitHost, 'parallax layers must not cover the auth card').toBe('card')

    // Contract max_drift_px are DESIGN-space px (1672x941); rendered drift
    // scales with the cover-fit factor, so assert against contract*s where
    // s is read back from the rendered layer width.
    const renderedScale = await page
      .locator(`${stack} .hk-parallax-stack__layer`)
      .first()
      .evaluate((el) => (el as HTMLElement).offsetWidth / 1672)

    // Warm-up move, then neutral (center) baseline.
    await page.mouse.move(800, 450)
    await page.waitForTimeout(250)
    const neutral = await layerTranslations(page, stack)

    // Max drift at corners.
    await page.mouse.move(0, 0)
    await page.waitForTimeout(250)
    const neg = await layerTranslations(page, stack)
    await page.mouse.move(1600, 900)
    await page.waitForTimeout(250)
    const pos = await layerTranslations(page, stack)

    // Contract maxima per extension (design px): x 0/4/8/10/12/18.
    const maxX = [0, 4, 8, 10, 12, 18]
    const maxY = [0, 2, 4, 5, 6, 9]
    for (let i = 0; i < 6; i++) {
      const negDx = Math.abs(neg[i]!.x - neutral[i]!.x)
      const posDx = Math.abs(pos[i]!.x - neutral[i]!.x)
      const bound = maxX[i]! * renderedScale
      expect(negDx, `layer L${i} -x drift`).toBeLessThanOrEqual(bound + 0.5)
      expect(posDx, `layer L${i} +x drift`).toBeLessThanOrEqual(bound + 0.5)
      expect(Math.abs(neg[i]!.y - neutral[i]!.y)).toBeLessThanOrEqual(
        maxY[i]! * renderedScale + 0.5,
      )
      if (maxX[i] === 0) {
        expect(posDx, `layer L${i} static`).toBeLessThan(0.5)
      } else {
        // Extreme pointers saturate at (close to) the rendered max.
        expect(posDx, `layer L${i} +x saturation`).toBeGreaterThan(bound * 0.8)
      }
    }
    // Foreground drifts more than far mountains.
    const fgDx = Math.abs(pos[5]!.x - neutral[5]!.x)
    const farDx = Math.abs(pos[1]!.x - neutral[1]!.x)
    expect(fgDx).toBeGreaterThan(farDx)
    await shot(page, '01-login')
    assertNoBrowserErrors(errors)
  })

  test('reduced motion pins all auth layers to zero drift', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.getByTestId('auth-screen')).toBeVisible({ timeout: 15_000 })
    const stack = '[data-testid="auth-screen"] .hk-parallax-stack'
    await page.mouse.move(800, 450)
    await page.waitForTimeout(150)
    const neutral = await layerTranslations(page, stack)
    await page.mouse.move(0, 0)
    await page.waitForTimeout(150)
    const neg = await layerTranslations(page, stack)
    for (let i = 0; i < neg.length; i++) {
      expect(Math.abs(neg[i]!.x - neutral[i]!.x)).toBeLessThan(0.5)
      expect(Math.abs(neg[i]!.y - neutral[i]!.y)).toBeLessThan(0.5)
    }
    assertNoBrowserErrors(errors)
  })

  test('scene 02 character creation mounts the same vista stack', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await bootToGuestHome(page)
    const creation = page.getByTestId('character-creation-screen')
    await expect(creation).toBeVisible({ timeout: 15_000 })
    const stack = creation.locator('.hk-parallax-stack[data-stack="auth-creation"]')
    await expect(stack).toBeVisible()
    expect(await stack.locator('.hk-parallax-stack__layer').count()).toBe(6)
    // Route curtain must finish revealing before the capture.
    await waitForPresentationIdle(page)
    await shot(page, '02-character-creation')
    assertNoBrowserErrors(errors)
  })

  test('scenes 05+08: realm ascent stack, then body figure/overlay', async ({ page }) => {
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)
    await openStandalone(page, 'realm')
    const scroll = page.locator('.hk-scroll')
    await expect(scroll).toBeVisible({ timeout: 15_000 })

    const stack = scroll.locator(
      '.realm-scene__ascent .hk-parallax-stack[data-stack="realm-ascent"]',
    )
    await expect(stack).toBeVisible()
    await expect(stack.locator('.hk-parallax-stack__layer')).toHaveCount(5)
    // Runtime-owned content stays dominant: realm rungs still render.
    await expect(scroll.locator('.realm-node').first()).toBeVisible({ timeout: 10_000 })
    await waitForPresentationIdle(page)
    await waitForScrollSettled(page)
    await shot(page, '05-realm')

    await page.keyboard.press('Escape')
    await openStandalone(page, 'body')
    const body = page.locator('.body-scene')
    await expect(body).toBeVisible({ timeout: 15_000 })
    const figure = body.locator('.body-scene__figure-img')
    const meridian = body.locator('.body-scene__figure-overlay')
    await expect(figure).toBeVisible()
    await expect(meridian).toBeVisible()
    expect(await figure.getAttribute('src')).toContain('body-cultivation-figure')
    expect(await meridian.getAttribute('src')).toContain('body-meridian-overlay')
    await waitForPresentationIdle(page)
    await waitForScrollSettled(page)
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
    const treeViewport = page.locator('.node-tree__viewport')
    await expect(treeViewport).toBeVisible({ timeout: 20_000 })
    const substrate = treeViewport.locator('.hk-parallax-stack[data-stack="skill-tree"]')
    await expect(substrate).toBeVisible()
    await expect(substrate.locator('.hk-parallax-stack__layer')).toHaveCount(4)
    // Runtime constellation nodes still own interactivity.
    await expect(treeViewport.locator('.node-tree__node').first()).toBeVisible()
    await waitForScrollSettled(page)
    await shot(page, '07-skill')

    // Scene 06 is its own imperial scene now — the plinth centerpiece
    // lives in TechniquePanel, not the skill tree.
    await page.keyboard.press('Escape')
    await openStandalone(page, 'technique')
    const technique = page.locator('.technique-scene')
    await expect(technique).toBeVisible({ timeout: 15_000 })
    const plinth = technique.locator('.technique-scene__plinth')
    await expect(plinth).toBeVisible()
    expect(await plinth.getAttribute('src')).toContain('technique-display-plinth')
    await waitForPresentationIdle(page)
    await waitForScrollSettled(page)
    await shot(page, '06-technique')
    assertNoBrowserErrors(errors)
  })

  test('scene 10 stage select: map frame + mask + chapter divider + lock symbol', async ({
    page,
  }) => {
    const errors = collectBrowserErrors(page)
    await bootFreshMortal(page)
    await page.keyboard.press('Tab')
    const teleport = page.locator('[data-wheel-slot="teleport_array"]')
    await expect(teleport).toBeVisible({ timeout: 10_000 })
    await teleport.click()

    const overlay = page.getByTestId('function-overlay-panel')
    await expect(overlay).toBeVisible({ timeout: 15_000 })
    const stage = overlay.locator('.stage-select')
    await expect(stage).toBeVisible({ timeout: 10_000 })

    for (const [cls, asset] of [
      ['__map-frame', 'exploration-map-frame'],
      ['__chapter-divider', 'exploration-chapter-divider'],
    ] as const) {
      const img = stage.locator(`.stage-select${cls}`)
      await expect(img).toBeVisible()
      expect(await img.getAttribute('src')).toContain(asset)
    }
    // The painted-mask asset applies via the --map-mask CSS var on the map.
    const mapMask = await stage.locator('.stage-map').evaluate(
      (el) => getComputedStyle(el).maskImage,
    )
    expect(mapMask).toContain('exploration-map-mask')

    // Locked stage symbols render via the stable `lock` SVG.
    const locks = stage.locator('.stage-map__node.is-locked .stage-map__lock .hk-symbol')
    if (await locks.count()) {
      const mask = await locks.first().evaluate((el) => getComputedStyle(el).maskImage)
      expect(mask).toContain('huyen-kim/symbols/lock.svg')
    }
    await waitForScrollSettled(page)
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

    // Imperial-scroll close glyph.
    await openStandalone(page, 'realm')
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
