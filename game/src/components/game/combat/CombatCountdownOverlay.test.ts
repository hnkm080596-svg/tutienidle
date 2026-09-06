// @vitest-environment jsdom
// Fix round 1 (2026-09-06, freeze-fix review) — coverage cho fix
// countdownSecondsRemaining/countdownTurnsRemaining trong
// CombatCountdownOverlay.vue. Trước fix, trận turn-based (đường DUY
// NHẤT còn dùng cho Stage) chỉ có countdownTurnsRemaining trên Battle
// → overlay đọc field countdownSecondsRemaining không tồn tại → luôn
// undefined → hiển thị "Xuất Trận!" ngay lập tức thay vì đếm 3,2,1
// (freeze KHÔNG xảy ra ở đây — bug này chỉ làm mất hiệu ứng đếm ngược,
// nhưng cùng LỚP lỗi "field không tồn tại đọc âm thầm ra undefined"
// như bug freeze đã fix — nên coverage bắt buộc, không để tái diễn).
// Mount theo pattern project (createApp + h + provide, KHÔNG
// @vue/test-utils — xem CombatExitConfirmModal.test.ts).
import { describe, expect, it, afterEach } from 'vitest'
import { createApp, h, ref } from 'vue'
import CombatCountdownOverlay from './CombatCountdownOverlay.vue'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'
import type { Battle } from '@/core/battle/Battle'
import type { GameManager } from '@/core/game/GameManager'

function t(key: string): string {
  return (i18n.global as unknown as { t: (k: string) => string }).t(key)
}

interface MockGameManager {
  getBattle: () => Partial<Battle> | null
}

function mountOverlay(battle: Partial<Battle> | null) {
  const container = document.createElement('div')

  document.body.appendChild(container)

  const app = createApp({ render: () => h(CombatCountdownOverlay) })

  const gm: MockGameManager = { getBattle: () => battle }

  app.provide(GAME_MANAGER_KEY, gm as unknown as GameManager)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})
  app.use(i18n)
  app.mount(container)

  return {
    container,
    number: () => container.querySelector('.combat-countdown-overlay__number')?.textContent ?? null,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CombatCountdownOverlay — countdown field fix (2026-09-06)', () => {
  it('trận turn-based (chỉ countdownTurnsRemaining) hiển thị đúng số giây quy đổi /10', () => {
    const overlay = mountOverlay({
      state: 'countdown',
      countdownTurnsRemaining: 30,
    } as Partial<Battle>)

    // 30 lượt / 10 = 3 giây → Math.ceil(3) = "3".
    expect(overlay.number()).toBe('3')

    overlay.unmount()
  })

  it('trận turn-based ở lượt cuối (1 lượt = 0.1s) vẫn hiển thị số dương, không nhảy thẳng "Xuất Trận!"', () => {
    const overlay = mountOverlay({
      state: 'countdown',
      countdownTurnsRemaining: 1,
    } as Partial<Battle>)

    // 1 lượt / 10 = 0.1 giây → Math.ceil(0.1) = 1.
    expect(overlay.number()).toBe('1')

    overlay.unmount()
  })

  it('trận legacy (countdownSecondsRemaining) vẫn ưu tiên đọc field giây thật', () => {
    const overlay = mountOverlay({
      state: 'countdown',
      countdownSecondsRemaining: 2,
      // Cố tình set cả countdownTurnsRemaining khác giá trị để chứng minh
      // field giây thật (legacy) được ưu tiên, không bị field lượt ghi đè.
      countdownTurnsRemaining: 999,
    } as Partial<Battle>)

    expect(overlay.number()).toBe('2')

    overlay.unmount()
  })

  it('countdownTurnsRemaining về 0 hiển thị "Xuất Trận!"', () => {
    const overlay = mountOverlay({
      state: 'countdown',
      countdownTurnsRemaining: 0,
    } as Partial<Battle>)

    expect(overlay.number()).toBe(t('combat.overlay.countdown.go'))

    overlay.unmount()
  })

  it('battle.state !== "countdown" → overlay không render', () => {
    const overlay = mountOverlay({
      state: 'fighting',
      countdownTurnsRemaining: 30,
    } as Partial<Battle>)

    expect(overlay.container.querySelector('.combat-countdown-overlay')).toBeNull()

    overlay.unmount()
  })
})
