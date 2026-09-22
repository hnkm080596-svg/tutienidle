// @vitest-environment jsdom
// P7-M7 + M-QI-01 - RealmPanel's body chapter subviews: the Luyen The
// tier block ported from the retired LuyenThePanel, and the Bat Mach
// (meridian) list whose next row carries the live manual invest action
// (QI-D1). Both read through chapter-scoped seams.
import { describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import BodyRefinementSection from './BodyRefinementSection.vue'
import MeridianSection from './MeridianSection.vue'
import { usePlayerStore } from '@/stores/player'
import { STATE_VERSION_KEY, BUMP_STATE_KEY, GAME_MANAGER_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'
import { baseGainKeys, BODY_REFINEMENT_TIERS } from '@/data/realm/BodyRefinement'
import { statLabel } from '@/core/stats/StatLabels'
import { GameManager } from '@/core/game/GameManager'
import { materials } from '@/data/materials/materials'
import { pills } from '@/data/pill/pills'
import { MERIDIANS } from '@/data/realm/Meridians'
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
      i18n.global.t('panels.realm.meridian.summary', { completed: 2, total: 9 }),
    )

    const rows = view.container.querySelectorAll('.meridian-section__row')
    expect(rows.length).toBe(9)
    expect(rows[0]!.classList.contains('meridian-section__row--opened')).toBe(true)
    expect(rows[1]!.classList.contains('meridian-section__row--opened')).toBe(true)
    // index 2 = am_kieu_mach - the sequential next row.
    expect(rows[2]!.classList.contains('meridian-section__row--next')).toBe(true)
    expect(rows[2]!.textContent).toContain(i18n.global.t('panels.realm.meridian.stateNext'))
    expect(rows[3]!.classList.contains('meridian-section__row--locked')).toBe(true)

    view.unmount()
  })

  it('the Ky Kinh row shows the Thien Dia Chi Kieu requirement when next', async () => {
    const view = mountSection(MeridianSection, (player) => {
      player.$state.realmId = 'qi_refining'
      player.$state.realmLevel = 18
      setBodyProgression(player, {
        meridian: {
          openedIds: [
            'nham_mach', 'doi_mach', 'am_kieu_mach', 'am_duy_mach',
            'duong_duy_mach', 'duong_kieu_mach', 'xung_mach', 'doc_mach',
          ],
        },
      })
    })

    await nextTick()

    const last = view.container.querySelectorAll('.meridian-section__row')[8]!
    expect(last.classList.contains('meridian-section__row--next')).toBe(true)
    expect(last.textContent).toContain(i18n.global.t('panels.realm.meridian.auxGate'))

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
    expect(rows.length).toBe(9)
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
      setBodyProgression(player, { meridian: { openedIds } })
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
        setBodyProgression(player, { meridian: { openedIds: [] } })
        manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 5)
      })

      await nextTick()

      const button = nextRowButton(view)
      expect(button).not.toBeNull()
      expect(button!.disabled).toBe(false)

      view.unmount()
    })

    it('gates the final meridian on thien_dia_chi_kieu possession (not consumed)', async () => {
      const opened8 = MERIDIANS.slice(0, 8).map((m) => m.id)

      const noAux = mountSection(MeridianSection, (player, manager) => {
        qiPlayer(player)
        setBodyProgression(player, { meridian: { openedIds: opened8 } })
        manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 40)
      })

      await nextTick()
      expect(nextRowButton(noAux)!.disabled).toBe(true)
      noAux.unmount()

      const withAux = mountSection(MeridianSection, (player, manager) => {
        qiPlayer(player)
        setBodyProgression(player, { meridian: { openedIds: opened8 } })
        manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 40)
        manager.materialBag.add(manager.materialRegistry.get('thien_dia_chi_kieu'), 1)
      })

      await nextTick()

      const button = nextRowButton(withAux)
      expect(button!.disabled).toBe(false)

      button!.click()
      await nextTick()

      expect(withAux.bumpState).toHaveBeenCalledTimes(1)
      expect(withAux.manager.materialBag.getAmount('thien_dia_chi_kieu')).toBe(1)
      expect(withAux.manager.pillBag.getAmount('thong_mach_dan')).toBe(0)

      withAux.unmount()
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
