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
 * P3-M3 - production combat vertical slice through the real UI.
 *
 * Proves the spec's end-to-end loop on the canonical systems:
 *   ritual build select -> stage enter -> battle init -> aura grant ->
 *   fighting -> terminal -> reward settlement -> refight -> clean exit.
 *
 * Test 1 (victory loop) uses the ngo_dao build: the linh_bao-L3 gate is
 * seeded pre-battle (the loop itself is unpatched), the ritual grants the
 * real kit, and the aura grant at battle entry is asserted through
 * getBattleBuffs - the same read the combat UI uses.
 *
 * Test 2 (abandon loop) drives exit-confirm -> abandonBattle -> straight
 * home under the curtain -> re-enter -> natural terminal -> result panel
 * -> return-to-map. Abandon is NOT routed through the defeat panel
 * (exitCombatToHome goes home); natural-defeat terminal coverage lives at
 * engine level (GameManager.battleTeardown.test.ts), per the plan.
 *
 * The canvas exit-zone click -> 'combat_exit_request' edge is unit-covered
 * (CombatScene.hudWiring.test.ts); here the event is emitted through the
 * real eventBus so the DOM modal -> confirmExit -> abandonBattle chain
 * runs unpatched.
 */

const SAVE_KEY = GUEST_SAVE_KEY
const BREAKTHROUGH_GATE_LEVEL = 12
const FAST_FORWARD_SECONDS = 600
const LINH_BAO_L3_CASTS = 10_000

// page.evaluate returns serialized data - the live GameManager's methods
// do NOT cross the boundary. Every manager read below is a self-contained
// evaluate that resolves the manager from the registry inside the page and
// returns plain data only.
interface GameManagerHandle {
  activePlayer?: { completedStageIds?: string[] }
  getTurnBattle(): {
    state: string
    players: { entity: { id: string } }[]
    enemies: { entity: { id: string } }[]
    totalTurnsElapsed?: number
    roundsElapsed?: number
  } | null
  turnBattleOps: {
    isTurnBattleInProgress(): boolean
    getBattleBuffs(entityId: string): readonly { definitionId: string }[]
  }
  tribulationDirector?: {
    update(deltaSeconds: number): void
    getState(): { state: 'ongoing' | 'victory' | 'defeat' } | null
  }
  eventBus: { emit(type: string, payload: unknown): void }
}

type Page = import('@playwright/test').Page

// NOTE: page.evaluate serializes only the callback - helpers below inline
// the registry lookup so no outer-scope identifier leaks into the page.
function isBattleInProgress(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const game = (window as Window & {
      __tutienPhaserGame?: { registry: { get(key: string): unknown } }
    }).__tutienPhaserGame
    const manager = game?.registry.get('gameManager') as GameManagerHandle | undefined
    return manager?.turnBattleOps.isTurnBattleInProgress() ?? false
  })
}

function battleSnapshot(
  page: Page,
): Promise<{ state: string; players: number; enemies: number; turnsElapsed: number } | null> {
  return page.evaluate(() => {
    const game = (window as Window & {
      __tutienPhaserGame?: { registry: { get(key: string): unknown } }
    }).__tutienPhaserGame
    const manager = game?.registry.get('gameManager') as GameManagerHandle | undefined
    const battle = manager?.getTurnBattle()
    if (!battle) return null
    return {
      state: battle.state,
      players: battle.players.length,
      enemies: battle.enemies.length,
      turnsElapsed: battle.totalTurnsElapsed ?? 0,
    }
  })
}

function auraOnFirstPlayer(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const game = (window as Window & {
      __tutienPhaserGame?: { registry: { get(key: string): unknown } }
    }).__tutienPhaserGame
    const manager = game?.registry.get('gameManager') as GameManagerHandle | undefined
    const entityId = manager?.getTurnBattle()?.players?.[0]?.entity?.id
    if (entityId === undefined) return false
    return (manager?.turnBattleOps.getBattleBuffs(entityId) ?? []).some(
      (buff) => buff.definitionId === 'van_phap_than_hoa',
    )
  })
}

/** Seed fields onto the persisted player slice before reload. */
async function seedAndReload(
  page: import('@playwright/test').Page,
  playerPatch: Record<string, unknown>,
): Promise<void> {
  await openSettingsAndSave(page)

  const saveBefore = await page.evaluate(() => {
    const raw = localStorage.getItem('tien-hiep-idle-save:guest')
    return raw ? (JSON.parse(raw) as { player: Record<string, unknown> }) : null
  })
  expect(saveBefore).not.toBeNull()

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
    .poll(
      () =>
        page.evaluate((seconds) => {
          const game = (window as Window & {
            __tutienPhaserGame?: { registry: { get(key: string): unknown } }
          }).__tutienPhaserGame
          const director = (
            game?.registry.get('gameManager') as GameManagerHandle | undefined
          )?.tribulationDirector

          if (!director) {
            return 'missing-director'
          }

          director.update(seconds)

          return director.getState()?.state ?? 'cleared'
        }, FAST_FORWARD_SECONDS),
      {
        timeout: 30_000,
        message: 'TribulationDirector should reach victory/defeat once the session hold releases',
      },
    )
    .toMatch(/victory|defeat|cleared/)

  // M-F-TALENT: victory mints a mandatory talent entitlement that locks
  // the transition until resolved - pick the first offer before drain.
  const entitlementModal = page.locator('[data-testid="talent-entitlement-modal"]')
  const entitlementShown = await entitlementModal
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false)
  if (entitlementShown) {
    await entitlementModal.locator('button').first().click()
    await expect(entitlementModal).toHaveCount(0)
  }

  const wheelLayer = page.locator('.command-wheel-layer')
  await expect(wheelLayer).toBeAttached({ timeout: 30_000 })
  await expect(tribulationUi).toHaveCount(0)
  await waitForPresentationIdle(page)

  const ritualPanel = page.locator('.overlay-panel')
  await expect(ritualPanel).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.quan-khi-panel__choices')).toBeVisible()
}

async function chooseWay(page: import('@playwright/test').Page, wayNamePattern: RegExp): Promise<void> {
  const choice = page.getByRole('button', { name: wayNamePattern })
  await expect(choice).toBeEnabled({ timeout: 10_000 })
  await choice.click()

  const confirm = page.locator('.confirm-modal__confirm')
  await expect(confirm).toBeVisible({ timeout: 10_000 })
  await confirm.click()

  await expect(page.locator('.overlay-panel')).toHaveCount(0, { timeout: 10_000 })

  const announcement = page.locator('.world-announcement')
  if (await announcement.isVisible().catch(() => false)) {
    await announcement.click()
  }
  await expect(announcement).toHaveCount(0, { timeout: 15_000 })
}

/** Command wheel -> teleport array -> stage select -> start; returns
 * once a TurnBattle object exists (entry-phase state is already live). */
async function startStageOneBattle(page: import('@playwright/test').Page): Promise<void> {
  const teleportSlot = page.locator('[data-wheel-slot="teleport_array"]')
  if (!(await teleportSlot.isVisible().catch(() => false))) {
    await page.keyboard.press('Tab')
  }
  await expect(teleportSlot).toBeVisible({ timeout: 10_000 })
  await teleportSlot.click()

  const overlay = page.getByTestId('function-overlay-panel')
  await expect(overlay).toBeVisible({ timeout: 10_000 })

  const startButton = page.getByTestId('stage-start-button')
  await expect(startButton).toBeEnabled({ timeout: 10_000 })
  await startButton.click()

  await expect
    .poll(async () => (await battleSnapshot(page)) !== null, {
      timeout: 30_000,
      message: 'TurnBattle should exist shortly after stage start',
    })
    .toBe(true)
}

/** Emits the event the canvas exit-zone emits; the DOM exit-confirm
 * modal -> confirmExit -> abandonBattle chain runs for real. The combat
 * top bar gates readiness: CombatExitConfirmModal only listens once
 * CombatSceneOverlay mounts (v-if isCombatSceneActive) AND onExitRequest
 * requires ui.combatOrigin === 'stage' - emitting before the overlay is
 * up drops the event on the floor. */
async function abandonViaExitConfirm(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('.combat-top-bar')).toBeVisible({ timeout: 30_000 })

  // The modal subscribes in onMounted - a single emit can still land
  // before the listener registers (top-bar visibility does not order
  // the sibling's mount). The request is idempotent (each emit just
  // sets visible when combatOrigin === 'stage'), so retry until the
  // modal actually renders - same as a user pressing the exit zone
  // again.
  const exitModal = page.locator('.combat-exit-confirm')
  for (let attempt = 0; attempt < 10; attempt++) {
    await page.evaluate(() => {
      const game = (window as Window & {
        __tutienPhaserGame?: { registry: { get(key: string): unknown } }
      }).__tutienPhaserGame
      const bus = game?.registry.get('eventBus') as
        | { emit(type: string, payload: unknown): void }
        | undefined
      bus?.emit('combat_exit_request', undefined)
    })
    try {
      await expect(exitModal).toBeVisible({ timeout: 2_000 })
      break
    } catch {
      if (attempt === 9) throw new Error('exit-confirm modal never opened after 10 emits')
    }
  }
  await exitModal.getByRole('button', { name: 'Thoát Trận' }).click()
}

test.describe('P3 — production combat vertical slice', () => {
  test('victory loop: ngo_dao ritual -> stage 1 -> aura -> victory -> reward -> refight -> clean exit', async ({
    page,
  }) => {
    // Ritual setup (~90s) + up to 2 battle attempts (~180s each worst
    // measured) + refight + exit assertions.
    test.setTimeout(600_000)
    const collected = collectBrowserErrors(page)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Vertical Slice')
    await enterHome(page)
    await seedAndReload(page, { skillCastCounts: { linh_bao: LINH_BAO_L3_CASTS } })
    await winQuanKhiAndOpenRitual(page)
    await chooseWay(page, /Ngộ Đạo Chân Quyết/)

    await startStageOneBattle(page)

    // Enemies spawn during intro (3s spawn interval) - poll for the
    // first spawn rather than reading the just-minted battle.
    await expect
      .poll(async () => (await battleSnapshot(page))?.enemies ?? 0, {
        timeout: 30_000,
        message: 'first enemy wave should spawn during intro',
      })
      .toBeGreaterThan(0)

    // Battle init: players + enemies minted through resolveCombatBuild.
    const init = await page.evaluate(() => {
      const game = (window as Window & {
        __tutienPhaserGame?: { registry: { get(key: string): unknown } }
      }).__tutienPhaserGame
      const manager = game?.registry.get('gameManager') as GameManagerHandle | undefined
      const battle = manager?.getTurnBattle()

      return {
        inProgress: manager?.turnBattleOps.isTurnBattleInProgress() ?? false,
        players: battle?.players.length ?? 0,
        enemies: battle?.enemies.length ?? 0,
      }
    })
    expect(init.inProgress).toBe(true)
    expect(init.players).toBeGreaterThan(0)
    expect(init.enemies).toBeGreaterThan(0)

    // Aura grant at entry (ngo_dao capability -> runtime-owned grant).
    await expect
      .poll(async () => auraOnFirstPlayer(page), {
        timeout: 30_000,
        message: 'van_phap_than_hoa should be granted at battle entry',
      })
      .toBe(true)

    // Run to terminal. A qi_refining ngo_dao build should clear stage 1
    // most runs; a defeat is still legitimate - retry once and require a
    // victory across the two attempts (also exercises the defeat->retry
    // teardown organically).
    const victory = page.locator('.combat-victory-panel')
    const defeat = page.locator('.combat-defeat-panel')
    const result = victory.or(defeat)

    let won = false
    for (let attempt = 0; attempt < 2 && !won; attempt++) {
      await expect(result).toBeVisible({ timeout: 240_000 })
      if (await victory.isVisible()) {
        won = true
      } else {
        await page.locator('.combat-defeat-panel__retry').click()
        await expect(result).toBeHidden({ timeout: 15_000 })
      }
    }
    expect(won, 'ngo_dao build should clear stage 1 within two attempts').toBe(true)

    // Reward settlement (no loot internals): the stage is marked complete
    // on the live player record.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = (window as Window & {
              __tutienPhaserGame?: { registry: { get(key: string): unknown } }
            }).__tutienPhaserGame
            const manager = game?.registry.get('gameManager') as GameManagerHandle | undefined
            return manager?.activePlayer?.completedStageIds?.includes('mortal_dong_1') ?? false
          }),
        { timeout: 15_000, message: 'victory should mark mortal_dong_1 complete' },
      )
      .toBe(true)

    // Refight from the victory panel -> clean cycle. Capture the
    // WINNING battle's live reference immediately before retry: the
    // first attempt may have been a defeat, so identity must be checked
    // against the terminal object the victory panel actually belongs
    // to, not the battle minted at stage entry.
    await page.evaluate(() => {
      const w = window as unknown as { __vsWinningBattle?: unknown }
      const game = (window as Window & {
        __tutienPhaserGame?: { registry: { get(key: string): unknown } }
      }).__tutienPhaserGame
      const manager = game?.registry.get('gameManager') as GameManagerHandle | undefined
      w.__vsWinningBattle = manager?.getTurnBattle() ?? null
    })
    await page.locator('.combat-victory-panel__retry').click()
    await expect(result).toBeHidden({ timeout: 15_000 })
    await expect
      .poll(async () => isBattleInProgress(page), {
        timeout: 30_000,
        message: 'refight should mint a fresh in-progress battle',
      })
      .toBe(true)

    // Battle 2 is a NEW instance (not the retained winning terminal
    // object) with reset turn/round counters and the entry aura
    // re-granted.
    const fresh = await page.evaluate(() => {
      const w = window as unknown as { __vsWinningBattle?: unknown }
      const game = (window as Window & {
        __tutienPhaserGame?: { registry: { get(key: string): unknown } }
      }).__tutienPhaserGame
      const manager = game?.registry.get('gameManager') as GameManagerHandle | undefined
      const battle = manager?.getTurnBattle()
      const entityId = battle?.players?.[0]?.entity?.id
      const aura =
        entityId !== undefined &&
        (manager?.turnBattleOps.getBattleBuffs(entityId) ?? []).some(
          (buff) => buff.definitionId === 'van_phap_than_hoa',
        )

      return {
        newInstance: battle !== null && battle !== w.__vsWinningBattle,
        turnsElapsed: battle?.totalTurnsElapsed ?? 0,
        roundsElapsed: battle?.roundsElapsed ?? 0,
        aura,
      }
    })
    expect(fresh.newInstance, 'refight must mint a fresh TurnBattle instance').toBe(true)
    expect(fresh.turnsElapsed, 'refight turn counter must start near zero').toBeLessThan(30)
    expect(fresh.roundsElapsed, 'refight round counter must start near zero').toBeLessThan(30)
    expect(fresh.aura, 'entry aura must be freshly re-granted on battle 2').toBe(true)

    // Clean exit: exit-confirm -> abandon -> straight home under the
    // curtain (exitCombatToHome routes home; the defeat panel only
    // appears on natural/engine defeat - abandon is not routed through
    // it). If the battle happens to END naturally before the exit modal
    // opens, whichever result panel is up takes us home instead. The
    // emit retries like abandonViaExitConfirm - the modal subscribes in
    // onMounted and a lone early emit can be dropped.
    const exitModal = page.locator('.combat-exit-confirm')
    const resultOrModal = exitModal.or(result)
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.evaluate(() => {
        const game = (window as Window & {
          __tutienPhaserGame?: { registry: { get(key: string): unknown } }
        }).__tutienPhaserGame
        const bus = game?.registry.get('eventBus') as
          | { emit(type: string, payload: unknown): void }
          | undefined
        bus?.emit('combat_exit_request', undefined)
      })
      try {
        await expect(resultOrModal).toBeVisible({ timeout: 2_000 })
        break
      } catch {
        if (attempt === 9) {
          throw new Error('neither exit modal nor result panel appeared after 10 emits')
        }
      }
    }

    if (await exitModal.isVisible()) {
      await exitModal.getByRole('button', { name: 'Thoát Trận' }).click()
    } else {
      // Battle ended before the exit modal won focus - leave via the
      // result panel's own exit control.
      if (await victory.isVisible()) {
        await page.locator('.combat-victory-panel__continue').click()
      } else {
        await page.locator('.combat-defeat-panel__return').click()
      }
    }

    await expect(page.locator('.command-wheel-layer')).toBeAttached({ timeout: 30_000 })
    await expect
      .poll(async () => isBattleInProgress(page), {
        timeout: 15_000,
        message: 'no battle should be in progress after exit',
      })
      .toBe(false)

    assertNoBrowserErrors(collected)
  })

  test('abandon loop: stage -> exit-confirm -> abandon -> home -> re-enter -> terminal -> return', async ({
    page,
  }) => {
    // Setup (~40s) + battle-1 abandon + natural terminal wait (~180s
    // worst measured for a fresh mortal on stage 1) + refight + exit.
    test.setTimeout(420_000)
    const collected = collectBrowserErrors(page)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Abandon Slice')
    await enterHome(page)
    await startStageOneBattle(page)

    // Battle 1 in progress -> abandon through the exit-confirm modal.
    expect(await isBattleInProgress(page)).toBe(true)

    await abandonViaExitConfirm(page)

    // Abandon terminal: engine forced to defeat and the exit routes
    // STRAIGHT HOME under the curtain (exitCombatToHome) - the defeat
    // panel is the natural-defeat surface, not the abandon surface.
    await expect(page.locator('.command-wheel-layer')).toBeAttached({ timeout: 30_000 })
    // The curtain is still settling when the wheel layer reattaches -
    // Tab would be swallowed mid-transition, so wait for idle before
    // re-entering a stage.
    await waitForPresentationIdle(page)
    const abandoned = await page.evaluate(() => {
      const game = (window as Window & {
        __tutienPhaserGame?: { registry: { get(key: string): unknown } }
      }).__tutienPhaserGame
      const manager = game?.registry.get('gameManager') as GameManagerHandle | undefined
      return {
        state: manager?.getTurnBattle()?.state,
        inProgress: manager?.turnBattleOps.isTurnBattleInProgress(),
      }
    })
    expect(abandoned.state).toBe('defeat')
    expect(abandoned.inProgress).toBe(false)

    // Re-enter -> fresh battle 2 -> run to a natural terminal (a fresh
    // mortal on stage 1 reliably loses, but victory is accepted - the
    // assertion is that A terminal + its panel renders).
    await startStageOneBattle(page)
    await expect
      .poll(async () => isBattleInProgress(page), {
        timeout: 30_000,
        message: 're-entry should mint a fresh in-progress battle',
      })
      .toBe(true)

    const victory = page.locator('.combat-victory-panel')
    const defeat = page.locator('.combat-defeat-panel')
    await expect(victory.or(defeat)).toBeVisible({ timeout: 180_000 })
    expect(await isBattleInProgress(page)).toBe(false)

    // Return to map through whichever result panel surfaced.
    if (await victory.isVisible()) {
      await page.locator('.combat-victory-panel__continue').click()
    } else {
      await page.locator('.combat-defeat-panel__return').click()
    }
    await expect(page.locator('.command-wheel-layer')).toBeAttached({ timeout: 30_000 })
    expect(await isBattleInProgress(page)).toBe(false)

    assertNoBrowserErrors(collected)
  })
})
