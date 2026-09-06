import { describe, expect, it } from 'vitest'
import {
  AlchemySystem,
  resolveFuelWood,
  jobSuccessPercent,
  alchemyRoomSuccessBonus,
  alchemySecondsFor,
  ALCHEMY_SUCCESS_BONUS_PERCENT,
  ALCHEMY_SPEED_MULTIPLIERS,
} from './AlchemySystem'
import type { ActiveAlchemyJob, AlchemyRecipe } from './AlchemySystem'
import { PillBag } from '../pill/PillBag'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import type { Material } from '../material/Material'
import type { Pill } from '../pill/Pill'

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

    // Job đã xử lý xong (không treo vĩnh viễn).
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
    spiritStoneOnHand = spiritStoneCost,
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

describe('AlchemySystem — resolveFuelWood chọn gỗ đạt realm tối thiểu', () => {
  it('trả null khi không có gỗ nào đạt realm tối thiểu', () => {
    const bag = new MaterialBag()

    expect(resolveFuelWood(bag, 'mortal', 1)).toBeNull()
  })

  it('chọn gỗ đạt realm tối thiểu (mortal_wood_decade)', () => {
    const bag = new MaterialBag()
    const registry = new MaterialRegistry()

    registry.register(material('herb_decade'))
    registry.register(material('mortal_wood_decade'))

    bag.add(registry.get('herb_decade'), 3)
    bag.add(registry.get('mortal_wood_decade'), 3)

    expect(resolveFuelWood(bag, 'mortal', 1)).toBe('mortal_wood_decade')
  })

  it('nhu cầu vượt lượng có → không trả stack thiếu (kiểm tra bag.has amount)', () => {
    const bag = new MaterialBag()
    const registry = new MaterialRegistry()

    registry.register(material('mortal_wood_decade'))

    bag.add(registry.get('mortal_wood_decade'), 2)

    expect(resolveFuelWood(bag, 'mortal', 5)).toBeNull()
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

  it('maxConcurrentJobs <= 0 vẫn cho tối thiểu 1 slot (Math.max 1)', () => {
    const { recipe, bag, registry, system } = buildContext()

    const first = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 0)
    expect(first.ok).toBe(true)

    const second = system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 2_000, 0)
    expect(second.ok).toBe(false)
    expect(second.reason).toBe('job_slots_full')
  })
})

describe('AlchemySystem — cancel job (lò đã khởi động, không hoàn trả)', () => {
  it('cancel job đang chạy — xoá job, nguyên liệu đã reserve không hoàn trả', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext({ herbOnHand: 3 })

    expect(system.startJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, maxConcurrentJobs).ok).toBe(true)

    const jobs = system.getJobs()
    expect(jobs).toHaveLength(1)

    const jobId = jobs[0]!.jobId

    expect(system.cancelJob(jobId)).toBe(true)
    expect(system.getJobs()).toHaveLength(0)
    expect(bag.getAmount('herb_decade')).toBe(3 - 1)
    expect(bag.getAmount('mortal_wood_decade')).toBe(WOOD_AMOUNT - WOOD_AMOUNT)
  })

  it('cancel id không tồn tại — trả false, không throw', () => {
    const { recipe, bag, registry, system, maxConcurrentJobs } = buildContext()

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
