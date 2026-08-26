// @vitest-environment jsdom
//
// Result lifecycle (2026-08-26) — khi thắng/thua, StageWaveSystem gọi
// stageManager.stop() nhưng CombatScene vẫn đang hiển thị kết quả:
// Home/DongFu CHỈ được hiện lại khi combatSceneDismissed === true hoặc
// chưa từng vào combat. Regression gốc: victory → useStageActive trả
// false → DongFuScene che canvas dù modal kết quả đang hiện.
import { describe, expect, it } from 'vitest'
import { computed, createApp, h, ref, type ComputedRef, type Ref } from 'vue'
import { createPinia } from 'pinia'
import {
  BUMP_STATE_KEY,
  GAME_MANAGER_KEY,
  STATE_VERSION_KEY,
} from '@/composables/useGameState'
import type { GameManager } from '@/core/game/GameManager'
import type { Battle } from '@/core/battle/Battle'
import type { BattleState } from '@/core/battle/BattleTypes'
import type { Stage } from '@/core/stage/Stage'
import { useUiStore } from '@/stores/ui'
import { useStageActive } from '@/composables/useStageActive'
import { useCombatSceneActive } from '@/composables/useCombatSceneActive'

interface FakeGameManagerOptions {
  activeStage: boolean

  battleState: BattleState | null
}

function createHarness(options: FakeGameManagerOptions) {
  const stateVersion: Ref<number> = ref(0)

  let current = { ...options }

  const fakeGameManager = {
    stageManager: {
      get: () => (current.activeStage ? ({ stageId: 's' } as never) : null),
    },

    getBattle: (): Pick<Battle, 'state' | 'mode'> | null =>
      current.battleState === null ? null : ({ state: current.battleState, mode: 'stage' } as never),
  } as unknown as GameManager

  const container = document.createElement('div')

  document.body.appendChild(container)

  let stageActive: ComputedRef<boolean> | undefined
  let combatSceneActive: ComputedRef<boolean> | undefined

  const app = createApp({
    setup() {
      stageActive = useStageActive()

      combatSceneActive = useCombatSceneActive()

      return () => h('div')
    },
  })

  app.use(createPinia())

  app.provide(GAME_MANAGER_KEY, fakeGameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {})

  app.mount(container)

  return {
    ui: useUiStore(),

    read: () => {
      // Bump stateVersion như App.vue tick() để computed đánh giá lại.
      stateVersion.value++

      return {
        stageActive: stageActive!.value,

        combatSceneActive: combatSceneActive!.value,
      }
    },

    setCore(next: Partial<FakeGameManagerOptions>) {
      current = { ...current, ...next }
    },

    unmount: () => {
      app.unmount()

      container.remove()
    },
  }
}

describe('useStageActive / useCombatSceneActive — result lifecycle', () => {
  it('chưa từng vào combat: Home hiện (stageActive=false), Combat Scene tắt', () => {
    const harness = createHarness({ activeStage: false, battleState: null })

    expect(harness.ui.combatOrigin).toBeNull()

    expect(harness.read()).toEqual({ stageActive: false, combatSceneActive: false })

    harness.unmount()
  })

  it('fighting: Home ẩn, Combat Scene hiện', () => {
    const harness = createHarness({ activeStage: true, battleState: 'fighting' })

    harness.ui.enterCombatScene('stage')

    expect(harness.read()).toEqual({ stageActive: true, combatSceneActive: true })

    harness.unmount()
  })

  it('REGRESSION fighting → victory: Combat Scene vẫn active, Home VẪN ẨN, modal hiện', () => {
    const harness = createHarness({ activeStage: true, battleState: 'fighting' })

    harness.ui.enterCombatScene('stage')

    expect(harness.read().combatSceneActive).toBe(true)

    // Thắng: StageWaveSystem set battle.state='victory' rồi stageManager.stop().
    harness.setCore({ activeStage: false, battleState: 'victory' })

    const view = harness.read()

    // Trước fix: stageActive=false tại đây khiến DongFuScene che canvas.
    expect(view.stageActive).toBe(true)
    expect(view.combatSceneActive).toBe(true)

    harness.unmount()
  })

  it('victory → bấm "Tiếp Tục" (exitCombatScene): lúc này Home mới hiện', () => {
    const harness = createHarness({ activeStage: false, battleState: 'victory' })

    harness.ui.enterCombatScene('stage')

    expect(harness.read()).toEqual({ stageActive: true, combatSceneActive: true })

    harness.ui.exitCombatScene()

    expect(harness.read()).toEqual({ stageActive: false, combatSceneActive: false })

    harness.unmount()
  })

  it('defeat có hành vi tương tự victory', () => {
    const harness = createHarness({ activeStage: false, battleState: 'defeat' })

    harness.ui.enterCombatScene('stage')

    expect(harness.read()).toEqual({ stageActive: true, combatSceneActive: true })

    harness.ui.exitCombatScene()

    expect(harness.read()).toEqual({ stageActive: false, combatSceneActive: false })

    harness.unmount()
  })
})
