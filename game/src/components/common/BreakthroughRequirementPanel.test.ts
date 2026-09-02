// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import BreakthroughRequirementPanel from './BreakthroughRequirementPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { usePlayerStore } from '@/stores/player'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { GAME_MANAGER_KEY, BUMP_STATE_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'

// Task 9.1 — panel chỉ còn xác nhận "Độ kiếp cũng là độ thân" (2 nút
// Đã hiểu / Chờ đã). Linh Thạch cost + warning cũ đã dỡ khỏi UI.
function mountPanel() {
  const container = document.createElement('div')
  const pinia = createPinia()
  setActivePinia(pinia)

  const manager = new GameManager()
  const player = usePlayerStore()
  player.realmId = 'qi_refining'
  player.realmLevel = 12
  useBreakthroughRequirementStore().open()

  const version = ref(0)

  const app = createApp({ render: () => h(BreakthroughRequirementPanel) })
  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  document.body.appendChild(container)
  app.mount(container)

  return {
    container,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => { document.body.innerHTML = '' })

describe('BreakthroughRequirementPanel — confirm panel (Task 9.1)', () => {
  it('render title "Độ kiếp cũng là độ thân" + subtitle đỏ + 2 nút', () => {
    const { container, unmount } = mountPanel()

    expect(container.textContent).toContain('Độ kiếp cũng là độ thân')
    expect(container.textContent).toContain('Không thể mặc trang bị khi độ kiếp')
    expect(container.textContent).toContain('Đã hiểu')
    expect(container.textContent).toContain('Chờ đã')

    unmount()
  })

  it('KHÔNG còn hiển thị Linh Thạch cost', () => {
    const { container, unmount } = mountPanel()

    expect(container.textContent).not.toContain('Linh Thạch')

    unmount()
  })

  it('bấm "Đã hiểu" đóng panel (store.isOpen → false)', async () => {
    const { container, unmount } = mountPanel()

    expect(useBreakthroughRequirementStore().isOpen).toBe(true)

    const confirmButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button'),
    ).find(button => button.textContent?.trim() === 'Đã hiểu')!

    confirmButton.click()
    await nextTick()

    expect(useBreakthroughRequirementStore().isOpen).toBe(false)

    unmount()
  })
})
