import { expect, test, type Page } from './fixtures'

import { bootToGuestHome, enterHome } from './helpers'

/**
 * BETA journey scope-leak gate (spec sec.9 / frontend-contract sec.C-I).
 *
 * The DOM half of the beta journey check: drive the live app far enough to
 * reach every player-facing surface a beta session opens, and assert that
 * no scope-hidden system renders - not disabled, not "coming soon", not a
 * locked teaser. The headless half (creation -> mortal -> initiation ->
 * acts -> beta completion on the real ops) lives in
 * tests/architecture/betaJourney.test.ts; the static corpus half lives in
 * tests/architecture/betaScopeRenderedTokens.test.ts.
 *
 * This suite is a GATE, so leak assertions are hard expects, not
 * test.fail() markers: while a scope-hidden surface renders the suite
 * stays red and the failure lines name exactly which forbidden surface
 * class rendered.
 */

// The scope-hidden surface ids, expressed as the DOM hooks they would use
// if they rendered.
const SCOPE_HIDDEN_WHEEL_SLOTS = [
  'phap_bao',
  'formation_slot',
  'companion_roster',
  'chi_hien_quan',
]
const SCOPE_HIDDEN_BUILDINGS = ['chi_hien_quan']

// Equipment hall admits exactly enhance + dissolve in beta.
const BETA_EQUIPMENT_TAB_LABELS = ['Cường Hóa', 'Hóa Luyện']
const SCOPE_HIDDEN_EQUIPMENT_TAB_LABELS = ['Tẩy Luyện', 'Tinh Luyện', 'Phân Giải']

// Realm ladder in beta shows only the in-window rungs (Nhap Dao /
// Kien Co / Truc Co); Kim Dan+ and any coming-soon chip are forbidden.
const SCOPE_HIDDEN_REALM_LABELS = [
  'Kim Đan',
  'Nguyên Anh',
  'Hóa Thần',
  'Luyện Hư',
  'Đại Thừa',
  'Độ Kiếp',
]
const COMING_SOON_LABEL = 'Sắp ra mắt'

// Skill role strip / combat bar: basic + special only. 'Tuyet Ky' (the
// ultimate role) must be absent, never rendered locked or empty.
const ULTIMATE_LABEL = 'Tuyệt Kỹ'

const ELEMENT_TABS = '.skill-elements button'
const FIVE_ELEMENTS = ['Hỏa', 'Thủy', 'Mộc', 'Kim', 'Thổ']

// ---------------------------------------------------------------------------
// Drivers

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

/** Every DOM spec starts from the same state: fresh guest -> new mortal. */
async function bootFreshMortal(page: Page): Promise<void> {
  await bootToGuestHome(page)
  await createBetaCharacter(page, 'E2E Bêta')
  await enterHome(page)
}

// Store/game modules are imported by URL inside the page's own vite
// module graph (same mechanism the debug pokes use). The specifier is
// computed so vue-tsc does not try to resolve a dev-server path.
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

/** Drive the real atomic commit on the live GameManager (fire element). */
async function commitFireElement(page: Page): Promise<unknown> {
  return page.evaluate(async (playerUrl) => {
    const { usePlayerStore } = await import(/* @vite-ignore */ playerUrl)
    const w = window as unknown as {
      __tutienPhaserGame?: { registry: { get(key: string): any } }
    }
    const gm = w.__tutienPhaserGame?.registry.get('gameManager')
    if (!gm) throw new Error('gameManager not in phaser registry')
    const player = usePlayerStore()
    // Meet the authored offer gate + realm gate honestly on the real
    // state fields: linh_bao cast level 3 (10k casts) + mortal level 12.
    player.skillCastCounts['linh_bao'] = 10_000
    player.realmLevel = 12
    return gm.realmAdvanceOps.commitFiveElementInitiation('fire', player.$state)
  }, PLAYER_STORE_URL)
}

// ---------------------------------------------------------------------------

test.describe('beta journey - scope-leak gate (spec sec.9)', () => {
  test('creation surface offers name + talent only (no skill/attribute/path picks)', async ({
    page,
  }) => {
    await bootToGuestHome(page)
    const creation = page.getByTestId('character-creation-screen')
    await expect(creation).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('creation-name-input')).toBeVisible()
    await expect(
      creation.locator('[data-testid^="creation-talent-"]').first(),
    ).toBeVisible({ timeout: 10_000 })
    // The starter slot renders as a cosmetic preview strip (approved
    // creation design) - it never enters the creation payload, which stays
    // name + talent only (asserted by the unit suite).
    await expect(creation.locator('[data-hk-region="dao-lo"]')).toBeVisible()
    // The retired attribute pick must not exist at all.
    await expect(creation.locator('[data-testid^="creation-attribute-"]')).toHaveCount(0)
    // No sword/body/hidden way chooser.
    await expect(creation.getByText('Kiếm Tu')).toHaveCount(0)
    await expect(creation.getByText('Thể Tu')).toHaveCount(0)
  })

  test('command wheel renders no scope-hidden slots', async ({ page }) => {
    await bootFreshMortal(page)
    await page.keyboard.press('Tab')
    const slots = page.locator('[data-wheel-slot]')
    await expect(slots.first()).toBeVisible({ timeout: 10_000 })
    const rendered = await slots.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-wheel-slot')),
    )
    for (const id of SCOPE_HIDDEN_WHEEL_SLOTS) {
      expect(rendered, `wheel must not render slot ${id}`).not.toContain(id)
    }
  })

  test('home building icons render no worker lodge', async ({ page }) => {
    await bootFreshMortal(page)
    const icons = page.locator('[data-building-id]')
    await expect(icons.first()).toBeVisible({ timeout: 10_000 })
    const rendered = await icons.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-building-id')),
    )
    for (const id of SCOPE_HIDDEN_BUILDINGS) {
      expect(rendered, `building icon ${id} must be absent`).not.toContain(id)
    }
  })

  test('equipment hall renders only enhance + dissolve tabs', async ({ page }) => {
    await bootFreshMortal(page)
    await openLeftMode(page, 'equipment_hall')
    const overlay = page.getByTestId('function-overlay-panel')
    await expect(overlay).toBeVisible({ timeout: 10_000 })
    const tabs = overlay.locator('.qi-hall__tabs [role="tab"]')
    await expect(tabs.first()).toBeVisible({ timeout: 10_000 })
    await expect(tabs).toHaveCount(2)
    const labels = (await tabs.allTextContents()).map((label) => label.trim())
    expect(labels.sort()).toEqual([...BETA_EQUIPMENT_TAB_LABELS].sort())
    for (const label of SCOPE_HIDDEN_EQUIPMENT_TAB_LABELS) {
      expect(labels, `equipment tab "${label}" must be absent`).not.toContain(label)
    }
  })

  test('quest panel carries no daily-quest surfaces', async ({ page }) => {
    await bootFreshMortal(page)
    await openStandalone(page, 'quest')
    const panel = page.locator('.quest-scene')
    await expect(panel).toBeVisible({ timeout: 10_000 })
    await expect(panel.getByText('Nhiệm Vụ Ngày')).toHaveCount(0)
    await expect(panel.getByText(/hàng ngày|hằng ngày/i)).toHaveCount(0)
  })

  test('realm ladder lists only the three beta rungs, no coming-soon chips', async ({
    page,
  }) => {
    await bootFreshMortal(page)
    await openStandalone(page, 'realm')
    const nodes = page.locator('.realm-node')
    await expect(nodes.first()).toBeVisible({ timeout: 10_000 })
    // mortal rung (prepended) + Kien Co + Truc Co.
    await expect(nodes).toHaveCount(3)
    await expect(page.getByText(COMING_SOON_LABEL)).toHaveCount(0)
    for (const label of SCOPE_HIDDEN_REALM_LABELS) {
      await expect(
        page.locator('.realm-node').getByText(label, { exact: true }),
        `realm node "${label}" must be absent`,
      ).toHaveCount(0)
    }
  })

  test('skill surface renders no ultimate card', async ({ page }) => {
    await bootFreshMortal(page)
    await openStandalone(page, 'skill')
    const scene = page.locator('.skill-paper-scene')
    await expect(scene).toBeVisible({ timeout: 10_000 })
    // Scene 07 fidelity (user ruling): the role-strip surface is
    // retired - skills auto-mount by pathway, so the ultimate label
    // can never appear anywhere on the panel.
    await expect(
      scene.locator('.skill-role-strip'),
      'the retired role strip must not remount',
    ).toHaveCount(0)
    await expect(
      scene.getByText(ULTIMATE_LABEL, { exact: true }),
      'ultimate role label must not exist on the surface',
    ).toHaveCount(0)
  })

  test('combat skill bar renders no ultimate slot', async ({ page }) => {
    test.setTimeout(120_000)
    await bootFreshMortal(page)

    // Stage select via the wheel's teleport array, then start dong_1.
    await page.keyboard.press('Tab')
    const teleport = page.locator('[data-wheel-slot="teleport_array"]')
    await expect(teleport).toBeVisible({ timeout: 10_000 })
    await teleport.click()
    const overlay = page.getByTestId('function-overlay-panel')
    await expect(overlay).toBeVisible({ timeout: 10_000 })
    const start = page.getByTestId('stage-start-button')
    await expect(start).toBeEnabled({ timeout: 10_000 })
    await start.click()

    // The turn skill bar mounts with the combat HUD.
    const bar = page.locator('.turn-combat-skill-bar')
    await expect(bar).toBeVisible({ timeout: 30_000 })

    // The rail renders only betaCombatRolesFor entries; the ultimate
    // role is scope-hidden so no slot (disabled or otherwise) renders.
    await expect(
      bar.locator('button').filter({ hasText: ULTIMATE_LABEL }),
      'ultimate slot button must not exist on the bar',
    ).toHaveCount(0)
    await expect(
      bar.locator('button[aria-label*="Tuyệt Kỹ"]'),
      'no control may carry the ultimate aria-label',
    ).toHaveCount(0)
    // The Phap Tu An emblem slot is likewise a scope-hidden surface.
    await expect(bar.locator('.turn-combat-skill-bar__emblem')).toHaveCount(0)
  })

  test('skill panel renders only the committed element tab after initiation', async ({
    page,
  }) => {
    await bootFreshMortal(page)

    const result = await commitFireElement(page)
    expect(
      result,
      'commitFiveElementInitiation refused on the real state - check prereqs',
    ).toMatchObject({ ok: true })

    await openStandalone(page, 'skill')
    const tabs = page.locator(ELEMENT_TABS)
    await expect(tabs.first()).toBeVisible({ timeout: 10_000 })

    // Contract: after committing fire, the four non-committed element
    // branches are scope-hidden - the panel renders ONLY the fire tab,
    // derived from the betaSkillTreeFor node states.
    const rendered = await tabs.allTextContents()
    expect(
      rendered.length,
      `element tabs rendered ${JSON.stringify(rendered)} - only the committed element may render`,
    ).toBe(1)
    expect(rendered).toEqual([FIVE_ELEMENTS[0]])
  })

  test('standalone + left-panel deep links to scope-hidden surfaces fail closed', async ({
    page,
  }) => {
    await bootFreshMortal(page)
    const outcome = await page.evaluate(async (url) => {
      const { useUiStore } = await import(/* @vite-ignore */ url)
      const ui = useUiStore()
      const results: Record<string, unknown> = {}
      for (const panel of ['artifact', 'tran_phap', 'companion']) {
        ui.openStandalonePanel(panel as never)
        results[`standalone:${panel}`] = ui.standalonePanel === panel
      }
      for (const mode of ['worker_lodge']) {
        ui.openLeftPanel(mode as never)
        results[`leftMode:${mode}`] = ui.leftPanelMode === mode
      }
      return results
    }, UI_STORE_URL)
    for (const [key, opened] of Object.entries(outcome)) {
      expect(opened, `${key} opened a scope-hidden surface`).toBe(false)
    }
    await expect(page.locator('.artifact-panel')).toHaveCount(0)
    await expect(page.locator('.worker-lodge-panel')).toHaveCount(0)
  })
})
