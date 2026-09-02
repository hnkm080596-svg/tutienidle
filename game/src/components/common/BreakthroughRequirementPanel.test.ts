// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import BreakthroughRequirementPanel from './BreakthroughRequirementPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { usePlayerStore } from '@/stores/player'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { GAME_MANAGER_KEY, BUMP_STATE_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'

// Task 17 (rework P5) — cảnh báo "Đột phá sẽ tháo toàn bộ trang bị" phải
// hiện SẴN trong panel xác nhận (không chờ tương tác) — verbatim wording
// theo brief, đúng chính tả và dấu câu.
function mountPanel() {
  const container = document.createElement('div')
  const pinia = createPinia()
  setActivePinia(pinia)

  const manager = new GameManager()
  const player = usePlayerStore()
  player.realmId = 'mortal'
  player.realmLevel = 12
  player.bodyRefinementCompletedTiers = 6
  player.mortalPerfectionAchieved = true
  useBreakthroughRequirementStore().open()

  const version = ref(0)

  const app = createApp({ render: () => h(BreakthroughRequirementPanel) })
  app.use(pinia)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, unmount: () => app.unmount() }
}

afterEach(() => { document.body.innerHTML = '' })

describe('BreakthroughRequirementPanel — cảnh báo tháo trang bị (rework P5, Task 17)', () => {
  it('render đúng text cảnh báo tháo toàn bộ trang bị', () => {
    const { container, unmount } = mountPanel()

    expect(container.textContent).toContain(
      'Đột phá sẽ tháo toàn bộ trang bị (yêu cầu trang bị ngang phẩm mới)',
    )

    unmount()
  })
})
