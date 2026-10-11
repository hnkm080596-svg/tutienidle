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
  jobSuccessPercent,
  alchemyJobReservationDigest,
  alchemyMulberry32,
  alchemyRoomSuccessBonus,
  alchemySecondsFor,
  ALCHEMY_MAX_BATCH_QUANTITY,
  ALCHEMY_SUCCESS_BONUS_PERCENT,
  ALCHEMY_SPEED_MULTIPLIERS,
} from './AlchemySystem'
import type { ActiveAlchemyJob, AlchemyRecipe } from './AlchemySystem'
import { rollPillQualityWithHerb } from '../pill/PillQuality'
import type { ItemQuality } from '../item/ItemQuality'
import { BUI_GO_ID, LUYEN_DAN_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
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
  luyenDanTinhHoaAmount: 1,
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
    quantity: 1,
    unitsDone: 0,
    reservation: {
      woodId: BUI_GO_ID,
      fuelWoodAmount: RECIPE.fuelWoodAmount,
      spiritStoneCost: RECIPE.spiritStoneCost,
      herbAmount: RECIPE.herbAmount,
      luyenDanTinhHoaAmount: RECIPE.luyenDanTinhHoaAmount,
      specialIngredients: [],
      costScale: 1,
      digest: 0,
    },
    ...overrides,
  }

  job.reservation = { ...job.reservation, digest: alchemyJobReservationDigest(job, job.reservation) }

  return job
}

// Mint streams are deterministic per unit: mulberry32(rollSeedBase +
// absolute unit index); first draw = extra-pill roll, next draw =
// grade roll only when the unit mints. Mirrors the settle loop so a
// test can assert the seeded outcome instead of scripting ambient rng.
function simUnits(
  job: ActiveAlchemyJob,
  recipe: AlchemyRecipe,
  bonus = 0,
  yieldMult = 1,
): { minted: boolean[]; grades: ItemQuality[]; unitPills: number[]; pills: number } {
  const total = jobSuccessPercent(job, recipe, bonus)
  const guaranteed = Math.floor(total / 100)
  const extra = total % 100
  const herbAge =
    recipe.herbVariants.find((variant) => variant.materialId === job.herbMaterialId)?.age ??
    'decade'
  const minted: boolean[] = []
  const grades: ItemQuality[] = []
  const unitPills: number[] = []
  let pills = 0
  for (let i = 0; i < (job.quantity ?? 1); i += 1) {
    const rng = alchemyMulberry32((job.rollSeedBase ?? 0) + i)
    let count = guaranteed
    if (rng() * 100 < extra) count += 1
    count = Math.floor(count * Math.max(0, yieldMult))
    minted.push(count > 0)
    if (count > 0) grades.push(rollPillQualityWithHerb(rng, herbAge))
    unitPills.push(count)
    pills += count
  }
  return { minted, grades, unitPills, pills }
}

// Finds a rollSeedBase whose unit outcomes satisfy `want` - keeps
// seeded-roll assertions explicit instead of guessing at hash values.
function baseWhere(
  quantity: number,
  want: (sim: ReturnType<typeof simUnits>) => boolean,
  recipe: AlchemyRecipe = RECIPE,
  bonus = 0,
): number {
  for (let base = 0; base < 4_000; base += 1) {
    const job = makeJob({ quantity, rollSeedBase: base })
    if (want(simUnits(job, recipe, bonus))) return base
  }
  throw new Error('no rollSeedBase satisfies the wanted unit outcome')
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
  it('không bonus — base decade 50 + room 1 bonus 0 (split moi)', () => {
    expect(jobSuccessPercent(makeJob(), RECIPE)).toBe(50)
  })

  it('bonus điểm % (Đan Duyên +15) cộng thẳng vào tổng', () => {
    expect(jobSuccessPercent(makeJob(), RECIPE, 15)).toBe(65)
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
  it('không bonus — roll 60% thất bại với total 50% (split moi)', () => {
    // Seeded stream: pick a base whose unit-0 extra-pill roll misses,
    // so the settle deterministically mints nothing (the fail branch).
    const base = baseWhere(1, (sim) => sim.minted[0] === false)
    const { system, bag } = makeSystemWithJob(makeJob({ rollSeedBase: base }))

    system.tick(2_000, bag, () => ({ id: RECIPE.pillId }), () => 0.6)

    expect(bag.getAmount(RECIPE.pillId)).toBe(0)
    expect(system.drainSettlementEvents()[0]?.success).toBe(false)
  })

  it('bonus 15 điểm — cùng roll 40% thành công (total 65%)', () => {
    const { system, bag } = makeSystemWithJob()

    system.tick(2_000, bag, () => ({ id: RECIPE.pillId }), () => 0.4, 15)

    expect(bag.getAmount(RECIPE.pillId)).toBe(1)
    expect(system.drainSettlementEvents()[0]?.success).toBe(true)
  })

  it('bonus đẩy total qua 100 — guaranteed pill tăng tương ứng', () => {
    const { system, bag } = makeSystemWithJob()

    // 50 + 75 = 125 -> guaranteed 1, extra chance 25% (roll 0.5 truot extra)
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
  it('bảng bonus/speed đủ 9 entry theo maxLevel Đan Phòng', () => {
    expect(ALCHEMY_SUCCESS_BONUS_PERCENT).toHaveLength(9)
    expect(ALCHEMY_SPEED_MULTIPLIERS).toHaveLength(9)
  })

  it('level 6-9 có giá trị thật, không kẹt ở level 5', () => {
    expect(alchemyRoomSuccessBonus(6)).toBeGreaterThan(alchemyRoomSuccessBonus(5))
    expect(alchemyRoomSuccessBonus(9)).toBeGreaterThan(alchemyRoomSuccessBonus(8))

    expect(alchemySecondsFor(RECIPE, 9)).toBeLessThan(alchemySecondsFor(RECIPE, 5))
  })

  it('bonus clamp với level ngoài khoảng (0/âm/vượt 9)', () => {
    expect(alchemyRoomSuccessBonus(0)).toBe(ALCHEMY_SUCCESS_BONUS_PERCENT[0])
    expect(alchemyRoomSuccessBonus(-3)).toBe(ALCHEMY_SUCCESS_BONUS_PERCENT[0])
    expect(alchemyRoomSuccessBonus(99)).toBe(ALCHEMY_SUCCESS_BONUS_PERCENT[8])
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
    tinhHoaOnHand?: number
    spiritStoneCost?: number
    spiritStoneOnHand?: number
    maxConcurrentJobs?: number
  } = {},
) {
  const {
    herbAmount = 1,
    herbOnHand = herbAmount,
    woodOnHand = WOOD_AMOUNT,
    tinhHoaOnHand = RECIPE.luyenDanTinhHoaAmount,
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
  registry.register(material(BUI_GO_ID))
  registry.register(material(LUYEN_DAN_TINH_HOA_ID))

  if (herbOnHand > 0) bag.add(registry.get('herb_decade'), herbOnHand)
  if (woodOnHand > 0) bag.add(registry.get(BUI_GO_ID), woodOnHand)
  // Materials economy rework - tinh hoa bat buoc; stock du mac dinh.
  bag.add(registry.get(LUYEN_DAN_TINH_HOA_ID), tinhHoaOnHand)

  const system = new AlchemySystem()

  return { recipe, bag, registry, system, maxConcurrentJobs }
}

// Materials economy rework - nhien lieu la Bui Go (id duy nhat, khong
// realm/tuoi); resolveFuelWood va rule 6E cung-realm-cung-tuoi da retired.
describe('AlchemySystem — nhiên liệu Bụi Gỗ (materials economy rework)', () => {
  /** Recipe thao van nien + bag co bui_go (du hoac thieu). */
  function myriadContext(buiGoOnHand: number, tinhHoaOnHand = 1) {
    const recipe: AlchemyRecipe = {
      ...RECIPE,
      herbVariants: [{ materialId: 'herb_myriad_year', age: 'myriad_year', label: 'Vạn Niên' }],
      fuelWoodAmount: WOOD_AMOUNT,
    }

    const bag = new MaterialBag()
    const registry = new MaterialRegistry()

    registry.register(material('herb_myriad_year'))
    registry.register(material(BUI_GO_ID))
    registry.register(material(LUYEN_DAN_TINH_HOA_ID))

    bag.add(registry.get('herb_myriad_year'), 1)
    bag.add(registry.get(BUI_GO_ID), buiGoOnHand)
    bag.add(registry.get(LUYEN_DAN_TINH_HOA_ID), tinhHoaOnHand)

    const system = new AlchemySystem()

    return { recipe, bag, registry, system }
  }

  it('herb vạn niên + bui_go đủ + tinh hoa đủ → job start', () => {
    const { recipe, bag, registry, system } = myriadContext(WOOD_AMOUNT)

    const result = system.startJob(recipe, 'herb_myriad_year', bag, registry, 0, 1, 1_000, 1)

    expect(result.ok).toBe(true)
    expect(bag.getAmount(BUI_GO_ID)).toBe(0)
    expect(bag.getAmount(LUYEN_DAN_TINH_HOA_ID)).toBe(0)
    expect(system.getJobs()).toHaveLength(1)
  })

  it('herb vạn niên + thiếu bui_go → missing_bui_go, không trừ thảo', () => {
    const { recipe, bag, registry, system } = myriadContext(WOOD_AMOUNT - 1)

    const result = system.startJob(recipe, 'herb_myriad_year', bag, registry, 0, 1, 1_000, 1)

    expect(result).toEqual({ ok: false, reason: 'missing_bui_go' })
    expect(bag.getAmount('herb_myriad_year')).toBe(1)
    expect(bag.getAmount(BUI_GO_ID)).toBe(WOOD_AMOUNT - 1)
    expect(system.getJobs()).toHaveLength(0)
  })

  it('đủ bui_go + thiếu tinh hoa → missing_tinh_hoa, không trừ gì', () => {
    const { recipe, bag, registry, system } = myriadContext(WOOD_AMOUNT, 0)

    const result = system.startJob(recipe, 'herb_myriad_year', bag, registry, 0, 1, 1_000, 1)

    expect(result).toEqual({ ok: false, reason: 'missing_tinh_hoa' })
    expect(bag.getAmount('herb_myriad_year')).toBe(1)
    expect(bag.getAmount(BUI_GO_ID)).toBe(WOOD_AMOUNT)
    expect(system.getJobs()).toHaveLength(0)
  })

  it('herb thập niên + bui_go + tinh hoa → OK', () => {
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
    expect(bag.getAmount(BUI_GO_ID)).toBe(0)

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
    expect(bag.getAmount(BUI_GO_ID)).toBe(WOOD_AMOUNT)
    expect(system.getJobs()).toHaveLength(0)
  })

  it('thiếu gỗ — thất bại sạch, KHÔNG trừ thảo (atomic)', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext({
      woodOnHand: WOOD_AMOUNT - 1,
    })

    const result = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, maxConcurrentJobs)

    expect(result).toEqual({ ok: false, reason: 'missing_bui_go' })
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
    expect(bag.getAmount(BUI_GO_ID)).toBe(WOOD_AMOUNT)
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
    expect(bag.getAmount(BUI_GO_ID)).toBe(WOOD_AMOUNT)
  })

  it('vượt slot tối đa — job_slots_full, không trừ gì', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext({ maxConcurrentJobs: 1 })

    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, maxConcurrentJobs).ok).toBe(true)

    const result = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 2_000, maxConcurrentJobs)

    expect(result).toEqual({ ok: false, reason: 'job_slots_full' })
    expect(system.getJobs()).toHaveLength(1)
  })

  it('maxConcurrentJobs <= 0 vẫn cho tối thiểu 1 slot (Math.max 1)', () => {
    const { recipe, bag, registry, system } = buildContext()

    const first = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 0)
    expect(first.ok).toBe(true)

    const second = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 2_000, 0)
    expect(second.ok).toBe(false)
    expect(second.reason).toBe('job_slots_full')
  })
})

describe('AlchemySystem — cancel job (QUEUE REWORK: refund chi phan vien chua bat dau)', () => {
  it('cancel order 1 vien dang trong lo — xoa job, lieu da dot khong hoan', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext({ herbOnHand: 3 })

    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, maxConcurrentJobs).ok).toBe(true)

    const jobId = system.getJobs()[0]!.jobId

    // Vien duy nhat da vao lo (startedAt 1_000 < now 2_000) - unstarted = 0.
    expect(system.cancelJob(jobId, bag, registry, 2_000)).toEqual({ ok: true, unprocessedUnits: 0 })
    expect(system.getJobs()).toHaveLength(0)
    expect(bag.getAmount('herb_decade')).toBe(3 - 1)
    expect(bag.getAmount(BUI_GO_ID)).toBe(WOOD_AMOUNT - WOOD_AMOUNT)
  })

  it('cancel id không tồn tại — trả ok:false, không throw', () => {
    const { bag, registry, system } = buildContext()

    expect(system.cancelJob('ghost_job', bag, registry, 1_000)).toEqual({ ok: false })
    expect(system.getJobs()).toHaveLength(0)
  })

  it('cancel batch giua chung — hoan lieu cac vien CHUA BAT DAU, vien xong/dang dot mat lieu', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext({
      herbOnHand: 10,
      woodOnHand: 40,
      tinhHoaOnHand: 4,
    })

    // quantity 4, perUnit 60s, started 1_000.
    expect(
      system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, maxConcurrentJobs, 1, 4).ok,
    ).toBe(true)
    expect(bag.getAmount('herb_decade')).toBe(10 - 4)
    expect(bag.getAmount(BUI_GO_ID)).toBe(40 - WOOD_AMOUNT * 4)
    expect(bag.getAmount(LUYEN_DAN_TINH_HOA_ID)).toBe(0)

    const jobId = system.getJobs()[0]!.jobId

    // now = 122_000 -> vien 0,1 xong deadline, vien 2 dang trong lo,
    // chi vien 3 chua bat dau -> refund 1x herb + 1x wood + 1x tinh hoa.
    expect(system.cancelJob(jobId, bag, registry, 122_000)).toEqual({ ok: true, unprocessedUnits: 1 })
    expect(bag.getAmount('herb_decade')).toBe(10 - 4 + 1)
    expect(bag.getAmount(BUI_GO_ID)).toBe(40 - WOOD_AMOUNT * 4 + WOOD_AMOUNT)
    expect(bag.getAmount(LUYEN_DAN_TINH_HOA_ID)).toBe(1)
    expect(system.getJobs()).toHaveLength(0)
  })

  it('cancel batch ngay sau enqueue — vien dau da vao lo, refund quantity-1', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext({
      herbOnHand: 6,
      woodOnHand: 40,
      tinhHoaOnHand: 3,
    })

    expect(
      system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, maxConcurrentJobs, 1, 3).ok,
    ).toBe(true)

    const jobId = system.getJobs()[0]!.jobId

    // now = 2_000: vien 0 dang trong lo (started 1_000), 2 vien chua bat dau.
    expect(system.cancelJob(jobId, bag, registry, 2_000)).toEqual({ ok: true, unprocessedUnits: 2 })
    expect(bag.getAmount('herb_decade')).toBe(6 - 3 + 2)
    expect(bag.getAmount(BUI_GO_ID)).toBe(40 - WOOD_AMOUNT * 3 + WOOD_AMOUNT * 2)
    expect(bag.getAmount(LUYEN_DAN_TINH_HOA_ID)).toBe(2)
  })

  it('cancel voi clock ngoai domain — ok:false, job con nguyen (deny)', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext()

    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, maxConcurrentJobs).ok).toBe(true)

    const jobId = system.getJobs()[0]!.jobId

    expect(system.cancelJob(jobId, bag, registry, Number.NaN)).toEqual({ ok: false })
    expect(system.getJobs()).toHaveLength(1)
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
  })
})

describe('AlchemySystem — success rate với bonus Đan Phòng (pure math, không RNG)', () => {
  it('jobSuccessPercent = base niên đại + bonus room + bonus điểm thiên phú', () => {
    const baseDecade = jobSuccessPercent(makeJob(), RECIPE, 0)
    const withRoom = jobSuccessPercent(makeJob({ roomLevelAtStart: 3 }), RECIPE, 0)

    expect(withRoom).toBe(baseDecade + alchemyRoomSuccessBonus(3))
    expect(jobSuccessPercent(makeJob({ roomLevelAtStart: 3 }), RECIPE, 10)).toBe(
      baseDecade + alchemyRoomSuccessBonus(3) + 10,
    )
  })

  it('guaranteed/extra tách từ total — 65% → 0 guaranteed + extra 65%', () => {
    const total = jobSuccessPercent(makeJob(), RECIPE, 15)

    expect(total).toBe(65)
    expect(Math.floor(total / 100)).toBe(0)
    expect(total % 100).toBe(65)
  })

  it('total > 100 → guaranteed tăng, phần thừa thành extra chance', () => {
    const total = jobSuccessPercent(makeJob(), RECIPE, 75)

    expect(total).toBe(125)
    expect(Math.floor(total / 100)).toBe(1)
    expect(total % 100).toBe(25)
  })
})

describe('AlchemySystem — cap stackLimit của PillBag khi settle (đan stack trần 1000)', () => {
  it('settle vượt trần PillBag — phần tràn bị chặn, đan stack giữ 1000', () => {
    // Same-grade stack required for the cap to bite: pick a base whose
    // unit mints a 'hoang' pill (merges into the pre-filled stack).
    const base = baseWhere(1, (sim) => sim.grades[0] === 'hoang', RECIPE, 100)
    const { system, bag } = makeSystemWithJob(makeJob({ rollSeedBase: base }))

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
    expect(bag.getAmount(BUI_GO_ID)).toBe(0)
    // Thao duoc giu nguyen herbAmount - spec chi nhan go + Linh Thach.
    expect(bag.getAmount('herb_decade')).toBe(0)
    expect(system.getJobs()).toHaveLength(1)
  })

  it('costMultiplier 2 — gỗ chỉ đủ giá gốc → missing_bui_go, atomic không trừ gì', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext({
      woodOnHand: WOOD_AMOUNT, // du gia goc nhung thieu gia x2
    })

    const result = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, maxConcurrentJobs, 2)

    expect(result).toEqual({ ok: false, reason: 'missing_bui_go' })
    expect(bag.getAmount('herb_decade')).toBe(1)
    expect(bag.getAmount(BUI_GO_ID)).toBe(WOOD_AMOUNT)
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
    const base = baseWhere(1, (sim) => sim.minted[0] === false)
    const { system, bag } = makeSystemWithJob(makeJob({ rollSeedBase: base }))

    system.tick(2_000, bag, () => ({ id: RECIPE.pillId }), () => 0.6, 0, 2)

    expect(bag.getAmount(RECIPE.pillId)).toBe(0)
    expect(system.drainSettlementEvents()[0]?.success).toBe(false)
  })

  it('settleOffline forward yieldMultiplier — job quá hạn settle x2', () => {
    const { system, bag } = makeSystemWithJob()

    // total 120% (50 + 70) -> guaranteed 1 + extra 20%; rng 0.9 tranh
    // phu thuoc Math.random (extra 20% khien test flaky theo thiet ke).
    const settled = system.settleOffline(
      bag,
      () => ({ id: RECIPE.pillId }),
      2_000,
      70,
      2,
      () => 0.9,
    )

    expect(settled).toBe(1)
    expect(bag.getAmount(RECIPE.pillId)).toBe(2)
  })

  it('startAlchemyJob (ops) — talent hoa_hau_thong_than trừ x2 Linh Thạch + x2 gỗ', () => {
    const spiritStoneId = 'spirit_stone_ha_pham'
    const materialBag = new MaterialBag()
    const materialRegistry = new MaterialRegistry()
    const buildingRegistry = new BuildingRegistry()
    const buildingManager = new BuildingManager()

    for (const entry of [material('herb_decade'), material(BUI_GO_ID), material(LUYEN_DAN_TINH_HOA_ID), material(spiritStoneId)]) {
      materialRegistry.register(entry)
    }

    const recipeWithCost: AlchemyRecipe = { ...RECIPE, spiritStoneCost: 10 }

    materialBag.add(materialRegistry.get('herb_decade'), 10)
    materialBag.add(materialRegistry.get(BUI_GO_ID), 10)
    materialBag.add(materialRegistry.get(LUYEN_DAN_TINH_HOA_ID), 10)
    materialBag.add(materialRegistry.get(spiritStoneId), 100)

    buildingRegistry.register({
      id: 'pill_room',
      name: 'Dan Phong',
      functionType: 'pill_room',
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
    expect(materialBag.getAmount(BUI_GO_ID)).toBe(8)
    expect(materialBag.getAmount('herb_decade')).toBe(9)
  })

  it('startAlchemyJob (ops) — không talent → chi phí gốc nguyên vẹn', () => {
    const spiritStoneId = 'spirit_stone_ha_pham'
    const materialBag = new MaterialBag()
    const materialRegistry = new MaterialRegistry()
    const buildingRegistry = new BuildingRegistry()
    const buildingManager = new BuildingManager()

    for (const entry of [material('herb_decade'), material(BUI_GO_ID), material(LUYEN_DAN_TINH_HOA_ID), material(spiritStoneId)]) {
      materialRegistry.register(entry)
    }

    const recipeWithCost: AlchemyRecipe = { ...RECIPE, spiritStoneCost: 10 }

    materialBag.add(materialRegistry.get('herb_decade'), 10)
    materialBag.add(materialRegistry.get(BUI_GO_ID), 10)
    materialBag.add(materialRegistry.get(LUYEN_DAN_TINH_HOA_ID), 10)
    materialBag.add(materialRegistry.get(spiritStoneId), 100)

    buildingRegistry.register({
      id: 'pill_room',
      name: 'Dan Phong',
      functionType: 'pill_room',
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
    expect(materialBag.getAmount(BUI_GO_ID)).toBe(9)
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
    // total 70% (decade 50 + room5 20) -> guaranteed 0, extra 70% cho 2 vien.
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

// QUEUE REWORK (2026-10-11) - order = batch N vien luyen TUAN TU:
// reserve nguyen lieu x quantity luc enqueue, moi vien roll rieng theo
// deadline started + (k+1)*perUnit (perUnit = alchemySecondsFor hien
// hanh), mint tung vien. Cancel refund chi cac vien chua bat dau.
describe('AlchemySystem — queue order (batch tuần tự từng viên)', () => {
  function batchContext(overrides: { herbOnHand?: number; woodOnHand?: number } = {}) {
    const { herbOnHand = 20, woodOnHand = 60 } = overrides

    const recipe: AlchemyRecipe = { ...RECIPE, herbAmount: 1, fuelWoodAmount: WOOD_AMOUNT, baseDurationSeconds: 60 }
    const bag = new MaterialBag()
    const registry = new MaterialRegistry()

    registry.register(material('herb_decade'))
    registry.register(material(BUI_GO_ID))
    registry.register(material(LUYEN_DAN_TINH_HOA_ID))

    if (herbOnHand > 0) bag.add(registry.get('herb_decade'), herbOnHand)
    if (woodOnHand > 0) bag.add(registry.get(BUI_GO_ID), woodOnHand)
    bag.add(registry.get(LUYEN_DAN_TINH_HOA_ID), 60)

    const system = new AlchemySystem()

    system.setRecipeLookup((id) => (id === recipe.id ? recipe : undefined))

    return { recipe, bag, registry, system }
  }

  it('startJob quantity=N — reserve atomic herb/go x N, completesAt = start + N*duration', () => {
    const { recipe, bag, registry, system } = batchContext()

    const result = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 1, 1, 5)

    expect(result).toEqual({ ok: true, spiritStoneCost: 0 })
    expect(bag.getAmount('herb_decade')).toBe(20 - 5)
    expect(bag.getAmount(BUI_GO_ID)).toBe(60 - WOOD_AMOUNT * 5)

    const job = system.getJobs()[0]!
    expect(job.quantity).toBe(5)
    expect(job.unitsDone).toBe(0)
    expect(job.completesAtMs).toBe(1_000 + 5 * 60_000)
    // Reservation giu so PER-UNIT (refund/settle replay tung vien).
    expect(job.reservation.herbAmount).toBe(1)
    expect(job.reservation.fuelWoodAmount).toBe(WOOD_AMOUNT)
  })

  it.each([0, -3, 1.5, Number.NaN, 1_001, Number.POSITIVE_INFINITY])(
    'quantity=%p — invalid_quantity, khong tru lieu',
    (quantity) => {
      const { recipe, bag, registry, system } = batchContext()

      const result = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 1, 1, quantity)

      expect(result).toEqual({ ok: false, reason: 'invalid_quantity' })
      expect(bag.getAmount('herb_decade')).toBe(20)
      expect(system.getJobs()).toHaveLength(0)
    },
  )

  it('kho khong du lieu cho batch — missing_herb, khong tru gi', () => {
    const { recipe, bag, registry, system } = batchContext({ herbOnHand: 3 })

    const result = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 1, 1, 5)

    expect(result).toEqual({ ok: false, reason: 'missing_herb' })
    expect(bag.getAmount('herb_decade')).toBe(3)
    expect(system.getJobs()).toHaveLength(0)
  })

  it('tick tuan tu — moi deadline roll mot vien, unitsDone tang dan, xong het moi roi queue', () => {
    const { recipe, bag, registry, system } = batchContext()
    const pillBag = new PillBag()

    system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 1, 1, 3)

    // total 50% (decade, split moi). Per-unit pill counts come from the
    // seeded mint stream - mirror it instead of scripting ambient rng.
    const sim = simUnits(system.getJobs()[0]!, recipe)
    let expected = 0

    system.tick(61_000, pillBag, () => ({ id: recipe.pillId }), () => 0)
    let job = system.getJobs()[0]!
    expect(job.unitsDone).toBe(1)
    expected += sim.unitPills[0]!
    expect(pillBag.getAmount(recipe.pillId)).toBe(expected)
    expect(system.drainSettlementEvents()[0]).toMatchObject({ unitsProcessed: 1, jobDone: false })

    system.tick(121_000, pillBag, () => ({ id: recipe.pillId }), () => 0)
    job = system.getJobs()[0]!
    expect(job.unitsDone).toBe(2)
    expected += sim.unitPills[1]!
    expect(pillBag.getAmount(recipe.pillId)).toBe(expected)

    system.tick(181_000, pillBag, () => ({ id: recipe.pillId }), () => 0)
    expect(system.getJobs()).toHaveLength(0)
    expected += sim.unitPills[2]!
    expect(pillBag.getAmount(recipe.pillId)).toBe(expected)
    // drain gom event cua tick 2 + tick 3 - lay event cuoi (job xong).
    expect(system.drainSettlementEvents().at(-1)).toMatchObject({ unitsProcessed: 1, jobDone: true })
  })

  it('tick mot lan sau offline dai — roll het cac vien qua han, moi vien roll rieng', () => {
    const { recipe, bag, registry, system } = batchContext()
    const pillBag = new PillBag()

    system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 1, 1, 3)

    // All 3 units settle in one tick; per-unit outcomes come from the
    // seeded stream (each unit its own mulberry32 roll).
    const sim = simUnits(system.getJobs()[0]!, recipe)

    system.tick(999_000, pillBag, () => ({ id: recipe.pillId }), () => 0.5)

    expect(pillBag.getAmount(recipe.pillId)).toBe(sim.pills)
    const event = system.drainSettlementEvents()[0]!
    expect(event.unitsProcessed).toBe(3)
    expect(event.jobDone).toBe(true)
    expect(event.pills).toBe(sim.pills)
    expect(event.success).toBe(sim.pills > 0)
  })

  it('extraPillChance tren tung vien — total 125%: moi vien guaranteed 1 + roll 25% rieng', () => {
    const { recipe, bag, registry, system } = batchContext()
    const pillBag = new PillBag()

    // room 1 + bonus 75 -> 125%: guaranteed 1 + extra 25%.
    system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 1, 1, 3)

    // Each unit rolls its own extra-pill draw off the seeded stream.
    const sim = simUnits(system.getJobs()[0]!, recipe, 75)

    system.tick(999_000, pillBag, () => ({ id: recipe.pillId }), () => 0.9, 75)

    expect(pillBag.getAmount(recipe.pillId)).toBe(sim.pills)
    expect(sim.unitPills.every((count) => count >= 1)).toBe(true)
  })

  it('vien da qua deadline nhung chua roll van bi mat lieu khi cancel (chong ne roll)', () => {
    const { recipe, bag, registry, system } = batchContext()

    system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 1, 1, 3)

    const jobId = system.getJobs()[0]!.jobId

    // now = 61_500: vien 0 XONG (deadline 61_000) + vien 1 dang trong lo
    // -> chi vien 2 chua bat dau -> refund 1 vien du tick chua chay.
    const cancelled = system.cancelJob(jobId, bag, registry, 61_500)

    expect(cancelled).toEqual({ ok: true, unprocessedUnits: 1 })
    expect(bag.getAmount('herb_decade')).toBe(20 - 3 + 1)
  })

  it('restore round-trip giua batch — job quantity=3 unitsDone=1 van settle tiep dung', () => {
    const { recipe, bag, registry, system } = batchContext()
    const pillBag = new PillBag()

    system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 1, 1, 3)

    // Roll 1 vien roi "save" (detach qua getJobs) + "restore" sang system moi.
    const sim = simUnits(system.getJobs()[0]!, recipe)
    system.tick(61_000, pillBag, () => ({ id: recipe.pillId }), () => 0)

    const snapshot = system.getJobs().map((job) => ({ ...job }))
    expect(snapshot[0]!.unitsDone).toBe(1)

    const restored = new AlchemySystem()
    restored.setRecipeLookup((id) => (id === recipe.id ? recipe : undefined))
    restored.restoreJobs(snapshot, 61_000)

    // Hai vien con lai settle o cac deadline rieng, khong re-mint vien 0.
    restored.tick(181_000, pillBag, () => ({ id: recipe.pillId }), () => 0)
    expect(restored.getJobs()).toHaveLength(0)
    expect(pillBag.getAmount(recipe.pillId)).toBe(sim.pills)
  })

  it('job shape cu (khong quantity/unitsDone) — restore VERBATIM, settle nhu cu', () => {
    const pillBag = new PillBag()
    // RECIPE goc (fuelWoodAmount 1) - khop reservation cua makeJob de
    // witness verify pass.
    const recipe = RECIPE

    const legacy = makeJob({ completesAtMs: 60_500, startedAtMs: 500 })
    // Bo 2 field moi de gia lap save pre-rework, roi fold lai digest
    // theo formula CU (khong batch fields) nhu save that.
    delete (legacy as Partial<ActiveAlchemyJob>).quantity
    delete (legacy as Partial<ActiveAlchemyJob>).unitsDone
    legacy.reservation = {
      ...legacy.reservation,
      digest: alchemyJobReservationDigest(legacy, legacy.reservation),
    }

    const system = new AlchemySystem()
    system.setRecipeLookup((id) => (id === recipe.id ? recipe : undefined))
    // Restore tai 1_000 > started 500 - khong post-date nen khong shift.
    system.restoreJobs([legacy], 1_000)

    const restored = system.getJobs()[0]!
    // Verbatim: field van absent, digest nguyen, deadline math tu
    // default 1/0.
    expect(restored.quantity).toBeUndefined()
    expect(restored.unitsDone).toBeUndefined()
    expect(restored.reservation.digest).toBe(legacy.reservation.digest)

    system.tick(60_500, pillBag, () => ({ id: recipe.pillId }), () => 0)
    expect(pillBag.getAmount(recipe.pillId)).toBe(1)
    expect(system.getJobs()).toHaveLength(0)
  })

  it('restore tu choi batch shape khong hop le — quantity xau / unitsDone >= quantity / thieu 1 trong 2', () => {
    const system = new AlchemySystem()

    const base = makeJob()
    const cases: Partial<ActiveAlchemyJob>[] = [
      { quantity: 0, unitsDone: 0 },
      { quantity: -2, unitsDone: 0 },
      { quantity: 1.5, unitsDone: 0 },
      { quantity: 1001, unitsDone: 0 },
      { quantity: 3, unitsDone: 3 },
      { quantity: 3, unitsDone: -1 },
      { quantity: 3, unitsDone: 1.5 },
      { unitsDone: 1 },
    ]

    for (const patch of cases) {
      system.restoreJobs([{ ...base, ...patch }], 0)
      expect(system.getJobs()).toHaveLength(0)
    }

    // Chi quantity ma khong unitsDone (xor arm) - writer luon ghi ca cap.
    const { unitsDone: _stripped, ...withoutUnitsDone } = base
    system.restoreJobs([{ ...withoutUnitsDone, quantity: 3 } as ActiveAlchemyJob], 0)
    expect(system.getJobs()).toHaveLength(0)

    const { quantity: _strippedQty, ...withoutQuantity } = base
    system.restoreJobs([{ ...withoutQuantity, unitsDone: 0 } as ActiveAlchemyJob], 0)
    expect(system.getJobs()).toHaveLength(0)
  })
})

// Ops-level refund: cancelAlchemyJob mirror spirit stone cua cac vien
// chua bat dau (domain hoan herb/go/specials; ops hoan stone - cung
// split voi duong charge).
describe('GameManagerAlchemyOps — cancelAlchemyJob refund stone (QUEUE REWORK)', () => {
  it('cancel order giua chung — stone cua vien chua bat dau duoc hoan', () => {
    const spiritStoneId = 'spirit_stone_ha_pham'
    const materialBag = new MaterialBag()
    const materialRegistry = new MaterialRegistry()
    const buildingRegistry = new BuildingRegistry()
    const buildingManager = new BuildingManager()

    for (const entry of [material('herb_decade'), material(BUI_GO_ID), material(LUYEN_DAN_TINH_HOA_ID), material(spiritStoneId)]) {
      materialRegistry.register(entry)
    }

    const recipeWithCost: AlchemyRecipe = { ...RECIPE, spiritStoneCost: 10 }

    materialBag.add(materialRegistry.get('herb_decade'), 10)
    materialBag.add(materialRegistry.get(BUI_GO_ID), 20)
    materialBag.add(materialRegistry.get(LUYEN_DAN_TINH_HOA_ID), 10)
    materialBag.add(materialRegistry.get(spiritStoneId), 100)

    buildingRegistry.register({
      id: 'pill_room',
      name: 'Dan Phong',
      functionType: 'pill_room',
    } as never)

    buildingManager.add({ instanceId: 'pr-1', buildingId: 'pill_room', level: 1, lastCollectedAt: 0 })

    const alchemySystem = new AlchemySystem()

    const ops = new GameManagerAlchemyOps({
      alchemySystem,
      alchemyRecipesById: new Map([[recipeWithCost.id, recipeWithCost]]),
      materialRegistry,
      materialBag,
      buildingRegistry,
      buildingManager,
      buildingSystem: new BuildingSystem(),
    })

    const player = { selectedTalentIds: [] } as never

    vi.useFakeTimers()
    try {
      vi.setSystemTime(1_000)

      // 3 click 'Luyen Dan' lien tiep -> merge vao 1 order quantity 3,
      // stone tru tung click (10/vien -> tong 30).
      for (let click = 0; click < 3; click += 1) {
        const started = ops.startAlchemyJob(recipeWithCost.id, 'herb_decade', player)
        expect(started.ok).toBe(true)
      }
      expect(materialBag.getAmount(spiritStoneId)).toBe(70)
      expect(alchemySystem.getJobs()).toHaveLength(1)
      expect(alchemySystem.getJobs()[0]!.quantity).toBe(3)

      const jobId = alchemySystem.getJobs()[0]!.jobId

      // Cancel luc vien 0 dang trong lo -> 2 vien chua bat dau ->
      // hoan 2x10 stone + 2 herb + 2x wood.
      vi.setSystemTime(1_500)
      expect(ops.cancelAlchemyJob(jobId)).toBe(true)
    } finally {
      vi.useRealTimers()
    }

    expect(materialBag.getAmount(spiritStoneId)).toBe(90)
    expect(materialBag.getAmount('herb_decade')).toBe(10 - 3 + 2)
    expect(materialBag.getAmount(BUI_GO_ID)).toBe(20 - 3 + 2)
  })
})

// QUEUE REWORK ruling 2 (2026-10-11) - moi click 'Luyen Dan' = +1 vien:
// cung loai voi order CUOI hang cho thi merge (quantity+1), khac loai
// tao order moi. Reserve nguyen lieu 1 vien ngay luc bam.
describe('AlchemySystem — enqueueJob merge-into-last-order', () => {
  const PER_UNIT_MS = 60_000

  function clickContext() {
    const recipe: AlchemyRecipe = {
      ...RECIPE,
      herbAmount: 1,
      fuelWoodAmount: WOOD_AMOUNT,
      baseDurationSeconds: PER_UNIT_MS / 1000,
    }
    const bag = new MaterialBag()
    const registry = new MaterialRegistry()

    registry.register(material('herb_decade'))
    registry.register(material('herb_century'))
    registry.register(material(BUI_GO_ID))
    registry.register(material('mortal_wood_century'))

    registry.register(material(LUYEN_DAN_TINH_HOA_ID))

    bag.add(registry.get('herb_decade'), 20)
    bag.add(registry.get('herb_century'), 20)
    bag.add(registry.get(BUI_GO_ID), 60)
    bag.add(registry.get('mortal_wood_century'), 60)
    bag.add(registry.get(LUYEN_DAN_TINH_HOA_ID), 60)

    const recipeWithVariants: AlchemyRecipe = {
      ...recipe,
      herbVariants: [
        ...recipe.herbVariants,
        { materialId: 'herb_century', label: 'Tram Nien', age: 'century', successPercentBonus: 60 } as never,
      ],
    }

    const system = new AlchemySystem()
    system.setRecipeLookup((id) => (id === recipeWithVariants.id ? recipeWithVariants : undefined))

    return { recipe: recipeWithVariants, bag, registry, system }
  }

  it('3 click cung loai — merge vao 1 order: quantity 3, span 3 vien, tru lieu tung click', () => {
    const { recipe, bag, registry, system } = clickContext()

    for (let click = 0; click < 3; click += 1) {
      const result = system.enqueueJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 2)
      expect(result).toMatchObject({ ok: true, merged: click === 0 ? false : true })
    }

    const jobs = system.getJobs()
    expect(jobs).toHaveLength(1)
    expect(jobs[0]!.quantity).toBe(3)
    expect(jobs[0]!.completesAtMs).toBe(1_000 + 3 * PER_UNIT_MS)
    expect(bag.getAmount('herb_decade')).toBe(20 - 3)
    expect(bag.getAmount(BUI_GO_ID)).toBe(60 - WOOD_AMOUNT * 3)
  })

  it('xen ke A B A — A thu 2 KHONG merge vi order cuoi la B: 3 order', () => {
    const { recipe, bag, registry, system } = clickContext()

    // 'B' = cung recipe nhung bien the thao khac (don gian nhat trong
    // fixture nay - merge key la recipe + herb).
    system.enqueueJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 5)
    system.enqueueJob(recipe, 'herb_century', bag, registry, 0, 1, 1_000, 5)
    system.enqueueJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 5)

    const jobs = system.getJobs()
    expect(jobs).toHaveLength(3)
    expect(jobs.map((job) => job.herbMaterialId)).toEqual(['herb_decade', 'herb_century', 'herb_decade'])
    expect(jobs.every((job) => (job.quantity ?? 1) === 1)).toBe(true)
  })

  it('queue day van merge duoc vao order cuoi (merge khong ton slot); khac loai thi job_slots_full', () => {
    const { recipe, bag, registry, system } = clickContext()

    // capacity 1: order dau lap day slot.
    system.enqueueJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 1)

    // Click cung loai -> merge du queue day.
    const merged = system.enqueueJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 1)
    expect(merged).toMatchObject({ ok: true, merged: true })
    expect(system.getJobs()[0]!.quantity).toBe(2)

    // Click khac loai -> can slot moi -> full.
    const fresh = system.enqueueJob(recipe, 'herb_century', bag, registry, 0, 1, 1_000, 1)
    expect(fresh).toMatchObject({ ok: false, reason: 'job_slots_full' })
  })

  it('merged order settle tuan tu dung deadline — moi vien roll rieng sau merge', () => {
    const { recipe, bag, registry, system } = clickContext()
    const pillBag = new PillBag()

    system.enqueueJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 5)
    system.enqueueJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 5)
    system.enqueueJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 5)

    const sim = simUnits(system.getJobs()[0]!, recipe)
    system.tick(61_000, pillBag, () => ({ id: recipe.pillId }), () => 0)
    expect(system.getJobs()[0]!.unitsDone).toBe(1)
    system.tick(181_000, pillBag, () => ({ id: recipe.pillId }), () => 0)
    expect(system.getJobs()).toHaveLength(0)
    expect(pillBag.getAmount(recipe.pillId)).toBe(sim.pills)
  })

  it('cost profile lech giua 2 click (talent/double-pill) — khong merge, tao order moi', () => {
    const { recipe, bag, registry, system } = clickContext()

    system.enqueueJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 5, 1)
    // Click sau voi costMultiplier khac -> reservation mismatch -> new order.
    const second = system.enqueueJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 5, 2)

    expect(second).toMatchObject({ ok: true, merged: false })
    expect(system.getJobs()).toHaveLength(2)
  })

  it('order cuoi cham cap batch — click roi xuong order moi', () => {
    const { recipe, bag, registry, system } = clickContext()

    // Inject order quantity=cap cung loai qua restore.
    const capped = makeJob({ completesAtMs: 61_000, startedAtMs: 1_000 })
    system.restoreJobs([{ ...capped, quantity: ALCHEMY_MAX_BATCH_QUANTITY, unitsDone: 0 }], 0)

    const result = system.enqueueJob(recipe, capped.herbMaterialId, bag, registry, 0, 1, 0, 5)
    expect(result).toMatchObject({ ok: true, merged: false })
    expect(system.getJobs()).toHaveLength(2)
  })

  it('click thieu lieu tren order mergeable — tra reason cu the, khong tru gi', () => {
    const { recipe, bag, registry, system } = clickContext()

    system.enqueueJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 5)
    bag.remove('herb_decade', bag.getAmount('herb_decade'))

    const result = system.enqueueJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 5)
    expect(result).toMatchObject({ ok: false, reason: 'missing_herb' })
    expect(system.getJobs()[0]!.quantity).toBe(1)
    expect(bag.getAmount(BUI_GO_ID)).toBe(60 - WOOD_AMOUNT)
  })
})
