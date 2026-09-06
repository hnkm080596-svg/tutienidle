// ProductionBalance.simulation.test.ts (gp123 6F, task D1) — simulation
// 24h × 1 worker × 3 chuỗi kinh tế với seed cố định, khoá bất đẳng thức
// theo từng chuỗi (mỗi chuỗi bất đẳng thức riêng, nêu chi tiết bên dưới) bằng số liệu thực
// của engine (ProductionSystem/AlchemySystem/DecomposeSystem) — không
// dùng mô hình rút gọn:
//
// - Chuỗi Thảo (Động Thiên → Đan Phòng): đan sản xuất ≤ thảo tiêu thụ.
// - Chuỗi Gỗ (Lâm → nhiên liệu Đan Phòng): gỗ theo tuổi ≥ nhiên liệu
//   các job đan cần (rule resolveFuelWood: đúng realm + đúng tuổi).
// - Chuỗi Khoáng (Quáng → Phân Giải): khoáng sản xuất ≥ khoáng phân
//   giải tiêu thụ.
//
// Determinism: Math.random bị pin qua mulberry32(seed) — đường duy nhất
// dùng RNG ngoài seed snapshot là buildCycle (rollSeed) và roll extra
// pill của AlchemySystem.tick. Kết quả lặp lại y hệt mỗi run.
//
// Nếu bất đẳng thức VIOLATE: KHÔNG tune ProductionBalance tại đây —
// số liệu violation được in ra để user quyết (balance tuning là quyết
// định design, plan 6F).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { SPIRIT_STONE_MATERIAL } from '../material/SpiritStoneMaterial'
import { materials } from '../../data/materials/materials'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { PillBag } from '../pill/PillBag'
import {
  AlchemySystem,
  resolveFuelWood,
} from '../alchemy/AlchemySystem'
import { DecomposeSystem } from './DecomposeSystem'
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { ProductionSystem } from './ProductionSystem'
import {
  TERRITORY_THANH_VAN,
  THANH_VAN_FOREST_REWARDS,
  THANH_VAN_GROTTO_HERBS,
  THANH_VAN_MINE_REWARDS,
  THANH_VAN_PRODUCTION_SITES,
} from './ProductionCatalog'
import type { HerbAge } from './ProductionTypes'
import { HERB_AGES } from './ProductionTypes'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  GROTTO_HERB_AMOUNT,
  HERB_AGE_WEIGHTS,
  MATERIAL_AGE_AMOUNTS,
  MATERIAL_AGE_WEIGHTS,
  PRODUCTION_RATE_TABLE,
  computeCycleSeconds,
  mulberry32,
} from './ProductionBalance'

// =========================
// Tham số simulation — 24h game time, bước 1s, 1 worker mỗi chuỗi.
// =========================

const SIM_SECONDS = 86_400
const STEP_MS = 1_000
const SIM_END_MS = SIM_SECONDS * STEP_MS
const SIM_SEED = 20260906

const FOREST_SITE_ID = TERRITORY_THANH_VAN.productionSiteIds.forest
const MINE_SITE_ID = TERRITORY_THANH_VAN.productionSiteIds.mine
const GROTTO_SITE_ID = TERRITORY_THANH_VAN.productionSiteIds.grotto

/** Đan phương mô hình hoá: 1 trong 8 đan phẩm Phàm Nhân (chain Thảo/Gỗ). */
const HERB_RECIPE = alchemyRecipes.find((recipe) => recipe.id === 'alchemy_tu_linh_dan_mortal')!

/** Đan Phòng nhận thảo ĐỦ trục HerbAge 5 bậc (recipes sinh từ HERB_AGES). */
const CRAFTABLE_AGES: readonly HerbAge[] = HERB_AGES

/** Level Đan Phòng 1 — bonus 0, success % đúng bằng bảng base theo tuổi. */
const ALCHEMY_ROOM_LEVEL = 1

function createRegistry(): MaterialRegistry {
  const registry = new MaterialRegistry()

  for (const material of materials) {
    registry.register(material)
  }

  // SPIRIT_STONE_MATERIAL đã nằm trong catalog materials — chỉ đăng ký
  // khi thiếu (catalog đổi tay không còn Linh Thạch vẫn chạy được).
  if (!registry.has(SPIRIT_STONE_MATERIAL.id)) {
    registry.register(SPIRIT_STONE_MATERIAL)
  }

  return registry
}

function createCatalogSystem(): ProductionSystem {
  return new ProductionSystem({
    territory: TERRITORY_THANH_VAN,
    sites: THANH_VAN_PRODUCTION_SITES,
    forestRewards: THANH_VAN_FOREST_REWARDS,
    mineRewards: THANH_VAN_MINE_REWARDS,
    grottoHerbs: THANH_VAN_GROTTO_HERBS,
  })
}

function zeroByAge(): Record<HerbAge, number> {
  return { decade: 0, century: 0, millennium: 0, myriad_year: 0, thuong_co: 0 }
}

function fmtAgeTable(lines: Record<string, Record<HerbAge, number>>): string {
  const ages = HERB_AGES.join('\t')

  const rows = Object.entries(lines)
    .map(([label, byAge]) => `${label}\t${HERB_AGES.map((age) => byAge[age]).join('\t')}`)

  return [`(tuổi)\t${ages}`, ...rows].join('\n')
}

function accumulateEvents(
  produced: Map<string, number>,
  overflow: Map<string, number>,
  events: ReturnType<ProductionSystem['drainSettlementEvents']>,
): void {
  for (const event of events) {
    produced.set(event.materialId, (produced.get(event.materialId) ?? 0) + event.amount)

    if (event.overflow) {
      overflow.set(event.materialId, (overflow.get(event.materialId) ?? 0) + event.overflow)
    }
  }
}

const WOOD_ID_PATTERN = /^(.+)_wood_(decade|century|millennium|myriad_year|thuong_co)$/
const ORE_ID_PATTERN = /^(.+)_ore_(decade|century|millennium|myriad_year|thuong_co)$/

/** Gỗ theo tuổi từ kết quả Lâm — key `${realmId}_wood_${age}`. */
function woodByRealmAge(produced: Map<string, number>): Map<string, Record<HerbAge, number>> {
  const table = new Map<string, Record<HerbAge, number>>()

  for (const [materialId, amount] of produced) {
    const match = WOOD_ID_PATTERN.exec(materialId)

    if (!match) {
      continue
    }

    const realmId = match[1]!
    const age = match[2] as HerbAge

    const row = table.get(realmId) ?? zeroByAge()

    row[age] += amount

    table.set(realmId, row)
  }

  return table
}

// =========================
// Chuỗi Thảo (Động Thiên → Đan Phòng) — dùng chung cho test thảo và gỗ
// (chain Gỗ cần phân bố tuổi của job đan để tính nhu cầu nhiên liệu).
// =========================

interface HerbChainResult {
  pillsProduced: number

  jobsStarted: number

  jobsByAge: Record<HerbAge, number>

  herbsConsumed: number

  herbsProduced: Map<string, number>
}

function runHerbChain(): HerbChainResult {
  const random = mulberry32(SIM_SEED)
  const spy = vi.spyOn(Math, 'random').mockImplementation(random)

  try {
    const system = createCatalogSystem()

    system.setAutoRestart(GROTTO_SITE_ID, true)

    const registry = createRegistry()
    const bag = new MaterialBag()

    // Seed nhiên liệu ĐỦ cho mọi tuổi — thiếu hụt gỗ là bài của chain Gỗ,
    // không được chặn chain Thảo (tách biến).
    for (const age of HERB_AGES) {
      bag.add(registry.get(`mortal_wood_${age}`), 1_000_000)
    }

    const pillBag = new PillBag()
    const alchemy = new AlchemySystem()

    alchemy.setRecipeLookup((recipeId) => alchemyRecipes.find((recipe) => recipe.id === recipeId))

    const jobsByAge = zeroByAge()
    let jobsStarted = 0

    const herbsProduced = new Map<string, number>()

    for (let nowMs = 0; nowMs <= SIM_END_MS; nowMs += STEP_MS) {
      // 1 worker Động Thiên — pool capacity 1, không assignment (round-robin).
      system.tickWorkers(nowMs, bag, registry, 'mortal', 1)

      accumulateEvents(herbsProduced, new Map(), system.drainSettlementEvents())

      // Đan Phòng 1 job slot — luôn chọn biến thể tuổi đầu tiên còn đủ thảo.
      if (!alchemy.hasActiveJob()) {
        const variant = HERB_RECIPE.herbVariants.find(
          (candidate) => bag.getAmount(candidate.materialId) >= HERB_RECIPE.herbAmount,
        )

        if (
          variant &&
          resolveFuelWood(bag, HERB_RECIPE.fuelWoodRealmId, HERB_RECIPE.fuelWoodAmount, variant.age)
        ) {
          const result = alchemy.startJob(
            HERB_RECIPE,
            variant.materialId,
            bag,
            registry,
            Number.MAX_SAFE_INTEGER,
            ALCHEMY_ROOM_LEVEL,
            nowMs,
            1,
          )

          if (result.ok) {
            jobsStarted += 1
            jobsByAge[variant.age] += 1
          }
        }
      }

      // Settle job theo lịch — roll extra pill dùng cùng stream seeded.
      alchemy.tick(nowMs, pillBag, (pillId) => ({ id: pillId }), random, 0)
    }

    return {
      pillsProduced: pillBag.getAmount(HERB_RECIPE.pillId),
      jobsStarted,
      jobsByAge,
      herbsConsumed: jobsStarted * HERB_RECIPE.herbAmount,
      herbsProduced,
    }
  } finally {
    spy.mockRestore()
  }
}

// =========================
// Chain Gỗ — Lâm 24h, đối chiếu từng tuổi với nhu cầu nhiên liệu chain Thảo.
// =========================

interface WoodChainResult {
  woodProduced: Map<string, Record<HerbAge, number>>

  overflowTotal: number
}

function runWoodChain(): WoodChainResult {
  const random = mulberry32(SIM_SEED)
  const spy = vi.spyOn(Math, 'random').mockImplementation(random)

  try {
    const system = createCatalogSystem()

    system.setAutoRestart(FOREST_SITE_ID, true)

    const registry = createRegistry()
    const bag = new MaterialBag()

    const produced = new Map<string, number>()
    const overflow = new Map<string, number>()

    for (let nowMs = 0; nowMs <= SIM_END_MS; nowMs += STEP_MS) {
      system.tickWorkers(nowMs, bag, registry, 'mortal', 1)

      accumulateEvents(produced, overflow, system.drainSettlementEvents())
    }

    const overflowTotal = [...overflow.values()].reduce((total, amount) => total + amount, 0)

    return { woodProduced: woodByRealmAge(produced), overflowTotal }
  } finally {
    spy.mockRestore()
  }
}

// =========================
// Chain Khoáng — Quáng + Phân Giải chạy CÙNG bag trong cùng cửa sổ 24h.
// =========================

interface OreChainResult {
  oreProduced: number

  oreOverflow: number

  oreRemaining: number

  oreConsumed: number

  tinhHoaProduced: number
}

function runOreChain(): OreChainResult {
  const random = mulberry32(SIM_SEED)
  const spy = vi.spyOn(Math, 'random').mockImplementation(random)

  try {
    const system = createCatalogSystem()

    system.setAutoRestart(MINE_SITE_ID, true)

    const registry = createRegistry()
    const bag = new MaterialBag()

    const decompose = new DecomposeSystem(bag, { autoWorkerCapacity: 1 })

    decompose.setSetting({ gradeFilter: 'all', ageFilter: 'all', workers: 1 })

    const produced = new Map<string, number>()
    const overflow = new Map<string, number>()

    let tinhHoaProduced = 0

    for (let nowMs = 0; nowMs <= SIM_END_MS; nowMs += STEP_MS) {
      system.tickWorkers(nowMs, bag, registry, 'mortal', 1)

      accumulateEvents(produced, overflow, system.drainSettlementEvents())

      decompose.tick(nowMs)

      for (const entry of decompose.drainOutput()) {
        if (entry.materialId === LUYEN_KHI_TINH_HOA_ID) {
          tinhHoaProduced += entry.amount
        }
      }
    }

    let oreProduced = 0
    let oreOverflow = 0
    let oreRemaining = 0

    for (const [materialId, amount] of produced) {
      if (!ORE_ID_PATTERN.test(materialId)) {
        continue
      }

      oreProduced += amount

      oreOverflow += overflow.get(materialId) ?? 0

      oreRemaining += bag.getAmount(materialId)
    }

    // Khoáng tiêu thụ = sản xuất - tràn stack - tồn cuối (không đường rò khác).
    const oreConsumed = oreProduced - oreOverflow - oreRemaining

    return { oreProduced, oreOverflow, oreRemaining, oreConsumed, tinhHoaProduced }
  } finally {
    spy.mockRestore()
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PRODUCTION_RATE_TABLE (gp123 6F — bảng tổng hợp, pure derivation)', () => {
  it('đủ realm × 3 site-kind; cycleSeconds suy đúng từ bảng gốc', () => {
    const realmCount = Object.keys(CYCLE_BASE_SECONDS_BY_REALM).length

    expect(PRODUCTION_RATE_TABLE).toHaveLength(realmCount * 3)

    for (const row of PRODUCTION_RATE_TABLE) {
      const baseSeconds = CYCLE_BASE_SECONDS_BY_REALM[row.collectionRealmId]

      expect(baseSeconds).toBeDefined()

      expect(row.cycleSeconds).toBe(computeCycleSeconds(baseSeconds!, 1))

      if (row.kind === 'grotto') {
        expect(row.ageRollWeights).toEqual(HERB_AGE_WEIGHTS)

        expect(row.yieldAmountByAge.decade).toBe(GROTTO_HERB_AMOUNT)
      } else {
        expect(row.ageRollWeights).toEqual(MATERIAL_AGE_WEIGHTS)

        expect(row.yieldAmountByAge).toEqual(MATERIAL_AGE_AMOUNTS)
      }
    }
  })

  it('pattern yield id khớp quy ước material (`<realm>_wood_<age>` / `<realm>_ore_<age>`)', () => {
    const forestMortal = PRODUCTION_RATE_TABLE.find(
      (row) => row.kind === 'forest' && row.collectionRealmId === 'mortal',
    )

    const mineMortal = PRODUCTION_RATE_TABLE.find(
      (row) => row.kind === 'mine' && row.collectionRealmId === 'mortal',
    )

    expect(forestMortal?.yieldMaterialIdPattern).toBe('mortal_wood_<age>')

    expect(mineMortal?.yieldMaterialIdPattern).toBe('mortal_ore_<age>')
  })
})

describe('Simulation 24h × 1 worker — cân bằng từng chuỗi (gp123 6F)', () => {
  it('chuỗi Thảo: đan sản xuất ≤ thảo tiêu thụ (Động Thiên → Đan Phòng)', () => {
    const chain = runHerbChain()

    const herbsProducedTotal = [...chain.herbsProduced.values()].reduce((total, amount) => total + amount, 0)

    console.log(
      `[6F Thảo] recipe=${HERB_RECIPE.id} jobs=${chain.jobsStarted} ` +
      `thảo SX=${herbsProducedTotal} thảo TT=${chain.herbsConsumed} đan=${chain.pillsProduced}\n` +
      `job theo tuổi:\n${fmtAgeTable({ jobs: chain.jobsByAge })}`,
    )

    expect(chain.jobsStarted).toBeGreaterThan(0)

    expect(chain.pillsProduced).toBeLessThanOrEqual(chain.herbsConsumed)
  })

  it('chuỗi Gỗ: gỗ sản xuất theo tuổi ≥ nhiên liệu job đan cần (cùng phân bố tuổi)', () => {
    const herbChain = runHerbChain()
    const woodChain = runWoodChain()

    // Nhiên liệu cần theo tuổi — rule resolveFuelWood: đúng `<realm>_wood_<age>`,
    // realm của đan phương mortal → chỉ gỗ mortal của ĐÚNG tuổi dùng được.
    const fuelNeeded = zeroByAge()

    for (const age of CRAFTABLE_AGES) {
      fuelNeeded[age] = herbChain.jobsByAge[age] * HERB_RECIPE.fuelWoodAmount
    }

    const woodMortal = woodChain.woodProduced.get('mortal') ?? zeroByAge()

    console.log(
      `[6F Gỗ] mortal_wood SX theo tuổi vs nhiên liệu cần:\n` +
      fmtAgeTable({ 'SX mortal': woodMortal, 'cần mortal': fuelNeeded }) +
      `\nSX mọi realm:\n${fmtAgeTable(Object.fromEntries([...woodChain.woodProduced]))}` +
      `\noverflow=${woodChain.overflowTotal}`,
    )

    for (const age of CRAFTABLE_AGES) {
      expect(woodMortal[age]).toBeGreaterThanOrEqual(fuelNeeded[age])
    }
  })

  it('chuỗi Khoáng: khoáng sản xuất ≥ khoáng Phân Giải tiêu thụ', () => {
    const chain = runOreChain()

    console.log(
      `[6F Khoáng] SX=${chain.oreProduced} tràn=${chain.oreOverflow} ` +
      `tồn=${chain.oreRemaining} TT=${chain.oreConsumed} tinh_hoa=${chain.tinhHoaProduced}`,
    )

    // Bất đẳng thức SX ≥ TT trên là hằng đẳng thức bảo toàn (tràn + tồn ≥ 0
    // luôn đúng) — khoá FALSIFIABLE nằm ở tồn cuối: Phân Giải phải theo kịp
    // Quáng, không để khoáng tồn đọng cuối 24h.
    expect(chain.oreRemaining).toBe(0)

    expect(chain.oreProduced).toBeGreaterThanOrEqual(chain.oreConsumed)
  })
})
