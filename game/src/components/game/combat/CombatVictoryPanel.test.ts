// @vitest-environment jsdom
// B4 (audit T1-5) — a Promise<boolean> is truthy, so the countdown's
// `if (!refight())` rollback never ran when a refight failed
// asynchronously: battleRunMode stayed armed and selectedStageId kept
// the advanced value. Mount harness mirrors CombatDefeatPanel.test.ts
// (createApp + h + provide — no @vue/test-utils).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import CombatVictoryPanel from './CombatVictoryPanel.vue'
import { useUiStore } from '@/stores/ui'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'
import { resolveNextProgressStage } from '@/core/stage/ProgressStageResolver'

vi.mock('@/core/stage/ProgressStageResolver', () => ({
  resolveNextProgressStage: vi.fn(),
}))

const resolveMock = vi.mocked(resolveNextProgressStage)

interface MockGameManager {
  getBattleRewardSummary: ReturnType<typeof vi.fn>
  catalogOps: {
    getStage: ReturnType<typeof vi.fn>
    isStageUnlocked: ReturnType<typeof vi.fn>
  }
  turnBattleOps: { startStage: ReturnType<typeof vi.fn> }
  abandonBattle: ReturnType<typeof vi.fn>
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
    catalogOps: {
      getStage: vi.fn(() => undefined),
      isStageUnlocked: vi.fn(() => true),
    },
    turnBattleOps: { startStage: vi.fn(() => false) },
    abandonBattle: vi.fn(() => false),
    eventBus,
  }
}

function mountPanel(gm: MockGameManager, battleRunMode: 'manual' | 'repeat' | 'progress' = 'repeat') {
  const container = document.createElement('div')

  document.body.appendChild(container)

  const app = createApp({ render: () => h(CombatVictoryPanel) })

  const pinia = createPinia()

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gm as unknown as import('@/core/game/GameManager').GameManager)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})

  // battleRunMode must be armed BEFORE mount — onMounted reads it to
  // decide whether the 3s auto-refight countdown starts (B4).
  const ui = useUiStore(pinia)

  ui.battleRunMode = battleRunMode

  app.mount(container)

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

describe('CombatVictoryPanel — B4 failed refight recovery (audit T1-5)', () => {
  it('repeat mode: countdown refight resolves false → battleRunMode rolls back to manual (Promise truthiness regression)', async () => {
    vi.useFakeTimers()
    const gm = makeGameManager()
    gm.catalogOps.getStage.mockReturnValue({ id: 'mortal_dong_1' })

    const panel = mountPanel(gm, 'repeat')
    panel.ui.selectedStageId = 'mortal_dong_1'
    await nextTick()

    await vi.advanceTimersByTimeAsync(3_000)
    await nextTick()

    expect(panel.ui.battleRunMode).toBe('manual')
    expect(panel.ui.selectedStageId).toBe('mortal_dong_1')

    panel.unmount()
  })

  it('progress mode: advance to next stage fails → selectedStageId restored + manual', async () => {
    vi.useFakeTimers()
    const gm = makeGameManager()
    const nextStage = {
      id: 'next_stage',
      name: 'Next Stage',
      description: '',
      floor: 2,
      enemyPool: [],
      totalEnemyCount: 1,
      waves: [1],
      spawnIntervalSeconds: 0,
    }
    gm.catalogOps.getStage.mockReturnValue(nextStage)
    resolveMock.mockReturnValue({ status: 'ready', stage: nextStage })

    const panel = mountPanel(gm, 'progress')
    panel.ui.selectedZoneId = 'mortal'
    panel.ui.selectedStageId = 'prev_stage'
    await nextTick()

    await vi.advanceTimersByTimeAsync(3_000)
    await nextTick()

    expect(panel.ui.selectedStageId).toBe('prev_stage')
    expect(panel.ui.battleRunMode).toBe('manual')

    panel.unmount()
  })
})
