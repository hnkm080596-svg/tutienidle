import { describe, expect, it } from 'vitest'
import { AlchemySystem, jobSuccessPercent } from './AlchemySystem'
import type { ActiveAlchemyJob, AlchemyRecipe } from './AlchemySystem'
import { PillBag } from '../pill/PillBag'

// Thiên phú Đan Duyên (talent-direction-choice-plan §6) — alchemy_success_bonus
// cộng điểm % vào totalPercent TRƯỚC khi tách guaranteed/extra, giữ cap 300.
const RECIPE: AlchemyRecipe = {
  id: 'recipe_test',
  pillId: 'pill_test',
  realmId: 'mortal',
  herbVariants: [{ materialId: 'herb_decade', age: 'decade', label: 'Thập Niên' }],
  herbAmount: 1,
  fuelWoodRealmId: 'mortal',
  fuelWoodAmount: 1,
  spiritStoneCost: 0,
  baseDurationSeconds: 60,
}

function makeJob(overrides: Partial<ActiveAlchemyJob> = {}): ActiveAlchemyJob {
  return {
    jobId: 'job_test',
    recipeId: RECIPE.id,
    pillId: RECIPE.pillId,
    herbMaterialId: 'herb_decade',
    startedAtMs: 0,
    completesAtMs: 1_000,
    roomLevelAtStart: 1,
    ...overrides,
  }
}

function makeSystemWithJob(job: ActiveAlchemyJob = makeJob()): {
  system: AlchemySystem
  bag: PillBag
} {
  const system = new AlchemySystem()
  const bag = new PillBag()

  system.setRecipeLookup((id) => (id === RECIPE.id ? RECIPE : undefined))
  system.restoreJobs([job])

  return { system, bag }
}

describe('AlchemySystem — jobSuccessPercent', () => {
  it('không bonus — base decade 30 + room 1 bonus 0', () => {
    expect(jobSuccessPercent(makeJob(), RECIPE)).toBe(30)
  })

  it('bonus điểm % (Đan Duyên +15) cộng thẳng vào tổng', () => {
    expect(jobSuccessPercent(makeJob(), RECIPE, 15)).toBe(45)
  })

  it('cap 300 giữ nguyên kể cả khi bonus đẩy tổng vượt trần', () => {
    const myriadRecipe: AlchemyRecipe = {
      ...RECIPE,
      herbVariants: [{ materialId: 'herb_myriad', age: 'myriad_year', label: 'Vạn Niên' }],
    }
    const job = makeJob({ herbMaterialId: 'herb_myriad', roomLevelAtStart: 5 })

    // base 100 + room 5 bonus 20 + talent 200 → clamp 300
    expect(jobSuccessPercent(job, myriadRecipe, 200)).toBe(300)
  })
})

describe('AlchemySystem — tick với bonus thiên phú', () => {
  it('không bonus — roll 40% thất bại với total 30%', () => {
    const { system, bag } = makeSystemWithJob()

    system.tick(2_000, bag, () => ({ id: RECIPE.pillId }), () => 0.4)

    expect(bag.getAmount(RECIPE.pillId)).toBe(0)
    expect(system.drainSettlementEvents()[0]?.success).toBe(false)
  })

  it('bonus 15 điểm — cùng roll 40% thành công (total 45%)', () => {
    const { system, bag } = makeSystemWithJob()

    system.tick(2_000, bag, () => ({ id: RECIPE.pillId }), () => 0.4, 15)

    expect(bag.getAmount(RECIPE.pillId)).toBe(1)
    expect(system.drainSettlementEvents()[0]?.success).toBe(true)
  })

  it('bonus đẩy total qua 100 — guaranteed pill tăng tương ứng', () => {
    const { system, bag } = makeSystemWithJob()

    // 30 + 75 = 105 → guaranteed 1, extra chance 5% (roll 0.5 trượt extra)
    system.tick(2_000, bag, () => ({ id: RECIPE.pillId }), () => 0.5, 75)

    expect(bag.getAmount(RECIPE.pillId)).toBe(1)
  })
})

describe('AlchemySystem — settleOffline với bonus thiên phú', () => {
  it('settleOffline forward bonus vào tick — total 100% luôn có đan', () => {
    const { system, bag } = makeSystemWithJob()

    const settled = system.settleOffline(bag, () => ({ id: RECIPE.pillId }), 2_000, 70)

    expect(settled).toBe(1)
    expect(bag.getAmount(RECIPE.pillId)).toBeGreaterThanOrEqual(1)
  })
})
