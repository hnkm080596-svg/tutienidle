// @vitest-environment jsdom
// 6A-T7 (2026-09-01) — slider Nhịp Tụ Lực + Ult button migrate từ
// CombatControlBar sang KiemTuCombatHud (ControlBar sẽ bị xóa T8).
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import KiemTuCombatHud from './KiemTuCombatHud.vue'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'

interface MockGameManager {
  battleSystem: {
    setChannelTickSeconds: ReturnType<typeof vi.fn>
    tryPlayerUltimate: ReturnType<typeof vi.fn>
    ultAutoEnabled: boolean
  }
  getBattle: ReturnType<typeof vi.fn>
  skillManager: {
    get: ReturnType<typeof vi.fn>
    getLoadoutEntries: ReturnType<typeof vi.fn>
    getEquippedInSlot: ReturnType<typeof vi.fn>
  }
}

function makeGameManager(ultUnlocked = true): MockGameManager {
  return {
    battleSystem: {
      setChannelTickSeconds: vi.fn(),
      tryPlayerUltimate: vi.fn(),
      ultAutoEnabled: true,
    },
    // Battle null: loadout computed trả [] (an toàn, primary undefined);
    // UI ult click test sẽ override bằng battle có player.kiemThe đủ.
    getBattle: vi.fn(() => null),
    skillManager: {
      get: vi.fn((id: string) => ({ unlocked: ultUnlocked })),
      getLoadoutEntries: vi.fn(() => []),
      getEquippedInSlot: vi.fn(() => undefined),
    },
  }
}

const ULT_BATTLE = {
  state: 'fighting',
  player: {
    currentKiemThe: 100,
    tuLucActive: false,
    tuLucElapsed: 0,
  },
}

function mountHud(gm: MockGameManager) {
  const pinia = createPinia()

  setActivePinia(pinia)

  // Set state TRƯỚC mount qua đúng pinia instance (onMounted đọc route
  // ngay lúc mount — set sau mount là muộn cho contract reset về 3).
  const appPlayer = usePlayerStore(pinia)
  const appUi = useUiStore(pinia)

  appPlayer.cultivationPath = 'kiem_tu'
  appPlayer.kiemTuRoute = 'bat_kiem'
  appUi.combatOrigin = 'stage'

  const container = document.createElement('div')

  document.body.appendChild(container)

  const version = ref(0)
  const app = createApp({ render: () => h(KiemTuCombatHud) })

  app.use(pinia)
  app.provide(GAME_MANAGER_KEY, gm as unknown as import('@/core/game/GameManager').GameManager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => {
    version.value += 1
  })

  app.mount(container)

  return {
    container,
    player: appPlayer,
    ui: appUi,
    clickButton: async (text: string) => {
      const button = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(text),
      )

      if (!button) {
        throw new Error(`button "${text}" không tồn tại`)
      }

      button.click()
      await nextTick()
    },
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('KiemTuCombatHud — slider + ult migrated (6A-T7)', () => {
  it('bat_kiem: slider Nhịp Tụ Lực render + input gọi setChannelTickSeconds', async () => {
    const gm = makeGameManager()
    const hud = mountHud(gm)

    await nextTick()

    const slider = hud.container.querySelector<HTMLInputElement>('#tu-luc-tick-slider')

    expect(slider, 'slider #tu-luc-tick-slider phải render cho bat_kiem').not.toBeNull()

    slider!.value = '5'
    slider!.dispatchEvent(new Event('input'))
    await nextTick()

    expect(gm.battleSystem.setChannelTickSeconds).toHaveBeenCalledWith('bat_kiem_thuat', 5)

    hud.unmount()
  })

  it('mount bat_kiem: reset tick về 3 + sync BattleSystem (contract cũ ControlBar)', () => {
    const gm = makeGameManager()

    mountHud(gm)

    expect(gm.battleSystem.setChannelTickSeconds).toHaveBeenCalledWith('bat_kiem_thuat', 3)
  })

  it('kiem_tran + ult learned: nút ult render, click → tryPlayerUltimate', async () => {
    const gm = makeGameManager()

    // Ult test cần battle thật-shape: TTKT cần player.currentKiemThe đủ cost.
    gm.getBattle.mockReturnValue(ULT_BATTLE)
    const hud = mountHud(gm)

    // Route đổi SAU mount: mountHud set bat_kiem mặc định — đổi sang
    // kiem_tran qua store reactive (v-if ult button re-render).
    hud.player.kiemTuRoute = 'kiem_tran'
    await nextTick()
    await nextTick()

    await hud.clickButton('Tru Tiên Kiếm Trận')

    expect(gm.battleSystem.tryPlayerUltimate).toHaveBeenCalledOnce()

    hud.unmount()
  })

  it('ult chưa learn: không render nút', async () => {
    const gm = makeGameManager(false)
    const hud = mountHud(gm)

    hud.player.kiemTuRoute = 'kiem_tran'
    await nextTick()

    const ultButton = Array.from(hud.container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Tru Tiên Kiếm Trận'),
    )

    expect(ultButton).toBeUndefined()

    hud.unmount()
  })
})
