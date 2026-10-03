// @vitest-environment jsdom
//
// Spec SS11 top bar -- identity left / resources center / utilities right.
// Verifies the composition mounts and utility actions reach the ui store.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'
import { createApp, defineComponent, h, ref } from 'vue'
import { createPinia } from 'pinia'
import GlobalTopBar from './GlobalTopBar.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { VUE_ROUTE_ADAPTER_KEY, type Route } from '@/presentation/PresentationContracts'
import type { VueRouteAdapter } from '@/presentation/VueRouteAdapter'
import { useUiStore } from '@/stores/ui'
import { i18n } from '@/i18n'

function mountTopBar(gameManager: GameManager) {
  const container = document.createElement('div')
  const stateVersion = ref(0)

  document.body.appendChild(container)

  const RootStub = defineComponent({
    render: () => h('div', [h(GlobalTopBar)]),
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
    bar: () => container.querySelector<HTMLElement>('.global-top-bar'),
    identity: () => container.querySelector<HTMLButtonElement>('.global-top-bar__identity'),
    seals: () => Array.from(container.querySelectorAll<HTMLButtonElement>('.global-top-bar__seal')),
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('GlobalTopBar', () => {
  let mounted: ReturnType<typeof mountTopBar>

  beforeEach(() => {
    mounted = mountTopBar(new GameManager())
  })

  afterEach(() => {
    mounted.unmount()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('renders identity, docked resources and utility seals as L8 chrome', () => {
    expect(mounted.bar()).not.toBeNull()
    expect(mounted.bar()!.dataset.canonicalLayer).toBe('L8')
    expect(mounted.identity()!.textContent).toContain('Vô Danh')
    expect(mounted.identity()!.textContent).toContain('Phàm Nhân')
    expect(mounted.seals().length).toBe(3)
    expect(mounted.bar()!.querySelector('.currency-hud')).not.toBeNull()
  })

  it('identity opens the character overlay; seals reach bag/settings/feedback', async () => {
    mounted.identity()!.click()
    await nextTick()
    expect(mounted.ui.characterOverlayOpen).toBe(true)

    mounted.ui.closeHomeOverlays()

    const seals = mounted.seals()
    // feedback / bag / settings -- catalog order in the utilities cluster.
    seals[1]!.click()
    await nextTick()
    expect(mounted.ui.characterOverlayOpen).toBe(true)
    expect(mounted.ui.activeBagTab).toBe('equipment')

    mounted.ui.closeHomeOverlays()

    seals[2]!.click()
    await nextTick()
    expect(mounted.ui.leftPanelMode).toBe('settings')
  })

  it('feedback seal opens the dialog teleported to body', async () => {
    expect(document.querySelector('.feedback-dialog')).toBeNull()

    mounted.seals()[0]!.click()
    await nextTick()

    expect(mounted.bar()!.contains(document.querySelector('.feedback-dialog'))).toBe(false)
    expect(document.querySelector('.feedback-dialog')).not.toBeNull()
  })
})
