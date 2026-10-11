// @vitest-environment jsdom
// QA R3 seam repro (blind wave 3) - FINDING R3-ALCH-L1 (LOW, cosmetic).
//
// Seam: the order-rail labels every card after index 0
// `${t('alchemy.queued')} #${i + 1}` - a 1-slot queue mental model
// (AlchemyFidelityScene.vue:213). The domain has brewed orders in
// PARALLEL since the pill-room level curve (L3/L6/L9 grant 2/3/4
// concurrentJobSlots): AlchemySystem.tick() walks EVERY job and rolls
// each order's own per-unit deadlines from its own startedAtMs - there
// is no head-of-line gate, so at capacity >= 2 order #2 brews at the
// same time as order #1. Rendering it "Cho #2" is a straight mislabel:
// the order IS brewing.
//
// Repro part A (domain truth): two restored jobs each settle a unit on
// the same tick - order #2 is provably brewing, not waiting.
// Repro part B (label): mounted with capacity 2 and two in-flight
// jobs, the second card must say brewing - it says Cho #2.
// Deterministic: seeded rollSeedBase deadlines, fixed clock.

import { describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import { createI18n } from 'vue-i18n'
import { AlchemySystem, type AlchemyRecipe } from '@/core/alchemy/AlchemySystem'
import { alchemyJobFixture } from '@/core/alchemy/AlchemyJob.fixture'
import { PillBag } from '@/core/pill/PillBag'
import AlchemyFidelityScene from './fidelity/AlchemyFidelityScene.vue'
import type { AlchemyJobDisplay } from './fidelity/alchemyUi'

const RECIPE: AlchemyRecipe = {
  id: 'alchemy_r3_label',
  pillId: 'pill_r3_label',
  realmId: 'mortal',
  herbVariants: [{ materialId: 'herb_r3', age: 'decade', label: 'Herb' }],
  herbAmount: 1,
  fuelWoodRealmId: 'mortal',
  fuelWoodAmount: 1,
  luyenDanTinhHoaAmount: 1,
  spiritStoneCost: 0,
  baseDurationSeconds: 60,
}

function makeJob(jobId: string, startedAtMs: number, completesAtMs: number) {
  return alchemyJobFixture(
    {
      jobId,
      recipeId: RECIPE.id,
      pillId: RECIPE.pillId,
      herbMaterialId: 'herb_r3',
      startedAtMs,
      completesAtMs,
      roomLevelAtStart: 1,
      quantity: 1,
      unitsDone: 0,
      rollSeedBase: 0,
    },
    undefined,
    RECIPE,
  )
}

describe('R3-ALCH-L1 - "queued #N" mislabel on a parallel-brewing order', () => {
  it('order #2 settles its own unit deadline on the same tick as order #1 (parallel, not queued)', () => {
    const system = new AlchemySystem()
    system.setRecipeLookup((id) => (id === RECIPE.id ? RECIPE : undefined))
    // Two orders in flight at capacity >= 2 (pill_room L3+). Each job's
    // units are due at its own completesAtMs - the domain treats them
    // as independent parallel slots.
    const jobA = makeJob('job_a', 0, 60_000)
    const jobB = makeJob('job_b', 5_000, 65_000)
    system.restoreJobs([jobA, jobB], 0)
    const bag = new PillBag()
    system.tick(70_000, bag, () => ({ id: RECIPE.pillId }), () => 0)
    const events = system.drainSettlementEvents()
    // Both orders delivered their unit - order #2 was BREWING while the
    // card rail would call it "queued".
    expect(events.map((e) => e.jobId).sort()).toEqual(['job_a', 'job_b'])
  })

  it('the second card reads brewing when a second order occupies its own slot', () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'vi',
      messages: {
        vi: {
          alchemy: {
            brewing: 'Đang luyện',
            queued: 'Chờ',
            queueTitle: 'Hàng Luyện',
            emptySlot: 'Ô trống',
            cancelJob: 'Hủy',
            unitsProgress: '{done}/{total} viên',
          },
        },
      },
    })
    const jobs: AlchemyJobDisplay[] = [
      {
        id: 'job_a',
        recipeId: RECIPE.id,
        herbMaterialId: 'herb_r3',
        roomLevelAtStart: 1,
        name: 'Đan A',
        icon: '',
        progress: 50,
        remaining: '1p',
        unitsDone: 0,
        quantity: 1,
      },
      {
        id: 'job_b',
        recipeId: RECIPE.id,
        herbMaterialId: 'herb_r3',
        roomLevelAtStart: 1,
        name: 'Đan B',
        icon: '',
        progress: 40,
        remaining: '2p',
        unitsDone: 0,
        quantity: 1,
      },
    ]
    const container = document.createElement('div')
    document.body.appendChild(container)
    const app = createApp(AlchemyFidelityScene, {
      recipes: [],
      recipe: null,
      variant: null,
      jobs,
      capacity: 2,
    })
    try {
      app.use(i18n)
      app.mount(container)
      const states = [...container.querySelectorAll<HTMLElement>('.job-card__state')].map(
        (el) => el.textContent?.trim(),
      )
      // DEFECT: job_b occupies its own parallel slot and is brewing -
      // its card must not say "Cho #2".
      expect(states[1]).toBe('Đang luyện')
    } finally {
      app.unmount()
      container.remove()
    }
  })
})
