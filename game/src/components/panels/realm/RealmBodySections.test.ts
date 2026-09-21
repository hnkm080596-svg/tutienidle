// @vitest-environment jsdom
// P7-M7 - RealmPanel's body chapter subviews: the Luyen The tier block
// ported from the retired LuyenThePanel, and the new read-only Bat
// Mach (meridian) list. Both read through chapter-scoped seams.
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import BodyRefinementSection from './BodyRefinementSection.vue'
import MeridianSection from './MeridianSection.vue'
import { usePlayerStore } from '@/stores/player'
import { STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'
import type { Component } from 'vue'
import type { BodyProgressionState } from '@/core/realm/body/BodyChapter'

function mountSection(component: Component, setup: (player: ReturnType<typeof usePlayerStore>) => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({ render: () => h(component) })
  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})

  const player = usePlayerStore(pinia)
  setup(player)

  app.mount(container)

  return {
    container,
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
})
