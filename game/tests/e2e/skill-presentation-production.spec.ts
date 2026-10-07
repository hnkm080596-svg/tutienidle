import { expect, test } from './fixtures'
import { BETA_FEATURES } from '../../src/core/betaFeatureFlags'

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
 * Design-section 11 mandatory e2e: the skill presentation runtime on the REAL
 * production path (no dev lab): boot -> battle -> manual submit ->
 * skillVfxDebug shows cast -> impact ACK once -> resolved -> complete.
 *
 * Two legs in one test:
 *   1. melee basic (mortal 'tram' slash - an upright-space recipe) with a
 *      clean cancel/exit.
 *   2. hidden_sword_pathway 'ngu_kiem_thuat' (the way's only dynamic
 *      basic; requires the tram-core gate + the Van Kiem Quyet ritual).
 *
 * Asserted through CombatScene.skillVfxDebug (read-only diagnostics) plus
 * the action_impact observation feed and enemy HP deltas - never by
 * reaching into the runner.
 */

const SAVE_KEY = GUEST_SAVE_KEY
const BREAKTHROUGH_GATE_LEVEL = 12
const FAST_FORWARD_SECONDS = 600

// page.evaluate returns serialized data - the live GameManager's methods
// do NOT cross the boundary. Every read below resolves the manager (and
// the CombatScene for skillVfxDebug) from the registry inside the page.
interface GameManagerHandle {
  getTurnBattle(): {
    totalTurnsElapsed?: number
    enemies: { entity: { id: string; currentHp: number; alive: boolean } }[]
  } | null
  turnBattleOps: { isTurnBattleInProgress(): boolean }
  submitTurnChoice(choice: unknown): boolean
  setBattleManualMode(enabled: boolean): void
  eventBus: { on(type: string, handler: (payload: unknown) => void): void }
  tribulationDirector?: {
    update(deltaSeconds: number): void
    getState(): { state: 'ongoing' | 'victory' | 'defeat' } | null
  }
}

type Page = import('@playwright/test').Page

interface PresentationCounters {
  phases: { requestId: string | null; phase: string }[]
  casts: number
  impacts: number
  resolved: number
  lastCastRequestId: string | null
  impactsByRequest: Record<string, number>
  resolvedByRequest: Record<string, number>
  damageByRequest: Record<string, number>
}

type TestWindow = Window & {
  __tutienPhaserGame?: {
    registry: { get(key: string): unknown }
    scene: {
      getScene(key: string): {
        skillVfxDebug?: {
          playback: { phase: string; requestId: string | null; faultCount: number }
          pool: { active: number }
        }
      }
    }
  }
  __sp?: PresentationCounters
}

/** Current playback snapshot + pool lease count from the live scene. */
function playbackSnapshot(page: Page) {
  return page.evaluate(() => {
    const game = (window as TestWindow).__tutienPhaserGame
    const scene = game?.scene.getScene('CombatScene')
    const debug = scene?.skillVfxDebug
    return debug ? { ...debug.playback, poolActive: debug.pool.active } : null
  })
}

function isBattleInProgress(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const game = (window as TestWindow).__tutienPhaserGame
    const manager = game?.registry.get('gameManager') as GameManagerHandle | undefined
    return manager?.turnBattleOps.isTurnBattleInProgress() ?? false
  })
}

/** Sum of live enemy HP - a hit on any of them lowers the total once. */
function enemyHpTotal(page: Page): Promise<number> {
  return page.evaluate(() => {
    const game = (window as TestWindow).__tutienPhaserGame
    const manager = game?.registry.get('gameManager') as GameManagerHandle | undefined
    return (manager?.getTurnBattle()?.enemies ?? [])
      .filter((enemy) => enemy.entity.alive)
      .reduce((total, enemy) => total + enemy.entity.currentHp, 0)
  })
}

/**
 * Installs the in-page recorder: counts cast/impact/resolved emissions
 * (the requestId of the latest cast is kept so the submitted turn can be
 * picked out of the phase log), and appends every (requestId, phase)
 * transition of the runner's snapshot on a rAF poller.
 */
async function installPresentationRecorder(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as TestWindow
    const game = w.__tutienPhaserGame
    const manager = game?.registry.get('gameManager') as GameManagerHandle | undefined
    const scene = game?.scene.getScene('CombatScene')

    w.__sp = { phases: [], casts: 0, impacts: 0, resolved: 0, lastCastRequestId: null,
      impactsByRequest: {}, resolvedByRequest: {}, damageByRequest: {} }
    manager?.eventBus.on('skill_presentation_cast', (payload) => {
      w.__sp!.casts++
      w.__sp!.lastCastRequestId = (payload as { ref: { requestId: string } }).ref.requestId
    })
    manager?.eventBus.on('action_impact', () => {
      w.__sp!.impacts++
      // action_impact fires inside the owning playback's impact ACK window,
      // while the runner still reports that requestId as active. Per-request
      // counts make an enemy cast straddling the window unable to inflate or
      // steal this turn's tally.
      const requestId = scene?.skillVfxDebug?.playback.requestId
      if (requestId) {
        w.__sp!.impactsByRequest[requestId] = (w.__sp!.impactsByRequest[requestId] ?? 0) + 1
      }
    })
    manager?.eventBus.on('skill_presentation_resolved', (payload) => {
      w.__sp!.resolved++
      const requestId = (payload as { ref: { requestId: string } }).ref.requestId
      w.__sp!.resolvedByRequest[requestId] = (w.__sp!.resolvedByRequest[requestId] ?? 0) + 1
      // hpDamage is the applied HP delta (capped at remaining HP), so the
      // per-request sum equals the exact enemyHpTotal drop this cast caused.
      const groups = (payload as { groups?: { outcomes?: { kind: string; hpDamage?: number }[] }[] }).groups ?? []
      const damage = groups.reduce(
        (sum, group) => sum + (group.outcomes ?? []).reduce((s, outcome) => s + (outcome.kind === 'hit' ? outcome.hpDamage ?? 0 : 0), 0),
        0,
      )
      w.__sp!.damageByRequest[requestId] = (w.__sp!.damageByRequest[requestId] ?? 0) + damage
    })

    const record = () => {
      const snapshot = scene?.skillVfxDebug?.playback
      if (snapshot) {
        const last = w.__sp!.phases[w.__sp!.phases.length - 1]
        if (!last || last.requestId !== snapshot.requestId || last.phase !== snapshot.phase) {
          w.__sp!.phases.push({ requestId: snapshot.requestId, phase: snapshot.phase })
        }
      }
      requestAnimationFrame(record)
    }
    record()
  })
}

function readCounters(page: Page): Promise<PresentationCounters | undefined> {
  return page.evaluate(() => (window as TestWindow).__sp)
}

/**
 * Manual mode on, then poll submitTurnChoice until a player turn is
 * awaited and the pick is accepted (returns false while an enemy turn is
 * resolving - harmless no-op). Returns the submitted cast's requestId.
 *
 * skill_presentation_cast emits synchronously inside the accepted
 * submitTurnChoice call, so reading lastCastRequestId and the enemy HP
 * total in the SAME evaluate captures exactly the submitted cast and the
 * HP baseline at that instant - an accepted submit means every prior
 * turn's pipeline already finished, so nothing in flight can still
 * damage an enemy inside that call.
 */
async function submitManualChoice(
  page: Page,
  choice: unknown,
): Promise<{ requestId: string; hpBefore: number }> {
  await page.evaluate(() => {
    const game = (window as TestWindow).__tutienPhaserGame
    const manager = game?.registry.get('gameManager') as GameManagerHandle | undefined
    manager?.setBattleManualMode(true)
  })

  let submitted: { requestId: string; hpBefore: number } | null = null
  await expect
    .poll(
      async () => {
        if (submitted) return submitted
        submitted = await page.evaluate((submittedChoice) => {
          const game = (window as TestWindow).__tutienPhaserGame
          const manager = game?.registry.get('gameManager') as GameManagerHandle | undefined
          const accepted = manager?.submitTurnChoice(submittedChoice) ?? false
          if (!accepted) return null
          const requestId = (window as TestWindow).__sp?.lastCastRequestId
          if (!requestId) return null
          const hpBefore = (manager?.getTurnBattle()?.enemies ?? [])
            .filter((enemy) => enemy.entity.alive)
            .reduce((total, enemy) => total + enemy.entity.currentHp, 0)
          return { requestId, hpBefore }
        }, choice)
        return submitted
      },
      { timeout: 120_000, message: 'a player manual turn should accept the submitted choice' },
    )
    .not.toBeNull()
  return submitted!
}

/**
 * Asserts the production contract for one submitted cast:
 *  - exactly one playback ran for the requestId, ordered cast -> resolved
 *    ('waiting'/'resume' may compress out between rAF frames - not pinned)
 *  - the runner drained to idle afterwards
 *  - the action_impact and skill_presentation_resolved feeds each fired
 *    exactly once FOR THIS requestId - the counts are keyed per request,
 *    so an enemy cast straddling the window cannot inflate them
 *  - enemy HP dropped by exactly this request's summed hpDamage - the
 *    baseline was captured atomically at submit-accept and the resolved
 *    payload reports applied damage, so a dodge (hpDamage 0) expects zero
 *    drop and no straddling cast can slip through uncounted. No lease faults.
 */
async function assertSubmittedPlayback(
  page: Page,
  requestId: string,
  hpBefore: number,
): Promise<void> {
  // Impact ACK once -> resolved -> the runner drains back to idle with
  // every lease released. The idle + poolActive observation must be ONE
  // evaluate: the next turn's cast may legitimately start between two
  // separate reads and look like a stranded lease on this playback.
  await expect
    .poll(
      async () => {
        const snapshot = await playbackSnapshot(page)
        return snapshot?.phase === 'idle' && snapshot.poolActive === 0 ? snapshot : null
      },
      {
        timeout: 30_000,
        message: `playback ${requestId} should drain back to idle with all leases released`,
      },
    )
    .not.toBeNull()

  const counters = (await readCounters(page))!
  const forRequest = counters.phases.filter((entry) => entry.requestId === requestId)
  const order = forRequest.map((entry) => entry.phase)
  expect(order[0], `first phase for ${requestId}`).toBe('cast')
  expect(order.filter((phase) => phase === 'cast'), 'one cast phase').toHaveLength(1)
  expect(order.filter((phase) => phase === 'resolved'), 'one resolved phase').toHaveLength(1)
  expect(order.indexOf('resolved')).toBeGreaterThan(order.indexOf('cast'))

  // Complete: an 'idle' entry follows this request's last phase entry.
  const lastIndex = counters.phases.lastIndexOf(forRequest[forRequest.length - 1]!)
  expect(counters.phases.slice(lastIndex).some((entry) => entry.phase === 'idle')).toBe(true)

  expect(counters.impactsByRequest[requestId] ?? 0, 'impact ACK feed fired exactly once').toBe(1)
  expect(counters.resolvedByRequest[requestId] ?? 0, 'resolved feed fired exactly once').toBe(1)
  const expectedDrop = counters.damageByRequest[requestId] ?? 0
  expect(await enemyHpTotal(page), 'enemy HP drop equals the request\'s resolved damage').toBe(hpBefore - expectedDrop)
  // faultCount is cumulative and monotone - safe to read after the drain.
  expect((await playbackSnapshot(page))?.faultCount ?? -1).toBe(0)
}

/** Seed fields onto the persisted player slice before reload. */
async function seedAndReload(page: Page, playerPatch: Record<string, unknown>): Promise<void> {
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
      nodeLevels: {
        ...((saveBefore!.player.nodeLevels as Record<string, number> | undefined) ?? {}),
        ...((playerPatch.nodeLevels as Record<string, number> | undefined) ?? {}),
      },
      purchasedNodeIds: [
        ...((saveBefore!.player.purchasedNodeIds as string[] | undefined) ?? []),
        ...((playerPatch.purchasedNodeIds as string[] | undefined) ?? []),
      ],
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

/** Quan Khi tribulation -> victory, leaving the offer list on screen. */
async function winQuanKhiAndOpenRitual(page: Page): Promise<void> {
  await page.keyboard.press('`')
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
          const game = (window as TestWindow).__tutienPhaserGame
          const director = (
            game?.registry.get('gameManager') as GameManagerHandle | undefined
          )?.tribulationDirector
          if (!director) return 'missing-director'
          director.update(seconds)
          return director.getState()?.state ?? 'cleared'
        }, FAST_FORWARD_SECONDS),
      { timeout: 30_000 },
    )
    .toMatch(/victory|defeat|cleared/)

  const entitlementModal = page.locator('[data-testid="talent-entitlement-modal"]')
  const entitlementShown = await entitlementModal
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false)
  if (entitlementShown) {
    await entitlementModal.locator('button').first().click()
    await expect(entitlementModal).toHaveCount(0)
  }

  await expect(page.locator('.df-wheel')).toBeAttached({ timeout: 30_000 })
  await expect(tribulationUi).toHaveCount(0)
  await waitForPresentationIdle(page)

  await expect(page.locator('.overlay-panel')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.quan-khi-panel__choices')).toBeVisible()
}

/** Clicks a way card and confirms. */
async function chooseWay(page: Page, wayNamePattern: RegExp): Promise<void> {
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

/** Command wheel -> teleport array -> stage 1; returns once TurnBattle exists. */
async function startStageOneBattle(page: Page): Promise<void> {
  const teleportSlot = page.locator('[data-wheel-slot="teleport_array"]')
  if (!(await teleportSlot.isVisible().catch(() => false))) {
    await page.keyboard.press('`')
  }
  await expect(teleportSlot).toBeVisible({ timeout: 10_000 })
  await teleportSlot.click()

  const overlay = page.getByTestId('function-overlay-panel')
  await expect(overlay).toBeVisible({ timeout: 10_000 })

  const startButton = page.getByTestId('stage-start-button')
  await expect(startButton).toBeEnabled({ timeout: 10_000 })
  await startButton.click()

  await expect
    .poll(async () => isBattleInProgress(page), {
      timeout: 30_000,
      message: 'TurnBattle should exist shortly after stage start',
    })
    .toBe(true)
}

/** Emits the canvas exit-zone event; the DOM exit-confirm modal runs for real. */
async function abandonViaExitConfirm(page: Page): Promise<void> {
  await expect(page.locator('.combat-top-bar')).toBeVisible({ timeout: 30_000 })

  const exitModal = page.locator('.combat-exit-confirm')
  for (let attempt = 0; attempt < 10; attempt++) {
    await page.evaluate(() => {
      const game = (window as TestWindow).__tutienPhaserGame
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

test.describe('skill presentation runtime - production path (design section 11)', () => {
  test('melee basic + ngu_kiem_thuat: cast -> impact once -> resolved -> complete', async ({
    page,
  }) => {
    // ngu_kiem_thuat is a sword-path skill - scope-hidden under the beta lock.
    test.skip(!BETA_FEATURES.swordPath, 'swordPath scope-hidden under the beta lock')
    test.setTimeout(600_000)
    const collected = collectBrowserErrors(page)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Skill Presentation')
    await enterHome(page)

    // ---- Leg 1: melee basic on the mortal build ----
    await startStageOneBattle(page)
    await installPresentationRecorder(page)

    // Enemies spawn during the intro (3s spawn interval) - capture HP only
    // once at least one exists.
    await expect
      .poll(async () => enemyHpTotal(page), {
        timeout: 30_000,
        message: 'enemies should spawn during the battle intro',
      })
      .toBeGreaterThan(0)

    const melee = await submitManualChoice(page, 'basic')
    await assertSubmittedPlayback(page, melee.requestId, melee.hpBefore)

    // Next turn reachable: auto enemy turns keep casting through the same
    // runner while the player turn awaits input.
    const afterMelee = (await readCounters(page))!
    await expect
      .poll(async () => (await readCounters(page))!.casts, {
        timeout: 60_000,
        message: 'a subsequent cast should follow the completed turn',
      })
      .toBeGreaterThan(afterMelee.casts)

    // Cancel/exit path clean: exit-confirm -> abandon -> no battle.
    await abandonViaExitConfirm(page)
    await expect(page.locator('.df-wheel')).toBeAttached({ timeout: 30_000 })
    await expect.poll(async () => isBattleInProgress(page), { timeout: 15_000 }).toBe(false)

    // ---- Leg 2: ngu_kiem_thuat on hidden_sword_pathway ----
    // The curtain may still be animating after the abandon - settle it so
    // openSettingsAndSave's Tab actually opens the command wheel.
    await waitForPresentationIdle(page)
    await seedAndReload(page, { nodeLevels: { core_tram: 3 }, purchasedNodeIds: ['core_tram'] })
    await winQuanKhiAndOpenRitual(page)
    await chooseWay(page, /Vạn Kiếm Quyết/)

    await startStageOneBattle(page)
    await installPresentationRecorder(page)

    await expect
      .poll(async () => enemyHpTotal(page), {
        timeout: 30_000,
        message: 'enemies should spawn during the battle intro',
      })
      .toBeGreaterThan(0)

    const ngu = await submitManualChoice(page, { kind: 'dynamic_basic', defId: 'ngu_kiem_thuat' })
    await assertSubmittedPlayback(page, ngu.requestId, ngu.hpBefore)

    const afterNgu = (await readCounters(page))!
    await expect
      .poll(async () => (await readCounters(page))!.casts, {
        timeout: 60_000,
        message: 'combat should continue after the ngu turn',
      })
      .toBeGreaterThan(afterNgu.casts)

    await abandonViaExitConfirm(page)
    await expect.poll(async () => isBattleInProgress(page), { timeout: 15_000 }).toBe(false)

    assertNoBrowserErrors(collected)
  })
})
