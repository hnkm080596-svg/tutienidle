import { expect, test } from '@playwright/test'

import {
  assertNoBrowserErrors,
  bootToGuestHome,
  collectBrowserErrors,
  createCharacterThroughUi,
  enterHome,
  openSettingsAndSave,
  reauthAndEnterHome,
  waitForPresentationIdle,
} from './helpers'

/**
 * P13 wiring oracle for the tribulation flow — the e2e coverage F1 lacked.
 *
 * F1 (fix commit 5ea09d73) was a Critical soft-lock: App.vue's tick called
 * checkTribulationOutcomeAction WITHOUT the presentation argument, so a
 * finished tribulation applied its outcome but the coordinator never issued
 * request({ target: 'home' }) — the route stayed 'tribulation' forever and
 * home chrome never returned. The static guard lives in
 * tests/architecture/tribulationOutcomeWiring.test.ts; this spec drives the
 * whole loop in a real browser:
 *
 *   boot -> create character -> save -> seed realmLevel 12 (Quan Khi gate,
 *   CORE_REALM_LEVEL) -> reload -> RealmPanel -> "Quan Khi" -> confirm ->
 *   tribulation route mounts -> fast-forward the director -> outcome ->
 *   coordinator routes home -> home chrome (command wheel) returns and is
 *   usable again.
 *
 * Fast-forward seam (no new production surface): window.__tutienPhaserGame
 * is registered by PhaserCanvas.vue on every boot, and its Phaser registry
 * carries the real GameManager under the 'gameManager' gate key
 * (PresentationGate.ts REQUIRED_GATE_KEYS, seeded at PhaserCanvas.vue).
 * Calling tribulationDirector.update(seconds) runs the domain owner's own
 * closed catch-up loop — mind questions simply time out (counted as
 * failures) and lightning chapters burn through. update() self-guards while
 * the interactive session is held, so the poll retries until the
 * coordinator's release lands (phase 'idle' implies released).
 */
const SAVE_KEY = 'tien-hiep-idle-save'

// CORE_REALM_LEVEL (src/core/realm/realmSystem.ts) — minimum tier for the
// Quan Khi major breakthrough. The minor-tier ladder keeps working above
// it (mortal maxLevel is 18), so a seeded level-12 mortal stays eligible.
const BREAKTHROUGH_GATE_LEVEL = 12

// Fast-forward budget: the Quan Khi kiếp (mind 3 questions ~33s of timers +
// 15s lightning chapter) needs ~50s simulated; 600s covers any realm's
// chapter list with margin. The director's closed catch-up loop consumes
// only while state stays 'ongoing', so overshooting is harmless.
const FAST_FORWARD_SECONDS = 600

interface SaveShape {
  version: number
  player: {
    name: string
    realmId: string
    realmLevel: number
    cultivation: number
  }
}

/** Narrow read-only handle over the registry's GameManager (no `any`). */
interface TribulationDirectorHandle {
  update(deltaSeconds: number): void
  getState(): { state: 'ongoing' | 'victory' | 'defeat' } | null
}

interface GameManagerHandle {
  tribulationDirector: TribulationDirectorHandle
}

function readSave(page: import('@playwright/test').Page): Promise<SaveShape | null> {
  return page.evaluate(() => {
    // String literal — module constants do not serialize into evaluate.
    const raw = localStorage.getItem('tien-hiep-idle-save')

    return raw ? (JSON.parse(raw) as SaveShape) : null
  })
}

/**
 * Drive the tribulation director forward by FAST_FORWARD_SECONDS via the
 * existing window.__tutienPhaserGame -> registry 'gameManager' seam.
 * Returns the director state after the catch-up ('ongoing' while the
 * presentation hold still blocks updates, 'cleared' once the outcome tick
 * consumed it between polls).
 */
function advanceTribulation(
  page: import('@playwright/test').Page,
): Promise<string> {
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

test.describe('Tribulation flow (P13 oracle, F1 regression)', () => {
  test('completed tribulation routes home and restores usable home chrome', async ({ page }) => {
    test.setTimeout(210_000)

    const collected = collectBrowserErrors(page)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Độ Kiếp')
    await enterHome(page)

    // Save a real snapshot through the settings button (same path as
    // save-reload.spec.ts), then seed realmLevel = 12 so the Quan Khi gate
    // (realmLevel >= CORE_REALM_LEVEL) opens on the restored character.
    // cultivation resets to 0 so no minor-tier auto-breakthrough can fire
    // mid-test.
    await openSettingsAndSave(page)

    const saveBefore = await readSave(page)
    expect(saveBefore).not.toBeNull()
    expect(saveBefore!.player.realmId).toBe('mortal')

    const seededSave: SaveShape = {
      ...saveBefore!,
      player: {
        ...saveBefore!.player,
        realmLevel: BREAKTHROUGH_GATE_LEVEL,
        cultivation: 0,
      },
    }

    // addInitScript overwrites the pagehide autosave flush before the new
    // boot reads the save (same ordering contract as save-reload.spec.ts).
    await page.addInitScript(
      ({ key, payload }) => {
        localStorage.setItem(key, JSON.stringify(payload))
      },
      { key: SAVE_KEY, payload: seededSave },
    )

    await page.reload()
    await reauthAndEnterHome(page)

    // Command wheel (Tab) -> Cảnh Giới slot -> RealmPanel -> "Quan Khi".
    await page.keyboard.press('Tab')
    const realmSlot = page.locator('[data-wheel-slot="realm"]')
    await expect(realmSlot).toBeVisible({ timeout: 10_000 })
    await realmSlot.click()

    const realmDialog = page.getByRole('dialog', { name: 'Cảnh Giới' })
    await expect(realmDialog).toBeVisible({ timeout: 15_000 })

    const breakthroughButton = realmDialog.getByRole('button', { name: 'Quán Khí' })
    await expect(breakthroughButton).toBeEnabled({ timeout: 10_000 })
    await breakthroughButton.click()

    // BreakthroughRequirementPanel ("Độ kiếp cũng là độ thân...") -> confirm
    // "Đã hiểu" -> triggerBreakthrough() -> runAdmitted('tribulation').
    const confirmDialog = page.getByRole('dialog', { name: /Độ kiếp cũng là độ thân/ })
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 })
    await confirmDialog.getByRole('button', { name: 'Đã hiểu' }).click()

    // The tribulation route commits before the curtain reopens: the overlay
    // mounts once activeRoute is 'tribulation' AND the director has state.
    const tribulationUi = page.locator('.tribulation-ui')
    await expect(tribulationUi).toBeVisible({ timeout: 30_000 })

    // Phase 'idle' implies the session hold was released (coordinator step
    // 8), so director.update() below is no longer blocked.
    await waitForPresentationIdle(page)

    // Fast-forward to the outcome. Victory or defeat are both valid ends —
    // the oracle under test is the route-home wiring, not the survival
    // math. A fresh mortal at 'human' grade reliably survives the Quan Khi
    // lightning chapter, so this normally lands 'victory'.
    await expect
      .poll(() => advanceTribulation(page), {
        timeout: 30_000,
        message: 'TribulationDirector should reach victory/defeat once the session hold releases',
      })
      .toMatch(/victory|defeat|cleared/)

    // F1 oracle: the outcome tick must issue request({ target: 'home' }).
    // .command-wheel-layer only renders while the committed route is neither
    // 'combat' nor 'tribulation' (GameRoot.vue isFullSceneActive), so its
    // re-attachment IS the route-home witness — under F1 it never reappears.
    const wheelLayer = page.locator('.command-wheel-layer')
    try {
      await expect(wheelLayer).toBeAttached({ timeout: 30_000 })
    } catch (error) {
      // Diagnostic dump: coordinator phase/curtain, director state, scene
      // flags — tells a stuck transition apart from a consumed outcome.
      const diag = await page.evaluate(() => {
        const overlay = document.querySelector('[data-testid="presentation-overlay"]')
        const game = (window as Window & {
          __tutienPhaserGame?: {
            registry: { get(key: string): unknown }
            scene: { isActive(key: string): boolean }
          }
        }).__tutienPhaserGame
        const manager = game?.registry.get('gameManager') as GameManagerHandle | undefined
        return {
          phase: overlay?.getAttribute('data-phase'),
          curtain: overlay?.getAttribute('data-curtain'),
          tribulationState: manager?.tribulationDirector.getState()?.state ?? null,
          tribulationSceneActive: game?.scene.isActive('TribulationScene') ?? null,
          mainSceneActive: game?.scene.isActive('MainScene') ?? null,
          gameRootPresent: Boolean(document.querySelector('.game-root')),
          announcementVisible: Boolean(document.querySelector('.world-announcement')),
        }
      })
      console.log('DIAG:', JSON.stringify(diag))
      throw error
    }
    await expect(tribulationUi).toHaveCount(0)
    await waitForPresentationIdle(page)

    // The outcome's world announcement appears during the closed curtain
    // and auto-hides ~5s after show() (worldAnnouncement AUTO_CLOSE_MS).
    // It may already be gone on a slow machine, so click only if present,
    // then wait out the fade — no assertion on its visibility itself.
    const announcement = page.locator('.world-announcement')
    if (await announcement.isVisible()) {
      await announcement.click()
    }
    await expect(announcement).toHaveCount(0, { timeout: 15_000 })

    // Chrome is usable again, not just mounted. The outcome may have opened
    // a standalone panel over home (Quan Khi path-choice on victory;
    // RealmPanel stays open on defeat). OverlayPanel closes on a scrim
    // click (@click.self) — its Escape hook only fires while focus is
    // inside the card, and QuanKhiPanel's choice buttons are disabled
    // during the tribulation cooldown, so a corner click is reliable.
    const openPanel = page.locator('.overlay-panel')
    if (await openPanel.isVisible().catch(() => false)) {
      await openPanel.click({ position: { x: 8, y: 8 } })
      await expect(openPanel).toHaveCount(0, { timeout: 10_000 })
    }

    await page.keyboard.press('Tab')
    const realmSlotAfter = page.locator('[data-wheel-slot="realm"]')
    await expect(realmSlotAfter).toBeVisible({ timeout: 10_000 })
    await realmSlotAfter.click()

    await expect(page.getByRole('dialog', { name: 'Cảnh Giới' })).toBeVisible({ timeout: 15_000 })

    assertNoBrowserErrors(collected)
  })
})
