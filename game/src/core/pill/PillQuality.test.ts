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
import type { ItemQuality } from '../item/ItemQuality'
import {
  AlchemySystem,
  alchemyJobReservationDigest,
  type ActiveAlchemyJob,
  type AlchemyRecipe,
} from '../alchemy/AlchemySystem'
import { buildProfessionMaterialId } from '../profession/ProfessionMaterial'
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
  baseDurationSeconds: 60,
}

function makeJob(
  overrides: Partial<ActiveAlchemyJob> = {},
  herbAge: 'decade' | 'myriad_year' = 'decade',
): ActiveAlchemyJob {
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
      woodId: buildProfessionMaterialId('wood', RECIPE.fuelWoodRealmId, herbAge),
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
  it('moi don vi roll chat rieng: batch tron -> nhieu stack, event ghi mintedGrades', () => {
    const recipe3: AlchemyRecipe = { ...RECIPE }
    const job = makeJob({ quantity: 3, completesAtMs: 1_000 })
    const { system, bag } = makeSystem(recipe3, job)

    // total 50%: moi vien roll A success roi B chat (chi khi mint).
    // u1: A 0 trung + B 0 -> hoang; u2: A 0 trung + B 0.9 -> huyen;
    // u3: A 0.6 truot -> khong tieu roll B.
    const rolls = [0, 0, 0, 0.9, 0.6]
    let index = 0
    system.tick(999_000, bag, () => ({ id: RECIPE.pillId }), () => rolls[index++] ?? 0.9)

    const stacks = bag.getStacks(RECIPE.pillId)
    expect(bag.getAmount(RECIPE.pillId)).toBe(2)
    expect(stacks.map((s) => s.quality)).toEqual(['hoang', 'huyen'])

    const event = system.drainSettlementEvents()[0]!
    expect(event.mintedGrades).toEqual(['hoang', 'huyen'])
    expect(event.pills).toBe(2)
    expect(event.unitsProcessed).toBe(3)
  })

  it('don vi khong mint khong tieu rng chat (thu tu roll on dinh)', () => {
    const { system, bag } = makeSystem(RECIPE, makeJob({ quantity: 2 }))

    // u1 truot (0.6>=0.5) -> khong roll chat; u2 trung + chat = rolls[1].
    const rolls = [0.6, 0, 0.98]
    let index = 0
    system.tick(999_000, bag, () => ({ id: RECIPE.pillId }), () => rolls[index++] ?? 0.9)

    const stacks = bag.getStacks(RECIPE.pillId)
    expect(stacks).toHaveLength(1)
    expect(stacks[0]?.quality).toBe('dia')
  })

  it('herb van_nien day +1 bac chat san pham', () => {
    const recipeMyriad: AlchemyRecipe = {
      ...RECIPE,
      herbVariants: [{ materialId: 'herb_myriad', age: 'myriad_year', label: 'Van Nien' }],
    }
    const job = makeJob({ herbMaterialId: 'herb_myriad' }, 'myriad_year')
    const { system, bag } = makeSystem(recipeMyriad, job)

    // roll tho hoang -> +1 -> huyen.
    const rolls = [0, 0]
    let index = 0
    system.tick(999_000, bag, () => ({ id: RECIPE.pillId }), () => rolls[index++] ?? 0)

    expect(bag.getStacks(RECIPE.pillId)[0]?.quality).toBe('huyen')
  })

  it('unitPills>1 (yield x2) ghi 1 muc chat cho ca don vi', () => {
    const { system, bag } = makeSystem(RECIPE, makeJob({ quantity: 1 }))

    const rolls = [0, 0.98] // A trung extra, B dia
    let index = 0
    system.tick(999_000, bag, () => ({ id: RECIPE.pillId }), () => rolls[index++] ?? 0, 0, 2)

    expect(bag.getAmount(RECIPE.pillId)).toBe(2)
    expect(bag.getStacks(RECIPE.pillId)[0]?.quality).toBe('dia')
    expect(bag.getStacks(RECIPE.pillId)[0]?.amount).toBe(2)
    expect(system.drainSettlementEvents()[0]?.mintedGrades).toEqual(['dia'])
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
    player.bodyProgression.meridian.openedIds.push(meridian.id)

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
    player.bodyProgression.meridian.openedIds.push(meridian.id)

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
