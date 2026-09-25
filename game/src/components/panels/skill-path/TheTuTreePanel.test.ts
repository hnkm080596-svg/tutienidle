// @vitest-environment jsdom
// The Tu beta tree panel: COLUMNS' authored ids must resolve against the
// real registry (a renamed node id renders a dead card), the excludesNode
// mutex renders the losing column abandoned, and respec stays disabled
// while a battle is in progress.
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import TheTuTreePanel from './TheTuTreePanel.vue'
import { usePlayerStore } from '@/stores/player'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'
import { THE_TU_NODES } from '@/data/progression/TheTuNodes'
import type { GameManager } from '@/core/game/GameManager'

function mockGameManager(state: 'intro' | 'countdown' | 'fighting' | null): Partial<GameManager> {
  return {
    nodeRegistry: {
      getAll: () => THE_TU_NODES,
      get: (id: string) => THE_TU_NODES.find((node) => node.id === id)!,
      has: (id: string) => THE_TU_NODES.some((node) => node.id === id),
    } as unknown as GameManager['nodeRegistry'],
    getTurnBattle: () =>
      (state === null ? null : { state }) as ReturnType<GameManager['getTurnBattle']>,
    progressionOps: {
      previewNodeRespec: () => null,
      respecNodeTree: () => 0,
    } as unknown as GameManager['progressionOps'],
  }
}

function mountPanel(inBattle: 'intro' | 'countdown' | 'fighting' | false = false) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  window.ResizeObserver = window.ResizeObserver || (class {
    observe() {}

    unobserve() {}

    disconnect() {}
  } as never)

  const app = createApp({
    render: () => h(TheTuTreePanel, {}),
  })

  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, mockGameManager(inBattle === false ? null : inBattle) as GameManager)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})

  const player = usePlayerStore(pinia)
  player.$state.skillInsight = 500

  app.mount(container)

  return {
    container,
    player,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('TheTuTreePanel', () => {
  it('every authored column id resolves in the real registry - both root cards render', async () => {
    const view = mountPanel()
    await nextTick()

    const roots = view.container.querySelectorAll('.the-tu-tree__card--root')
    expect(roots).toHaveLength(2)
    for (const root of roots) {
      expect(root.querySelector('.the-tu-tree__card-name')?.textContent?.trim()).toBeTruthy()
    }
    view.unmount()
  })

  it('purchasing one root renders the opposite column abandoned (excludesNode mutex)', async () => {
    const view = mountPanel()
    view.player.$state.nodeLevels.cuong_chien = 1
    view.player.$state.purchasedNodeIds.push('cuong_chien')
    await nextTick()

    const columns = view.container.querySelectorAll('.the-tu-tree__column')
    expect(columns).toHaveLength(2)
    const abandoned = view.container.querySelectorAll('.the-tu-tree__column.is-abandoned')
    expect(abandoned).toHaveLength(1)
    expect(
      abandoned[0]!.querySelector('.the-tu-tree__abandoned')?.textContent?.trim(),
    ).toBeTruthy()
    view.unmount()
  })

  it('respec stays disabled while a battle is in progress', async () => {
    const view = mountPanel('fighting')
    view.player.$state.nodeLevels.cuong_chien = 1
    view.player.$state.purchasedNodeIds.push('cuong_chien')
    await nextTick()

    const respec = view.container.querySelector<HTMLButtonElement>('.the-tu-tree__respec')
    expect(respec).not.toBeNull()
    expect(respec!.disabled).toBe(true)

    respec!.click()
    await nextTick()
    expect(view.player.$state.nodeLevels.cuong_chien).toBe(1)
    view.unmount()
  })

  it('countdown also counts as in-battle: respec stays disabled', async () => {
    const view = mountPanel('countdown')
    view.player.$state.nodeLevels.cuong_chien = 1
    view.player.$state.purchasedNodeIds.push('cuong_chien')
    await nextTick()

    const respec = view.container.querySelector<HTMLButtonElement>('.the-tu-tree__respec')
    expect(respec).not.toBeNull()
    expect(respec!.disabled).toBe(true)
    respec!.click()
    await nextTick()
    expect(view.player.$state.nodeLevels.cuong_chien).toBe(1)
    view.unmount()
  })
})
