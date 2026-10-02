// @vitest-environment jsdom
// B19 consumer-seam repros (review only, no production edits).
// Hostile surface: CharacterDetailCard renders the dormant hidden-way
// stat rows for EVERY beta save, and MaterialBagSection/LoreCodex
// render a carried doan_bao_thach stack whose description names the
// dormant artifact domain. Contract sec.I: "no UI may mention" the
// dormant systems. These tests encode the expected scope-honest
// behavior - they FAIL while the leaks are live.
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import CharacterDetailCard from '@/components/panels/CharacterDetailCard.vue'
import MaterialBagSection from '@/components/panels/bag-sections/MaterialBagSection.vue'
import LoreCodex from '@/components/panels/scripture/LoreCodex.vue'
import { GameManager } from '@/core/game/GameManager'
import { BASE_STAT_LABELS } from '@/core/stats/StatLabels'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import { materials } from '@/data/materials/materials'

// ASCII comment rule (P15): prose here stays ascii-only.

function mountComponent(component: object, prepare?: (manager: GameManager) => void) {
  const container = document.createElement('div')
  const pinia = createPinia()
  const manager = new GameManager()
  const version = ref(0)
  prepare?.(manager)

  const app = createApp({ render: () => h(component) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, manager, unmount: () => app.unmount() }
}

beforeEach(() => {
  window.ResizeObserver = window.ResizeObserver || (class {
    observe() {}

    unobserve() {}

    disconnect() {}
  } as never)
})

describe('b19 consumer scope honesty', () => {
  // LEAK-1: CharacterDetailCard iterates every BASE_STAT_LABELS entry in
  // the combat/survival/special/defense_advanced categories with no
  // scope filter. defense_advanced contains counterChance /
  // protectChance / followUpChance - the hidden body way (The Tu An)
  // reactive chances whose own labels say "The Tu An" - and special
  // contains reactionEffectPercent, which StatDomain marks as hidden
  // spell-path only. A fresh mortal save renders dormant hidden-way
  // stat rows by name. Mint path: panels.character.actions.details
  // opens this card on the live Character panel for any player.
  it('character detail card renders no hidden-way stat rows', () => {
    const mounted = mountComponent(CharacterDetailCard)
    const text = mounted.container.textContent ?? ''

    const hiddenLabels = BASE_STAT_LABELS.filter(
      (s) => ['counterChance', 'protectChance', 'followUpChance', 'reactionEffectPercent'].includes(s.key),
    ).map((s) => s.label)

    for (const label of hiddenLabels) {
      expect(text).not.toContain(label)
    }

    mounted.unmount()
  })

  // LEAK-2: MaterialBagSection entries filter only the companion pull
  // token; a carried doan_bao_thach stack (artifact-domain material,
  // delivery suppressed by isDomainScopedAcquisitionEnabled) renders
  // with a description naming the dormant artifact system
  // ("ban menh phap bao"). Mint path: legacy/carried bag stack -
  // contract H keeps carried records and plays the save.
  it('material bag hides the domain-suppressed artifact stone', async () => {
    const stone = materials.find((m) => m.id === 'doan_bao_thach')
    expect(stone).toBeDefined()

    const mounted = mountComponent(MaterialBagSection, (manager) => {
      manager.materialBag.add(stone!, 3)
    })
    await Promise.resolve()

    // jsdom has no layout width so grid cells never mount; the count
    // label reflects the unfiltered entries list directly.
    const count = mounted.container.querySelector('.bag-section__count')?.textContent?.trim() ?? ''
    expect(count.startsWith('0')).toBe(true)

    mounted.unmount()
  })

  // LEAK-2b: same carried stack renders inside the scripture LoreCodex
  // (category 'other' passes its only filter besides the pull token).
  it('lore codex hides the domain-suppressed artifact stone', async () => {
    const stone = materials.find((m) => m.id === 'doan_bao_thach')
    expect(stone).toBeDefined()

    const mounted = mountComponent(LoreCodex, (manager) => {
      manager.materialBag.add(stone!, 3)
    })
    await Promise.resolve()

    // loreItems computed feeds both the slot grid and the empty-state;
    // a rendered item means the EmptyState did not show.
    const empty = mounted.container.querySelector('.empty-state, [class*="empty"]')
    expect(empty).not.toBeNull()

    mounted.unmount()
  })
})
