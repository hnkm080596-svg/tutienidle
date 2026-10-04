// @vitest-environment jsdom
//
// F-PILL-CHIP (FIX WAVE 4) - regression guard asserting CLOSED. The
// active-effects chip mapped raw persistentTimedEffects: a carried
// dormant-family pill (hoi_xuan_dan_*) still rendered an active chip
// while its stack cells were already scope-filtered in the same
// template. The chip now applies the same scopeHiddenPillFamilyOfId
// admission as the cells - dormant-family timed effects render nothing.
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import PillBagSection from './PillBagSection.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import { usePlayerStore } from '@/stores/player'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import type { PersistentTimedEffect } from '@/core/player/PersistentTimedEffect'
import { pills } from '@/data/pill/pills'

// Re-pin the canonical beta lock (global setup unlocks features).
lockBetaFeaturesForTests()

function timedEffect(overrides: Partial<PersistentTimedEffect>): PersistentTimedEffect {
  const now = Date.now()
  return {
    id: `fx-${Math.random().toString(36).slice(2)}`,
    sourceItemId: 'tu_linh_dan_qi_refining',
    appliedAtMs: now - 1_000,
    expiresAtMs: now + 60_000,
    modifiers: [
      { id: 'fx-hp', sourceId: 'pill', sourceType: 'pill', stat: 'hpRegenPerTurn', flat: 5 },
      { id: 'fx-mp', sourceId: 'pill', sourceType: 'pill', stat: 'manaRegenPerTurn', flat: 3 },
    ],
    ...overrides,
  }
}

function mountSection(prepare?: (pinia: Pinia, manager: GameManager) => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const pinia = createPinia()
  const manager = new GameManager()
  const version = ref(0)
  prepare?.(pinia, manager)

  const app = createApp({ render: () => h(PillBagSection) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, unmount: () => { app.unmount(); container.remove() } }
}

function activeChipRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.pill-active__row'))
}

// jsdom has no ResizeObserver - useBagGridLayout observes the grid on
// mount; stub per PillBagSection.test.ts pattern.
beforeEach(() => {
  window.ResizeObserver = window.ResizeObserver || (class {
    observe() {}

    unobserve() {}

    disconnect() {}
  } as never)
  document.body.innerHTML = ''
})

describe('PillBagSection - active-effects chip scope', () => {
  it('a carried dormant-family timed effect renders no chip', () => {
    const { container, unmount } = mountSection((pinia, manager) => {
      manager.catalogOps.registerPills(
        pills.filter((pill) => pill.id === 'hoi_xuan_dan_qi_refining'),
      )
      const player = usePlayerStore(pinia)
      player.persistentTimedEffects = [
        timedEffect({ sourceItemId: 'hoi_xuan_dan_qi_refining' }),
      ]
    })

    expect(container.querySelector('.pill-active')).toBeNull()
    expect(activeChipRows(container)).toHaveLength(0)
    unmount()
  })

  it('control: a beta-family timed effect still renders its chip', () => {
    const { container, unmount } = mountSection((pinia, manager) => {
      manager.catalogOps.registerPills(
        pills.filter((pill) => pill.id === 'tu_linh_dan_qi_refining'),
      )
      const player = usePlayerStore(pinia)
      player.persistentTimedEffects = [
        timedEffect({ sourceItemId: 'tu_linh_dan_qi_refining' }),
      ]
    })

    const rows = activeChipRows(container)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.querySelector('.pill-active__name')?.textContent?.trim())
      .toBe('Tụ Linh Đan')
    expect(rows[0]!.querySelector('.pill-active__value')?.textContent?.trim())
      .toBe('+5 HP/s, +3 MP/s')
    unmount()
  })

  it('control: an expired timed effect renders no chip', () => {
    const { container, unmount } = mountSection((pinia) => {
      const player = usePlayerStore(pinia)
      player.persistentTimedEffects = [
        timedEffect({ expiresAtMs: Date.now() - 1 }),
      ]
    })

    expect(activeChipRows(container)).toHaveLength(0)
    unmount()
  })

  it('a mixed carried list renders only the admitted effect', () => {
    const { container, unmount } = mountSection((pinia, manager) => {
      manager.catalogOps.registerPills(
        pills.filter((pill) => pill.id === 'tu_linh_dan_qi_refining' || pill.id === 'hoi_xuan_dan_qi_refining'),
      )
      const player = usePlayerStore(pinia)
      player.persistentTimedEffects = [
        timedEffect({ id: 'fx-dormant', sourceItemId: 'hoi_xuan_dan_qi_refining' }),
        timedEffect({ id: 'fx-live', sourceItemId: 'tu_linh_dan_qi_refining' }),
      ]
    })

    const rows = activeChipRows(container)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.querySelector('.pill-active__name')?.textContent?.trim())
      .toBe('Tụ Linh Đan')
    unmount()
  })
})
