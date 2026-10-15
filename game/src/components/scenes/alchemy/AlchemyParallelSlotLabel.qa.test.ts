// @vitest-environment jsdom
// Single-kiln regression: restored orders and their labels remain sequential.

import { describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import { createI18n } from 'vue-i18n'
import { AlchemySystem, type AlchemyRecipe } from '@/core/alchemy/AlchemySystem'
import { alchemyJobFixture } from '@/core/alchemy/AlchemyJob.fixture'
import { PillBag } from '@/core/pill/PillBag'
import AlchemyFidelityScene from './fidelity/AlchemyFidelityScene.vue'
import type { AlchemyJobDisplay } from './fidelity/alchemyUi'

const RECIPE: AlchemyRecipe = {
  id: 'alchemy_tu_linh_dan_qi_refining',
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

describe('single active kiln and waiting-order labels', () => {
  it('restored overlapping orders settle sequentially through one kiln', () => {
    const system = new AlchemySystem()
    system.setRecipeLookup((id) => (id === RECIPE.id ? RECIPE : undefined))
    // Restore serializes two overlapping live-family orders.
    const jobA = makeJob('job_a', 0, 60_000)
    const jobB = makeJob('job_b', 5_000, 65_000)
    system.restoreJobs([jobA, jobB], 0)
    const bag = new PillBag()
    system.tick(70_000, bag, () => ({ id: RECIPE.pillId }), () => 0)
    const events = system.drainSettlementEvents()
    // Only the first order is due before the promoted second deadline.
    expect(events.map((e) => e.jobId)).toEqual(['job_a'])
    expect(system.getJobs().map((job) => job.jobId)).toEqual(['job_b'])
    system.tick(120_000, bag, () => ({ id: RECIPE.pillId }), () => 0)
    expect(system.drainSettlementEvents().map((event) => event.jobId)).toEqual(['job_b'])
    expect(system.getJobs()).toHaveLength(0)
  })

  it('the active card reads active kiln and the second card reads waiting', () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'vi',
      messages: {
        vi: {
          alchemy: {
            activeKiln: 'Đang luyện',
            waitingJob: 'Chờ luyện',
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
        state: 'active',
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
        state: 'waiting',
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
      // Explicit display states agree with the single-kiln owner.
      expect(states).toEqual(['Đang luyện', 'Chờ luyện'])
      expect(container.querySelectorAll('.job-card--brewing')).toHaveLength(1)
      expect(container.querySelectorAll('.job-card--waiting')).toHaveLength(1)
    } finally {
      app.unmount()
      container.remove()
    }
  })
})
