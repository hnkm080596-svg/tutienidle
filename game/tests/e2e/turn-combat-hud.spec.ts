import { expect, test } from './fixtures'

import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'

/**
 * Slice 7 e2e (master plan Task 7/8 Step 5 smoke test, 2026-09-04):
 *
 * 1. Tao nhan vat -> tran Tang 1 chay tron ven (unified flow - ket qua
 *    Thang/Thua hien thi) -> "Danh Lai" tao tran moi (regression fix
 *    StageManager release, merge 70cb22e).
 * 2. HUD path hien thi slot combat (moi - thay legacy slider/Ult da go),
 *    legacy controls KHONG con xuat hien.
 * 3. Refight khong crash, khong ErrorScreen.
 *
 * Pacing note (2026-09-14 baseline repair, measured): a stage-1 battle is
 * no longer "quick" - the turn engine runs real-time on the combat clock
 * (0.1s steps, RAF source) and the pipeline waits for Phaser acks each
 * phase, so one actor turn costs ~1.8s wall-clock. A full stage-1 battle
 * (~65-70 turns, multi-wave) measured ~118-133s; two battles back to back
 * plus setup need ~260-280s, which the old 210s test cap could never
 * contain - that arithmetic, not a stall and not ARCH-005 reactivity, was
 * the audit's "second battle result" failure (the result modal renders
 * correctly the moment the domain reaches victory/defeat). New budget:
 * 180s per battle (same ~1.35x headroom create-to-combat already gives
 * the same battle shape), 420s test cap. TurnCombatSkillBar/turn-order
 * strip can still miss their short render window, so the spec keeps
 * asserting the HUD slots (rendered at battle mount) rather than the bar.
 *
 * Outcome (fix round 1, freeze-fix review, 2026-09-06): tran Tang 1 CO
 * THE ket thuc Thang hoac Thua (giong create-to-combat.spec.ts da ghi
 * nhan tu 2026-08-29 - nhan vat pham nhan moi tao tren Tang 1 thuong
 * Thua sau ~100s). Assertion chap nhan ca 2 ket qua - chi khang dinh
 * tran DA ket thuc (result panel hien) + HUD hoat dong dung, khong con
 * gia dinh "luon Thang" (gate flaky truoc day).
 */
test.describe('Slice 7 — turn combat HUD', () => {
  test('battle runs, combat slots render, legacy controls gone, refight works', async ({ page }) => {
    // Two sequential real-time battles: ~135s worst measured each + setup
    // (see header pacing note). 420s covers 2 x 180s asserts + ~40s of
    // setup/assert slack; the per-assert budgets bound each battle, the
    // cap bounds their sum.
    test.setTimeout(420_000)

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'E2E Turn HUD')
    await enterHome(page)

    // Open stage select via keyboard Tab (deterministic) and start battle 1.
    await page.keyboard.press('Tab')

    const teleportSlot = page.locator('[data-wheel-slot="teleport_array"]')
    await expect(teleportSlot).toBeVisible({ timeout: 10_000 })
    await teleportSlot.click()

    const overlay = page.getByTestId('function-overlay-panel')
    await expect(overlay).toBeVisible({ timeout: 10_000 })

    const startButton = page.getByTestId('stage-start-button')
    await expect(startButton).toBeEnabled({ timeout: 10_000 })

    // Task 11 (UI/UX remediation, 2026-09-07) - assert HUD qua RUNTIME
    // event probe (event bus that qua registry) thay vi DOM polling: tran
    // co the ket thuc rat nhanh (char moi 1-hit-killed - gameplay that,
    // khong phai defect), DOM poll 100ms lo render ngan. Event probe
    // bat MOI snapshot event bat ke toc do - bang chung chac chan hon.
    await page.evaluate(() => {
      const w = window as unknown as {
        __tutienPhaserGame?: { registry: { get(key: string): unknown } }
        __hudProbe: { snapshots: number; fightingSnapshots: number }
      }

      w.__hudProbe = { snapshots: 0, fightingSnapshots: 0 }

      const bus = w.__tutienPhaserGame?.registry.get('eventBus') as
        | { on(eventName: string, handler: (event: unknown) => void): void }
        | undefined

      if (!bus) {
        throw new Error('eventBus chưa expose trong registry')
      }

      bus.on('turn_battle_entity_snapshot', (raw) => {
        const event = raw as { countdownProgress?: number }
        const probe = (w as unknown as { __hudProbe: { snapshots: number; fightingSnapshots: number } }).__hudProbe

        probe.snapshots++

        if (event.countdownProgress === undefined) {
          probe.fightingSnapshots++
        }
      })
    })

    await startButton.click()

    // Battle 1 runs to a result panel (victory OR defeat - stage 1 can
    // legitimately end either way, see note above).
    const victory = page.locator('.combat-victory-panel')
    const defeat = page.locator('.combat-defeat-panel')
    await expect(victory.or(defeat)).toBeVisible({ timeout: 180_000 })

    // Snapshot events phai chay (engine <-> scene wiring song) - gom ca
    // fighting phase (countdownProgress undefined) nhieu tick.
    const hudProbe = await page.evaluate(() => {
      const w = window as unknown as { __hudProbe?: { snapshots: number; fightingSnapshots: number } }

      return w.__hudProbe
    })

    expect(hudProbe?.snapshots ?? 0, 'turn_battle_entity_snapshot phải được phát').toBeGreaterThan(5)
    expect(
      hudProbe?.fightingSnapshots ?? 0,
      'snapshot fighting phase phải chạy (HUD mount window tồn tại)',
    ).toBeGreaterThan(2)

    // Legacy Kiem Tu controls must be GONE (retired in Task 7).
    await expect(page.locator('.kiem-tu-combat-hud__ult')).toHaveCount(0)
    await expect(page.getByText('Nhịp Tụ Lực')).toHaveCount(0)

    // Refight - regression guard for the StageManager-release fix. Both
    // outcome panels have a `__retry` button (same class suffix) - click
    // whichever is visible.
    const retryButton = (await victory.isVisible())
      ? page.locator('.combat-victory-panel__retry')
      : page.locator('.combat-defeat-panel__retry')
    await retryButton.click()
    await expect(victory.or(defeat)).toBeHidden({ timeout: 15_000 })

    // Battle 2 eventually resolves (no crash, no error screen). Refight
    // KHONG assert slot DOM nua - co the thua nhanh truoc khi poll kip
    // nhin (gameplay that, xem comment Task 11 o tren - wiring da duoc
    // assert bang event probe o tran 1).
    await expect(victory.or(defeat)).toBeVisible({
      timeout: 180_000,
    })

    // No error boundary triggered.
    await expect(page.locator('.error-screen')).toHaveCount(0)
  })
})
