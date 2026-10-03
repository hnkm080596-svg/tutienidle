import { expect, test, type Page } from './fixtures'
import { BETA_FEATURES } from '../../src/core/betaFeatureFlags'
import {
  bootToGuestHome,
  createCharacterThroughUi,
  enterHome,
  openSettingsAndSave,
  reauthAndEnterHome,
  waitForPresentationIdle,
  GUEST_SAVE_KEY,
} from './helpers'

/**
 * P14 verification (standing-slot plan Task 6 Step 7, 2026-09-07):
 * Tran Phap panel with the 3x3 standing-slot grid.
 *
 * Repaired 2026-09-13 (architecture-qa-repairs Task 7): the original spec
 * waited for the TEST-ONLY "Hon Don Tran" formation and a
 * `.tran-phap-panel__grant-test` button, both retired with that fixture.
 * The spec now runs against REAL content:
 *
 * - Formation: Cuu Cung Tran (cuu_cung_tran) opens all 9 standing slots -
 *   the same coverage the test formation provided.
 * - Companions: seeded into the save via the save-reload.spec.ts
 *   convention (snapshot a real save, inject player.companions, reapply
 *   through addInitScript so the post-reload boot restores them). No
 *   production code is mocked or gated.
 *
 * Flow:
 * 1. Create a character, drive the real Quan Khi ritual and commit a way
 *    (a non-mortal save must carry cultivationPath - the mortal-boundary
 *    contract rejects realm-only seeds, and the formation wheel slot is
 *    disabled below Truc Co). Then seed foundation_establishment + one
 *    real companion (ho_ly_tinh) onto the coherent qi_refining save,
 *    reload and re-authenticate.
 * 2. Open the panel, select Cuu Cung Tran, drag player + the companion
 *    into cells (real DragEvent dispatch -- native dragTo does not fire
 *    this codebase's Vue @dragstart/@drop handlers, see P14).
 * 3. Assert: no crash (Phaser.Game bootstrap with the missing physics
 *    config fix), 3x3 overlay grid (9 cells, not 36), occupied cells get
 *    the distinct green background class, Phaser canvas renders, and the
 *    confirmed loadout persists through the validating owner commit
 *    (gameManager.turnBattleOps.setFormationLoadout, F4).
 *
 * The webServer (DEV_PORT) is started/killed by playwright.config.ts.
 */
const SAVE_KEY = GUEST_SAVE_KEY
const BREAKTHROUGH_GATE_LEVEL = 12
const FAST_FORWARD_SECONDS = 600

// CompanionInstance (data/companion/Companions.ts) entry identical to what
// createCompanionInstance() produces on a real pull: mortal realmLevel 1,
// constellation rank 0. 'ho_ly_tinh' is a real COMPANIONS roster id, so
// saveShapeValidation accepts it and commitFormationLoadout counts it as a
// known combatant.
const SEEDED_COMPANION = {
  instanceId: 'e2e_companion_ho_ly_tinh',
  definitionId: 'ho_ly_tinh',
  realmId: 'mortal',
  realmLevel: 1,
  exp: 0,
  constellationRank: 0,
}

interface SaveShape {
  version: number
  player: {
    name: string
    realmId: string
    realmLevel: number
    cultivation: number
    companions: Array<Record<string, unknown>>
    formationLoadout: {
      formationId: string
      assignments: Array<{ row: number; column: number; combatantId: string }>
    } | null
  }
  techniques: Array<{
    id: string
    gradeHistory?: Record<number, { finalRank: number; completionState: string }>
  }>
}

interface TribulationDirectorHandle {
  update(deltaSeconds: number): void
  getState(): { state: 'ongoing' | 'victory' | 'defeat' } | null
}

interface GameManagerHandle {
  tribulationDirector: TribulationDirectorHandle
}

function readSave(page: Page): Promise<SaveShape | null> {
  return page.evaluate(() => {
    // String literal - module constants do not serialize into evaluate.
    const raw = localStorage.getItem('tien-hiep-idle-save:guest')

    return raw ? (JSON.parse(raw) as SaveShape) : null
  })
}

function advanceTribulation(page: Page): Promise<string> {
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
  page: Page,
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

// Native dragTo does not reach this codebase's Vue @dragstart/@drop
// handlers (P14): dispatch real DragEvents carrying one DataTransfer, then
// let Vue settle in a separate step.
async function dragCardToCell(page: Page, cardIndex: number, cellIndex: number): Promise<void> {
  await page.evaluate(
    ({ cardIndex: card, cellIndex: cell }) => {
      const cardEl = document.querySelectorAll('.tran-phap-panel__card')[card] as HTMLElement | undefined
      const target = document.querySelectorAll('.tran-phap-panel__cell')[cell] as HTMLElement | undefined

      if (!cardEl || !target) {
        throw new Error('card or cell missing')
      }

      const dataTransfer = new DataTransfer()
      cardEl.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }))
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }))
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }))
    },
    { cardIndex, cellIndex },
  )

  // Vue updates on the next microtask -- separate call (P14 gotcha).
  await page.waitForTimeout(300)
}

test.describe('Standing slot panel (P14)', () => {
  test('panel opens, drag-drop works without crash, 3x3 grid with distinct occupied state', async ({ page }) => {
    // The Tran Phap wheel slot is scope-hidden under the beta lock.
    test.skip(!BETA_FEATURES.formation, 'formation scope-hidden under the beta lock')
    test.setTimeout(300_000)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'P14 Slot Panel')
    await enterHome(page)

    // P7-M9: the Tran Phap wheel slot stays disabled below Truc Co
    // (isFormationUnlocked), and a non-mortal save must carry a real
    // cultivationPath - mortalBoundaryContractViolation rejects
    // realm-only seeds outright. Drive the real Quan Khi ritual from a
    // seeded realmLevel-12 mortal and commit the phap tu way, then bump
    // the coherent qi_refining save to foundation_establishment.
    await seedAndReload(page, 'mortal', { realmLevel: BREAKTHROUGH_GATE_LEVEL })

    // RealmPanel -> Quan Khi (same drive as technique-frozen-warning).
    await page.keyboard.press('Tab')
    const realmSlot = page.locator('[data-wheel-slot="realm"]')
    await expect(realmSlot).toBeVisible({ timeout: 10_000 })
    await realmSlot.click()

    const realmDialog = page.getByRole('dialog', { name: 'Cảnh Giới' })
    await expect(realmDialog).toBeVisible({ timeout: 15_000 })
    const quanKhiButton = realmDialog.getByRole('button', { name: 'Quán Khí' })
    await expect(quanKhiButton).toBeEnabled({ timeout: 10_000 })
    await quanKhiButton.click()

    const breakthroughConfirm = page.getByRole('dialog', { name: /Độ kiếp cũng là độ thân/ })
    await expect(breakthroughConfirm).toBeVisible({ timeout: 10_000 })
    await breakthroughConfirm.getByRole('button', { name: 'Đã hiểu' }).click()

    const tribulationUi = page.locator('.tribulation-ui')
    await expect(tribulationUi).toBeVisible({ timeout: 30_000 })
    await waitForPresentationIdle(page)

    await expect
      .poll(() => advanceTribulation(page), {
        timeout: 30_000,
        message: 'Quan Khi tribulation should resolve once the session hold releases',
      })
      .toMatch(/victory|defeat|cleared/)

    // M-F-TALENT: a settled breakthrough opens the blocking talent
    // entitlement dialog - the pick resolves it and home chrome returns.
    const entitlementModal = page.getByTestId('talent-entitlement-modal')
    await expect(entitlementModal).toBeVisible({ timeout: 30_000 })
    await entitlementModal
      .locator('[data-testid^="entitlement-talent-"], [data-testid^="entitlement-upgrade-"]')
      .first()
      .click()
    await expect(entitlementModal).toHaveCount(0, { timeout: 10_000 })

    await expect(page.locator('.command-wheel-layer')).toBeAttached({ timeout: 30_000 })
    await expect(tribulationUi).toHaveCount(0)
    await waitForPresentationIdle(page)

    const announcement = page.locator('.world-announcement')
    if (await announcement.isVisible().catch(() => false)) {
      await announcement.click()
    }
    await expect(announcement).toHaveCount(0, { timeout: 15_000 })

    // QuanKhiPanel offer list -> the phap tu (spell_pathway) card. Any
    // committed way satisfies the mortal-boundary contract; this one's
    // post-ritual save shape is the proven foundation-bump seed.
    const choice = page.getByRole('button', { name: /Đại Ngũ Hành Chân Quyết/ })
    await expect(choice).toBeEnabled({ timeout: 15_000 })
    await choice.click()

    // Beta initiation is atomic: element-axis ways commit on the element
    // pick itself - no generic confirm modal appears (spell_pathway is
    // the only beta-offerable way and it declares the element axis).
    const elementButton = page.locator('.quan-khi-panel__element-btn').first()
    await expect(elementButton).toBeVisible({ timeout: 10_000 })
    await elementButton.click()
    await expect(page.locator('.overlay-panel')).toHaveCount(0, { timeout: 10_000 })

    if (await announcement.isVisible().catch(() => false)) {
      await announcement.click()
    }
    await expect(announcement).toHaveCount(0, { timeout: 15_000 })

    // Bump the coherent qi_refining save to foundation_establishment and
    // inject the companion (same save-reload convention as before).
    await openSettingsAndSave(page)

    const saveBefore = await readSave(page)
    expect(saveBefore).not.toBeNull()
    expect(saveBefore!.player.realmId).toBe('qi_refining')

    const seededSave: SaveShape = {
      ...saveBefore!,
      player: {
        ...saveBefore!.player,
        companions: [{ ...SEEDED_COMPANION }],
        realmId: 'foundation_establishment',
        realmLevel: 1,
        cultivation: 0,
      },
      // M-F-TECHNIQUE (v75) save integrity: the realm bump leaves the
      // live grade lagging (grade 1 < realm index 2), so the seeded
      // save must carry the born-sealed grade-1 record the realm-exit
      // freeze seam would have written - without it restore rejects.
      techniques: saveBefore!.techniques.map((technique) => ({
        ...technique,
        gradeHistory: { 1: { finalRank: 0, completionState: 'partial' } },
      })),
    }

    // addInitScript runs BEFORE the new page's app JS on reload, so it
    // overwrites whatever the old page's pagehide autosave flush wrote.
    await page.addInitScript(
      ({ key, payload }) => {
        localStorage.setItem(key, JSON.stringify(payload))
      },
      { key: SAVE_KEY, payload: seededSave },
    )

    await page.reload()
    await reauthAndEnterHome(page)

    // Collect console errors (crash fix evidence) for the panel phase.
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })
    page.on('pageerror', (error) => {
      consoleErrors.push(`pageerror: ${String(error)}`)
    })

    // Open the command wheel and the formation panel.
    await page.keyboard.press('Tab')
    const formationSlot = page.locator('[data-wheel-slot="formation_slot"]')
    await expect(formationSlot).toBeVisible({ timeout: 10_000 })
    await formationSlot.click()

    const panel = page.locator('.tran-phap-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Select Cuu Cung Tran - the real formation that opens all 9 slots.
    await panel.locator('.tran-phap-panel__formation-button', { hasText: 'Cửu Cung Trận' }).click()

    // Grid must be 3x3 = 9 cells now (was 36 pre-rework).
    const cellCount = await panel.locator('.tran-phap-panel__cell').count()
    expect(cellCount, 'overlay grid must be 3x3 = 9 cells').toBe(9)

    // All 9 cells enabled (Cuu Cung Tran opens every slot).
    const enabledCount = await panel.locator('.tran-phap-panel__cell--enabled').count()
    expect(enabledCount).toBe(9)

    // Phaser canvas must exist underneath (scene bootstrap did not crash).
    // Generous timeout: the preview boots through a dynamic import('phaser'),
    // which a cold dev server pays vite dep-optimization for on first hit.
    const previewCanvas = panel.locator('.tran-phap-panel__preview-canvas canvas')
    try {
      await expect(previewCanvas).toBeVisible({ timeout: 30_000 })
    } catch (error) {
      const containerHtml = await panel
        .locator('.tran-phap-panel__preview-canvas')
        .evaluate((el) => el.innerHTML)
        .catch(() => '<container missing>')
      throw new Error(
        `preview canvas missing; container html: ${containerHtml.slice(0, 200)}; console so far: ${consoleErrors.join(' | ') || 'none'}`,
        { cause: error },
      )
    }

    // The seeded companion must show up as a queue card next to the player
    // card (proves the save-seed restored, no test-only grant hook needed).
    // Queue cards are shared SlotView slots with showLabel off (2026-09-15
    // nametag ruling): the id lives on the accessible name, not the text.
    const queueCards = panel.locator('.tran-phap-panel__card')
    await expect(queueCards).toHaveCount(2)
    await expect(queueCards.nth(1)).toHaveAttribute('aria-label', SEEDED_COMPANION.definitionId)

    // Drag the player card (queue index 0) into cell (1,1) = index 4.
    await dragCardToCell(page, 0, 4)

    // Exactly one occupied cell, and it carries the occupied class
    // (CSS state fix evidence: green background class present).
    const occupied = panel.locator('.tran-phap-panel__cell--occupied')
    await expect(occupied).toHaveCount(1)
    await expect(occupied).toContainText('player')

    // Sprite materialized on the Phaser canvas for the assignment
    // (syncAssignments ran -- canvas scene alive, no crash).
    const canvasStillAlive = await panel.locator('.tran-phap-panel__preview-canvas canvas').isVisible()
    expect(canvasStillAlive, 'Phaser canvas must still be alive after drop (crash fix)').toBe(true)

    // Drag the companion card (now the only queue card) into cell (0,0).
    await dragCardToCell(page, 0, 0)

    await expect(panel.locator('.tran-phap-panel__cell--occupied')).toHaveCount(2)

    // Save formation (confirm button enabled after assignments exist).
    const confirmButton = panel.locator('.tran-phap-panel__confirm')
    await expect(confirmButton).toBeEnabled()
    await confirmButton.click()

    // F4 oracle: the commit went through the validating owner, so a manual
    // save must persist the committed loadout verbatim. Escape closes the
    // panel (OverlayPanel onEscape -> ui.closeHomeOverlays) so the wheel
    // can open Settings.
    await page.keyboard.press('Escape')
    await expect(panel).not.toBeVisible({ timeout: 5_000 })

    await openSettingsAndSave(page)

    // player.save() resolves asynchronously - poll rather than read once.
    await expect
      .poll(async () => (await readSave(page))?.player.formationLoadout?.formationId, { timeout: 10_000 })
      .toBe('cuu_cung_tran')

    const saveAfter = await readSave(page)
    expect(saveAfter?.player.formationLoadout?.assignments).toEqual(
      expect.arrayContaining([
        { row: 1, column: 1, combatantId: 'player' },
        { row: 0, column: 0, combatantId: SEEDED_COMPANION.definitionId },
      ]),
    )

    // No crash anywhere: zero console errors / page errors.
    expect(consoleErrors, `unexpected console errors: ${consoleErrors.join(' | ')}`).toEqual([])
  })
})
