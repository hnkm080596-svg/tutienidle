// @vitest-environment jsdom
// Scene 08 (Luyen The) fidelity integration: the paper 3-page surface
// mounted through BodySurface. Pins the same canonical contracts the
// retired BodyScene suite owned: physique line, tier/meridian/zhou_tian
// unit states, live invest wiring (realmAdvanceOps.investBodyChapter),
// sequential+realm gates, hidden-row reveal rules (AUTH-2).
import { describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import BodySurface from './BodySurface.vue'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
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

function mountScene(
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

  // jsdom lacks the Web Animations API the paper figure's meridian
  // sweep reads - stub the pieces it touches.
  if (document.timeline === undefined) {
    Object.defineProperty(document, 'timeline', {
      value: { currentTime: 0 },
      configurable: true,
    })
  }
  if (!Element.prototype.animate) {
    Element.prototype.animate = (() => ({
      cancel() {},
      finished: Promise.resolve(),
    })) as unknown as typeof Element.prototype.animate
  }

  const player = usePlayerStore(pinia)
  setup(player, manager)
  useUiStore(pinia).standalonePanel = 'body'

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

const mountBodyScene = (
  setup: (player: ReturnType<typeof usePlayerStore>, manager: GameManager) => void,
) => mountScene(BodySurface, setup)

function setBodyProgression(
  player: ReturnType<typeof usePlayerStore>,
  patch: Partial<BodyProgressionState>,
) {
  player.$state.bodyProgression = {
    ...player.$state.bodyProgression,
    ...patch,
  }
}

const UI_CHAPTER_INDEX: Record<string, number> = { body_refinement: 0, meridian: 1, zhou_tian: 2 }

async function selectChapter(view: { container: HTMLElement }, id: string) {
  const buttons = view.container.querySelectorAll<HTMLButtonElement>('.body-chapters button')
  const seal = buttons[UI_CHAPTER_INDEX[id]!]
  expect(seal).toBeDefined()
  seal!.click()
  await nextTick()
}

function chapterButtons(view: { container: HTMLElement }) {
  return view.container.querySelectorAll<HTMLButtonElement>('.body-chapters button')
}

function investButton(view: { container: HTMLElement }) {
  return view.container.querySelector<HTMLButtonElement>('.body-invest')
}

describe('BodySurface (scene 08 fidelity)', () => {
  it('renders the paper regions with the three chapter seals', async () => {
    const view = mountBodyScene((player) => {
      player.$state.realmId = 'mortal'
    })
    await nextTick()

    expect(view.container.querySelector('.body-paper-scene')).not.toBeNull()
    expect(view.container.querySelector('.body-paper-figure')).not.toBeNull()
    expect(view.container.querySelector('.body-paper-details')).not.toBeNull()

    const seals = chapterButtons(view)
    expect(seals.length).toBe(3)
    // Mortal start: only Luyen The unlocked; the later chapters seal.
    expect(seals[1]!.classList.contains('is-locked')).toBe(true)
    expect(seals[2]!.classList.contains('is-locked')).toBe(true)

    view.unmount()
  })

  it('renders the approved figure art per chapter', async () => {
    const view = mountBodyScene((player) => {
      player.$state.realmId = 'mortal'
    })
    await nextTick()

    const figure = view.container.querySelector<HTMLImageElement>('.body-figure-art')
    expect(figure?.getAttribute('src')).toContain('silhouette-seated')

    view.unmount()
  })

  it('renders every authored meridian orb lit by real progress', async () => {
    const view = mountBodyScene((player) => {
      player.$state.realmId = 'qi_refining'
      player.$state.physiqueGrade = 'bao'
      setBodyProgression(player, {
        body_refinement: { completedTiers: 6, currentTierProgress: 0 },
        meridian: { progress: { nham_mach: 100, doi_mach: 100 } },
      })
    })
    await nextTick()
    await selectChapter(view, 'meridian')

    // All 8 nodes render (locked dimmed): the opened two 'done', the
    // next sequential 'current', the tail 'locked'.
    const orbs = view.container.querySelectorAll('.body-orb')
    expect(orbs.length).toBe(8)
    expect(orbs[0]!.classList.contains('done')).toBe(true)
    expect(orbs[1]!.classList.contains('done')).toBe(true)
    expect(orbs[2]!.classList.contains('current')).toBe(true)
    expect(orbs[7]!.classList.contains('locked')).toBe(true)

    view.unmount()
  })

  describe('Luyen The chapter (body_refinement)', () => {
    it('renders the persisted physique grade line', async () => {
      const fresh = mountBodyScene((player) => {
        player.$state.realmId = 'mortal'
      })
      await nextTick()
      expect(fresh.container.querySelector('.body-heading p')?.textContent)
        .toContain('Phàm Thể')
      fresh.unmount()

      const transformed = mountBodyScene((player) => {
        player.$state.realmId = 'qi_refining'
        player.$state.physiqueGrade = 'bao'
        setBodyProgression(player, {
          body_refinement: { completedTiers: 6, currentTierProgress: 0 },
        })
      })
      await nextTick()
      // Completed refinement makes meridian the default chapter - open
      // the Luyen The seal first.
      await selectChapter(transformed, 'body_refinement')
      expect(transformed.container.querySelector('.body-heading p')?.textContent)
        .toContain('Bảo Thể')
      transformed.unmount()
    })

    it('updates the physique line when the grade flips mid-session', async () => {
      let store: ReturnType<typeof usePlayerStore> | undefined
      const view = mountBodyScene((player) => {
        store = player
        player.$state.realmId = 'mortal'
      })
      await nextTick()
      expect(view.container.querySelector('.body-heading p')?.textContent)
        .toContain('Phàm Thể')

      store!.$state.physiqueGrade = 'bao'
      view.bumpState()
      await nextTick()
      expect(view.container.querySelector('.body-heading p')?.textContent)
        .toContain('Bảo Thể')
      view.unmount()
    })

    it('shows the aggregated stat total of every completed tier', async () => {
      const view = mountBodyScene((player) => {
        player.$state.realmId = 'qi_refining'
        setBodyProgression(player, {
          // Four tiers done: the card totals their combined gains.
          body_refinement: { completedTiers: 4, currentTierProgress: 0 },
        })
      })
      await nextTick()

      const expectedTotals = new Map<string, number>()
      for (const tier of BODY_REFINEMENT_TIERS.slice(0, 4)) {
        for (const stat of baseGainKeys(tier.baseGains)) {
          expectedTotals.set(statLabel(stat), (expectedTotals.get(statLabel(stat)) ?? 0) + (tier.baseGains[stat] ?? 0))
        }
      }
      const rows = [...view.container.querySelectorAll('.body-paper-details dl div')]
        .map(div => [div.querySelector('dt')?.textContent ?? '', div.querySelector('dd')?.textContent ?? ''])
      const got = new Map(rows.map(([label, value]) => [label, Number.parseFloat(value ?? '')]))
      expect(got.size).toBe(expectedTotals.size)
      for (const [label, total] of expectedTotals) {
        expect(got.get(label)).toBeCloseTo(total)
      }

      view.unmount()
    })

    it('drops the invest CTA once every tier is done', async () => {
      const view = mountBodyScene((player) => {
        player.$state.realmId = 'qi_refining'
        setBodyProgression(player, {
          body_refinement: { completedTiers: 6, currentTierProgress: 0 },
        })
      })
      await nextTick()

      // Completed refinement hands the default chapter to meridian -
      // view the Luyen The card explicitly.
      await selectChapter(view, 'body_refinement')
      // Every tier done: no invest affordance.
      expect(investButton(view)?.disabled ?? true).toBe(true)

      view.unmount()
    })

    it('AUTH-2: a frozen hidden record renders no extra row', async () => {
      const frozen = mountBodyScene((player) => {
        player.$state.hiddenPerfection.realms['mortal'] = {
          discovered: true,
          bodyCompleted: false,
          frozen: true,
        }
      })
      await nextTick()
      expect(frozen.container.querySelector('.body-extra')).toBeNull()
      frozen.unmount()

      const active = mountBodyScene((player) => {
        player.$state.hiddenPerfection.realms['mortal'] = {
          discovered: true,
          bodyCompleted: false,
          frozen: false,
        }
      })
      await nextTick()
      expect(active.container.querySelector('.body-extra')).not.toBeNull()
      active.unmount()
    })
  })

  describe('Bat Mach chapter (meridian)', () => {
    function qiPlayer(
      player: ReturnType<typeof usePlayerStore>,
      realmLevel = 18,
      opened: string[] = [],
    ) {
      player.$state.realmId = 'qi_refining'
      player.$state.realmLevel = realmLevel
      // Sequential gate: meridian invest requires completed refinement.
      player.$state.physiqueGrade = 'bao'
      setBodyProgression(player, {
        body_refinement: { completedTiers: 6, currentTierProgress: 0 },
        meridian: { progress: Object.fromEntries(opened.map((id) => [id, 100])) },
      })
    }

    it('renders the next meridian card with done/current/locked chips', async () => {
      const view = mountBodyScene((player) => {
        qiPlayer(player, 6, ['nham_mach', 'doi_mach'])
      })
      await nextTick()

      await selectChapter(view, 'meridian')

      const title = view.container.querySelector('.body-paper-details h2')
      // The next sequential node (am_kieu_mach) is the default card.
      expect(title?.textContent).toContain('Âm Kiều Mạch')

      // All 8 nodes render (locked dimmed): opened two 'done', the
      // next 'current', the rest 'locked'.
      const orbs = view.container.querySelectorAll('.body-orb')
      expect(orbs.length).toBe(8)
      expect(orbs[0]!.classList.contains('done')).toBe(true)
      expect(orbs[1]!.classList.contains('done')).toBe(true)
      expect(orbs[2]!.classList.contains('current')).toBe(true)
      expect(orbs[7]!.classList.contains('locked')).toBe(true)

      view.unmount()
    })

    it('mortal player: page locked - all chips locked + page gate', async () => {
      const view = mountBodyScene((player) => {
        player.$state.realmId = 'mortal'
        player.$state.realmLevel = 10
        setBodyProgression(player, {
          body_refinement: { completedTiers: 6, currentTierProgress: 0 },
          meridian: { progress: {} },
        })
      })
      await nextTick()

      await selectChapter(view, 'meridian')

      // The page realm is out of reach: no meridian rows render at
      // all - the card shows only the real unlock condition.
      expect(view.container.textContent).toContain(
        i18n.global.t('panels.realm.meridian.pageLocked', { realm: 'Luyện Khí' }),
      )
      const orbs = view.container.querySelectorAll('.body-orb')
      expect(orbs.length).toBe(8)
      expect(orbs[0]!.classList.contains('locked')).toBe(true)
      expect(orbs[7]!.classList.contains('locked')).toBe(true)
      // The CTA renders but stays disabled behind the page gate.
      expect(investButton(view)?.disabled ?? false).toBe(true)

      view.unmount()
    })

    it('invests the next meridian on click: progress grows, 1 pill debited, bumpState fired', async () => {
      let state!: ReturnType<typeof usePlayerStore>['$state']
      const view = mountBodyScene((player, manager) => {
        state = player.$state
        qiPlayer(player)
        manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 5)
      })
      await nextTick()

      await selectChapter(view, 'meridian')

      const button = investButton(view)
      expect(button).not.toBeNull()
      expect(button!.disabled).toBe(false)

      button!.click()
      await nextTick()

      // Progressive invest: one pill adds a partial gain (nham 5~10),
      // the meridian stays 'next' until it reaches 100.
      const progress = state.bodyProgression.meridian.progress.nham_mach
      expect(progress).toBeGreaterThanOrEqual(5)
      expect(progress).toBeLessThanOrEqual(10)
      expect(view.bumpState).toHaveBeenCalledTimes(1)
      expect(view.manager.pillBag.getAmount('thong_mach_dan')).toBe(4)

      const orbs = view.container.querySelectorAll('.body-orb')
      // The still-investable nham stays 'current'; locked nodes dim.
      expect(orbs.length).toBe(8)
      expect(orbs[0]!.classList.contains('current')).toBe(true)
      expect(orbs[1]!.classList.contains('locked')).toBe(true)

      view.unmount()
    })

    it('disables the CTA when thong_mach_dan is insufficient', async () => {
      const view = mountBodyScene((player) => {
        qiPlayer(player)
      })
      await nextTick()

      await selectChapter(view, 'meridian')

      const button = investButton(view)
      expect(button).not.toBeNull()
      expect(button!.disabled).toBe(true)

      view.unmount()
    })

    it('paces the CTA by in-page-realm level', async () => {
      const low = mountBodyScene((player, manager) => {
        qiPlayer(player, 1) // nham_mach needs level 2
        manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 5)
      })
      await nextTick()
      await selectChapter(low, 'meridian')
      expect(investButton(low)!.disabled).toBe(true)
      low.unmount()

      const high = mountBodyScene((player, manager) => {
        qiPlayer(player, 2)
        manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 5)
      })
      await nextTick()
      await selectChapter(high, 'meridian')
      expect(investButton(high)!.disabled).toBe(false)
      high.unmount()
    })

    it('keeps the invest card actionable past the page realm (no pace gate cross-realm)', async () => {
      const view = mountBodyScene((player, manager) => {
        player.$state.realmId = 'foundation_establishment'
        player.$state.realmLevel = 1
        player.$state.physiqueGrade = 'bao'
        setBodyProgression(player, {
          body_refinement: { completedTiers: 6, currentTierProgress: 0 },
          meridian: { progress: {} },
        })
        manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 5)
      })
      await nextTick()
      await selectChapter(view, 'meridian')

      const button = investButton(view)
      expect(button).not.toBeNull()
      expect(button!.disabled).toBe(false)

      view.unmount()
    })

    it('the final meridian needs no material aux - pills alone progress it', async () => {
      const opened7 = MERIDIANS.slice(0, 7).map(m => m.id)

      const view = mountBodyScene((player, manager) => {
        qiPlayer(player)
        setBodyProgression(player, {
          meridian: { progress: Object.fromEntries(opened7.map((id) => [id, 100])) },
        })
        manager.pillBag.add(manager.pillRegistry.get('thong_mach_dan'), 40)
      })
      await nextTick()
      await selectChapter(view, 'meridian')

      const button = investButton(view)
      expect(button).not.toBeNull()
      expect(button!.disabled).toBe(false)

      button!.click()
      await nextTick()

      expect(view.bumpState).toHaveBeenCalledTimes(1)
      // Exactly 1 pill per invest - doc_mach rolls 0.1~1 per invest.
      expect(view.manager.pillBag.getAmount('thong_mach_dan')).toBe(39)

      view.unmount()
    })

    it('AUTH-2: a frozen Quan The record renders no extra row', async () => {
      const frozen = mountBodyScene((player) => {
        player.$state.realmId = 'qi_refining'
        player.$state.hiddenPerfection.realms['qi_refining'] = {
          discovered: true,
          bodyCompleted: false,
          frozen: true,
        }
      })
      await nextTick()
      await selectChapter(frozen, 'meridian')
      expect(frozen.container.querySelector('.body-extra')).toBeNull()
      frozen.unmount()
    })
  })

  describe('Chu Thien chapter (zhou_tian)', () => {
    function tcPlayer(
      player: ReturnType<typeof usePlayerStore>,
      realmLevel = 18,
      completed = 0,
      { meridianComplete = true } = {},
    ) {
      player.$state.realmId = 'foundation_establishment'
      player.$state.realmLevel = realmLevel
      player.$state.physiqueGrade = 'bao'
      setBodyProgression(player, {
        body_refinement: { completedTiers: 6, currentTierProgress: 0 },
        meridian: {
          progress: Object.fromEntries(
            (meridianComplete ? MERIDIANS : []).map((m) => [m.id, 100]),
          ),
        },
        zhou_tian: { completed },
      })
    }

    it('locked: the sealed tab refuses to open until the meridian chapter completes', async () => {
      const view = mountBodyScene((player) => {
        tcPlayer(player, 18, 0, { meridianComplete: false })
      })
      await nextTick()
      await selectChapter(view, 'zhou_tian')

      // The click is refused: the surface stays on the meridian
      // chapter and the sealed page never renders.
      const seals = chapterButtons(view)
      expect(seals[UI_CHAPTER_INDEX['zhou_tian']!]!.classList.contains('is-locked')).toBe(true)
      const title = view.container.querySelector('.body-paper-details h2')
      expect(title?.textContent).toContain('Nhâm Mạch')

      view.unmount()
    })

    it('realm_locked: unlocked sequentially but zero capacity outside Truc Co', async () => {
      const view = mountBodyScene((player) => {
        player.$state.realmId = 'mortal'
        player.$state.realmLevel = 18
        player.$state.physiqueGrade = 'bao'
        setBodyProgression(player, {
          body_refinement: { completedTiers: 6, currentTierProgress: 0 },
          meridian: { progress: Object.fromEntries(MERIDIANS.map((m) => [m.id, 100])) },
          zhou_tian: { completed: 0 },
        })
      })
      await nextTick()
      await selectChapter(view, 'zhou_tian')

      expect(view.container.textContent).toContain(
        i18n.global.t('panels.realm.zhouTian.realmLocked', { realm: 'Trúc Cơ' }),
      )
      expect(investButton(view)?.disabled ?? true).toBe(true)

      view.unmount()
    })

    it('invests the next step on click through realmAdvanceOps', async () => {
      let state!: ReturnType<typeof usePlayerStore>['$state']
      const view = mountBodyScene((player, manager) => {
        state = player.$state
        tcPlayer(player, 18, 0)
        // Step 0 costs 100 essence (2026-10-05 curve) - seeding exactly
        // 100 bounds the chapter's multi-step invest to one advancement.
        manager.materialBag.add(
          manager.materialRegistry.get(ZHOU_TIAN_CURRENCY_MATERIAL_ID),
          100,
        )
      })
      await nextTick()
      await selectChapter(view, 'zhou_tian')

      const button = investButton(view)
      expect(button).not.toBeNull()
      expect(button!.disabled).toBe(false)

      button!.click()
      await nextTick()

      expect(state.bodyProgression.zhou_tian.completed).toBe(1)
      expect(view.bumpState).toHaveBeenCalledTimes(1)

      view.unmount()
    })

    it('renders no unit rail or milestones under the figure (preview parity)', async () => {
      const view = mountBodyScene((player) => {
        tcPlayer(player, 18, 20)
      })
      await nextTick()
      await selectChapter(view, 'zhou_tian')

      expect(view.container.querySelectorAll('.body-unit-rail').length).toBe(0)
      expect(view.container.querySelectorAll('.body-milestone').length).toBe(0)
      expect(view.container.querySelectorAll('.body-caption').length).toBe(0)

      view.unmount()
    })
  })
})
