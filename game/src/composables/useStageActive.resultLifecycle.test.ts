// @vitest-environment jsdom
//
// Result lifecycle (2026-08-26) — khi thắng/thua, StageWaveSystem gọi
// stageManager.stop() nhưng CombatScene vẫn đang hiển thị kết quả:
// Home/DongFu CHỈ được hiện lại khi route coordinator đã rời 'combat'
// (bấm "Tiếp Tục"/"Về Động Phủ" → request({target:'home'})). Regression
// gốc: victory → useStageActive trả false → DongFuScene che canvas dù
// modal kết quả đang hiện.
//
// R12 cleanup: visibility authority is the coordinator's activeRoute —
// the ui-store flags (combatSceneDismissed / isTribulationSceneActive)
// that used to drive these tests are gone; the route ref plays that role.
import { describe, expect, it } from 'vitest'
import { computed, createApp, h, ref, type ComputedRef, type Ref } from 'vue'
import { createPinia } from 'pinia'
import {
  BUMP_STATE_KEY,
  STATE_VERSION_KEY,
} from '@/composables/useGameState'
import { VUE_ROUTE_ADAPTER_KEY, type Route } from '@/presentation/PresentationContracts'
import type { VueRouteAdapter } from '@/presentation/VueRouteAdapter'
import { useStageActive } from '@/composables/useStageActive'
import { useCombatSceneActive } from '@/composables/useCombatSceneActive'

function createHarness(initialRoute: Route) {
  const stateVersion: Ref<number> = ref(0)
  const route: Ref<Route> = ref(initialRoute)

  const fakeRouteAdapter = {
    activeRoute: computed(() => route.value),
  } as unknown as VueRouteAdapter

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

  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {})
  app.provide(VUE_ROUTE_ADAPTER_KEY, fakeRouteAdapter)

  app.mount(container)

  return {
    route,

    read: () => ({
      stageActive: stageActive!.value,

      combatSceneActive: combatSceneActive!.value,
    }),

    unmount: () => {
      app.unmount()

      container.remove()
    },
  }
}

describe('useStageActive / useCombatSceneActive — result lifecycle', () => {
  it('chưa từng vào combat (route home): Home hiện (stageActive=false), Combat Scene tắt', () => {
    const harness = createHarness('home')

    expect(harness.read()).toEqual({ stageActive: false, combatSceneActive: false })

    harness.unmount()
  })

  it('fighting (route combat): Home ẩn, Combat Scene hiện', () => {
    const harness = createHarness('combat')

    expect(harness.read()).toEqual({ stageActive: true, combatSceneActive: true })

    harness.unmount()
  })

  it('REGRESSION fighting → victory: route vẫn combat, Home VẪN ẨN, modal hiện', () => {
    const harness = createHarness('combat')

    expect(harness.read().combatSceneActive).toBe(true)

    // Thắng: battle.state='victory' + stageManager.stop() phía domain —
    // route không đổi, CombatScene vẫn mount đến khi player bấm tiếp.
    const view = harness.read()

    // Trước fix: stageActive=false tại đây khiến DongFuScene che canvas.
    expect(view.stageActive).toBe(true)
    expect(view.combatSceneActive).toBe(true)

    harness.unmount()
  })

  it('victory → bấm "Tiếp Tục" (request home): lúc này Home mới hiện', () => {
    const harness = createHarness('combat')

    expect(harness.read()).toEqual({ stageActive: true, combatSceneActive: true })

    harness.route.value = 'home'

    expect(harness.read()).toEqual({ stageActive: false, combatSceneActive: false })

    harness.unmount()
  })

  it('defeat có hành vi tương tự victory', () => {
    const harness = createHarness('combat')

    expect(harness.read()).toEqual({ stageActive: true, combatSceneActive: true })

    harness.route.value = 'home'

    expect(harness.read()).toEqual({ stageActive: false, combatSceneActive: false })

    harness.unmount()
  })

  it('route tribulation cũng ẩn Home (stageActive=true) nhưng Combat Scene tắt', () => {
    const harness = createHarness('tribulation')

    expect(harness.read()).toEqual({ stageActive: true, combatSceneActive: false })

    harness.unmount()
  })
})
