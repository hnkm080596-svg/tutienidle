// @vitest-environment jsdom
// P7-M7 - the technique card + Nang Canh action absorbed from the
// retired TechniquePanel into SkillPathPanel's band. Mounts the real
// component through the project pattern (createApp + h + provide).
import { describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import TechniqueBand from './TechniqueBand.vue'
import { usePlayerStore } from '@/stores/player'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import type { Technique } from '@/core/technique/Technique'
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

function mountBand(options: MountOptions = {}) {
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
    } as unknown as GameManager['realmAdvanceOps'],
    materialBag: {
      getAmount: () => options.materialAmount ?? 0,
    } as unknown as GameManager['materialBag'],
    materialRegistry: {
      get: (id: string) => ({ id, name: `Mat ${id}` }),
    } as unknown as GameManager['materialRegistry'],
  }

  const app = createApp({ render: () => h(TechniqueBand) })
  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gameManager as GameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, bumpState)
  app.directive('tooltip', vTooltip)

  const player = usePlayerStore(pinia)
  player.$state.realmId = options.realmId ?? 'qi_refining'

  app.mount(container)

  return {
    container,
    tryAdvanceTechniqueGrade,
    bumpState,
    gradeButton: () => container.querySelector<HTMLButtonElement>('.technique-band__grade-btn'),
    sectionRows: () => container.querySelectorAll('.technique-band__rows li').length,
    emptyText: () => container.querySelector('.technique-band .empty-state, .technique-band__empty')?.textContent ?? null,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('TechniqueBand (P7-M7)', () => {
  it('renders the canonical technique card, its sections, and the grade button with cost', async () => {
    const view = mountBand({ technique: fixtureTechnique() })

    await nextTick()

    expect(view.container.querySelector('.technique-band')).not.toBeNull()
    expect(view.sectionRows()).toBeGreaterThan(0)
    expect(view.gradeButton()).not.toBeNull()

    view.unmount()
  })

  it('grade click runs tryAdvanceTechniqueGrade and bumps state on success only', async () => {
    const success = mountBand({
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

    const failure = mountBand({
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
    // rank 0 < TECHNIQUE_RANK_CAP -> canAdvanceTechniqueGrade false.
    const view = mountBand({
      technique: fixtureTechnique({ rank: 0 }),
      realmId: 'foundation_establishment',
      materialAmount: 999,
    })

    await nextTick()

    expect(view.gradeButton()!.disabled).toBe(true)

    view.unmount()
  })

  it('shows the mortal empty state without the grade button when no technique is active', async () => {
    const view = mountBand({ technique: undefined })

    await nextTick()

    const expected = i18n.global.t('panels.skillPath.technique.emptyNoTechnique')
    expect(view.container.textContent).toContain(expected)
    expect(view.gradeButton()).toBeNull()

    view.unmount()
  })
})
