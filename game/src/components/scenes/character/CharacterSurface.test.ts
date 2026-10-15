// @vitest-environment jsdom
//
// Live CharacterSurface contract tests (migrated from dead CharacterPanel
// tests in Slice 3.1): five main attribute rows keyed by MainStatKey,
// allocate (+)/MAX behavior per row, five element pucks, and beta-scope
// collapse of carried dormant ways/talents.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import CharacterSurface from './CharacterSurface.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import { usePlayerStore } from '@/stores/player'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '@/core/game/__fixtures__/betaTalentsUnlock'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

function mountSurface(prepare?: (pinia: Pinia, manager: GameManager) => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const pinia = createPinia()
  const manager = new GameManager()
  const version = ref(0)
  prepare?.(pinia, manager)

  const app = createApp({ render: () => h(CharacterSurface) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, manager, unmount: () => { app.unmount(); container.remove() } }
}

beforeEach(() => {
  window.ResizeObserver = window.ResizeObserver || (class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never)
})

afterEach(() => { document.body.innerHTML = '' })

describe('CharacterSurface — main stats rows (5 attributes)', () => {
  it('renders 5 main stat rows keyed by MainStatKey', () => {
    const { container, unmount } = mountSurface()

    const rows = container.querySelectorAll('.character-stat-row[data-stat]')
    expect(rows).toHaveLength(5)

    const stats = [...rows].map((row) => row.getAttribute('data-stat')).sort()
    expect(stats).toEqual(['attunement', 'dexterity', 'intelligence', 'strength', 'vitality'])
    unmount()
  })

  it('when attributePoints > 0, renders allocate button and dispatches allocateAttributePoint', () => {
    const { container, manager, unmount } = mountSurface((pinia) => {
      usePlayerStore(pinia).attributePoints = 3
    })

    const spy = vi.spyOn(manager.progressionOps, 'allocateAttributePoint')
    const button = container.querySelector<HTMLButtonElement>(
      '.character-stat-row[data-stat="strength"] .character-allocate',
    )

    expect(button).not.toBeNull()
    button!.click()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(expect.anything(), 'strength')
    unmount()
  })

  it('when attributePoints === 0, renders no allocate button', () => {
    const { container, unmount } = mountSurface()

    expect(container.querySelector('.character-allocate')).toBeNull()
    unmount()
  })

  it('when a stat reaches cap, renders MAX instead of allocate button even with points remaining', () => {
    const { container, unmount } = mountSurface((pinia) => {
      const player = usePlayerStore(pinia)
      player.attributePoints = 3
      player.baseStats.strength = 999_999
    })

    const row = container.querySelector('.character-stat-row[data-stat="strength"]')!
    expect(row.querySelector('.character-allocate')).toBeNull()
    expect(row.querySelector('.character-stat-max')?.textContent?.trim()).not.toBe('')
    unmount()
  })
})

describe('CharacterSurface — beta scope on carried dormant ways', () => {
  it('a carried sword_pathway collapses the dao label to undefined (no Kiếm Tu branding)', () => {
    const { container, unmount } = mountSurface((pinia) => {
      const player = usePlayerStore(pinia)
      player.cultivationPath = 'sword'
      player.cultivationWay = 'sword_pathway'
    })

    const realmLine = container.querySelector('[data-testid="character-realm-line"]')
    expect(realmLine?.textContent).not.toContain('Kiếm Tu')
    unmount()
  })

  it('a carried body_pathway collapses the dao label to undefined (no Thể Tu branding)', () => {
    const { container, unmount } = mountSurface((pinia) => {
      const player = usePlayerStore(pinia)
      player.cultivationPath = 'body'
      player.cultivationWay = 'body_pathway'
    })

    const realmLine = container.querySelector('[data-testid="character-realm-line"]')
    expect(realmLine?.textContent).not.toContain('Thể Tu')
    unmount()
  })
})
