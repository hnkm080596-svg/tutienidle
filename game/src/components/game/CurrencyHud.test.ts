// @vitest-environment jsdom
//
// CurrencyHud chip strip + the `resource-pill` chrome contract:
// while the huyen-kim manifest keeps the slot 'pending' the capsules
// render the plain CSS pill (no slice element); once it flips to 'ready'
// each chip mounts an InkNineSlice[data-hk-slice="resource-pill"] layer -
// the primitive owns the nine-slice style, so this test asserts the
// marker/class contract rather than inline border-image (jsdom drops
// image-set() values the shared primitive emits anyway).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createApp, defineComponent, h, ref } from 'vue'
import { createPinia } from 'pinia'
import CurrencyHud from './CurrencyHud.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { chromeSlice, HUYEN_KIM_CHROME } from '@/ui/huyenKimChrome'
import { i18n } from '@/i18n'

function mountHud(gameManager: GameManager) {
  const container = document.createElement('div')
  const stateVersion = ref(0)

  document.body.appendChild(container)

  const RootStub = defineComponent({
    render: () => h('div', [h(CurrencyHud)]),
  })

  const app = createApp({ render: () => h(RootStub) })

  app.use(createPinia())
  app.use(i18n)

  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })

  app.mount(container)

  return {
    stateVersion,
    hud: () => container.querySelector<HTMLElement>('.currency-hud'),
    chips: () =>
      Array.from(container.querySelectorAll<HTMLElement>('.currency-hud__chip')),
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('CurrencyHud', () => {
  let mounted: ReturnType<typeof mountHud>

  beforeEach(() => {
    mounted = mountHud(new GameManager())
  })

  afterEach(() => {
    mounted.unmount()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('renders at least one labeled currency capsule', async () => {
    await nextTick()
    expect(mounted.hud()).not.toBeNull()
    expect(mounted.chips().length).toBeGreaterThanOrEqual(1)
    for (const chip of mounted.chips()) {
      expect(chip.querySelector('.currency-hud__label')).not.toBeNull()
      expect(chip.querySelector('.currency-hud__amount')).not.toBeNull()
    }
  })

  it('mirrors the resource-pill chrome slot state on every capsule', async () => {
    await nextTick()
    const slice = chromeSlice('resource-pill')
    const chips = mounted.chips()
    expect(chips.length).toBeGreaterThanOrEqual(1)
    for (const chip of chips) {
      const sliced = chip.classList.contains('currency-hud__chip--sliced')
      expect(sliced, 'sliced class follows chromeSlice()').toBe(Boolean(slice))
      const layer = chip.querySelector<HTMLElement>(
        '.ink-nine-slice[data-hk-slice="resource-pill"]',
      )
      expect(Boolean(layer), 'InkNineSlice layer follows chromeSlice()').toBe(Boolean(slice))
      if (slice && layer) {
        const asset = HUYEN_KIM_CHROME['resource-pill']
        if (!asset) throw new Error('resource-pill missing from manifest')
        // Non-tintable capsule: no accent/tint var may leak into the art.
        expect(layer.style.getPropertyValue('--ink-slice-tint')).toBe('')
      }
    }
  })
})
