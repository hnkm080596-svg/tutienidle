// @vitest-environment jsdom
//
// Spec SS12 Thien Co Bang -- right rail of actionable opportunities.
// Verifies empty state, breakthrough-ready entry, and CTA navigation.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'
import { createApp, defineComponent, h, ref } from 'vue'
import { createPinia } from 'pinia'
import ThienCoRail from './ThienCoRail.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { VUE_ROUTE_ADAPTER_KEY, type Route } from '@/presentation/PresentationContracts'
import type { VueRouteAdapter } from '@/presentation/VueRouteAdapter'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { i18n } from '@/i18n'

function mountRail(gameManager: GameManager) {
  const container = document.createElement('div')
  const stateVersion = ref(0)

  document.body.appendChild(container)

  const RootStub = defineComponent({
    render: () => h('div', [h(ThienCoRail)]),
  })

  const app = createApp({ render: () => h(RootStub) })

  app.use(createPinia())
  app.use(i18n)

  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })
  app.provide(VUE_ROUTE_ADAPTER_KEY, {
    activeRoute: computed(() => 'home' as Route),
  } as unknown as VueRouteAdapter)

  app.mount(container)

  const ui = useUiStore()

  return {
    ui,
    rail: () => container.querySelector<HTMLElement>('.thien-co-rail'),
    empty: () => container.querySelector<HTMLElement>('.thien-co-rail__empty'),
    entries: () => Array.from(container.querySelectorAll<HTMLElement>('.thien-co-rail__entry')),
    entryCta: (index: number) =>
      container.querySelectorAll<HTMLElement>('.thien-co-rail__entry')[index]?.querySelector('button'),
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('ThienCoRail', () => {
  let gameManager: GameManager
  let mounted: ReturnType<typeof mountRail>

  beforeEach(() => {
    gameManager = new GameManager()
    mounted = mountRail(gameManager)
  })

  afterEach(() => {
    mounted.unmount()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows the quiet empty line when nothing is actionable', () => {
    expect(mounted.rail()).not.toBeNull()
    expect(mounted.rail()!.dataset.canonicalLayer).toBe('L8')
    expect(mounted.entries().length).toBe(0)
    expect(mounted.empty()!.textContent).toContain('Đạo tâm an nhiên')
  })

  it('surfaces a breakthrough-ready entry that opens the realm panel', async () => {
    const player = usePlayerStore()
    player.realmId = 'mortal'
    player.realmLevel = 12
    player.cultivation = player.cultivationRequired

    await nextTick()

    const entries = mounted.entries()
    expect(entries.length).toBeGreaterThanOrEqual(1)
    expect(entries[0]!.dataset.kind).toBe('breakthrough')
    expect(entries[0]!.textContent).toContain('Đột phá sẵn sàng')

    mounted.entryCta(0)!.click()
    await nextTick()

    expect(mounted.ui.standalonePanel).toBe('realm')
  })
})
