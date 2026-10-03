// @vitest-environment jsdom
// TechniquePanel (Huyen Kim scene 06) - ports the retired
// TechniqueBand coverage onto the imperial scene: mounts the real
// component through the project pattern (createApp + h + provide).
// The scroll shell renders only when ui.standalonePanel === 'technique'.
import { describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import TechniquePanel from './TechniquePanel.vue'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import type { Technique } from '@/core/technique/Technique'
import { betaTechniqueSurfaceFor } from '@/core/betaScopeTechniqueDomain'
import type { PlayerData } from '@/core/player/Player'
import type { GameManager } from '@/core/game/GameManager'

function fixtureTechnique(overrides: Partial<Technique> = {}): Technique {
  return {
    id: 'test_art',
    name: 'Test Art',
    description: 'A test technique',
    grade: 1,
    rank: 0,
    mastery: 0,
    quality: 'hoang',
    gradeHistory: {},
    gradeEffects: { 1: { so_nhap: { mightFlat: 5 } } },
    ...overrides,
  }
}

interface MountOptions {
  technique?: Technique
  realmId?: string
  materialAmount?: number
  gradeResult?: boolean
}

function mountPanel(options: MountOptions = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const stateVersion = ref(0)
  const bumpState = vi.fn(() => {
    stateVersion.value += 1
  })
  const tryAdvanceTechniqueGrade = vi.fn(() => options.gradeResult ?? true)

  const gameManager = {
    techniqueManager: {
      getActive: () => options.technique,
    } as unknown as GameManager['techniqueManager'],
    realmAdvanceOps: {
      tryAdvanceTechniqueGrade,
      // Canonical-model seam - the same deps the real facade binds.
      getBetaTechniqueSurfaceModel: (player: PlayerData) =>
        betaTechniqueSurfaceFor(player, {
          activeTechnique: options.technique,
          materialAmount: () => options.materialAmount ?? 0,
          materialName: (id: string) => `Mat ${id}`,
          turnBattleInProgress: false,
        }),
    } as unknown as GameManager['realmAdvanceOps'],
    materialBag: {
      getAmount: () => options.materialAmount ?? 0,
    } as unknown as GameManager['materialBag'],
    materialRegistry: {
      get: (id: string) => ({ id, name: `Mat ${id}` }),
    } as unknown as GameManager['materialRegistry'],
  }

  const app = createApp({ render: () => h(TechniquePanel) })
  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gameManager as GameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, bumpState)
  app.directive('tooltip', vTooltip)

  const player = usePlayerStore(pinia)
  player.$state.realmId = options.realmId ?? 'qi_refining'
  const ui = useUiStore(pinia)
  ui.openStandalonePanel('technique')

  app.mount(container)

  return {
    container,
    tryAdvanceTechniqueGrade,
    bumpState,
    gradeButton: () => container.querySelector<HTMLButtonElement>('.technique-advance'),
    sectionRows: () => container.querySelectorAll('.technique-section dl div').length,
    scene: () => container.querySelector('.technique-paper-scene'),
    noticeText: () => container.querySelector('.technique-notice')?.textContent ?? null,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('TechniquePanel (Huyen Kim scene 06)', () => {
  it('renders the canonical technique card, its sections, and the grade button with cost', async () => {
    const view = mountPanel({ technique: fixtureTechnique() })

    await nextTick()

    expect(view.scene()).not.toBeNull()
    expect(view.sectionRows()).toBeGreaterThan(0)
    expect(view.gradeButton()).not.toBeNull()

    view.unmount()
  })

  it('grade click runs tryAdvanceTechniqueGrade and bumps state on success only', async () => {
    const success = mountPanel({
      technique: fixtureTechnique({ rank: 10 }),
      realmId: 'foundation_establishment',
      materialAmount: 999,
    })

    await nextTick()
    success.gradeButton()!.click()
    await nextTick()

    expect(success.tryAdvanceTechniqueGrade).toHaveBeenCalledTimes(1)
    expect(success.bumpState).toHaveBeenCalledTimes(1)

    success.unmount()

    const failure = mountPanel({
      technique: fixtureTechnique({ rank: 10 }),
      realmId: 'foundation_establishment',
      materialAmount: 999,
      gradeResult: false,
    })

    await nextTick()
    failure.gradeButton()!.click()
    await nextTick()

    expect(failure.bumpState).not.toHaveBeenCalled()

    failure.unmount()
  })

  it('disables the grade button when the op precondition fails', async () => {
    // M-F-TECHNIQUE - catch-up-only: an in-band holder (grade == realm
    // index) has nothing to catch up to, so the precondition fails.
    const view = mountPanel({
      technique: fixtureTechnique({ rank: 10 }),
      realmId: 'qi_refining',
      materialAmount: 999,
    })

    await nextTick()

    expect(view.gradeButton()!.disabled).toBe(true)

    view.unmount()
  })

  it('shows the empty state with the grade CTA disabled when no technique is active', async () => {
    const view = mountPanel({ technique: undefined })

    await nextTick()

    const expected = i18n.global.t('panels.skillPath.technique.emptyNoTechnique')
    expect(view.container.textContent).toContain(expected)
    expect(view.gradeButton()!.disabled).toBe(true)

    view.unmount()
  })

  it('renders nothing when the technique scene is not open', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const stateVersion = ref(0)
    const app = createApp({ render: () => h(TechniquePanel) })
    const pinia = createPinia()
    app.use(pinia)
    app.use(i18n)
    app.provide(GAME_MANAGER_KEY, {} as GameManager)
    app.provide(STATE_VERSION_KEY, stateVersion)
    app.provide(BUMP_STATE_KEY, vi.fn())
    app.directive('tooltip', vTooltip)

    app.mount(container)
    await nextTick()

    expect(container.querySelector('.technique-paper-scene')).toBeNull()

    app.unmount()
    container.remove()
  })
})
