import { describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import HomeResourceStrip from './HomeResourceStrip.vue'

// ui-discoverability-refactor-plan.md §3.5 (2026-08-29) — dải tài nguyên
// thường trực ở home: Linh Thạch luôn hiện; vật liệu nâng cấp theo dữ
// liệu building thật; click mở túi đồ.
function mountWith(manager: GameManager) {
  const pinia = createPinia()
  const stateVersion = { value: 0 }

  const root = document.createElement('div')

  const app = createApp({
    setup() {
      return () => h(HomeResourceStrip)
    },
  })

  app.use(pinia)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => { stateVersion.value++ })
  app.mount(root)

  return { root, manager }
}

describe('HomeResourceStrip (ui-discoverability-refactor-plan §3.5)', () => {
  it('hiện Linh Thạch với số lượng thật từ materialBag', () => {
    const manager = new GameManager()

    manager.materialBag.add(manager.materialRegistry.get('spirit_stone_ha_pham'), 1234)

    const { root } = mountWith(manager)

    expect(root.textContent).toContain('Linh Thạch')
    expect(root.textContent).toContain('1234')
  })

  it('click Linh Thạch mở panel túi (inventory)', () => {
    const manager = new GameManager()

    manager.materialBag.add(manager.materialRegistry.get('spirit_stone_ha_pham'), 5)

    const { root } = mountWith(manager)

    const button = root.querySelector('[data-testid="home-resource-strip"] button')!

    ;(button as HTMLButtonElement).click()

    const ui = useUiStoreOrNull()

    expect(ui?.characterOverlayOpen).toBe(true)
  })
})

import { useUiStore } from '@/stores/ui'

function useUiStoreOrNull() {
  const pinia = createPinia()

  try {
    return useUiStore(pinia)
  } catch {
    return null
  }
}
