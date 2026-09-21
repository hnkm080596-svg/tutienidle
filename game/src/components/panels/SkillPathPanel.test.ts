// @vitest-environment jsdom
// P7-M7 - the consolidated progression view carries the way identity
// line (committed way name, 'Phan Nhan' for a way-less mortal) resolved
// through getActiveWayDefinition, plus the absorbed TechniqueBand.
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import SkillPathPanel from './SkillPathPanel.vue'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import type { GameManager } from '@/core/game/GameManager'

function mockGameManager(): Partial<GameManager> {
  return {
    skillManager: {
      getAll: () => [],
      get: () => undefined,
    } as unknown as GameManager['skillManager'],
    techniqueManager: {
      getActive: () => undefined,
    } as unknown as GameManager['techniqueManager'],
    nodeRegistry: {
      getAll: () => [],
      get: () => undefined,
    } as unknown as GameManager['nodeRegistry'],
    materialBag: {
      getAmount: () => 0,
    } as unknown as GameManager['materialBag'],
    materialRegistry: {
      get: () => undefined,
    } as unknown as GameManager['materialRegistry'],
    realmAdvanceOps: {
      tryAdvanceTechniqueGrade: () => false,
    } as unknown as GameManager['realmAdvanceOps'],
    progressionOps: {
      getResolvedSkillRoles: () => ({ basic: { kind: 'dynamic', label: '—' } }),
      getSkillUpgradeInsightCost: () => 0,
      upgradeSkill: () => false,
      setMortalBasicSkill: () => false,
      selectSkillSpecialization: () => false,
      purchaseNode: () => false,
      upgradeNode: () => false,
      selectSpellPathElement: () => false,
      switchRoute: () => 0,
      devResetBranch: () => 0,
      allocateAttributePoint: () => false,
    } as unknown as GameManager['progressionOps'],
  }
}

function mountPanel(setup: (player: ReturnType<typeof usePlayerStore>) => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  // NodeTreePanel measures with ResizeObserver - jsdom stub.
  window.ResizeObserver = window.ResizeObserver || (class {
    observe() {}

    unobserve() {}

    disconnect() {}
  } as never)

  const app = createApp({ render: () => h(SkillPathPanel) })
  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, mockGameManager() as GameManager)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})
  app.directive('tooltip', vTooltip)

  const player = usePlayerStore(pinia)
  setup(player)
  useUiStore(pinia).standalonePanel = 'skill'

  app.mount(container)

  return {
    container,
    subtitle: () => container.querySelector('.skill-path-panel__subtitle')?.textContent ?? null,
    band: () => container.querySelector('.technique-band'),
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('SkillPathPanel way identity (P7-M7)', () => {
  it('a way-less mortal sees the Phan Nhan identity', async () => {
    const view = mountPanel(() => {})

    await nextTick()

    expect(view.subtitle()).toBe(i18n.global.t('panels.skillPath.mortalName'))
    // Mortal carries no canonical technique - the band shows its empty
    // state (the Nhap Mon hint) rather than nothing.
    expect(view.band()).not.toBeNull()
    expect(view.band()!.textContent).toContain(
      i18n.global.t('panels.skillPath.technique.emptyNoTechnique'),
    )

    view.unmount()
  })

  it('a committed way shows its self-describing name', async () => {
    const view = mountPanel((player) => {
      player.$state.realmId = 'qi_refining'
      player.$state.cultivationPath = 'sword'
      player.$state.cultivationWay = 'sword_pathway'
    })

    await nextTick()

    expect(view.subtitle()).toBe('Kiếm Tu — Ngự Kiếm Tâm Kinh')

    view.unmount()
  })
})
