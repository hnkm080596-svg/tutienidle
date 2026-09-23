// @vitest-environment jsdom
// P7-M7 - the consolidated progression view carries the way identity
// line (committed way name, 'Phan Nhan' for a way-less mortal) resolved
// through getActiveWayDefinition, plus the absorbed TechniqueBand.
import { describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import SkillPathPanel from './SkillPathPanel.vue'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import type { GameManager } from '@/core/game/GameManager'
import type { Skill } from '@/core/skill/Skill'

function mockGameManager(overrides: {
  skills?: Skill[]
  levels?: Record<string, number>
  costs?: Record<string, number | undefined>
  maxLevels?: Record<string, number>
  levelUpSkill?: (skillId: string) => boolean
} = {}): Partial<GameManager> {
  return {
    skillManager: {
      getAll: () => overrides.skills ?? [],
      get: (skillId: string) => (overrides.skills ?? []).find((skill) => skill.id === skillId),
    } as unknown as GameManager['skillManager'],
    getTurnBattle: () => null,
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
      getSkillLevel: (skillId: string) => overrides.levels?.[skillId] ?? 1,
      getSkillCoreUpgradeCost: (skillId: string) => overrides.costs?.[skillId],
      getSkillCoreMaxLevel: (skillId: string) => overrides.maxLevels?.[skillId] ?? 1,
      levelUpSkill: (skillId: string) => overrides.levelUpSkill?.(skillId) ?? false,
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

function mountPanel(
  setup: (player: ReturnType<typeof usePlayerStore>) => void,
  manager: Partial<GameManager> = mockGameManager(),
) {
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
  app.provide(GAME_MANAGER_KEY, manager as GameManager)
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

// M-QI-05 (D7 / oracle 14) - the Tree/Detail center-mode affordance:
// visible whenever showTree is true; native selection forces Detail;
// ordinary Skill selection keeps the current mode; both directions
// stay reachable and the upgrade affordance calls levelUpSkill.
describe('SkillPathPanel center mode (M-QI-05 oracle 14)', () => {
  function cardWithText(container: HTMLElement, text: string): HTMLElement | null {
    for (const card of container.querySelectorAll<HTMLElement>('.skill-path-list__card')) {
      if (card.textContent?.includes(text)) {
        return card
      }
    }

    return null
  }

  function modeTab(container: HTMLElement, text: string): HTMLElement | null {
    for (const tab of container.querySelectorAll<HTMLElement>('.skill-path-panel__mode-tab')) {
      if (tab.textContent?.includes(text)) {
        return tab
      }
    }

    return null
  }

  it('sword_pathway: native core entry forces detail, Tree tab restores the node view, upgrade calls levelUpSkill', async () => {
    const levelUpSkill = vi.fn(() => true)
    const manager = mockGameManager({
      costs: { orb_dam: 8 },
      maxLevels: { orb_dam: 10 },
      levelUpSkill,
    })

    const view = mountPanel((player) => {
      player.$state.realmId = 'qi_refining'
      player.$state.cultivationPath = 'sword'
      player.$state.cultivationWay = 'sword_pathway'
      player.$state.skillInsight = 100
      player.$state.nodeLevels['core_orb_dam'] = 1
      player.$state.purchasedNodeIds.push('core_orb_dam')
    }, manager)

    await nextTick()

    // Tree mode by default: tree mounted, mode tabs visible.
    expect(view.container.querySelector('.node-tree')).not.toBeNull()
    expect(modeTab(view.container, i18n.global.t('panels.skillPath.centerTabs.tree'))).not.toBeNull()
    expect(modeTab(view.container, i18n.global.t('panels.skillPath.centerTabs.detail'))).not.toBeNull()

    // The owned native core renders its canonical level + a card.
    const card = cardWithText(view.container, 'Lv. 1/10')
    expect(card).not.toBeNull()
    card!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    // Native selection forces detail: tree unmounts, NativeCoreDetail
    // renders (D7 discriminated surface - not the Skill-typed view).
    expect(view.container.querySelector('.node-tree')).toBeNull()
    expect(view.container.querySelector('.native-core-detail')).not.toBeNull()
    expect(view.container.querySelector('.skill-detail')).toBeNull()

    const upgrade = view.container.querySelector<HTMLButtonElement>('.native-core-detail__upgrade')
    expect(upgrade).not.toBeNull()
    expect(upgrade!.disabled).toBe(false)
    upgrade!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(levelUpSkill).toHaveBeenCalledWith('orb_dam')

    // Tree tab restores the node view.
    modeTab(view.container, i18n.global.t('panels.skillPath.centerTabs.tree'))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(view.container.querySelector('.node-tree')).not.toBeNull()

    view.unmount()
  })

  it('spell_pathway: skill selection keeps tree mode; Detail tab reaches the canonical upgrade surface', async () => {
    const levelUpSkill = vi.fn(() => true)
    const skill = {
      id: 'hoa_cau_thuat',
      name: 'Hỏa Cầu Thuật',
      type: 'active',
      level: 1,
      maxLevel: 10,
      description: '',
      effects: [],
      cooldown: 2,
      experience: 0,
      totalExperience: 0,
      requiredRealmId: 'qi_refining',
    } as unknown as Skill

    const manager = mockGameManager({
      skills: [skill],
      levels: { hoa_cau_thuat: 2 },
      costs: { hoa_cau_thuat: 8 },
      levelUpSkill,
    })

    const view = mountPanel((player) => {
      player.$state.realmId = 'qi_refining'
      player.$state.cultivationPath = 'spell'
      player.$state.cultivationWay = 'spell_pathway'
      player.$state.skillInsight = 100
      player.$state.nodeLevels['core_hoa_cau_thuat'] = 2
      player.$state.purchasedNodeIds.push('core_hoa_cau_thuat')
    }, manager)

    await nextTick()

    expect(view.container.querySelector('.node-tree')).not.toBeNull()

    // Ordinary skill selection preserves the current (tree) mode.
    const card = cardWithText(view.container, 'Hỏa Cầu Thuật')
    expect(card).not.toBeNull()
    card!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(view.container.querySelector('.node-tree')).not.toBeNull()
    expect(view.container.querySelector('.skill-detail')).toBeNull()

    // The Detail tab is always reachable and shows canonical level.
    modeTab(view.container, i18n.global.t('panels.skillPath.centerTabs.detail'))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(view.container.querySelector('.node-tree')).toBeNull()
    const detail = view.container.querySelector('.skill-detail')
    expect(detail).not.toBeNull()
    expect(detail!.textContent).toContain('Lv. 2/10')

    const upgrade = view.container.querySelector<HTMLButtonElement>('.skill-detail__upgrade')
    expect(upgrade!.disabled).toBe(false)
    upgrade!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(levelUpSkill).toHaveBeenCalledWith('hoa_cau_thuat')

    // And back to tree.
    modeTab(view.container, i18n.global.t('panels.skillPath.centerTabs.tree'))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(view.container.querySelector('.node-tree')).not.toBeNull()

    view.unmount()
  })
})
