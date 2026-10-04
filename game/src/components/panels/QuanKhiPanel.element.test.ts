// @vitest-environment jsdom
// QuanKhiPanel element pick (art-qa wave A): the five-element grid renders
// every element tile - the four out-of-beta elements stay mounted in a
// locked state (dim + disabled + lock tooltip) instead of empty cells.
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import QuanKhiPanel from './QuanKhiPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { CORE_REALM_LEVEL } from '@/core/realm/realmSystem'
import { ELEMENT_LABELS, ELEMENT_ORDER } from '@/core/element/ElementLabels'
import { lockBetaElementsForTests } from '@/core/game/__fixtures__/betaElementsUnlock'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'

// The global betaScope setup admits every element for the historical
// suites; this file pins the production lock ({fire}) back on.
lockBetaElementsForTests()

function mountPanel() {
  const container = document.createElement('div')
  const pinia = createPinia()
  const gameManager = new GameManager()
  const stateVersion = ref(0)

  document.body.appendChild(container)

  const app = createApp({ render: () => h(QuanKhiPanel) })

  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })

  const player = usePlayerStore(pinia)
  player.realmId = 'mortal'
  player.realmLevel = CORE_REALM_LEVEL
  gameManager.setActivePlayer(player.$state)

  useUiStore(pinia).standalonePanel = 'quan_khi'

  app.mount(container)

  return {
    container,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('QuanKhiPanel element pick', () => {
  it('renders all five element tiles with the four non-beta tiles locked', async () => {
    const mounted = mountPanel()

    // Pick the spell way card to open the element step.
    const choice = Array.from(
      mounted.container.querySelectorAll<HTMLElement>('.quan-khi-panel__choice'),
    ).find((button) => button.textContent?.includes('Pháp Tu'))
    expect(choice, 'spell way card').toBeTruthy()
    choice!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const buttons = Array.from(
      mounted.container.querySelectorAll<HTMLButtonElement>('.quan-khi-panel__element-btn'),
    )
    expect(buttons.length).toBe(5)

    const labels = buttons.map((button) => button.textContent?.trim() ?? '')
    for (const element of ELEMENT_ORDER) {
      expect(labels).toContain(ELEMENT_LABELS[element])
    }

    const enabled = buttons.filter((button) => !button.disabled)
    const locked = buttons.filter((button) => button.classList.contains('is-locked'))

    // Only the beta element (fire) is playable; the rest are locked tiles.
    expect(enabled.length).toBe(1)
    expect(enabled[0]!.textContent).toContain(ELEMENT_LABELS.fire)
    expect(locked.length).toBe(4)
    for (const button of locked) {
      expect(button.disabled).toBe(true)
      expect(button.getAttribute('title')).toBe('Chưa mở trong beta')
      expect(button.querySelector('.quan-khi-panel__element-lock')).not.toBeNull()
    }

    mounted.unmount()
  })
})
