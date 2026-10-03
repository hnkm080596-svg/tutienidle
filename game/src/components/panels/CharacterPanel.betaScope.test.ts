// @vitest-environment jsdom
//
// F-C-CONS-1 (beta scope lock): CharacterPanel's chosenKit read
// getActiveWayDefinition(player) ungated - a carried dormant way
// (sword_pathway / body_pathway, both declaring element 'metal')
// tinted the figure aura metal while every other beta surface
// collapses the carried way to neutral. The computed is now gated via
// getActiveWay + isBetaWay (same collapse as
// SkillPathPanel.wayIdentity): dormant ways resolve undefined -> the
// chrome fallback, mortal saves and the beta spell_pathway are
// unchanged.
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import CharacterPanel from './CharacterPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import { usePlayerStore } from '@/stores/player'
import { ELEMENT_COLOR_VARS } from '@/core/element/ElementLabels'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '@/core/game/__fixtures__/betaTalentsUnlock'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

function mountPanel(prepare?: (pinia: Pinia, manager: GameManager) => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const pinia = createPinia()
  const manager = new GameManager()
  const version = ref(0)
  prepare?.(pinia, manager)

  const app = createApp({ render: () => h(CharacterPanel) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, manager, unmount: () => { app.unmount(); container.remove() } }
}

function auraOf(container: HTMLElement): string | null {
  const figure = container.querySelector<HTMLElement>('.character-panel__figure')
  return figure?.style.getPropertyValue('--aura') ?? null
}

afterEach(() => { document.body.innerHTML = '' })

describe('CharacterPanel — beta scope on the figure aura', () => {
  it('a carried sword_pathway collapses the aura to chrome (dormant way brands nothing)', () => {
    const { container, unmount } = mountPanel((pinia) => {
      const player = usePlayerStore(pinia)
      player.cultivationPath = 'sword'
      player.cultivationWay = 'sword_pathway'
    })

    // Pre-fix the dormant way's declared 'metal' element tinted the
    // aura; the bound is chrome like SkillPathPanel.wayIdentity.
    expect(auraOf(container)).toBe('var(--chrome-500)')
    expect(auraOf(container)).not.toBe(ELEMENT_COLOR_VARS.metal)
    unmount()
  })

  it('a carried body_pathway collapses the aura to chrome', () => {
    const { container, unmount } = mountPanel((pinia) => {
      const player = usePlayerStore(pinia)
      player.cultivationPath = 'body'
      player.cultivationWay = 'body_pathway'
    })

    expect(auraOf(container)).toBe('var(--chrome-500)')
    unmount()
  })

  it('control: a way-less mortal save renders chrome', () => {
    const { container, unmount } = mountPanel()

    expect(auraOf(container)).toBe('var(--chrome-500)')
    unmount()
  })

  it('control: the beta spell_pathway still renders chrome (no declared element)', () => {
    const { container, unmount } = mountPanel((pinia) => {
      const player = usePlayerStore(pinia)
      player.cultivationPath = 'spell'
      player.cultivationWay = 'spell_pathway'
    })

    expect(auraOf(container)).toBe('var(--chrome-500)')
    unmount()
  })
})
