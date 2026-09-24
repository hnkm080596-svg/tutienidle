// @vitest-environment jsdom
// P7-M7 + M-QI-01 - RealmPanel's body chapter subviews: the Luyen The
// tier block ported from the retired LuyenThePanel, and the Bat Mach
// (meridian) list whose next row carries the live manual invest action
// (QI-D1), and the Chu Thien (zhou_tian) circulation row (M-F-CHU-THIEN).
// All read through chapter-scoped seams.
import { describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import BodyRefinementSection from './BodyRefinementSection.vue'
import MeridianSection from './MeridianSection.vue'
import ZhouTianSection from './ZhouTianSection.vue'
import { usePlayerStore } from '@/stores/player'
import { STATE_VERSION_KEY, BUMP_STATE_KEY, GAME_MANAGER_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'
import { baseGainKeys, BODY_REFINEMENT_TIERS } from '@/data/realm/BodyRefinement'
import { statLabel } from '@/core/stats/StatLabels'
import { GameManager } from '@/core/game/GameManager'
import { materials } from '@/data/materials/materials'
import { pills } from '@/data/pill/pills'
import { MERIDIANS } from '@/data/realm/Meridians'
import { ZHOU_TIAN_CURRENCY_MATERIAL_ID } from '@/data/realm/ZhouTian'
import type { Component } from 'vue'
import type { BodyProgressionState } from '@/core/realm/body/BodyChapter'

function mountSection(
  component: Component,
  setup: (player: ReturnType<typeof usePlayerStore>, manager: GameManager) => void,
) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({ render: () => h(component) })
  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)
  const stateVersion = ref(0)
  app.provide(STATE_VERSION_KEY, stateVersion)
  // Mirror production: bumpState both records the call (spy assertion)
  // AND increments stateVersion so stateVersion-gated computeds rerun.
  const bumpState = vi.fn(() => {
    stateVersion.value += 1
  })
  app.provide(BUMP_STATE_KEY, bumpState)

  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerPills(pills)
  app.provide(GAME_MANAGER_KEY, manager)

  const player = usePlayerStore(pinia)
  setup(player, manager)

  app.mount(container)

  return {
    container,
    manager,
    bumpState,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

function setBodyProgression(
  player: ReturnType<typeof usePlayerStore>,
  patch: Partial<BodyProgressionState>,
) {
  player.$state.bodyProgression = {
    ...player.$state.bodyProgression,
    ...patch,
  }
}

describe('BodyRefinementSection (P7-M7)', () => {
  // M-QI-07 (QI-D4) - the section surfaces the persisted physiqueGrade
  // through the canonical read model: a localized physique line that
  // stays a pure read (no transformation logic in the component).
  it('renders the localized physique grade line for the seeded grade', async () => {
    const fresh = mountSection(BodyRefinementSection, (player) => {
      player.$state.realmId = 'mortal'
    })
    await nextTick()

    expect(fresh.container.querySelector('.body-refinement__physique')?.textContent)
      .toContain('Phàm Thể')
    fresh.unmount()

    const transformed = mountSection(BodyRefinementSection, (player) => {
      player.$state.realmId = 'qi_refining'
      player.$state.physiqueGrade = 'bao'
      setBodyProgression(player, {
        body_refinement: { completedTiers: 6, currentTierProgress: 0 },
      })
    })
    await nextTick()

    expect(transformed.container.querySelector('.body-refinement__physique')?.textContent)
      .toContain('Bảo Thể')
    transformed.unmount()
  })

  // QA sync hypothesis: the transform can fire while the panel is
  // already mounted (tick auto-invest writes the grade on the reactive
  // store state) - the line must update without a remount/reload.
  it('updates the physique line when the grade flips mid-session', async () => {
    let store: ReturnType<typeof usePlayerStore> | undefined
    const view = mountSection(BodyRefinementSection, (player) => {
      store = player
      player.$state.realmId = 'mortal'
    })
    await nextTick()

    expect(view.container.querySelector('.body-refinement__physique')?.textContent)
      .toContain('Phàm Thể')

    // Simulate the tick-time transform: the domain write lands on the
    // store state and bumps stateVersion (same as every other op).
    store!.$state.physiqueGrade = 'bao'
    view.bumpState()
    await nextTick()

    expect(view.container.querySelector('.body-refinement__physique')?.textContent)
      .toContain('Bảo Thể')
    view.unmount()
  })

  it('renders the tier rows with done/active/locked states from chapter state', async () => {
    const view = mountSection(BodyRefinementSection, (player) => {
      // Mortal floor 3 - tier 0 done, tier 1 (requiredRealmLevel 4)
      // realm-gated.
      player.$state.realmId = 'mortal'
      player.$state.realmLevel = 3
      setBodyProgression(player, {
        body_refinement: { completedTiers: 1, currentTierProgress: 10 },
      })
    })

    await nextTick()

    const expectedSummary = i18n.global.t('panels.realm.bodyRefinement.summary', { completed: 1 })
    expect(view.container.textContent).toContain(expectedSummary)

    const rows = view.container.querySelectorAll('.body-refinement__tier')
    expect(rows.length).toBe(6)
    expect(rows[0]!.classList.contains('body-refinement__tier--done')).toBe(true)
    expect(rows[1]!.classList.contains('body-refinement__tier--realm_locked')).toBe(true)

    view.unmount()
  })

  // M-F (D1) - tier stat labels derive from the typed baseGains keys
  // (Luyen Mach renders both of its stats), never from the retired
  // percent-modifier data shape.
  it('renders each tier\'s stat labels from its baseGains keys', async () => {
    const view = mountSection(BodyRefinementSection, (player) => {
      player.$state.realmId = 'qi_refining'
      setBodyProgression(player, {
        body_refinement: { completedTiers: 0, currentTierProgress: 0 },
      })
    })

    await nextTick()

    const statSpans = view.container.querySelectorAll('.body-refinement__tier-stat')
    expect(statSpans.length).toBe(BODY_REFINEMENT_TIERS.length)

    BODY_REFINEMENT_TIERS.forEach((tier, index) => {
      const expected = baseGainKeys(tier.baseGains)
        .map(stat => statLabel(stat))
        .join(' / ')
      expect(statSpans[index]!.textContent).toBe(expected)
    })

    // The 2-stat Luyen Mach tier is the shape that forced baseGains to
    // be a per-stat record - pin its joined label explicitly.
    const machIndex = BODY_REFINEMENT_TIERS.findIndex(
      tier => baseGainKeys(tier.baseGains).length === 2,
    )
    expect(machIndex).toBeGreaterThanOrEqual(0)
    expect(statSpans[machIndex]!.textContent).toContain(' / ')

    view.unmount()
  })

  it('shows the complete empty state when every tier is done', async () => {
    const view = mountSection(BodyRefinementSection, (player) => {
      setBodyProgression(player, {
        body_refinement: { completedTiers: 6, currentTierProgress: 0 },
      })
    })

    await nextTick()

    expect(view.container.textContent).toContain(
      i18n.global.t('panels.realm.bodyRefinement.empty'),
    )

    view.unmount()
  })
})

describe('MeridianSection (P7-M7)', () => {
  it('renders opened/next/locked rows from canonical chapter state', async () => {
    const view = mountSection(MeridianSection, (player) => {
      player.$state.realmId = 'qi_refining'
      player.$state.realmLevel = 6
      setBodyProgression(player, {
        meridian: { openedIds: ['nham_mach', 'doi_mach'] },
      })
    })

    await nextTick()

    expect(view.container.textContent).toContain(
      i18n.global.t('panels.realm.meridian.summary', { completed: 2, total: 8 }),
    )

    const rows = view.container.querySelectorAll('.meridian-section__row')
    expect(rows.length).toBe(8)
    expect(rows[0]!.classList.contains('meridian-section__row--opened')).toBe(true)
    expect(rows[1]!.classList.contains('meridian-section__row--opened')).toBe(true)
    // index 2 = am_kieu_mach - the sequential next row.
    expect(rows[2]!.classList.contains('meridian-section__row--next')).toBe(true)
    expect(rows[2]!.textContent).toContain(i18n.global.t('panels.realm.meridian.stateNext'))
    expect(rows[3]!.classList.contains('meridian-section__row--locked')).toBe(true)

    view.unmount()
  })

  // M-E (D2) - page model: a mortal player's realm index is below the
  // qi_refining page's, so the whole page renders locked-preview - no
  // 'next' affordance, no cost/gate lines, page-level lock label.
  it('renders the qi_refining page as locked-preview for a mortal player', async () => {
    const view = mountSection(MeridianSection, (player) => {
      player.$state.realmId = 'mortal'
      player.$state.realmLevel = 10
      setBodyProgression(player, { meridian: { openedIds: [] } })
    })

    await nextTick()

    expect(view.container.textContent).toContain(
      i18n.global.t('panels.realm.meridian.pageLocked', { realm: 'Luyện Khí' }),
    )

    const rows = view.container.querySelectorAll('.meridian-section__row')
    expect(rows.length).toBe(8)
    for (const row of rows) {
      expect(row.classList.contains('meridian-section__row--locked')).toBe(true)
    }
    expect(view.container.querySelector('.meridian-section__row--next')).toBeNull()
    expect(view.container.querySelector('.meridian-section__row-gate')).toBeNull()

    view.unmount()
  })

  // M-E (D2) - an unlocked page past its own realm keeps sequential
  // rows but suppresses the realm-pace label (it only paces inside the
  // page's realm).
  it('suppresses the pace label once past the page realm (Truc Co)', async () => {
    const view = mountSection(MeridianSection, (player) => {
      player.$state.realmId = 'foundation_establishment'
      player.$state.realmLevel = 1
      setBodyProgression(player, {
        meridian: { openedIds: ['nham_mach', 'doi_mach'] },
      })
    })

    await nextTick()

    const rows = view.container.querySelectorAll('.meridian-section__row')
    expect(rows[2]!.classList.contains('meridian-section__row--next')).toBe(true)
    // Cost still shows (the sequential contract is realm-independent)...
    expect(rows[2]!.textContent).toContain(
      i18n.global.t('panels.realm.meridian.cost', { count: 4 }),
    )
    // ...but the pace label does not render cross-realm.
    expect(view.container.textContent).not.toContain(
      i18n.global.t('panels.realm.meridian.realmGate', { realm: 'Luyện Khí', level: 6 }),
    )

    view.unmount()
  })

  // M-QI-01 (QI-D1) - the invest action wires MeridianSection's next
  // row to realmAdvanceOps.investBodyChapter(player, 'meridian'). The
  // button is presentation convenience only - the chapter stays sole
  // authority and re-validates on every click.
  describe('invest wiring (M-QI-01)', () => {
    function qiPlayer(
      player: ReturnType<typeof usePlayerStore>,
      realmLevel = 18,
      openedIds: string[] = [],
    ) {
      player.$state.realmId = 'qi_refining'
      player.$state.realmLevel = realmLevel
      // M-F-CHU-THIEN (C2C-59): meridian invest is sequentially gated
      // on completed refinement - investable fixtures carry the chain.
      player.$state.physiqueGrade = 'bao'
      setBodyProgression(player, {
        body_refinement: { completedTiers: 6, currentTierProgress: 0 },
        meridian: { openedIds },
      })
    }

    function nextRowButton(view: { container: HTMLElement }) {
      const nextRow = view.container.querySelector('.meridian-section__row--next')
      return nextRow?.querySelector('button') ?? null
    }

    it('invests the next meridian on click: openedIds grows, pill debited, bumpState fired', async () => {
      let state!: ReturnType<typeof usePlayerStore>['$state']
      const view = mountSection(MeridianSection, (player, manager) => {
        state = player.$state
        qiPlayer(player)
        manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 5)
      })

      await nextTick()

      const button = nextRowButton(view)
      expect(button).not.toBeNull()
      expect(button!.disabled).toBe(false)

      button!.click()
      await nextTick()

      expect(state.bodyProgression.meridian.openedIds).toEqual(['nham_mach'])
      expect(view.bumpState).toHaveBeenCalledTimes(1)
      expect(view.manager.pillBag.getAmount('thong_mach_dan')).toBe(4)
      // The invested row flips to opened; the next sequential row
      // becomes the new next.
      const rows = view.container.querySelectorAll('.meridian-section__row')
      expect(rows[0]!.classList.contains('meridian-section__row--opened')).toBe(true)
      expect(rows[1]!.classList.contains('meridian-section__row--next')).toBe(true)

      view.unmount()
    })

    it('disables the button when thong_mach_dan is insufficient', async () => {
      const view = mountSection(MeridianSection, (player) => {
        qiPlayer(player)
      })

      await nextTick()

      const button = nextRowButton(view)
      expect(button).not.toBeNull()
      expect(button!.disabled).toBe(true)

      view.unmount()
    })

    it('paces the button by in-page-realm level', async () => {
      const low = mountSection(MeridianSection, (player, manager) => {
        qiPlayer(player, 1) // nham_mach needs level 2
        manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 5)
      })

      await nextTick()
      expect(nextRowButton(low)!.disabled).toBe(true)
      low.unmount()

      const high = mountSection(MeridianSection, (player, manager) => {
        qiPlayer(player, 2)
        manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 5)
      })

      await nextTick()
      expect(nextRowButton(high)!.disabled).toBe(false)
      high.unmount()
    })

    it('keeps the lower page investable past its realm (no pace gate cross-realm)', async () => {
      const view = mountSection(MeridianSection, (player, manager) => {
        player.$state.realmId = 'foundation_establishment'
        player.$state.realmLevel = 1
        player.$state.physiqueGrade = 'bao'
        setBodyProgression(player, {
          body_refinement: { completedTiers: 6, currentTierProgress: 0 },
          meridian: { openedIds: [] },
        })
        manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 5)
      })

      await nextTick()

      const button = nextRowButton(view)
      expect(button).not.toBeNull()
      expect(button!.disabled).toBe(false)

      view.unmount()
    })

    it('the final meridian needs no material aux - pills alone open it (sec.19: ninth meridian retired)', async () => {
      const opened7 = MERIDIANS.slice(0, 7).map((m) => m.id)

      const view = mountSection(MeridianSection, (player, manager) => {
        qiPlayer(player)
        setBodyProgression(player, { meridian: { openedIds: opened7 } })
        manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 40)
      })

      await nextTick()

      const button = nextRowButton(view)
      expect(button).not.toBeNull()
      expect(button!.disabled).toBe(false)

      button!.click()
      await nextTick()

      expect(view.bumpState).toHaveBeenCalledTimes(1)
      // doc_mach costs 30 thong_mach_dan - nothing else is checked.
      expect(view.manager.pillBag.getAmount('thong_mach_dan')).toBe(10)

      view.unmount()
    })

    it('renders no invest button for a mortal player (locked page)', async () => {
      const view = mountSection(MeridianSection, (player) => {
        player.$state.realmId = 'mortal'
        player.$state.realmLevel = 10
        setBodyProgression(player, { meridian: { openedIds: [] } })
      })

      await nextTick()

      expect(view.container.querySelector('.meridian-section__row--next')).toBeNull()
      expect(view.container.querySelector('button')).toBeNull()

      view.unmount()
    })

    it('renders no button on opened or locked rows', async () => {
      const view = mountSection(MeridianSection, (player, manager) => {
        qiPlayer(player, 6, ['nham_mach', 'doi_mach'])
        manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 10)
      })

      await nextTick()

      const rows = view.container.querySelectorAll('.meridian-section__row')
      expect(rows[0]!.querySelector('button')).toBeNull()
      expect(rows[1]!.querySelector('button')).toBeNull()
      expect(rows[3]!.querySelector('button')).toBeNull()
      // Exactly one button exists - the single global next row.
      expect(view.container.querySelectorAll('button').length).toBe(1)

      view.unmount()
    })
  })
})

// M-F-CHU-THIEN - the Chu Thien section: sequential lock on the
// meridian chapter (C2C-59), realm capacity gating, milestone labels
// (180 Tieu / 360 Dai), and the live invest action through
// realmAdvanceOps.investBodyChapter(player, 'zhou_tian').
describe('ZhouTianSection (M-F-CHU-THIEN)', () => {
  function tcPlayer(
    player: ReturnType<typeof usePlayerStore>,
    realmLevel = 18,
    circulation = 0,
    { meridianComplete = true } = {},
  ) {
    player.$state.realmId = 'foundation_establishment'
    player.$state.realmLevel = realmLevel
    player.$state.physiqueGrade = 'bao'
    setBodyProgression(player, {
      body_refinement: { completedTiers: 6, currentTierProgress: 0 },
      meridian: { openedIds: meridianComplete ? MERIDIANS.map(m => m.id) : [] },
      zhou_tian: { circulation },
    })
  }

  function investButton(view: { container: HTMLElement }) {
    return view.container
      .querySelector<HTMLButtonElement>('.zhou-tian-section__invest button') ?? null
  }

  it('locked: hidden behind the sequential gate until the meridian chapter completes', async () => {
    const view = mountSection(ZhouTianSection, (player) => {
      tcPlayer(player, 18, 0, { meridianComplete: false })
    })

    await nextTick()

    expect(view.container.textContent).toContain('Phong ấn')
    expect(investButton(view)).toBeNull()

    view.unmount()
  })

  it('realm_locked: unlocked sequentially but zero capacity outside Truc Co', async () => {
    const view = mountSection(ZhouTianSection, (player) => {
      player.$state.realmId = 'mortal'
      player.$state.realmLevel = 10
      player.$state.physiqueGrade = 'bao'
      setBodyProgression(player, {
        body_refinement: { completedTiers: 6, currentTierProgress: 0 },
        meridian: { openedIds: MERIDIANS.map(m => m.id) },
        zhou_tian: { circulation: 0 },
      })
    })

    await nextTick()

    expect(view.container.textContent).toContain('Chưa tới cảnh giới')
    expect(investButton(view)).toBeNull()

    view.unmount()
  })

  it('active: shows capacity, milestones, and an enabled invest when essence is owned', async () => {
    const view = mountSection(ZhouTianSection, (player, manager) => {
      tcPlayer(player, 9, 179) // Tieu boundary minus one
      manager.materialBag.add(manager.materialRegistry.get(ZHOU_TIAN_CURRENCY_MATERIAL_ID), 5)
    })

    await nextTick()

    const text = view.container.textContent ?? ''
    expect(text).toContain('Đang vận chuyển')
    expect(text).toContain('Dung lượng hiện tại: 180')
    const button = investButton(view)
    expect(button).not.toBeNull()
    expect(button!.disabled).toBe(false)

    // C2C-75 - the capacity bar fills against the CURRENT realm
    // capacity (179/180 ~99%), never the absolute 360 ceiling.
    const bar = view.container.querySelector('[role="progressbar"]')
    expect(bar).not.toBeNull()
    expect(bar!.getAttribute('aria-valuemax')).toBe('180')
    expect(bar!.getAttribute('aria-valuenow')).toBe('179')

    view.unmount()
  })

  it('complete: circulation 360 renders the Dai state and no invest control', async () => {
    const view = mountSection(ZhouTianSection, (player) => {
      tcPlayer(player, 18, 360)
    })

    await nextTick()

    const text = view.container.textContent ?? ''
    expect(text).toContain('Đại Chu Thiên')
    expect(text).toContain('Đại Chu Thiên đã viên mãn')
    expect(investButton(view)).toBeNull()

    view.unmount()
  })

  it('invest click circulates up to capacity, debits essence, and fires bumpState', async () => {
    let state!: ReturnType<typeof usePlayerStore>['$state']
    const view = mountSection(ZhouTianSection, (player, manager) => {
      state = player.$state
      tcPlayer(player, 1, 15) // capacity 20, room 5
      manager.materialBag.add(manager.materialRegistry.get(ZHOU_TIAN_CURRENCY_MATERIAL_ID), 10)
    })

    await nextTick()

    const button = investButton(view)
    expect(button!.disabled).toBe(false)

    button!.click()
    await nextTick()

    expect(state.bodyProgression.zhou_tian.circulation).toBe(20)
    expect(view.bumpState).toHaveBeenCalledTimes(1)
    expect(view.manager.materialBag.getAmount(ZHOU_TIAN_CURRENCY_MATERIAL_ID)).toBe(5)

    // After filling to capacity the button is disabled.
    expect(investButton(view)!.disabled).toBe(true)

    // The bar max follows the same current capacity (20/20 = full).
    const bar = view.container.querySelector('[role="progressbar"]')
    expect(bar!.getAttribute('aria-valuemax')).toBe('20')
    expect(bar!.getAttribute('aria-valuenow')).toBe('20')

    view.unmount()
  })
})
