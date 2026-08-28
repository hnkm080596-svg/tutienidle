// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import RealmPanel from './RealmPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import {
  BUMP_STATE_KEY,
  GAME_MANAGER_KEY,
  STATE_VERSION_KEY,
} from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'

function mountRealmPanel() {
  const container = document.createElement('div')
  const pinia = createPinia()
  const gameManager = new GameManager()
  const stateVersion = ref(0)
  const app = createApp({ render: () => h(RealmPanel) })

  document.body.appendChild(container)
  app.use(pinia)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })

  useUiStore(pinia).standalonePanel = 'realm'
  app.mount(container)

  return {
    container,
    player: usePlayerStore(pinia),
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('RealmPanel', () => {
  it('chỉ còn nút đại cảnh giới — tiểu cảnh giới tự tăng khi đủ tu vi', async () => {
    const mounted = mountRealmPanel()
    const ritualButton = () => mounted.container.querySelector<HTMLButtonElement>(
      '.realm-panel__actions button',
    )!
    const actionLabels = () => Array.from(
      mounted.container.querySelectorAll<HTMLButtonElement>('.realm-panel__actions button'),
      button => button.textContent?.trim(),
    )

    expect(actionLabels()).toEqual(['Quán Khí'])
    expect(ritualButton().disabled).toBe(true)

    mounted.player.realmLevel = 12
    await nextTick()

    expect(ritualButton().disabled).toBe(false)

    mounted.player.realmId = 'qi_refining'
    mounted.player.realmLevel = 1
    await nextTick()

    expect(actionLabels()).toEqual(['Trúc Cơ'])
    expect(ritualButton().disabled).toBe(true)

    mounted.player.realmLevel = 12
    await nextTick()

    expect(ritualButton().disabled).toBe(false)

    mounted.player.realmId = 'foundation_establishment'
    await nextTick()

    expect(actionLabels()).toEqual(['Kim Đan'])
    expect(ritualButton().disabled).toBe(true)
    mounted.unmount()
  })
})
