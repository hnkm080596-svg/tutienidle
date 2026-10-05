// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from '@/i18n'
import { GameManager } from '@/core/game/GameManager'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import ArtifactPanel from './ArtifactPanel.vue'
import QuanKhiPanel from './QuanKhiPanel.vue'

const cleanups: (() => void)[] = []
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup() })

it('keeps artifact empty-state admission and closes through the existing UI owner', async () => {
  const pinia = createPinia()
  const ui = useUiStore(pinia)
  ui.standalonePanel = 'artifact'
  const manager = new GameManager()
  const version = ref(0)
  const root = document.createElement('div')
  document.body.appendChild(root)
  const app = createApp({ render: () => h(ArtifactPanel) })
  app.use(pinia).use(i18n)
  app.provide(GAME_MANAGER_KEY, manager).provide(STATE_VERSION_KEY, version).provide(BUMP_STATE_KEY, () => version.value++)
  app.mount(root)
  cleanups.push(() => { app.unmount(); root.remove() })
  await nextTick()
  expect(root.querySelector('.artifact-page [class*=empty-state]')).not.toBeNull()
  root.querySelector<HTMLButtonElement>('.pc-paper-scene__actions button')!.click()
  await nextTick()
  expect(ui.standalonePanel).toBeNull()
  expect(root.querySelector('.artifact-page')).toBeNull()
})

it('keeps initiation choices and closes without choosing a cultivation path', async () => {
  const pinia = createPinia()
  const player = usePlayerStore(pinia)
  player.realmId = 'qi_refining'
  player.realmLevel = 1
  const ui = useUiStore(pinia)
  ui.standalonePanel = 'quan_khi'
  const manager = new GameManager()
  manager.setActivePlayer(player.$state)
  const version = ref(0)
  const root = document.createElement('div')
  document.body.appendChild(root)
  const app = createApp({ render: () => h(QuanKhiPanel) })
  app.use(pinia).use(i18n)
  app.provide(GAME_MANAGER_KEY, manager).provide(STATE_VERSION_KEY, version).provide(BUMP_STATE_KEY, () => version.value++)
  app.mount(root)
  cleanups.push(() => { app.unmount(); root.remove() })
  await nextTick()
  expect(root.querySelectorAll('.quan-khi-panel__choice').length).toBeGreaterThan(0)
  root.querySelector<HTMLButtonElement>('.pc-paper-scene__actions button')!.click()
  await nextTick()
  expect(ui.standalonePanel).toBeNull()
  expect(player.cultivationPath).toBeUndefined()
  expect(root.querySelector('.quan-khi-page')).toBeNull()
})
