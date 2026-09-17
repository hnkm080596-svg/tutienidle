import { expect, test } from './fixtures'

import {
  assertNoBrowserErrors,
  bootToGuestHome,
  collectBrowserErrors,
  createCharacterThroughUi,
  enterHome,
  openSettingsAndSave,
  reauthAndEnterHome,
  waitForPresentationIdle,
  GUEST_SAVE_KEY,
} from './helpers'

/**
 * P14 runtime oracle for the Cultivation Path Framework — the M10
 * six-way ritual matrix, deferred out of the isolated worktree.
 *
 * Every test drives the real loop:
 *   boot -> create -> save -> seed realmLevel 12 (+ gate mirrors for
 *   hidden ways) -> reload -> RealmPanel "Quan Khi" -> tribulation
 *   fast-forward -> victory -> QuanKhiPanel offers -> choose (path, way)
 *   -> ConfirmModal -> realm advances, kit committed -> save oracle.
 *
 * Save-oracle fields: player.cultivationPath/cultivationWay (the atomic
 * pair), the way-owned slices (kiemTu without the retired mode key,
 * phapTu pending the element pick), and the top-level
 * techniques/skills manager arrays (equipped technique + learned kit).
 */
const SAVE_KEY = GUEST_SAVE_KEY
const BREAKTHROUGH_GATE_LEVEL = 12
const FAST_FORWARD_SECONDS = 600

// CAST_LEVELING_THRESHOLDS[skillId].lv3 (SkillSystem.ts) — the cast
// count that resolves cast-level 3 for the ngo_dao offer gate.
const LINH_BAO_L3_CASTS = 10_000

interface SaveShape {
  version: number
  player: {
    name: string
    realmId: string
    realmLevel: number
    cultivation: number
    cultivationPath?: string
    cultivationWay?: string
    kiemTu?: {
      preset?: string[]
      kiemY?: number
      kiemDaoCount?: number
      kiemDaoBase?: number
      mode?: string
    }
    phapTu?: { element: string | null; route: string | null }
    artifact?: { artifactId?: string }
    skillLevels?: Record<string, number>
    skillCastCounts?: Record<string, number>
  }
  techniques: { id: string; equipped?: boolean }[]
  skills: { id: string; equipped?: boolean }[]
}

interface TribulationDirectorHandle {
  update(deltaSeconds: number): void
  getState(): { state: 'ongoing' | 'victory' | 'defeat' } | null
}

interface GameManagerHandle {
  tribulationDirector: TribulationDirectorHandle
}

function readSave(page: import('@playwright/test').Page): Promise<SaveShape | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('tien-hiep-idle-save:guest')

    return raw ? (JSON.parse(raw) as SaveShape) : null
  })
}

function advanceTribulation(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate((seconds) => {
    const game = (window as Window & {
      __tutienPhaserGame?: { registry: { get(key: string): unknown } }
    }).__tutienPhaserGame
    const manager = game?.registry.get('gameManager') as GameManagerHandle | undefined
    const director = manager?.tribulationDirector

    if (!director) {
      return 'missing-director'
    }

    director.update(seconds)

    return director.getState()?.state ?? 'cleared'
  }, FAST_FORWARD_SECONDS)
}

/** Seed fields onto the persisted player slice before reload. */
async function seedAndReload(
  page: import('@playwright/test').Page,
  playerPatch: Record<string, unknown>,
): Promise<void> {
  await openSettingsAndSave(page)

  const saveBefore = await readSave(page)
  expect(saveBefore).not.toBeNull()
  expect(saveBefore!.player.realmId).toBe('mortal')

  const seededSave = {
    ...saveBefore!,
    player: {
      ...saveBefore!.player,
      realmLevel: BREAKTHROUGH_GATE_LEVEL,
      cultivation: 0,
      ...playerPatch,
    },
  }

  await page.addInitScript(
    ({ key, payload }) => {
      localStorage.setItem(key, JSON.stringify(payload))
    },
    { key: SAVE_KEY, payload: seededSave },
  )

  await page.reload()
  await reauthAndEnterHome(page)
}

/**
 * Drives the Quan Khi tribulation to victory and leaves the QuanKhiPanel
 * offer list on screen (the outcome service opens standalonePanel
 * 'quan_khi' on the mortal -> qi_refining kiếp).
 */
async function winQuanKhiAndOpenRitual(page: import('@playwright/test').Page): Promise<void> {
  await page.keyboard.press('Tab')
  const realmSlot = page.locator('[data-wheel-slot="realm"]')
  await expect(realmSlot).toBeVisible({ timeout: 10_000 })
  await realmSlot.click()

  const realmDialog = page.getByRole('dialog', { name: 'Cảnh Giới' })
  await expect(realmDialog).toBeVisible({ timeout: 15_000 })

  const breakthroughButton = realmDialog.getByRole('button', { name: 'Quán Khí' })
  await expect(breakthroughButton).toBeEnabled({ timeout: 10_000 })
  await breakthroughButton.click()

  const confirmDialog = page.getByRole('dialog', { name: /Độ kiếp cũng là độ thân/ })
  await expect(confirmDialog).toBeVisible({ timeout: 10_000 })
  await confirmDialog.getByRole('button', { name: 'Đã hiểu' }).click()

  const tribulationUi = page.locator('.tribulation-ui')
  await expect(tribulationUi).toBeVisible({ timeout: 30_000 })
  await waitForPresentationIdle(page)

  await expect
    .poll(() => advanceTribulation(page), {
      timeout: 30_000,
      message: 'TribulationDirector should reach victory/defeat once the session hold releases',
    })
    .toMatch(/victory|defeat|cleared/)

  // Route home + the outcome's standalonePanel commit.
  const wheelLayer = page.locator('.command-wheel-layer')
  await expect(wheelLayer).toBeAttached({ timeout: 30_000 })
  await expect(tribulationUi).toHaveCount(0)
  await waitForPresentationIdle(page)

  const ritualPanel = page.locator('.overlay-panel')
  await expect(ritualPanel).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.quan-khi-panel__choices')).toBeVisible()
}

/** Clicks a way card by its "Bước Vào {name}" button and confirms. */
async function chooseWay(page: import('@playwright/test').Page, wayNamePattern: RegExp): Promise<void> {
  const choice = page.getByRole('button', { name: wayNamePattern })
  await expect(choice).toBeEnabled({ timeout: 10_000 })
  await choice.click()

  const confirm = page.locator('.confirm-modal__confirm')
  await expect(confirm).toBeVisible({ timeout: 10_000 })
  await confirm.click()

  await expect(page.locator('.overlay-panel')).toHaveCount(0, { timeout: 10_000 })

  // The ceremony world announcement overlays home chrome — dismiss.
  const announcement = page.locator('.world-announcement')
  if (await announcement.isVisible().catch(() => false)) {
    await announcement.click()
  }
  await expect(announcement).toHaveCount(0, { timeout: 15_000 })
}

/** Persists and returns the post-ritual save for assertion. Closes the
 * settings overlay so follow-up wheel interactions are not blocked. */
async function saveAndRead(page: import('@playwright/test').Page): Promise<SaveShape> {
  await openSettingsAndSave(page)

  const save = await readSave(page)
  expect(save).not.toBeNull()

  const openPanel = page.locator('.overlay-panel')
  if (await openPanel.isVisible().catch(() => false)) {
    await openPanel.click({ position: { x: 8, y: 8 } })
    await expect(openPanel).toHaveCount(0, { timeout: 10_000 })
  }

  return save!
}

/** Reopens the QuanKhiPanel via CharacterPanel's Kiếm Tu-only entry. */
async function reopenQuanKhiViaCharacter(page: import('@playwright/test').Page): Promise<void> {
  await page.keyboard.press('Tab')
  const characterSlot = page.locator('[data-wheel-slot="character"]')
  await expect(characterSlot).toBeVisible({ timeout: 10_000 })
  await characterSlot.click()

  const quanKhiEntry = page.getByRole('button', { name: 'Quán Khí' })
  await expect(quanKhiEntry).toBeVisible({ timeout: 10_000 })
  await quanKhiEntry.click()

  await expect(page.locator('.overlay-panel')).toBeVisible({ timeout: 10_000 })
}

test.describe('Cultivation Path ritual — six-way matrix (P14)', () => {
  test('ungated offers only when no gate mirror is seeded', async ({ page }) => {
    test.setTimeout(210_000)
    const collected = collectBrowserErrors(page)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Ritual Gate')
    await enterHome(page)
    await seedAndReload(page, {})
    await winQuanKhiAndOpenRitual(page)

    // Exactly the three ungated base ways — ngo_dao/ung_the/ngu stay
    // hidden without their gates (no locked-card tease, spec §11).
    await expect(page.locator('.quan-khi-panel__choice')).toHaveCount(3)
    await expect(page.locator('.quan-khi-panel__hidden-card')).toHaveCount(0)

    assertNoBrowserErrors(collected)
  })

  test('kiem_tu/hien: ritual -> preset editor surface', async ({ page }) => {
    test.setTimeout(210_000)
    const collected = collectBrowserErrors(page)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Kiếm Hiển')
    await enterHome(page)
    await seedAndReload(page, {})
    await winQuanKhiAndOpenRitual(page)

    // ngu is gated (tram Lv3) — without the seed it must not be offered.
    await expect(page.locator('.quan-khi-panel__choice')).toHaveCount(3)

    await chooseWay(page, /Ngự Kiếm Tâm Kinh/)

    const save = await saveAndRead(page)
    expect(save.player.realmId).toBe('qi_refining')
    expect(save.player.cultivationPath).toBe('kiem_tu')
    expect(save.player.cultivationWay).toBe('hien')
    expect(save.player.kiemTu).toBeDefined()
    expect(save.player.kiemTu!.mode).toBeUndefined()
    expect(Array.isArray(save.player.kiemTu!.preset)).toBe(true)
    expect(save.techniques.find((t) => t.id === 'ngu_kiem')?.equipped).toBe(true)

    // Hien surface — the preset editor only renders for the hien way.
    await reopenQuanKhiViaCharacter(page)
    const palette = page.locator('.quan-khi-panel__preset-palette .quan-khi-panel__preset-orb')
    await expect(palette.first()).toBeVisible({ timeout: 10_000 })

    // Direct-op write through setKiemPhoPreset: append one unlocked orb
    // (at qi_refining only orb_dam is unlocked — ORB_UNLOCK_REALM).
    const slotsBefore = await page.locator('.quan-khi-panel__preset-slot:not(.quan-khi-panel__preset-slot--empty)').count()
    const firstUnlocked = page.locator('.quan-khi-panel__preset-orb:not(.is-locked)').first()
    await expect(firstUnlocked).toBeVisible()
    await firstUnlocked.click()
    await expect(
      page.locator('.quan-khi-panel__preset-slot:not(.quan-khi-panel__preset-slot--empty)'),
    ).toHaveCount(slotsBefore + 1)

    assertNoBrowserErrors(collected)
  })

  test('kiem_tu/ngu: tram gate -> ritual entry -> ngu slice', async ({ page }) => {
    test.setTimeout(210_000)
    const collected = collectBrowserErrors(page)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Kiếm Ngự')
    await enterHome(page)
    // requiresSkillLevel { tram, 3 } reads player.skillLevels.
    await seedAndReload(page, { skillLevels: { tram: 3 } })
    await winQuanKhiAndOpenRitual(page)

    // The gated way now appears: 3 base + ngu.
    await expect(page.locator('.quan-khi-panel__choice')).toHaveCount(4)

    await chooseWay(page, /Vạn Kiếm Quyết/)

    const save = await saveAndRead(page)
    expect(save.player.realmId).toBe('qi_refining')
    expect(save.player.cultivationPath).toBe('kiem_tu')
    expect(save.player.cultivationWay).toBe('ngu')
    expect(save.player.kiemTu).toBeDefined()
    expect(save.player.kiemTu!.mode).toBeUndefined()
    expect(save.player.kiemTu!.kiemY).toBe(0)
    expect(save.player.kiemTu!.kiemDaoCount).toBe(1)
    expect(save.player.kiemTu!.kiemDaoBase).toBe(1)
    expect(save.techniques.find((t) => t.id === 'van_kiem_quyet')?.equipped).toBe(true)

    // Ngu surface — spec card names Ngự Kiếm Đạo, no preset editor.
    await reopenQuanKhiViaCharacter(page)
    await expect(page.locator('.quan-khi-panel__route-name')).toHaveText(/Ngự Kiếm Đạo/, {
      timeout: 10_000,
    })
    await expect(page.locator('.quan-khi-panel__preset-palette')).toHaveCount(0)

    assertNoBrowserErrors(collected)
  })

  test('phap_tu/ngu_hanh: ritual -> element tree + artifact entitlement', async ({ page }) => {
    test.setTimeout(240_000)
    const collected = collectBrowserErrors(page)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Ngũ Hành')
    await enterHome(page)
    await seedAndReload(page, {})
    await winQuanKhiAndOpenRitual(page)

    await chooseWay(page, /Đại Ngũ Hành Chân Quyết/)

    const save = await saveAndRead(page)
    expect(save.player.realmId).toBe('qi_refining')
    expect(save.player.cultivationPath).toBe('phap_tu')
    expect(save.player.cultivationWay).toBe('ngu_hanh')
    expect(save.player.phapTu).toEqual({ element: null, route: null })
    expect(save.techniques.find((t) => t.id === 'dai_ngu_hanh_chan_quyet')?.equipped).toBe(true)

    // Element tree surface — 5 element tabs render for ngu_hanh only.
    await page.keyboard.press('Tab')
    const skillSlot = page.locator('[data-wheel-slot="skill"]')
    await expect(skillSlot).toBeVisible({ timeout: 10_000 })
    await skillSlot.click()
    await expect(page.locator('.skill-path-panel')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.skill-path-panel__element-tab')).toHaveCount(5)

    // F1 oracle (positive): at foundation_establishment the way grants
    // ngu_hanh_chau — the phap_bao wheel slot must be ENABLED and the
    // artifact must materialize on restore.
    const current = await readSave(page)
    const advanced = {
      ...current!,
      player: { ...current!.player, realmId: 'foundation_establishment', realmLevel: 1 },
    }
    await page.addInitScript(
      ({ key, payload }) => {
        localStorage.setItem(key, JSON.stringify(payload))
      },
      { key: SAVE_KEY, payload: advanced },
    )
    await page.reload()
    await reauthAndEnterHome(page)

    const restored = await saveAndRead(page)
    expect(restored.player.artifact?.artifactId).toBe('ngu_hanh_chau')

    await page.keyboard.press('Tab')
    const artifactSlot = page.locator('[data-wheel-slot="phap_bao"]')
    await expect(artifactSlot).toBeVisible({ timeout: 10_000 })
    await expect(artifactSlot).not.toHaveAttribute('aria-disabled', 'true')

    assertNoBrowserErrors(collected)
  })

  test('phap_tu/ngo_dao: linh_bao gate -> sealed card -> skill triple, no artifact', async ({ page }) => {
    test.setTimeout(240_000)
    const collected = collectBrowserErrors(page)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Ngộ Đạo')
    await enterHome(page)
    // requiresSkillCastLevel { linh_bao, 3 } reads skillCastCounts via
    // CAST_LEVELING_THRESHOLDS (lv3 = 10000 casts).
    await seedAndReload(page, { skillCastCounts: { linh_bao: LINH_BAO_L3_CASTS } })
    await winQuanKhiAndOpenRitual(page)

    // The sealed hidden card appears for ngo_dao only.
    const hiddenCard = page.locator('.quan-khi-panel__hidden-card')
    await expect(hiddenCard).toHaveCount(1)
    await expect(hiddenCard).toContainText('Ngộ Đạo')

    await chooseWay(page, /Ngộ Đạo Chân Quyết/)

    const save = await saveAndRead(page)
    expect(save.player.realmId).toBe('qi_refining')
    expect(save.player.cultivationPath).toBe('phap_tu')
    expect(save.player.cultivationWay).toBe('ngo_dao')
    expect(save.techniques.find((t) => t.id === 'ngo_dao_chan_quyet')?.equipped).toBe(true)

    const learnedIds = save.skills.map((skill) => skill.id)
    expect(learnedIds).toContain('van_phap_tuy_tam')
    expect(learnedIds).toContain('da_phap_lien_tuyen')
    expect(learnedIds).toContain('ngo_dao_hon_don')

    // ngo_dao owns no element tree.
    await page.keyboard.press('Tab')
    const skillSlot = page.locator('[data-wheel-slot="skill"]')
    await expect(skillSlot).toBeVisible({ timeout: 10_000 })
    await skillSlot.click()
    await expect(page.locator('.skill-path-panel')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.skill-path-panel__element-tabs')).toHaveCount(0)

    // F1 oracle (negative): at foundation_establishment the way grants
    // NO artifact — restore must not manufacture ngu_hanh_chau and the
    // phap_bao slot stays disabled.
    const current = await readSave(page)
    const advanced = {
      ...current!,
      player: { ...current!.player, realmId: 'foundation_establishment', realmLevel: 1 },
    }
    await page.addInitScript(
      ({ key, payload }) => {
        localStorage.setItem(key, JSON.stringify(payload))
      },
      { key: SAVE_KEY, payload: advanced },
    )
    await page.reload()
    await reauthAndEnterHome(page)

    const restored = await saveAndRead(page)
    expect(restored.player.artifact).toBeUndefined()

    await page.keyboard.press('Tab')
    const artifactSlot = page.locator('[data-wheel-slot="phap_bao"]')
    await expect(artifactSlot).toBeVisible({ timeout: 10_000 })
    await expect(artifactSlot).toHaveAttribute('aria-disabled', 'true')

    assertNoBrowserErrors(collected)
  })

  test('the_tu/hien: ritual -> kit resolution', async ({ page }) => {
    test.setTimeout(210_000)
    const collected = collectBrowserErrors(page)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Thể Hiển')
    await enterHome(page)
    await seedAndReload(page, {})
    await winQuanKhiAndOpenRitual(page)

    await chooseWay(page, /Kim Cang Bất Hoại Thể/)

    const save = await saveAndRead(page)
    expect(save.player.realmId).toBe('qi_refining')
    expect(save.player.cultivationPath).toBe('the_tu')
    expect(save.player.cultivationWay).toBe('hien')
    expect(save.techniques.find((t) => t.id === 'kim_cang_bat_hoai_the')?.equipped).toBe(true)

    assertNoBrowserErrors(collected)
  })

  test('the_tu/ung_the: huy_quyen gate -> ritual entry', async ({ page }) => {
    test.setTimeout(210_000)
    const collected = collectBrowserErrors(page)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Ứng Thế')
    await enterHome(page)
    // requiresSkillLevel { huy_quyen, 3 } reads player.skillLevels.
    await seedAndReload(page, { skillLevels: { huy_quyen: 3 } })
    await winQuanKhiAndOpenRitual(page)

    // 3 base + ung_the.
    await expect(page.locator('.quan-khi-panel__choice')).toHaveCount(4)

    await chooseWay(page, /Ứng Thế Thần Quyết/)

    const save = await saveAndRead(page)
    expect(save.player.realmId).toBe('qi_refining')
    expect(save.player.cultivationPath).toBe('the_tu')
    expect(save.player.cultivationWay).toBe('ung_the')
    expect(save.techniques.find((t) => t.id === 'ung_the_than_quyet')?.equipped).toBe(true)

    assertNoBrowserErrors(collected)
  })
})
