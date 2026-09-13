/// <reference lib="dom" />
import { test, expect } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { bootToGuestHome, createCharacterThroughUi, enterHome } from './helpers'

/**
 * QA visual capture (2026-09-07) — Turn-Based Wave VFX.
 *
 * Bằng chứng 2 lớp:
 * 1. RUNTIME (chính xác): event-bus listener đếm trực tiếp — countdown
 *    progress tăng, pending wave telegraph queue ≥3, pending→live transition.
 * 2. VISUAL (trực quan): screenshot tại countdown (party telegraph — window
 *    dài 3s, chụp kịp chắc chắn) và sau materialize. Wave telegraph window
 *    chỉ 0.8s — screenshot headless chậm hơn nên không chụp kịp; thay vào đó
 *    GHI LOG timestamp mỗi lần pending>0 (bằng chứng runtime) — người review
 *    xem ảnh countdown/materialize + số liệu log.
 */
test.describe('Turn-Based Wave VFX visual capture', () => {
  test('captures countdown/materialize screenshots + runtime wave telegraph proof', async ({ page }) => {
    test.setTimeout(180_000)

    const outDir = path.join(process.cwd(), 'test-results', 'wave-vfx-frames')
    fs.mkdirSync(outDir, { recursive: true })

    await bootToGuestHome(page)
    await createCharacterThroughUi(page, 'QA VFX Capture')
    await enterHome(page)

    await page.keyboard.press('Tab')
    const teleportSlot = page.locator('[data-wheel-slot="teleport_array"]')
    await expect(teleportSlot).toBeVisible({ timeout: 10_000 })
    await teleportSlot.click()
    const overlay = page.getByTestId('function-overlay-panel')
    await expect(overlay).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('stage-start-button')).toBeEnabled({ timeout: 10_000 })

    // Listener runtime — ghi log chi tiết pending timeline.
    await page.evaluate(() => {
      const w = window as unknown as {
        __tutienPhaserGame?: { registry: { get(key: string): unknown } }
        __vfxLive: {
          pending: number
          countdown: boolean
          countdownProgressMax: number
          pendingEvents: { at: number; count: number; progress: number }[]
          maxPending: number
        }
      }

      w.__vfxLive = {
        pending: 0,
        countdown: false,
        countdownProgressMax: 0,
        pendingEvents: [],
        maxPending: 0,
      }

      const game = w.__tutienPhaserGame
      if (!game) throw new Error('__tutienPhaserGame chưa expose')

      const bus = game.registry.get('eventBus') as {
        on(eventName: string, handler: (event: unknown) => void): void
      }
      if (!bus) throw new Error('eventBus chưa expose')

      bus.on('turn_battle_entity_snapshot', (raw) => {
        const event = raw as {
          pendingEnemySpawns?: { progress: number }[]
          countdownProgress?: number
        }
        const live = w.__vfxLive
        const pendingCount = event.pendingEnemySpawns?.length ?? 0

        live.pending = pendingCount
        live.countdown = event.countdownProgress !== undefined

        if (event.countdownProgress !== undefined) {
          live.countdownProgressMax = Math.max(live.countdownProgressMax, event.countdownProgress)
        }

        if (pendingCount > 0) {
          live.maxPending = Math.max(live.maxPending, pendingCount)
          if (live.pendingEvents.length < 100) {
            live.pendingEvents.push({
              at: Math.round(performance.now()),
              count: pendingCount,
              progress: event.pendingEnemySpawns![0]!.progress,
            })
          }
        }
      })
    })

    await page.getByTestId('stage-start-button').click()

    // (1) Countdown: poll flag → giữa countdown (1.2s) → chụp (window 3s
    // chắc chắn dính party telegraph).
    await expect
      .poll(
        async () =>
          page.evaluate(() => (window as unknown as { __vfxLive: { countdown: boolean } }).__vfxLive.countdown),
        { timeout: 20_000, intervals: [100] },
      )
      .toBe(true)
    await page.waitForTimeout(1_200)
    await page.screenshot({ path: path.join(outDir, 'visual-1-countdown-party-telegraph.png') })

    // Đợi đến khi wave 1 materialize (pending từng >0 rồi về 0) — poll qua
    // maxPending > 0 AND pending hiện tại === 0.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const live = (window as unknown as { __vfxLive: { maxPending: number; pending: number } }).__vfxLive
            return live.maxPending > 0 && live.pending === 0
          }),
        { timeout: 30_000, intervals: [100] },
      )
      .toBe(true)
    await page.screenshot({ path: path.join(outDir, 'visual-2-enemies-materialized.png') })

    // (2/3) Combat tiếp diễn — chụp 1 frame giữa trận (enemies live).
    await page.waitForTimeout(2_000)
    await page.screenshot({ path: path.join(outDir, 'visual-3-combat-in-progress.png') })

    // ===== Runtime proof (lớp bằng chứng chính xác) =====
    const live = await page.evaluate(() => {
      const w = window as unknown as {
        __vfxLive: {
          pending: number
          countdown: boolean
          countdownProgressMax: number
          pendingEvents: { at: number; count: number; progress: number }[]
          maxPending: number
        }
      }
      return w.__vfxLive
    })
    fs.writeFileSync(
      path.join(outDir, 'runtime-proof.json'),
      JSON.stringify(live, null, 2),
    )

    // Countdown telegraph được drive tới gần cuối (progress > 0.8 trước khi
    // chuyển fighting).
    expect(
      live.countdownProgressMax,
      'countdownProgress phải đạt gần 1 (telegraph party được update mỗi tick)',
    ).toBeGreaterThan(0.8)

    // Wave telegraph: pending xuất hiện với ≥3 quái đồng loạt (wave batch).
    expect(
      live.maxPending,
      'wave đầu phải queue đồng loạt ≥3 pending telegraph',
    ).toBeGreaterThanOrEqual(3)

    // Pending progress tăng dần (telegraph update mỗi tick, không kẹt).
    const first = live.pendingEvents[0]
    const last = live.pendingEvents[live.pendingEvents.length - 1]
    expect(
      last.progress - first.progress,
      'telegraph progress phải tăng qua các tick',
    ).toBeGreaterThan(0.1)

    // Bằng chứng ảnh tồn tại.
    for (const file of ['visual-1-countdown-party-telegraph.png', 'visual-2-enemies-materialized.png', 'visual-3-combat-in-progress.png']) {
      expect(fs.existsSync(path.join(outDir, file)), `${file} phải tồn tại`).toBe(true)
    }
  })
})
