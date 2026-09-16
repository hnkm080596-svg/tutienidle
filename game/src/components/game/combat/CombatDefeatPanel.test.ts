// @vitest-environment jsdom
// 9.6 — DefeatPanel 10s auto-return-home fallback: 10 giây không tương
// tác → tự về Động Phủ (combat_scene_exit + battleRunMode=manual), giống
// fallback đã hứa trong comment panel (dùng useAutoRetryCountdown(10)
// chạy song song nhánh 3s auto-refight).
// Mount theo pattern project (createApp + h + provide, KHÔNG
// @vue/test-utils — chưa cài).
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import CombatDefeatPanel from './CombatDefeatPanel.vue'
import { useUiStore } from '@/stores/ui'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'

interface MockGameManager {
  getBattleRewardSummary: ReturnType<typeof vi.fn>
  catalogOps: { getStage: ReturnType<typeof vi.fn> }
  eventBus: { emit: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> }
}

function makeGameManager(): MockGameManager {
  const eventBus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() }

  return {
    getBattleRewardSummary: vi.fn(() => ({
      techniqueInsight: 0,
      skillInsight: 0,
      artifactInsight: 0,
      spiritStone: 0,
      items: [],
    })),
    catalogOps: { getStage: vi.fn(() => undefined) },
    eventBus,
  }
}

function mountPanel(gm: MockGameManager, battleRunMode: 'manual' | 'repeat' = 'manual') {
  const container = document.createElement('div')

  document.body.appendChild(container)

  const app = createApp({ render: () => h(CombatDefeatPanel) })

  const pinia = createPinia()

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gm as unknown as import('@/core/game/GameManager').GameManager)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})

  app.mount(container)

  const ui = useUiStore(pinia)

  ui.battleRunMode = battleRunMode

  return {
    container,
    ui,
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
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('CombatDefeatPanel — 9.6 10s auto-return-home fallback', () => {
  it('10s không tương tác → returnHome tự động (combat_scene_exit + manual)', async () => {
    vi.useFakeTimers()
    const gm = makeGameManager()
    const panel = mountPanel(gm, 'manual')

    await vi.advanceTimersByTimeAsync(10_000)
    await nextTick()

    expect(panel.ui.battleRunMode).toBe('manual')
    expect(gm.eventBus.emit).toHaveBeenCalledWith('combat_scene_exit', undefined)

    panel.unmount()
  })

  it('chỉ 3s trôi KHÔNG trigger returnHome (nhánh 3s chỉ chuẩn bị refight, không exit)', async () => {
    vi.useFakeTimers()
    const gm = makeGameManager()
    const panel = mountPanel(gm, 'repeat')

    await vi.advanceTimersByTimeAsync(3_000)
    await nextTick()

    expect(gm.eventBus.emit).not.toHaveBeenCalledWith('combat_scene_exit', undefined)
    expect(panel.ui.battleRunMode).toBe('repeat')

    panel.unmount()
  })

  it('bấm "Về Động Phủ" trước 10s → chỉ exit 1 lần, 10s sau KHÔNG trigger thêm', async () => {
    vi.useFakeTimers()
    const gm = makeGameManager()
    const panel = mountPanel(gm, 'manual')

    const t = (i18n.global as unknown as { t: (k: string) => string }).t

    const returnButton = Array.from(panel.container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(t('combat.defeat.returnHome')),
    )

    expect(returnButton).toBeDefined()

    returnButton!.click()
    await nextTick()

    expect(gm.eventBus.emit).toHaveBeenCalledWith('combat_scene_exit', undefined)

    await vi.advanceTimersByTimeAsync(15_000)
    await nextTick()

    expect(gm.eventBus.emit).toHaveBeenCalledTimes(1)

    panel.unmount()
  })
})

// B2-1 ruling (2026-09-14, user decision "giữ nguyên + hint"): floor 1
// intentionally cannot be cleared on first entry — the defeat panel
// carries the cultivate-then-fight hint instead of a retune. Hint
// switches copy by whether the player sits at/below the stage's
// required realm level (cultivation gate) vs above it (gear gap).
describe('CombatDefeatPanel — B2-1 progression hint', () => {
  it('player at/below requiredRealmLevel → cultivate hint', async () => {
    const gm = makeGameManager()
    gm.catalogOps.getStage.mockReturnValue({ id: 'mortal_dong_1', requiredRealmLevel: 5 })
    const panel = mountPanel(gm)
    panel.ui.selectedStageId = 'mortal_dong_1'
    await nextTick()

    const t = (i18n.global as unknown as { t: (k: string) => string }).t
    expect(panel.container.textContent).toContain(t('combat.defeat.hintCultivate'))

    panel.unmount()
  })

  it('player above requiredRealmLevel → gear/power hint', async () => {
    const gm = makeGameManager()
    // Player store defaults to mortal realmLevel 1 — a stage gating at
    // level 0/undefined means the loss is not a cultivation gap.
    gm.catalogOps.getStage.mockReturnValue({ id: 'mortal_dong_1', requiredRealmLevel: 0 })
    const panel = mountPanel(gm)
    panel.ui.selectedStageId = 'mortal_dong_1'
    await nextTick()

    const t = (i18n.global as unknown as { t: (k: string) => string }).t
    expect(panel.container.textContent).toContain(t('combat.defeat.hintGear'))

    panel.unmount()
  })
})
