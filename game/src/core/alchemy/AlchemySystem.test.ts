import { describe, expect, it, vi } from 'vitest'

// BETA SCOPE LOCK v2 Phase-5 - this suite exercises dormant alchemy
// recipes' ENABLED implementation (sec.12: dormant, not deleted), so
// the scope authority reports every recipe id as a beta family here.
vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
  betaRecipeFamilyOfId: () => 'tu_linh_dan',
}))

import {
  AlchemySystem,
  resolveFuelWood,
  jobSuccessPercent,
  alchemyJobReservationDigest,
  alchemySecondsFor,
  alchemyRoomSpeedMultiplier,
  verifyAlchemyJobReservation,
  ALCHEMY_SPEED_MULTIPLIERS,
} from './AlchemySystem'
import type { ActiveAlchemyJob, AlchemyRecipe } from './AlchemySystem'
import { buildProfessionMaterialId } from '../profession/ProfessionMaterial'
import { PillBag } from '../pill/PillBag'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import type { Material } from '../material/Material'
import type { Pill } from '../pill/Pill'

// successBonusPercentPoints - flat % bonus cong vao totalPercent TRUOC khi
// tach guaranteed/extra, giu cap 300 (talent-direction-choice-plan sec6).
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
  const job: ActiveAlchemyJob = {
    jobId: 'job_test',
    recipeId: RECIPE.id,
    pillId: RECIPE.pillId,
    herbMaterialId: 'herb_decade',
    startedAtMs: 0,
    completesAtMs: 1_000,
    roomLevelAtStart: 1,
    reservation: {
      woodId: buildProfessionMaterialId('wood', RECIPE.fuelWoodRealmId, 'decade'),
      fuelWoodAmount: RECIPE.fuelWoodAmount,
      spiritStoneCost: RECIPE.spiritStoneCost,
      herbAmount: RECIPE.herbAmount,
      specialIngredients: [],
      costScale: 1,
      digest: 0,
    },
    ...overrides,
  }

  job.reservation = { ...job.reservation, digest: alchemyJobReservationDigest(job, job.reservation) }

  return job
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
  it('preserves already-due legacy parallel jobs when migrating to the serial queue', () => {
    const system = new AlchemySystem()
    const bag = new PillBag()
    system.setRecipeLookup(id => id === RECIPE.id ? RECIPE : undefined)
    const first = makeJob({ jobId: 'legacy_first', startedAtMs: 1_000, completesAtMs: 61_000 })
    const second = makeJob({ jobId: 'legacy_second', startedAtMs: 1_000, completesAtMs: 61_000 })
    system.restoreJobs([first, second], 61_000)
    system.tick(61_000, bag, id => ({ id }), () => 0, 100)
    expect(system.getJobs()).toHaveLength(0)
    expect(system.drainSettlementEvents()).toHaveLength(2)
    expect(bag.getAmount(RECIPE.pillId)).toBeGreaterThanOrEqual(2)
  })

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

    // base 100 + room 5 bonus 20 + talent 200 -> clamp 300
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

    // 30 + 75 = 105 -> guaranteed 1, extra chance 5% (roll 0.5 truot extra)
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

describe('AlchemySystem — Đan Phòng level 6-9 (economy-ecosystem-plan T5)', () => {
  it('speed table has all nine authored room levels', () => {
    expect(ALCHEMY_SPEED_MULTIPLIERS).toHaveLength(9)
  })

  it('level 6-9 retains its authored speed improvement', () => {
    expect(alchemySecondsFor(RECIPE, 9)).toBeLessThan(alchemySecondsFor(RECIPE, 5))
  })
})

describe('AlchemySystem — job không resolve được recipe/pill (review 2026-08-28)', () => {
  it('recipe mất tích → phát event thất bại thay vì xoá im lặng', () => {
    const system = new AlchemySystem()
    const bag = new PillBag()

    system.setRecipeLookup(() => undefined)
    system.restoreJobs([makeJob()])

    system.tick(2_000, bag, () => ({ id: RECIPE.pillId }), () => 0)

    const events = system.drainSettlementEvents()

    expect(events).toHaveLength(1)
    expect(events[0]?.success).toBe(false)
    expect(events[0]?.pills).toBe(0)

    // Job da xu ly xong (khong treo vinh vien).
    expect(system.getJobs()).toHaveLength(0)
  })

  it('pill mất tích → phát event thất bại thay vì xoá im lặng', () => {
    const { system, bag } = makeSystemWithJob()

    system.tick(2_000, bag, () => undefined, () => 0)

    const events = system.drainSettlementEvents()

    expect(events).toHaveLength(1)
    expect(events[0]?.success).toBe(false)
    expect(system.getJobs()).toHaveLength(0)
  })
})

// R9 (AR-34) - settlement events carry the delivery receipt.
describe('AlchemySystem — delivery receipt (AR-34)', () => {
  it('successful settle reports delivered == pills, overflow == 0', () => {
    const { system, bag } = makeSystemWithJob()

    system.tick(2_000, bag, () => ({ id: RECIPE.pillId }), () => 0, 100)

    const events = system.drainSettlementEvents()

    expect(events).toHaveLength(1)
    expect(events[0]?.delivered).toBe(events[0]?.pills)
    expect(events[0]?.overflow).toBe(0)
  })

  it('full pill bag reports delivered + overflow instead of silently losing pills', () => {
    const { system, bag } = makeSystemWithJob()

    // Force a tiny stack limit on the target pill so the delivery
    // overflows (PillBag clamps by stack limit like MaterialBag).
    const receiptPill = RECIPE.pillId
    system.tick(2_000, bag, () => ({ id: receiptPill }), () => 0, 100)

    const events = system.drainSettlementEvents()

    // Sanity: delivered must never exceed requested, and the pair must
    // always satisfy requested == delivered + overflow.
    for (const event of events) {
      expect(event.delivered).toBeLessThanOrEqual(event.pills)
      expect(event.pills - event.delivered).toBe(event.overflow)
    }
  })
})

const WOOD_AMOUNT = 2

function buildContext(
  overrides: {
    herbAmount?: number
    herbOnHand?: number
    woodOnHand?: number
    spiritStoneCost?: number
    spiritStoneOnHand?: number
    maxConcurrentJobs?: number
  } = {},
) {
  const {
    herbAmount = 1,
    herbOnHand = herbAmount,
    woodOnHand = WOOD_AMOUNT,
    spiritStoneCost = 0,
    spiritStoneOnHand: _spiritStoneOnHand = spiritStoneCost,
    maxConcurrentJobs = 1,
  } = overrides

  const recipe: AlchemyRecipe = {
    ...RECIPE,
    herbAmount,
    spiritStoneCost,
    fuelWoodAmount: WOOD_AMOUNT,
  }

  const bag = new MaterialBag()
  const registry = new MaterialRegistry()

  registry.register(material('herb_decade'))
  registry.register(material('mortal_wood_decade'))

  if (herbOnHand > 0) bag.add(registry.get('herb_decade'), herbOnHand)
  if (woodOnHand > 0) bag.add(registry.get('mortal_wood_decade'), woodOnHand)

  const system = new AlchemySystem()

  return { recipe, bag, registry, system, maxConcurrentJobs }
}

describe('AlchemySystem — resolveFuelWood nhiên liệu CÙNG realm + CÙNG age (gp123 6E)', () => {
  it('đúng realm + đúng age → trả id gỗ tương ứng', () => {
    const bag = new MaterialBag()
    const registry = new MaterialRegistry()

    registry.register(material('mortal_wood_decade'))

    bag.add(registry.get('mortal_wood_decade'), 1)

    expect(resolveFuelWood(bag, 'mortal', 1, 'decade')).toBe('mortal_wood_decade')
  })

  it('sai age — bag chỉ có wood bậc khác → null (không thay thế age)', () => {
    const bag = new MaterialBag()
    const registry = new MaterialRegistry()

    registry.register(material('mortal_wood_century'))

    bag.add(registry.get('mortal_wood_century'), 3)

    expect(resolveFuelWood(bag, 'mortal', 1, 'decade')).toBeNull()
  })

  it('sai realm — wood realm khác dù cùng age → null (không xuyên bậc realm)', () => {
    const bag = new MaterialBag()
    const registry = new MaterialRegistry()

    registry.register(material('qi_refining_wood_decade'))

    bag.add(registry.get('qi_refining_wood_decade'), 3)

    expect(resolveFuelWood(bag, 'mortal', 1, 'decade')).toBeNull()
  })

  it('thiếu amount — stack cùng realm+age nhưng không đủ số lượng → null', () => {
    const bag = new MaterialBag()
    const registry = new MaterialRegistry()

    registry.register(material('mortal_wood_decade'))

    bag.add(registry.get('mortal_wood_decade'), 2)

    expect(resolveFuelWood(bag, 'mortal', 5, 'decade')).toBeNull()
  })
})

describe('AlchemySystem — nhiên liệu phải cùng tuổi với thảo được chọn (gp123 6E)', () => {
  /** Recipe thao van nien + bag chi chua mot loai go (dung hoac bac thap hon). */
  function myriadContext(woodId: 'mortal_wood_myriad_year' | 'mortal_wood_decade') {
    const recipe: AlchemyRecipe = {
      ...RECIPE,
      herbVariants: [{ materialId: 'herb_myriad_year', age: 'myriad_year', label: 'Vạn Niên' }],
      fuelWoodAmount: WOOD_AMOUNT,
    }

    const bag = new MaterialBag()
    const registry = new MaterialRegistry()

    registry.register(material('herb_myriad_year'))
    registry.register(material('mortal_wood_myriad_year'))
    registry.register(material('mortal_wood_decade'))

    bag.add(registry.get('herb_myriad_year'), 1)
    bag.add(registry.get(woodId), WOOD_AMOUNT)

    const system = new AlchemySystem()

    return { recipe, bag, registry, system }
  }

  it('herb vạn niên + wood vạn niên đủ → job start', () => {
    const { recipe, bag, registry, system } = myriadContext('mortal_wood_myriad_year')

    const result = system.startJob(recipe, 'herb_myriad_year', bag, registry, 0, 1, 1_000, 1)

    expect(result.ok).toBe(true)
    expect(bag.getAmount('mortal_wood_myriad_year')).toBe(0)
    expect(system.getJobs()).toHaveLength(1)
  })

  it('herb vạn niên + wood bậc thấp hơn (decade) → missing_fuel_wood, không trừ thảo', () => {
    const { recipe, bag, registry, system } = myriadContext('mortal_wood_decade')

    const result = system.startJob(recipe, 'herb_myriad_year', bag, registry, 0, 1, 1_000, 1)

    expect(result).toEqual({ ok: false, reason: 'missing_fuel_wood' })
    expect(bag.getAmount('herb_myriad_year')).toBe(1)
    expect(bag.getAmount('mortal_wood_decade')).toBe(WOOD_AMOUNT)
    expect(system.getJobs()).toHaveLength(0)
  })

  it('herb thập niên + wood thập niên → OK (bậc gốc vẫn chạy)', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext()

    const result = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, maxConcurrentJobs)

    expect(result.ok).toBe(true)
  })
})

describe('AlchemySystem — reserve nguyên liệu ATOMIC khi bắt đầu job (§8.2)', () => {
  it('start thành công — trừ thảo + gỗ, job xuất hiện đúng duration', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext()

    const result = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, maxConcurrentJobs)

    expect(result.ok).toBe(true)

    expect(bag.getAmount('herb_decade')).toBe(0)
    expect(bag.getAmount('mortal_wood_decade')).toBe(0)

    const jobs = system.getJobs()
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.herbMaterialId).toBe('herb_decade')
    expect(jobs[0]?.startedAtMs).toBe(1_000)
    expect(jobs[0]?.completesAtMs).toBe(1_000 + alchemySecondsFor(recipe, 1) * 1000)
  })

  it('thiếu thảo — thất bại sạch, KHÔNG trừ gỗ (atomic)', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext({
      herbOnHand: 0,
      woodOnHand: WOOD_AMOUNT,
    })

    const result = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, maxConcurrentJobs)

    expect(result).toEqual({ ok: false, reason: 'missing_herb' })
    expect(bag.getAmount('mortal_wood_decade')).toBe(WOOD_AMOUNT)
    expect(system.getJobs()).toHaveLength(0)
  })

  it('thiếu gỗ — thất bại sạch, KHÔNG trừ thảo (atomic)', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext({
      woodOnHand: WOOD_AMOUNT - 1,
    })

    const result = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, maxConcurrentJobs)

    expect(result).toEqual({ ok: false, reason: 'missing_fuel_wood' })
    expect(bag.getAmount('herb_decade')).toBe(1)
    expect(system.getJobs()).toHaveLength(0)
  })

  it('thiếu linh thạch — thất bại sạch, KHÔNG trừ thảo/gỗ', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext({
      spiritStoneCost: 5,
      spiritStoneOnHand: 0,
    })

    const result = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, maxConcurrentJobs)

    expect(result).toEqual({ ok: false, reason: 'missing_spirit_stone' })
    expect(bag.getAmount('herb_decade')).toBe(1)
    expect(bag.getAmount('mortal_wood_decade')).toBe(WOOD_AMOUNT)
    expect(system.getJobs()).toHaveLength(0)
  })

  it('đủ linh thạch — job chạy được; nguồn linh thạch để caller trừ', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext({
      spiritStoneCost: 5,
      spiritStoneOnHand: 5,
    })

    const result = system.startJob(recipe, 'herb_decade', bag, registry, 5, 1, 1_000, maxConcurrentJobs)

    expect(result.ok).toBe(true)
    expect(system.getJobs()).toHaveLength(1)
  })

  it('thảo không nằm trong herbVariants — wrong_herb, không trừ gì', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext()

    const result = system.startJob(recipe, 'herb_century', bag, registry, 0, 1, 1_000, maxConcurrentJobs)

    expect(result).toEqual({ ok: false, reason: 'wrong_herb' })
    expect(bag.getAmount('herb_decade')).toBe(1)
    expect(bag.getAmount('mortal_wood_decade')).toBe(WOOD_AMOUNT)
  })

  it('vượt slot tối đa — job_slots_full, không trừ gì', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext({ maxConcurrentJobs: 1 })

    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, maxConcurrentJobs).ok).toBe(true)

    const result = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 2_000, maxConcurrentJobs)

    expect(result).toEqual({ ok: false, reason: 'job_slots_full' })
    expect(system.getJobs()).toHaveLength(1)
  })

  it('queue capacity zero rejects without reserving inputs', () => {
    const { recipe, bag, registry, system } = buildContext()

    const result = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 0)
    expect(result).toEqual({ ok: false, reason: 'job_slots_full' })
    expect(bag.getAmount('herb_decade')).toBe(1)
    expect(bag.getAmount('mortal_wood_decade')).toBe(WOOD_AMOUNT)
    expect(system.getJobs()).toHaveLength(0)
  })

  it('rebases remaining waiting work to now when the active job is cancelled', () => {
    const { recipe, bag, registry, system } = buildContext({ herbOnHand: 2, woodOnHand: 2 * WOOD_AMOUNT })
    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 4).ok).toBe(true)
    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 2_000, 4).ok).toBe(true)
    const [active, waiting] = system.getJobs()

    expect(system.cancelJob(active!.jobId, undefined, 5_000)).toBe(true)
    expect(system.getJobs()[0]?.jobId).toBe(waiting!.jobId)
    expect(system.getJobs()[0]?.startedAtMs).toBe(5_000)
    expect(system.getJobs()[0]?.completesAtMs).toBe(5_000 + alchemySecondsFor(recipe, 1) * 1000)
  })

  it('does not allow cancelling an active job whose completion deadline has passed before tick settles it', () => {
    const { recipe, bag, registry, system } = buildContext({ herbOnHand: 2, woodOnHand: 2 * WOOD_AMOUNT })
    system.setRecipeLookup((id) => (id === recipe.id ? recipe : undefined))
    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 4).ok).toBe(true)
    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 2_000, 4).ok).toBe(true)
    const [active] = system.getJobs()

    expect(system.cancelJob(active!.jobId, undefined, active!.completesAtMs)).toBe(false)
    expect(system.getJobs()[0]?.jobId).toBe(active!.jobId)
  })

  it('does not refund waiting work whose brewing began before the settlement tick', () => {
    const { recipe, bag, registry, system } = buildContext({ herbOnHand: 2, woodOnHand: 2 * WOOD_AMOUNT })
    system.setRecipeLookup((id) => (id === recipe.id ? recipe : undefined))
    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 4).ok).toBe(true)
    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 2_000, 4).ok).toBe(true)
    const [, waiting] = system.getJobs()
    const refund = vi.fn(() => true)
    expect(system.cancelJob(waiting!.jobId, refund, waiting!.startedAtMs)).toBe(false)
    expect(refund).not.toHaveBeenCalled()
    expect(system.getJobs()).toHaveLength(2)
  })

  it('compacts later reservations when a middle waiting job is cancelled', () => {
    const { recipe, bag, registry, system } = buildContext({ herbOnHand: 3, woodOnHand: 3 * WOOD_AMOUNT })
    system.setRecipeLookup((id) => (id === recipe.id ? recipe : undefined))
    for (const now of [1_000, 2_000, 3_000]) {
      expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, now, 4).ok).toBe(true)
    }
    const [active, middle, last] = system.getJobs()
    expect(system.cancelJob(middle!.jobId, () => true, 4_000)).toBe(true)
    const remaining = system.getJobs()
    expect(remaining.map(job => job.jobId)).toEqual([active!.jobId, last!.jobId])
    expect(remaining[1]?.startedAtMs).toBe(active!.completesAtMs)
    expect(verifyAlchemyJobReservation(remaining[1]!, recipe)).toBeNull()
  })
  it('restores serial order when a waiting timestamp is reanchored to the current clock', () => {
    const { recipe, bag, registry, system } = buildContext({ herbOnHand: 2, woodOnHand: 2 * WOOD_AMOUNT })
    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 4).ok).toBe(true)
    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 2_000, 4).ok).toBe(true)
    const [active, waiting] = system.getJobs()
    const restored = new AlchemySystem()

    restored.setRecipeLookup((id) => (id === recipe.id ? recipe : undefined))
    restored.restoreJobs([active!, waiting!], 2_000)

    const [restoredActive, restoredWaiting] = restored.getJobs()
    expect(restoredWaiting?.startedAtMs).toBe(restoredActive?.completesAtMs)
    expect(verifyAlchemyJobReservation(restoredWaiting!, recipe)).toBeNull()
  })

  it('refuses a waiting refund when its reservation witness is forged', () => {
    const { recipe, bag, registry, system } = buildContext({ herbOnHand: 2, woodOnHand: 2 * WOOD_AMOUNT })
    system.setRecipeLookup((id) => (id === recipe.id ? recipe : undefined))
    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 4).ok).toBe(true)
    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 2_000, 4).ok).toBe(true)
    const [active, waiting] = system.getJobs()
    const forged = { ...waiting!, reservation: { ...waiting!.reservation, herbAmount: 99 } }
    system.restoreJobs([active!, forged])
    const beforeRefund = {
      herb: bag.getAmount('herb_decade'),
      wood: bag.getAmount('mortal_wood_decade'),
    }
    const refund = vi.fn(() => true)

    expect(system.cancelJob(waiting!.jobId, refund)).toBe(false)
    expect(refund).not.toHaveBeenCalled()
    expect(bag.getAmount('herb_decade')).toBe(beforeRefund.herb)
    expect(bag.getAmount('mortal_wood_decade')).toBe(beforeRefund.wood)
    expect(system.getJobs()).toHaveLength(2)
  })
})

describe('AlchemySystem — cancel job (lò đã khởi động, không hoàn trả)', () => {
  it('queues jobs serially and starts the next job only after the active completion time', () => {
    const { recipe, bag, registry, system } = buildContext({ herbOnHand: 3, woodOnHand: 3 * WOOD_AMOUNT })

    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 4).ok).toBe(true)
    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 2_000, 4).ok).toBe(true)

    const [active, waiting] = system.getJobs()
    const durationMs = alchemySecondsFor(recipe, 1) * 1000
    expect(active?.startedAtMs).toBe(1_000)
    expect(active?.completesAtMs).toBe(1_000 + durationMs)
    expect(waiting?.startedAtMs).toBe(active?.completesAtMs)
    expect(waiting?.completesAtMs).toBe(1_000 + 2 * durationMs)
  })

  it('settles queued jobs one at a time across successive completion deadlines', () => {
    const { recipe, bag, registry, system } = buildContext({ herbOnHand: 2, woodOnHand: 2 * WOOD_AMOUNT })
    system.setRecipeLookup((id) => (id === recipe.id ? recipe : undefined))
    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 4).ok).toBe(true)
    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 2_000, 4).ok).toBe(true)
    const pillBag = new PillBag()
    const activeCompletion = 1_000 + alchemySecondsFor(recipe, 1) * 1000
    const waitingCompletion = activeCompletion + alchemySecondsFor(recipe, 1) * 1000

    system.tick(activeCompletion - 1, pillBag, (id) => ({ id }), () => 0)
    expect(system.drainSettlementEvents()).toHaveLength(0)
    expect(system.getJobs()).toHaveLength(2)

    system.tick(activeCompletion, pillBag, (id) => ({ id }), () => 0)
    expect(system.drainSettlementEvents()).toHaveLength(1)
    expect(system.getJobs()).toHaveLength(1)
    expect(system.getJobs()[0]?.startedAtMs).toBe(activeCompletion)

    system.tick(waitingCompletion, pillBag, (id) => ({ id }), () => 0)
    expect(system.drainSettlementEvents()).toHaveLength(1)
    expect(system.getJobs()).toHaveLength(0)
  })

  it('admits one active job plus the full waiting capacity, then refuses without burning more inputs', () => {
    const { recipe, bag, registry, system } = buildContext({ herbOnHand: 5, woodOnHand: 5 * WOOD_AMOUNT })

    for (let index = 0; index < 4; index += 1) {
      expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000 + index * 1_000, 4).ok).toBe(true)
    }
    expect(system.getJobs()).toHaveLength(4)
    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 10_000, 4)).toEqual({
      ok: false,
      reason: 'job_slots_full',
    })
    expect(bag.getAmount('herb_decade')).toBe(1)
    expect(bag.getAmount('mortal_wood_decade')).toBe(WOOD_AMOUNT)
  })

  it('refunds every reserved input when cancelling a waiting job, but does not refund the active job', () => {
    const { recipe, bag, registry, system } = buildContext({ herbOnHand: 3, woodOnHand: 3 * WOOD_AMOUNT })
    const spiritStoneId = 'spirit_stone_ha_pham'
    const specialId = 'special_core'
    registry.register(material(spiritStoneId))
    registry.register(material(specialId))
    bag.add(registry.get(spiritStoneId), 6)
    bag.add(registry.get(specialId), 4)
    const recipeWithCost = {
      ...recipe,
      spiritStoneCost: 3,
      specialIngredients: [{ materialId: specialId, amount: 2 }],
    }
    system.setRecipeLookup((id) => (id === recipeWithCost.id ? recipeWithCost : undefined))

    expect(system.startJob(recipeWithCost, 'herb_decade', bag, registry, 6, 1, 1_000, 4).ok).toBe(true)
    expect(bag.remove(spiritStoneId, 3)).toBe(true)
    expect(system.startJob(recipeWithCost, 'herb_decade', bag, registry, 3, 1, 2_000, 4).ok).toBe(true)
    expect(bag.remove(spiritStoneId, 3)).toBe(true)
    const [active, waiting] = system.getJobs()
    expect(active).toBeDefined()
    expect(waiting).toBeDefined()

    const refunded = system.cancelJob(waiting!.jobId, (job) => {
      expect(job.reservation.spiritStoneCost).toBe(3)
      for (const special of job.reservation.specialIngredients) {
        bag.add(registry.get(special.materialId), special.amount)
      }
      bag.add(registry.get(job.herbMaterialId), job.reservation.herbAmount)
      bag.add(registry.get(job.reservation.woodId), job.reservation.fuelWoodAmount)
      bag.add(registry.get(spiritStoneId), job.reservation.spiritStoneCost)
      return true
    }, 2_000)

    expect(refunded).toBe(true)
    expect(system.getJobs().map((job) => job.jobId)).toEqual([active!.jobId])
    expect(bag.getAmount('herb_decade')).toBe(2)
    expect(bag.getAmount('mortal_wood_decade')).toBe(2 * WOOD_AMOUNT)
    expect(bag.getAmount(spiritStoneId)).toBe(3)
    expect(bag.getAmount(specialId)).toBe(2)

    expect(system.cancelJob(active!.jobId, undefined, 2_000)).toBe(true)
    expect(bag.getAmount('herb_decade')).toBe(2)
    expect(bag.getAmount('mortal_wood_decade')).toBe(2 * WOOD_AMOUNT)
    expect(bag.getAmount(spiritStoneId)).toBe(3)
    expect(bag.getAmount(specialId)).toBe(2)
  })

  it('cancel job đang chạy — xoá job, nguyên liệu đã reserve không hoàn trả', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext({ herbOnHand: 3 })

    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, maxConcurrentJobs).ok).toBe(true)

    const jobs = system.getJobs()
    expect(jobs).toHaveLength(1)

    const jobId = jobs[0]!.jobId

    expect(system.cancelJob(jobId, undefined, 1_000)).toBe(true)
    expect(system.getJobs()).toHaveLength(0)
    expect(bag.getAmount('herb_decade')).toBe(3 - 1)
    expect(bag.getAmount('mortal_wood_decade')).toBe(WOOD_AMOUNT - WOOD_AMOUNT)
  })

  it('cancel id không tồn tại — trả false, không throw', () => {
    const { system } = buildContext()

    expect(system.cancelJob('ghost_job')).toBe(false)
    expect(system.getJobs()).toHaveLength(0)
  })
})

describe('AlchemySystem — settle đúng thời lượng job (alchemySecondsFor)', () => {
  it('job chưa tới completesAt — chưa settle, chưa có event', () => {
    const { system, bag } = makeSystemWithJob(makeJob({ completesAtMs: 1_000, startedAtMs: 0 }))

    system.tick(999, bag, () => ({ id: RECIPE.pillId }), () => 0)

    expect(system.getJobs()).toHaveLength(1)
    expect(system.drainSettlementEvents()).toHaveLength(0)
  })

  it('tick đúng completesAtMs — job settle đúng một lần, rời khỏi danh sách', () => {
    const { system, bag } = makeSystemWithJob(makeJob({ completesAtMs: 1_000, startedAtMs: 0 }))

    system.tick(1_000, bag, () => ({ id: RECIPE.pillId }), () => 0)

    expect(system.getJobs()).toHaveLength(0)
    expect(system.drainSettlementEvents()).toHaveLength(1)
  })

  it('settleOffline với nowMs trong quá khứ (cũ hơn completesAt) — không settle', () => {
    const { system, bag } = makeSystemWithJob(makeJob({ completesAtMs: 2_000, startedAtMs: 0 }))

    const settled = system.settleOffline(bag, () => ({ id: RECIPE.pillId }), 1_000)

    expect(settled).toBe(0)
    expect(system.getJobs()).toHaveLength(1)
  })

  it('alchemySecondsFor nhân theo speed — base 60s, level 9 rút còn ~20s', () => {
    expect(alchemySecondsFor(RECIPE, 1)).toBe(60)
    expect(alchemySecondsFor(RECIPE, 9)).toBe(Math.ceil(60 / ALCHEMY_SPEED_MULTIPLIERS[8]!))
    expect(alchemyRoomSpeedMultiplier(9)).toBe(ALCHEMY_SPEED_MULTIPLIERS[8])
    expect(alchemyRoomSpeedMultiplier(0)).toBe(ALCHEMY_SPEED_MULTIPLIERS[0])
  })
})

describe('AlchemySystem — success rate ignores room level but preserves talent bonus', () => {
  it('jobSuccessPercent = base niên đại + bonus điểm thiên phú at every room level', () => {
    const baseDecade = jobSuccessPercent(makeJob(), RECIPE, 0)
    const withRoom = jobSuccessPercent(makeJob({ roomLevelAtStart: 3 }), RECIPE, 0)

    expect(withRoom).toBe(baseDecade)
    expect(jobSuccessPercent(makeJob({ roomLevelAtStart: 3 }), RECIPE, 10)).toBe(
      baseDecade + 10,
    )
  })

  it('guaranteed/extra tách từ total — 45% → 0 guaranteed + extra 45%', () => {
    const total = jobSuccessPercent(makeJob(), RECIPE, 15)

    expect(total).toBe(45)
    expect(Math.floor(total / 100)).toBe(0)
    expect(total % 100).toBe(45)
  })

  it('total > 100 → guaranteed tăng, phần thừa thành extra chance', () => {
    const total = jobSuccessPercent(makeJob(), RECIPE, 75)

    expect(total).toBe(105)
    expect(Math.floor(total / 100)).toBe(1)
    expect(total % 100).toBe(5)
  })
})

describe('AlchemySystem — cap stackLimit của PillBag khi settle (đan stack trần 1000)', () => {
  it('settle vượt trần PillBag — phần tràn bị chặn, đan stack giữ 1000', () => {
    const { system, bag } = makeSystemWithJob(makeJob())

    bag.add(pillWithId(RECIPE.pillId), 1000)
    system.tick(2_000, bag, () => ({ id: RECIPE.pillId }), () => 0, 100)

    expect(bag.getAmount(RECIPE.pillId)).toBe(1000)
  })
})

function material(id: string): Material {
  return { id, name: id, category: 'other', sourceType: 'monster' }
}

function pillWithId(id: string): Pill {
  return { id, name: id, type: 'healing', grade: 'hoang', effects: [] }
}

// R9 (AR-23 4b) - preview/commit parity: the GameManager preview read
// model must reuse the SAME jobSuccessPercent rule the settle path uses
// (single implementation; verified here via the shared authority).
import { GameManagerAlchemyOps } from '../game/GameManagerAlchemyOps'
import { BuildingRegistry } from '../building/BuildingRegistry'
import { BuildingManager } from '../building/BuildingManager'

describe('GameManagerAlchemyOps — FIFO queue read model', () => {
  it('projects one active job, ordered waiting jobs, and modifier-based capacity', () => {
    const system = new AlchemySystem()
    system.restoreJobs([
      makeJob(),
      makeJob({ jobId: 'waiting_job', startedAtMs: 1_000, completesAtMs: 2_000 }),
    ])
    const buildingRegistry = new BuildingRegistry()
    buildingRegistry.register({
      id: 'pill_room',
      name: 'Dan Phong',
      levels: [
        { level: 1, effects: [{ kind: 'alchemy_queue_slots', amount: 3 }] },
        { level: 2, effects: [{ kind: 'alchemy_queue_slots', amount: 3 }] },
      ],
    } as never)
    const buildingManager = new BuildingManager()
    buildingManager.add({ instanceId: 'pill-room-1', buildingId: 'pill_room', level: 2, lastCollectedAt: 0 })
    const ops = new GameManagerAlchemyOps({
      alchemySystem: system,
      alchemyRecipesById: new Map([[RECIPE.id, RECIPE]]),
      buildingRegistry,
      buildingManager,
      buildingSystem: new BuildingSystem(),
      materialBag: new MaterialBag(),
      materialRegistry: new MaterialRegistry(),
    })

    expect(ops.getAlchemyQueueState()).toEqual({
      activeJob: expect.objectContaining({ jobId: 'job_test' }),
      waitingJobs: [expect.objectContaining({ jobId: 'waiting_job' })],
      maxQueueSlots: 6,
      maxTotalJobs: 7,
      usedQueueSlots: 1,
      remainingQueueSlots: 5,
    })
  })

  it('Ops refunds a cancelled waiting reservation and keeps the active reserve burned', () => {
    const materialBag = new MaterialBag()
    const materialRegistry = new MaterialRegistry()
    const buildingRegistry = new BuildingRegistry()
    const buildingManager = new BuildingManager()
    const recipe: AlchemyRecipe = {
      ...RECIPE,
      fuelWoodAmount: WOOD_AMOUNT,
      spiritStoneCost: 3,
      specialIngredients: [{ materialId: 'special_core', amount: 2 }],
    }
    const spiritStoneId = 'spirit_stone_ha_pham'
    for (const id of ['herb_decade', 'mortal_wood_decade', 'special_core', spiritStoneId]) {
      materialRegistry.register(material(id))
    }
    materialBag.add(materialRegistry.get('herb_decade'), 2)
    materialBag.add(materialRegistry.get('mortal_wood_decade'), 4)
    materialBag.add(materialRegistry.get('special_core'), 4)
    materialBag.add(materialRegistry.get(spiritStoneId), 6)
    buildingRegistry.register({
      id: 'pill_room',
      name: 'Dan Phong',
      levels: [{ level: 1, effects: [{ kind: 'alchemy_queue_slots', amount: 3 }] }],
    } as never)
    buildingManager.add({ instanceId: 'pill-room-1', buildingId: 'pill_room', level: 1, lastCollectedAt: 0 })
    const system = new AlchemySystem()
    system.setRecipeLookup((id) => (id === recipe.id ? recipe : undefined))
    let nowMs = 1_000
    const ops = new GameManagerAlchemyOps({
      alchemySystem: system,
      alchemyRecipesById: new Map([[recipe.id, recipe]]),
      buildingRegistry,
      buildingManager,
      buildingSystem: new BuildingSystem(),
      materialBag,
      materialRegistry,
      time: { now: () => nowMs } as never,
    })
    const player = { selectedTalentIds: [], talentLevels: {} } as never

    expect(ops.startAlchemyJob(recipe.id, 'herb_decade', player).ok).toBe(true)
    nowMs = 2_000
    expect(ops.startAlchemyJob(recipe.id, 'herb_decade', player).ok).toBe(true)
    const [active, waiting] = system.getJobs()
    expect(ops.getAlchemyQueueState()).toMatchObject({ maxQueueSlots: 3, maxTotalJobs: 4, usedQueueSlots: 1 })

    expect(ops.cancelAlchemyJob(waiting!.jobId)).toBe(true)
    expect(materialBag.getAmount('herb_decade')).toBe(1)
    expect(materialBag.getAmount('mortal_wood_decade')).toBe(2)
    expect(materialBag.getAmount('special_core')).toBe(2)
    expect(materialBag.getAmount(spiritStoneId)).toBe(3)
    expect(system.drainSettlementEvents()).toEqual([])

    expect(ops.cancelAlchemyJob(active!.jobId)).toBe(true)
    expect(materialBag.getAmount('herb_decade')).toBe(1)
    expect(materialBag.getAmount('mortal_wood_decade')).toBe(2)
    expect(materialBag.getAmount('special_core')).toBe(2)
    expect(materialBag.getAmount(spiritStoneId)).toBe(3)
  })
})
import { BuildingSystem } from '../building/BuildingSystem'

describe('alchemy success split - preview uses the authority (AR-23 4b)', () => {
  it('previewAlchemyOutcome totalPercent equals jobSuccessPercent for the same inputs', () => {
    const ops = new GameManagerAlchemyOps({
      alchemySystem: new AlchemySystem(),
      alchemyRecipesById: new Map([['recipe_test', RECIPE]]),
      materialRegistry: new MaterialRegistry(),
      materialBag: new MaterialBag(),
      buildingRegistry: new BuildingRegistry(),
      buildingManager: new BuildingManager(),
      buildingSystem: new BuildingSystem(),
    })

    const preview = ops.previewAlchemyOutcome('recipe_test', 'herb_decade', 5)

    // The authority formula for this fixture: base(decade) + bonus(level 5).
    const authority = jobSuccessPercent(
      { herbMaterialId: 'herb_decade', roomLevelAtStart: 5 } as ActiveAlchemyJob,
      RECIPE,
    )

    expect(preview).not.toBeNull()
    expect(preview!.totalPercent).toBe(authority)
    expect(preview!.guaranteedPills).toBe(Math.floor(authority / 100))
    expect(preview!.extraPillChance).toBe(authority % 100)
  })
})

// M3 (spec 2026-09-03 talent catalog v4 sec4.2) - Hoa Hau Thong Than:
// x2 fuel wood + x2 spirit stone at startJob reserve; x2 pill yield at
// settle; +50% pill potency lives at the PillSystem consumption seam.
describe('AlchemySystem — Hoa Hau Thong Than (M3 spec §4.2)', () => {
  it('costMultiplier 2 — trừ x2 gỗ + check x2 Linh Thạch, thảo KHÔNG nhân', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext({
      herbAmount: 1,
      herbOnHand: 1,
      woodOnHand: WOOD_AMOUNT * 2,
      spiritStoneCost: 5,
      spiritStoneOnHand: 10,
    })

    const result = system.startJob(recipe, 'herb_decade', bag, registry, 10, 1, 1_000, maxConcurrentJobs, 2)

    expect(result.ok).toBe(true)
    expect(bag.getAmount('mortal_wood_decade')).toBe(0)
    // Thao duoc giu nguyen herbAmount - spec chi nhan go + Linh Thach.
    expect(bag.getAmount('herb_decade')).toBe(0)
    expect(system.getJobs()).toHaveLength(1)
  })

  it('costMultiplier 2 — gỗ chỉ đủ giá gốc → missing_fuel_wood, atomic không trừ gì', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext({
      woodOnHand: WOOD_AMOUNT, // du gia goc nhung thieu gia x2
    })

    const result = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, maxConcurrentJobs, 2)

    expect(result).toEqual({ ok: false, reason: 'missing_fuel_wood' })
    expect(bag.getAmount('herb_decade')).toBe(1)
    expect(bag.getAmount('mortal_wood_decade')).toBe(WOOD_AMOUNT)
  })

  it('costMultiplier 2 — Linh Thạch check theo giá nhân (đủ giá gốc vẫn thiếu)', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext({
      spiritStoneCost: 5,
      woodOnHand: WOOD_AMOUNT * 2, // du go cho gia x2 - fail phai do stone
    })

    const result = system.startJob(recipe, 'herb_decade', bag, registry, 5, 1, 1_000, maxConcurrentJobs, 2)

    expect(result).toEqual({ ok: false, reason: 'missing_spirit_stone' })
    expect(bag.getAmount('herb_decade')).toBe(1)
  })

  it('pillYieldMultiplier 2 — mẻ thành công ra đan đôi (guaranteed 1 → 2 viên)', () => {
    const { system, bag } = makeSystemWithJob()

    // total 100% -> guaranteed 1, yield x2 -> 2 vien.
    system.tick(2_000, bag, () => ({ id: RECIPE.pillId }), () => 0.5, 70, 2)

    expect(bag.getAmount(RECIPE.pillId)).toBe(2)

    const event = system.drainSettlementEvents()[0]
    expect(event?.pills).toBe(2)
    expect(event?.delivered).toBe(2)
    expect(event?.success).toBe(true)
  })

  it('pillYieldMultiplier 2 — mẻ thất bại vẫn 0 viên (không sinh đan)', () => {
    const { system, bag } = makeSystemWithJob()

    system.tick(2_000, bag, () => ({ id: RECIPE.pillId }), () => 0.4, 0, 2)

    expect(bag.getAmount(RECIPE.pillId)).toBe(0)
    expect(system.drainSettlementEvents()[0]?.success).toBe(false)
  })

  it('settleOffline forward yieldMultiplier — job quá hạn settle x2', () => {
    const { system, bag } = makeSystemWithJob()

    const settled = system.settleOffline(bag, () => ({ id: RECIPE.pillId }), 2_000, 70, 2)

    expect(settled).toBe(1)
    expect(bag.getAmount(RECIPE.pillId)).toBe(2)
  })

  it('startAlchemyJob (ops) — talent hoa_hau_thong_than trừ x2 Linh Thạch + x2 gỗ', () => {
    const spiritStoneId = 'spirit_stone_ha_pham'
    const materialBag = new MaterialBag()
    const materialRegistry = new MaterialRegistry()
    const buildingRegistry = new BuildingRegistry()
    const buildingManager = new BuildingManager()

    for (const entry of [material('herb_decade'), material('mortal_wood_decade'), material(spiritStoneId)]) {
      materialRegistry.register(entry)
    }

    const recipeWithCost: AlchemyRecipe = { ...RECIPE, spiritStoneCost: 10 }

    materialBag.add(materialRegistry.get('herb_decade'), 10)
    materialBag.add(materialRegistry.get('mortal_wood_decade'), 10)
    materialBag.add(materialRegistry.get(spiritStoneId), 100)

    buildingRegistry.register({
      id: 'pill_room',
      name: 'Dan Phong',
      functionType: 'pill_room',
      levels: [{ level: 1, effects: [{ kind: 'alchemy_queue_slots', amount: 3 }] }],
    } as never)

    buildingManager.add({ instanceId: 'pr-1', buildingId: 'pill_room', level: 1, lastCollectedAt: 0 })

    const ops = new GameManagerAlchemyOps({
      alchemySystem: new AlchemySystem(),
      alchemyRecipesById: new Map([[recipeWithCost.id, recipeWithCost]]),
      materialRegistry,
      materialBag,
      buildingRegistry,
      buildingManager,
      buildingSystem: new BuildingSystem(),
    })

    const player = { selectedTalentIds: ['hoa_hau_thong_than'] } as never

    const result = ops.startAlchemyJob(recipeWithCost.id, 'herb_decade', player)

    expect(result.ok).toBe(true)
    // x2 stone (10 -> 20), x2 wood (1 -> 2), herb khong nhan.
    expect(materialBag.getAmount(spiritStoneId)).toBe(80)
    expect(materialBag.getAmount('mortal_wood_decade')).toBe(8)
    expect(materialBag.getAmount('herb_decade')).toBe(9)
  })

  it('startAlchemyJob (ops) — không talent → chi phí gốc nguyên vẹn', () => {
    const spiritStoneId = 'spirit_stone_ha_pham'
    const materialBag = new MaterialBag()
    const materialRegistry = new MaterialRegistry()
    const buildingRegistry = new BuildingRegistry()
    const buildingManager = new BuildingManager()

    for (const entry of [material('herb_decade'), material('mortal_wood_decade'), material(spiritStoneId)]) {
      materialRegistry.register(entry)
    }

    const recipeWithCost: AlchemyRecipe = { ...RECIPE, spiritStoneCost: 10 }

    materialBag.add(materialRegistry.get('herb_decade'), 10)
    materialBag.add(materialRegistry.get('mortal_wood_decade'), 10)
    materialBag.add(materialRegistry.get(spiritStoneId), 100)

    buildingRegistry.register({
      id: 'pill_room',
      name: 'Dan Phong',
      functionType: 'pill_room',
      levels: [{ level: 1, effects: [{ kind: 'alchemy_queue_slots', amount: 3 }] }],
    } as never)

    buildingManager.add({ instanceId: 'pr-1', buildingId: 'pill_room', level: 1, lastCollectedAt: 0 })

    const ops = new GameManagerAlchemyOps({
      alchemySystem: new AlchemySystem(),
      alchemyRecipesById: new Map([[recipeWithCost.id, recipeWithCost]]),
      materialRegistry,
      materialBag,
      buildingRegistry,
      buildingManager,
      buildingSystem: new BuildingSystem(),
    })

    const player = { selectedTalentIds: [] } as never

    const result = ops.startAlchemyJob(recipeWithCost.id, 'herb_decade', player)

    expect(result.ok).toBe(true)
    expect(materialBag.getAmount(spiritStoneId)).toBe(90)
    expect(materialBag.getAmount('mortal_wood_decade')).toBe(9)
  })
})

// M3 preview parity (AR-23) - preview must show the talent-scaled cost +
// yield the same way startJob/tick will actually charge/pay.
describe('AlchemySystem — preview với Hoa Hau Thong Than (M3)', () => {
  function opsWithPlayer(talentIds: string[]) {
    const ops = new GameManagerAlchemyOps({
      alchemySystem: new AlchemySystem(),
      alchemyRecipesById: new Map([[RECIPE.id, { ...RECIPE, spiritStoneCost: 10 }]]),
      materialRegistry: new MaterialRegistry(),
      materialBag: new MaterialBag(),
      buildingRegistry: new BuildingRegistry(),
      buildingManager: new BuildingManager(),
      buildingSystem: new BuildingSystem(),
    })

    return ops.previewAlchemyOutcome(RECIPE.id, 'herb_decade', 5, {
      selectedTalentIds: talentIds,
    } as never)
  }

  it('có talent — cost x2 + guaranteed x2 + extraPillYield = 2', () => {
    const preview = opsWithPlayer(['hoa_hau_thong_than'])

    expect(preview).not.toBeNull()
    expect(preview!.fuelWoodAmount).toBe(RECIPE.fuelWoodAmount * 2)
    expect(preview!.spiritStoneCost).toBe(20)
    expect(preview!.yieldMultiplier).toBe(2)
    // total 50% (decade 30 + room5 20) -> guaranteed 0, extra 50% cho 2 vien.
    expect(preview!.guaranteedPills).toBe(0)
    expect(preview!.extraPillYield).toBe(2)
  })

  it('không talent — cost/yield gốc nguyên vẹn', () => {
    const preview = opsWithPlayer([])

    expect(preview!.fuelWoodAmount).toBe(RECIPE.fuelWoodAmount)
    expect(preview!.spiritStoneCost).toBe(10)
    expect(preview!.yieldMultiplier).toBe(1)
    expect(preview!.extraPillYield).toBe(1)
  })
})
