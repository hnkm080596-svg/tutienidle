// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { SPIRIT_STONE_MATERIAL } from '@/core/material/SpiritStoneMaterial'
import HomeResourceStrip from './HomeResourceStrip.vue'

// ui-discoverability-refactor-plan.md §3.5 (2026-08-29) — dải tài nguyên
// thường trực ở home: Linh Thạch luôn hiện; vật liệu nâng cấp theo dữ
// liệu building thật; click mở túi đồ.
function mountWith(manager: GameManager) {
  const pinia = createPinia()
  const stateVersion = ref(0)

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

  return { root }
}

function makeManager() {
  const manager = new GameManager()

  manager.registerMaterials([SPIRIT_STONE_MATERIAL])

  return manager
}

describe('HomeResourceStrip (ui-discoverability-refactor-plan §3.5)', () => {
  it('thu gọn mặc định (2026-08-30 bug report: che góc màn hình) — chỉ hiện số Linh Thạch, bấm mới bung full', async () => {
    const manager = makeManager()

    manager.materialBag.add(SPIRIT_STONE_MATERIAL, 1234)

    const { root } = mountWith(manager)

    // Thu gọn: số vẫn thấy được (đủ hữu ích), tên "Linh Thạch" thì KHÔNG
    // hiện (đó là phần "che màn hình" gây khó chịu).
    expect(root.textContent).toContain('1234')
    expect(root.textContent).not.toContain('Linh Thạch')

    root.querySelector<HTMLButtonElement>('.home-resource-strip__toggle')!.click()
    await nextTick()

    expect(root.textContent).toContain('Linh Thạch')
    expect(root.textContent).toContain('1234')

    root.querySelector<HTMLButtonElement>('.home-resource-strip__collapse')!.click()
    await nextTick()

    expect(root.textContent).not.toContain('Linh Thạch')
  })
})
