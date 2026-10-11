// Adversarial QA cho truc chat dan (M-PILL-GRADE): bien trong so roll,
// uplift dot thao cap tien, stack khac chat khong gop, tieu chat thap
// truoc, uplift hieu luc tren moi loai effect, sach chat bat mach, va
// save crafted/legacy.
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
  betaRecipeFamilyOfId: () => 'tu_linh_dan',
}))

import {
  BASE_PILL_QUALITY,
  PILL_HERB_AGE_GRADE_STEPS,
  PILL_QUALITY_EFFECT_UPLIFT,
  pillQualityUplift,
  rollPillQuality,
  rollPillQualityWithHerb,
} from './PillQuality'
import { PillBag } from './PillBag'
import { PillSystem } from './PillSystem'
import type { Pill } from './Pill'
import { ITEM_QUALITY_ORDER, type ItemQuality } from '../item/ItemQuality'
import {
  AlchemySystem,
  ALCHEMY_MAX_BATCH_QUANTITY,
  alchemyJobReservationDigest,
  alchemyMulberry32,
  jobSuccessPercent,
  type ActiveAlchemyJob,
  type AlchemyRecipe,
} from '../alchemy/AlchemySystem'
import { BUI_GO_ID } from '../equipment/TinhHoaMaterial'
import { createDefaultPlayer } from '../player/Player'
import { getMainStatCap } from '../stats/StatCap'
import { getRequiredCultivation } from '../realm/realmSystem'
import { meridianChapter, recordMeridianOpenQuality } from '../realm/body/MeridianChapter'
import { MERIDIANS } from '../../data/realm/Meridians'
import { validateGameSaveShape } from '../../services/save/saveShapeValidation'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'

const PILL: Pill = {
  id: 'test_pill',
  name: 'Test Pill',
  type: 'cultivation',
  grade: 'hoang',
  effects: [],
}

const RNG = (value: number) => () => value

// ===================== rollPillQuality - bien trong so =====================
// ITEM_QUALITY_DROP_WEIGHT 75/15/8/1.99/0.01, weightedRandom <= 0 lay
// entry -> bien bao ham: (0,.75]=hoang, (.75,.9]=huyen, (.9,.98]=dia,
// (.98,.9999]=thien, (.9999,1]=tien.
describe('PillQuality — rollPillQuality (trong so 75/15/8/1.99/0.01)', () => {
  it.each([
    [0, 'hoang'],
    [0.5, 'hoang'],
    [0.75, 'hoang'], // bien bao ham tren
    [0.750001, 'huyen'],
    [0.9, 'huyen'],
    [0.900001, 'dia'],
    [0.98, 'dia'],
    [0.980001, 'thien'],
    [0.9999, 'thien'],
    [0.99991, 'tien'],
    [0.99999, 'tien'],
    [1, 'tien'], // roi het bang -> entry cuoi
  ])('rng %f -> %s', (roll, expected) => {
    expect(rollPillQuality(RNG(roll))).toBe(expected)
  })

  it('herb steps: decade/century/millennium +0, myriad +1, thuong_co +2', () => {
    expect(PILL_HERB_AGE_GRADE_STEPS).toEqual({
      decade: 0,
      century: 0,
      millennium: 0,
      myriad_year: 1,
      thuong_co: 2,
    })
  })

  it('uplift map: hoang 1 / huyen 1.25 / dia 1.5 / thien 1.75 / tien 2', () => {
    expect(PILL_QUALITY_EFFECT_UPLIFT).toEqual({
      hoang: 1,
      huyen: 1.25,
      dia: 1.5,
      thien: 1.75,
      tien: 2,
    })
    expect(pillQualityUplift(undefined)).toBe(1)
    expect(BASE_PILL_QUALITY).toBe('hoang')
  })
})

describe('PillQuality — rollPillQualityWithHerb (dot thao day chat)', () => {
  it('decade giu nguyen roll tho', () => {
    expect(rollPillQualityWithHerb(RNG(0.9), 'decade')).toBe('huyen')
    expect(rollPillQualityWithHerb(RNG(0.9999), 'decade')).toBe('thien')
  })

  it('myriad_year +1 bac', () => {
    expect(rollPillQualityWithHerb(RNG(0), 'myriad_year')).toBe('huyen') // hoang+1
    expect(rollPillQualityWithHerb(RNG(0.98), 'myriad_year')).toBe('thien') // dia+1
    expect(rollPillQualityWithHerb(RNG(0.9999), 'myriad_year')).toBe('tien') // thien+1
  })

  it('thuong_co +2 bac, cap tien khong tran', () => {
    expect(rollPillQualityWithHerb(RNG(0), 'thuong_co')).toBe('dia') // hoang+2
    expect(rollPillQualityWithHerb(RNG(0.9), 'thuong_co')).toBe('thien') // huyen+2
    expect(rollPillQualityWithHerb(RNG(0.98), 'thuong_co')).toBe('tien') // dia+2 cap
    expect(rollPillQualityWithHerb(RNG(0.9999), 'thuong_co')).toBe('tien') // thien+2 cap o tien
  })
})

// ===================== PillBag - stack theo chat =====================
describe('PillBag — truc chat (M-PILL-GRADE)', () => {
  it('cung vien dan khac chat KHONG gop stack; hoang/dan cu gop chung', () => {
    const bag = new PillBag()

    bag.add(PILL, 3) // dan cu khong field
    bag.add(PILL, 2, 'hoang') // mint hoang -> GOP vao stack cu
    bag.add(PILL, 1, 'tien')
    bag.add(PILL, 4, 'huyen')

    const stacks = bag.getStacks('test_pill')
    expect(stacks).toHaveLength(3)
    expect(bag.getAmount('test_pill')).toBe(10)
    // Sap chat thap -> cao; stack base giu lo danh khong-field.
    expect(stacks[0]?.quality).toBeUndefined()
    expect(stacks[0]?.amount).toBe(5)
    expect(stacks[1]?.quality).toBe('huyen')
    expect(stacks[2]?.quality).toBe('tien')
  })

  it('remove khong chi dinh -> tieu chat thap truoc, giu vien manh', () => {
    const bag = new PillBag()
    bag.add(PILL, 1, 'tien')
    bag.add(PILL, 2, 'hoang')

    expect(bag.remove('test_pill', 1)).toBe(true)
    // Vien con lai o tien + hoang 1.
    expect(bag.getStacks('test_pill')[0]?.amount).toBe(1)
    expect(bag.getStacks('test_pill')[0]?.quality).toBe('hoang')

    expect(bag.remove('test_pill', 1)).toBe(true)
    expect(bag.getStacks('test_pill')).toHaveLength(1)
    expect(bag.getStacks('test_pill')[0]?.quality).toBe('tien')
  })

  it('remove theo chat chi dinh khong cham stack khac', () => {
    const bag = new PillBag()
    bag.add(PILL, 2, 'hoang')
    bag.add(PILL, 2, 'tien')

    expect(bag.remove('test_pill', 1, 'tien')).toBe(true)
    expect(bag.getStacks('test_pill').find((s) => s.quality === 'tien')?.amount).toBe(1)
    expect(bag.getStacks('test_pill').find((s) => s.quality === 'hoang')?.amount).toBe(2)

    // Chat khong ton tai -> false, khong roi vao stack khac.
    expect(bag.remove('test_pill', 1, 'dia')).toBe(false)
    // Qua so trong stack chi dinh -> false, khong tru lan.
    expect(bag.remove('test_pill', 3, 'tien')).toBe(false)
    expect(bag.getAmount('test_pill')).toBe(3)
  })

  it('removeDetailed tra sach chat da tieu, thap -> cao', () => {
    const bag = new PillBag()
    bag.add(PILL, 2, 'hoang')
    bag.add(PILL, 1, 'dia')
    bag.add(PILL, 1, 'tien')

    const spent = bag.removeDetailed('test_pill', 3)
    expect(spent).toEqual(['hoang', 'hoang', 'dia'])
    expect(bag.getAmount('test_pill')).toBe(1)

    // Khong du -> khong tru gi, sach rong.
    expect(bag.removeDetailed('test_pill', 2)).toEqual([])
    expect(bag.getAmount('test_pill')).toBe(1)
  })

  it('overflow tinh THEO stack chat (1000 hoang + 1 tien hop le)', () => {
    const bag = new PillBag()
    bag.add(PILL, MAX_STACK_AMOUNT, 'hoang')
    // Them hoang -> tran tra ve so tran.
    expect(bag.add(PILL, 1, 'hoang')).toBe(1)
    // Stack khac chat la stack rieng -> van nhan.
    expect(bag.add(PILL, 1, 'tien')).toBe(0)
    expect(bag.getAmount('test_pill')).toBe(MAX_STACK_AMOUNT + 1)
  })

  it('guards NaN/am/khong du', () => {
    const bag = new PillBag()
    expect(bag.add(PILL, Number.NaN, 'tien')).toBe(0)
    expect(bag.add(PILL, -1, 'tien')).toBe(0)
    expect(bag.remove('test_pill', 1)).toBe(false)
    expect(bag.remove('test_pill', Number.NaN)).toBe(false)
    bag.add(PILL, 1)
    expect(bag.remove('test_pill', 5)).toBe(false)
    expect(bag.getAmount('test_pill')).toBe(1)
  })
})

// ===================== Mint path - roll chat tren tung don vi =====================
const RECIPE: AlchemyRecipe = {
  id: 'recipe_grade',
  pillId: 'pill_grade',
  realmId: 'mortal',
  herbVariants: [{ materialId: 'herb_decade', age: 'decade', label: 'Thap Nien' }],
  herbAmount: 1,
  fuelWoodRealmId: 'mortal',
  fuelWoodAmount: 1,
  spiritStoneCost: 0,
  luyenDanTinhHoaAmount: 0,
  baseDurationSeconds: 60,
}

function makeJob(overrides: Partial<ActiveAlchemyJob> = {}): ActiveAlchemyJob {
  const job: ActiveAlchemyJob = {
    jobId: 'job_grade',
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
      luyenDanTinhHoaAmount: RECIPE.luyenDanTinhHoaAmount,
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

function makeSystem(
  recipe: AlchemyRecipe = RECIPE,
  job: ActiveAlchemyJob = makeJob(),
): { system: AlchemySystem; bag: PillBag } {
  const system = new AlchemySystem()
  const bag = new PillBag()
  system.setRecipeLookup((id) => (id === recipe.id ? recipe : undefined))
  system.restoreJobs([job])
  return { system, bag }
}

describe('AlchemySystem — truc chat dan tren mint path', () => {
  // Mint streams are deterministic per unit: mulberry32(rollSeedBase +
  // absolute unit index), first draw = extra-pill roll, next draw =
  // grade roll (only when the unit mints). This helper mirrors that
  // loop so tests can pick a rollSeedBase and assert the exact output.
  function simUnits(
    job: ActiveAlchemyJob,
    recipe: AlchemyRecipe,
    bonus = 0,
    yieldMult = 1,
  ): { minted: boolean[]; grades: ItemQuality[]; pills: number } {
    const total = jobSuccessPercent(job, recipe, bonus)
    const guaranteed = Math.floor(total / 100)
    const extra = total % 100
    const herbAge =
      recipe.herbVariants.find((variant) => variant.materialId === job.herbMaterialId)?.age ??
      'decade'
    const minted: boolean[] = []
    const grades: ItemQuality[] = []
    let pills = 0
    for (let i = 0; i < (job.quantity ?? 1); i += 1) {
      const rng = alchemyMulberry32((job.rollSeedBase ?? 0) + i)
      let unitPills = guaranteed
      if (rng() * 100 < extra) unitPills += 1
      unitPills = Math.floor(unitPills * Math.max(0, yieldMult))
      minted.push(unitPills > 0)
      if (unitPills > 0) grades.push(rollPillQualityWithHerb(rng, herbAge))
      pills += unitPills
    }
    return { minted, grades, pills }
  }

  function baseWhere(
    quantity: number,
    want: (sim: ReturnType<typeof simUnits>) => boolean,
    recipe: AlchemyRecipe = RECIPE,
  ): number {
    // Scan stride-aligned bases only: restoreJobs drops any record
    // whose base is not a multiple of MAX in [0, 2^32 - MAX] (writer
    // contract), so a free-form base never reaches the tick.
    for (let base = 0; base + ALCHEMY_MAX_BATCH_QUANTITY <= 2 ** 32; base += ALCHEMY_MAX_BATCH_QUANTITY) {
      const job = makeJob({ quantity, rollSeedBase: base })
      const sim = simUnits(job, recipe)
      if (want(sim)) return base
    }
    throw new Error('no rollSeedBase satisfies the wanted unit outcome')
  }

  it('moi don vi roll chat rieng: batch tron -> nhieu stack, event ghi mintedGrades', () => {
    const base = baseWhere(
      3,
      (sim) => sim.grades.length >= 2 && new Set(sim.grades).size >= 2,
    )
    const job = makeJob({ quantity: 3, completesAtMs: 1_000, rollSeedBase: base })
    const { system, bag } = makeSystem(RECIPE, job)
    const sim = simUnits(job, RECIPE)

    system.tick(999_000, bag, () => ({ id: RECIPE.pillId }), () => 0.9)

    const stacks = bag.getStacks(RECIPE.pillId)
    expect(bag.getAmount(RECIPE.pillId)).toBe(sim.pills)
    expect(stacks.map((s) => s.quality)).toEqual([...new Set(sim.grades)])

    const event = system.drainSettlementEvents()[0]!
    expect(event.mintedGrades).toEqual(sim.grades)
    expect(event.pills).toBe(sim.pills)
    expect(event.unitsProcessed).toBe(3)
  })

  it('don vi khong mint khong tieu rng chat (thu tu roll on dinh)', () => {
    const base = baseWhere(
      2,
      (sim) => sim.minted[0] === false && sim.minted[1] === true,
    )
    const job = makeJob({ quantity: 2, rollSeedBase: base })
    const { system, bag } = makeSystem(RECIPE, job)
    const sim = simUnits(job, RECIPE)

    system.tick(999_000, bag, () => ({ id: RECIPE.pillId }), () => 0.9)

    const stacks = bag.getStacks(RECIPE.pillId)
    expect(stacks).toHaveLength(1)
    expect(stacks[0]?.quality).toBe(sim.grades[0])
  })

  it('herb van_nien day +1 bac chat san pham', () => {
    const recipeMyriad: AlchemyRecipe = {
      ...RECIPE,
      herbVariants: [{ materialId: 'herb_myriad', age: 'myriad_year', label: 'Van Nien' }],
    }
    // Pick a base whose minted grade is below 'tien' so the +1 uplift
    // cannot cap at the top rank (which would mask the shift).
    const base = baseWhere(
      1,
      (sim) => sim.minted[0] === true && sim.grades[0] !== 'tien',
      recipeMyriad,
    )
    const job = makeJob({ herbMaterialId: 'herb_myriad', rollSeedBase: base })
    const { system, bag } = makeSystem(recipeMyriad, job)

    system.tick(999_000, bag, () => ({ id: RECIPE.pillId }), () => 0)

    // Van Nien mints at 100% success and lifts the rolled grade by +1:
    // the stack quality equals the raw roll shifted one step up, i.e.
    // whatever the deterministic unit stream produces for this base.
    const sim = simUnits(job, recipeMyriad)
    expect(bag.getStacks(RECIPE.pillId)[0]?.quality).toBe(sim.grades[0])
    // The raw (unshifted) roll would be one step lower - replay the
    // same unit stream (extra-pill draw consumed first) with age
    // 'decade' to read the raw grade the herb uplift shifted.
    const rawStream = alchemyMulberry32(base)
    rawStream()
    const rawRoll = rollPillQualityWithHerb(rawStream, 'decade')
    expect(
      ITEM_QUALITY_ORDER.indexOf(sim.grades[0]!) - ITEM_QUALITY_ORDER.indexOf(rawRoll),
    ).toBe(1)
  })

  it('unitPills>1 (yield x2) ghi 1 muc chat cho ca don vi', () => {
    const base = baseWhere(1, (sim) => sim.minted[0] === true)
    const job = makeJob({ quantity: 1, rollSeedBase: base })
    const { system, bag } = makeSystem(RECIPE, job)
    const sim = simUnits(job, RECIPE, 0, 2)

    system.tick(999_000, bag, () => ({ id: RECIPE.pillId }), () => 0, 0, 2)

    expect(bag.getAmount(RECIPE.pillId)).toBe(sim.pills)
    expect(bag.getStacks(RECIPE.pillId)[0]?.quality).toBe(sim.grades[0])
    expect(bag.getStacks(RECIPE.pillId)[0]?.amount).toBe(sim.pills)
    expect(system.drainSettlementEvents()[0]?.mintedGrades).toEqual(sim.grades)
  })
})

// ===================== Uplift hieu luc len effect =====================
const STAT_PILL: Pill = {
  id: 'khai_linh_test',
  name: 'Khai Linh Test',
  type: 'cultivation',
  grade: 'hoang',
  realmId: 'mortal',
  effects: [{ type: 'permanent_stat', stat: 'attunement', value: 1 }],
}

const INSIGHT_PILL: Pill = {
  id: 'cam_ngo_test',
  name: 'Cam Ngo Test',
  type: 'cultivation',
  grade: 'hoang',
  realmId: 'mortal',
  effects: [{ type: 'skill_insight', value: 10 }],
}

const CULTIVATION_PCT_PILL: Pill = {
  id: 'tu_vi_test',
  name: 'Tu Vi Test',
  type: 'cultivation',
  grade: 'hoang',
  realmId: 'mortal',
  effects: [{ type: 'cultivation', cultivationPercent: 0.1 }],
}

describe('PillSystem — uplift hieu luc theo chat (ruling 4)', () => {
  it('permanent_stat: grant = round(value * uplift), ke ca Khai Linh', () => {
    const system = new PillSystem()
    const cap = getMainStatCap('mortal')

    const mk = () => {
      const player = createDefaultPlayer()
      player.realmId = 'mortal'
      return player
    }

    // uplift 1 -> +1; huyen 1.25 -> round 1; dia 1.5 -> round 2; tien 2 -> 2.
    for (const [uplift, expected] of [
      [1, 1],
      [1.25, 1],
      [1.5, 2],
      [1.75, 2],
      [2, 2],
    ] as const) {
      const player = mk()
      const base = player.baseStats.attunement
      system.useProfessionPill(STAT_PILL, player, Math.random, 1, undefined, uplift)
      expect(player.baseStats.attunement - base).toBe(Math.min(expected, cap - base))
    }
  })

  it('canUseProfessionPill dem grant DA uplift - cap gate khop apply', () => {
    const system = new PillSystem()
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    const cap = getMainStatCap(player.realmId)
    player.baseStats.attunement = cap - 1 // thieu 1 diem toi tran

    // uplift 1 -> grant 1 -> vua tran, OK.
    expect(system.canUseProfessionPill(STAT_PILL, player, 1)).toBe('ok')
    // uplift 1.5 -> grant round(1.5)=2 -> qua tran -> 'cap'.
    expect(system.canUseProfessionPill(STAT_PILL, player, 1.5)).toBe('cap')
  })

  it('skill_insight va cultivation% nhan uplift', () => {
    const system = new PillSystem()

    const p1 = createDefaultPlayer()
    system.useProfessionPill(INSIGHT_PILL, p1, Math.random, 1, undefined, 2)
    expect(p1.skillInsight).toBe(20)

    const p2 = createDefaultPlayer()
    const required = getRequiredCultivation(p2.realmId, p2.realmLevel)
    const before = p2.cultivation
    system.useProfessionPill(CULTIVATION_PCT_PILL, p2, Math.random, 1, undefined, 2)
    expect(p2.cultivation - before).toBe(Math.floor(required * 0.1 * 2))
  })
})

// ===================== Sach chat bat mach =====================
describe('Meridian — he so chat ghi tren moc mo (ruling 4)', () => {
  it('mean uplift cua sach Thong Mach Dan nhan vao % bat mach', () => {
    const player = createDefaultPlayer()
    const meridian = MERIDIANS[0]!
    player.bodyProgression.meridian.progress[meridian.id] = 100

    // Tieu 2 hoang + 1 tien -> mean (1+1+2)/3 = 4/3.
    recordMeridianOpenQuality(player, ['hoang', 'hoang', 'tien'])

    expect(
      player.bodyProgression.meridian.openedQualityMultipliers?.[meridian.id],
    ).toBeCloseTo(4 / 3, 5)

    meridianChapter.applyModifiers(player)
    const mod = player.modifiers.find((m) => m.id === `bat-mach:${meridian.id}:${meridian.stats[0]}`)
    expect(mod?.percent).toBeCloseTo(meridian.percentAtFullTier * (4 / 3), 5)
  })

  it('save cu khong co field -> he so 1 (lo danh giu nguyen)', () => {
    const player = createDefaultPlayer()
    const meridian = MERIDIANS[0]!
    player.bodyProgression.meridian.progress[meridian.id] = 100

    meridianChapter.applyModifiers(player)
    const mod = player.modifiers.find((m) => m.id === `bat-mach:${meridian.id}:${meridian.stats[0]}`)
    expect(mod?.percent).toBe(meridian.percentAtFullTier)
  })

  it('integrity: he so ghi tren duong chua mo la loi', () => {
    const player = createDefaultPlayer()
    player.bodyProgression.meridian.openedQualityMultipliers = { chua_mo: 2 }

    const issues = meridianChapter.integrityIssues(player)
    expect(issues.some((issue) => issue.includes('openedQualityMultipliers'))).toBe(true)
  })

  it('validatePersistedState: field sai shape bi bat', () => {
    const issues: { path: string; message: string }[] = []
    meridianChapter.validatePersistedState(
      { openedIds: [], openedQualityMultipliers: { mach_1: 99 } },
      'meridian',
      (issue) => issues.push(issue),
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]!.path).toBe('meridian.openedQualityMultipliers.mach_1')

    // Shape dung -> khong loi.
    const clean: { path: string; message: string }[] = []
    meridianChapter.validatePersistedState(
      { openedIds: [], openedQualityMultipliers: { mach_1: 1.5 } },
      'meridian',
      (issue) => clean.push(issue),
    )
    expect(clean).toHaveLength(0)
  })
})

// ===================== Ops consume theo chat =====================
describe('GameManagerPillOps — usePillDetailed theo chat stack', () => {
  async function setupWithPill() {
    const { GameManager } = await import('../game/GameManager')
    const manager = new GameManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)
    manager.catalogOps.registerPills([STAT_PILL])
    return { manager, player }
  }

  const target = () => ({
    addCultivation: () => {},
    heal: () => {},
    applyBuff: () => {},
  })

  it('chat chi dinh -> uong dung stack; khong chi dinh -> uong chat thap truoc', async () => {
    const { manager, player } = await setupWithPill()
    player.realmId = 'mortal'

    manager.pillBag.add(STAT_PILL, 1, 'hoang')
    manager.pillBag.add(STAT_PILL, 1, 'tien')

    // Khong chi dinh -> hoang truoc: grant round(1*1)=1.
    const base1 = player.baseStats.attunement
    const r1 = manager.pillOps.usePillDetailed(STAT_PILL.id, target(), player)
    expect(r1.ok).toBe(true)
    expect(player.baseStats.attunement - base1).toBe(1)
    expect(manager.pillBag.getStacks(STAT_PILL.id)).toHaveLength(1)

    // Chi dinh tien -> grant round(1*2)=2.
    const base2 = player.baseStats.attunement
    const r2 = manager.pillOps.usePillDetailed(
      STAT_PILL.id,
      target(),
      player,
      Math.random,
      'tien',
    )
    expect(r2.ok).toBe(true)
    expect(player.baseStats.attunement - base2).toBe(2)
    expect(manager.pillBag.getAmount(STAT_PILL.id)).toBe(0)
  })

  it('chat khong ton tai -> not_found, khong roi vao stack khac', async () => {
    const { manager, player } = await setupWithPill()
    manager.pillBag.add(STAT_PILL, 2, 'tien')

    const result = manager.pillOps.usePillDetailed(
      STAT_PILL.id,
      target(),
      player,
      Math.random,
      'dia',
    )
    expect(result).toEqual({ ok: false, reason: 'not_found' })
    expect(manager.pillBag.getAmount(STAT_PILL.id)).toBe(2)
  })
})

// ===================== Save shape - crafted / legacy =====================
describe('Save shape — pills[].quality', () => {
  const CATALOG_PILL = 'khai_linh_dan_mortal'

  it('chat la thuoc 5 bac -> khong issue; chuoi lung -> issue; absent -> ok', () => {
    const bad = validateGameSaveShape({
      pills: [{ pillId: CATALOG_PILL, amount: 1, quality: 'sieu_pham' }],
    })
    expect(bad.issues.some((issue) => issue.path === 'pills[0].quality')).toBe(true)

    const good = validateGameSaveShape({
      pills: [{ pillId: CATALOG_PILL, amount: 1, quality: 'tien' }],
    })
    expect(good.issues.some((issue) => issue.path === 'pills[0].quality')).toBe(false)

    const legacy = validateGameSaveShape({
      pills: [{ pillId: CATALOG_PILL, amount: 1 }],
    })
    expect(legacy.issues.some((issue) => issue.path === 'pills[0].quality')).toBe(false)
  })
})
