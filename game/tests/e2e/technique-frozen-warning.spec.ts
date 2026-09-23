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
 * M-F-TECHNIQUE (P14) - the BreakthroughRequirementPanel unperfected
 * warning rendered in a real browser.
 *
 * The warning mounts iff the held technique's projected completion is
 * below vien_man. This spec drives the real path end-to-end:
 *
 *   boot -> create -> save -> seed mortal realmLevel 12 -> reload ->
 *   Quan Khi ritual -> victory -> choose the phap tu way (grants
 *   five_elements_art, grade 1 rank 0, in-band at qi_refining) ->
 *   save -> seed realmLevel 12 + the Truc Co chapter-clear stage ->
 *   reload -> RealmPanel -> "Truc Co" -> BreakthroughRequirementPanel
 *   shows BOTH the still-equipped subtitle AND the unperfected
 *   technique warning (vi: "Tam phap canh 1 chua vien man (do dang)").
 *
 * A perfected live cycle is asserted by component tests only (jsdom);
 * this spec proves the panel wiring, the i18n interpolation, and the
 * realm-level projection seam under a real boot + restore.
 */
const SAVE_KEY = GUEST_SAVE_KEY
const BREAKTHROUGH_GATE_LEVEL = 12
const FAST_FORWARD_SECONDS = 600

// QI_REFINING_BREAKTHROUGH_STAGE_ID (src/core/realm/realmSystem.ts) -
// the Truc Co admission gate requires this chapter-final clear.
const QI_REFINING_BREAKTHROUGH_STAGE_ID = 'qi_refining_abyssal_pool'

interface SaveShape {
  version: number
  player: {
    name: string
    realmId: string
    realmLevel: number
    cultivation: number
    completedStageIds?: string[]
  }
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

/** Save, patch the persisted player slice, reload into the patched save. */
async function seedAndReload(
  page: import('@playwright/test').Page,
  expectedRealm: string,
  playerPatch: Record<string, unknown>,
): Promise<void> {
  await openSettingsAndSave(page)

  const saveBefore = await readSave(page)
  expect(saveBefore).not.toBeNull()
  expect(saveBefore!.player.realmId).toBe(expectedRealm)

  const seededSave = {
    ...saveBefore!,
    player: {
      ...saveBefore!.player,
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

async function openRealmDialog(page: import('@playwright/test').Page) {
  await page.keyboard.press('Tab')
  const realmSlot = page.locator('[data-wheel-slot="realm"]')
  await expect(realmSlot).toBeVisible({ timeout: 10_000 })
  await realmSlot.click()

  const realmDialog = page.getByRole('dialog', { name: 'Cảnh Giới' })
  await expect(realmDialog).toBeVisible({ timeout: 15_000 })
  return realmDialog
}

test.describe('BreakthroughRequirementPanel unperfected-technique warning (M-F-TECHNIQUE, P14)', () => {
  test('shows the frozen-cycle warning on the Trúc Cơ confirm while a technique is unperfected', async ({
    page,
  }) => {
    test.setTimeout(300_000)
    const collected = collectBrowserErrors(page)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Tâm Pháp')
    await enterHome(page)

    // Mortal at realmLevel 12 -> Quan Khi ritual -> victory -> way
    // choice grants five_elements_art (grade 1, rank 0) at qi_refining.
    await seedAndReload(page, 'mortal', { realmLevel: BREAKTHROUGH_GATE_LEVEL })

    let realmDialog = await openRealmDialog(page)
    const quanKhiButton = realmDialog.getByRole('button', { name: 'Quán Khí' })
    await expect(quanKhiButton).toBeEnabled({ timeout: 10_000 })
    await quanKhiButton.click()

    // Mortal confirm: no technique held -> exactly ONE warning line
    // (the still-equipped subtitle), no unperfected-technique line.
    let confirmDialog = page.getByRole('dialog', { name: /Độ kiếp cũng là độ thân/ })
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 })
    await expect(confirmDialog.locator('.breakthrough-confirm__warning')).toHaveCount(1)
    await confirmDialog.getByRole('button', { name: 'Đã hiểu' }).click()

    const tribulationUi = page.locator('.tribulation-ui')
    await expect(tribulationUi).toBeVisible({ timeout: 30_000 })
    await waitForPresentationIdle(page)

    await expect
      .poll(() => advanceTribulation(page), {
        timeout: 30_000,
        message: 'Quan Khi tribulation should resolve once the session hold releases',
      })
      .toMatch(/victory|defeat|cleared/)

    await expect(page.locator('.command-wheel-layer')).toBeAttached({ timeout: 30_000 })
    await expect(tribulationUi).toHaveCount(0)
    await waitForPresentationIdle(page)

    const announcement = page.locator('.world-announcement')
    if (await announcement.isVisible().catch(() => false)) {
      await announcement.click()
    }
    await expect(announcement).toHaveCount(0, { timeout: 15_000 })

    // QuanKhiPanel offer list -> the phap tu (spell_pathway) card
    // grants five_elements_art. Ngo Dao is gated and stays hidden
    // without its gate mirrors.
    const choice = page.getByRole('button', { name: /Đại Ngũ Hành Chân Quyết/ })
    await expect(choice).toBeEnabled({ timeout: 15_000 })
    await choice.click()

    const confirm = page.locator('.confirm-modal__confirm')
    await expect(confirm).toBeVisible({ timeout: 10_000 })
    await confirm.click()
    await expect(page.locator('.overlay-panel')).toHaveCount(0, { timeout: 10_000 })

    if (await announcement.isVisible().catch(() => false)) {
      await announcement.click()
    }
    await expect(announcement).toHaveCount(0, { timeout: 15_000 })

    // Now qi_refining with an unperfected (rank 0, in-band) technique:
    // seed the Truc Co admission pair (level 12 + chapter clear).
    await seedAndReload(page, 'qi_refining', {
      realmLevel: BREAKTHROUGH_GATE_LEVEL,
      completedStageIds: [QI_REFINING_BREAKTHROUGH_STAGE_ID],
    })

    realmDialog = await openRealmDialog(page)
    const trucCoButton = realmDialog.getByRole('button', { name: 'Trúc Cơ' })
    await expect(trucCoButton).toBeEnabled({ timeout: 10_000 })
    await trucCoButton.click()

    // P14 oracle: TWO warning lines - the still-equipped subtitle plus
    // the unperfected technique warning with its i18n interpolation.
    confirmDialog = page.getByRole('dialog', { name: /Độ kiếp cũng là độ thân/ })
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 })
    await expect(confirmDialog.locator('.breakthrough-confirm__warning')).toHaveCount(2)
    await expect(confirmDialog).toContainText('Tâm pháp cảnh 1 chưa viên mãn')
    await expect(confirmDialog).toContainText('dở dang')

    // Cancel out - confirming would consume the seeded state.
    await confirmDialog.getByRole('button', { name: 'Chờ đã' }).click()
    await expect(confirmDialog).toHaveCount(0, { timeout: 10_000 })

    assertNoBrowserErrors(collected)
  })
})
