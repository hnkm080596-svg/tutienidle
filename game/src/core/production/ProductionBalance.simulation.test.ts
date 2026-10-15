// ProductionBalance.simulation.test.ts (gp123 6F, task D1) - simulation
// 24h x independent production sites with a fixed seed; pin inequalities
// theo tung chuoi (moi chuoi bat dang thuc rieng, neu chi tiet ben duoi) bang so lieu thuc
// cua engine (ProductionSystem/AlchemySystem/DecomposeSystem) - khong
// dung mo hinh rut gon:
//
// - Chuoi Thao (Dong Thien -> Dan Phong): dan san xuat <= thao tieu thu.
// - Wood chain: forest -> explicit decomposition -> furnace fuel >= demand.
//   Compare canonical dust output with the alchemy job fuel demand.
// - Chuoi Khoang (Quang -> Phan Giai): khoang san xuat >= khoang phan
//   giai tieu thu.
//
// Determinism: Math.random bi pin qua mulberry32(seed) - duong duy nhat
// dung RNG ngoai seed snapshot la buildCycle (rollSeed) va roll extra
// pill cua AlchemySystem.tick. Ket qua lap lai y het moi run.
//
// Neu bat dang thuc VIOLATE: KHONG tune ProductionBalance tai day -
// so lieu violation duoc in ra de user quyet (balance tuning la quyet
// dinh design, plan 6F).
import { afterEach, describe, expect, it, vi } from 'vitest'

// BETA SCOPE LOCK v2 Phase-5 - this suite exercises the scope-hidden
// system's ENABLED implementation (sec.11-15: dormant, not deleted),
// so the scope authority reports in-scope for this file.
vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
  isBetaQuestEnabled: () => true,
  betaRecipeFamilyOfId: () => 'tu_linh_dan',
}))

import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { SPIRIT_STONE_MATERIAL } from '../material/SpiritStoneMaterial'
import { materials } from '../../data/materials/materials'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { PillBag } from '../pill/PillBag'
import {
  AlchemySystem,
} from '../alchemy/AlchemySystem'
import { DecomposeSystem } from './DecomposeSystem'
import { BUI_GO_ID, LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
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
  RESOURCE_CYCLE_BASE_SECONDS,
  GROTTO_HERB_AMOUNT,
  HERB_AGE_WEIGHTS,
  MATERIAL_AGE_AMOUNTS,
  MATERIAL_AGE_WEIGHTS,
  PRODUCTION_RATE_TABLE,
  computeCycleSeconds,
  mulberry32,
} from './ProductionBalance'

// =========================
// Simulation - 24h game time, 1s steps, one independently enabled site per chain.
// =========================

const SIM_SECONDS = 86_400
const STEP_MS = 1_000
const SIM_END_MS = SIM_SECONDS * STEP_MS
const SIM_SEED = 20260906

const FOREST_SITE_ID = TERRITORY_THANH_VAN.productionSiteIds.forest
const MINE_SITE_ID = TERRITORY_THANH_VAN.productionSiteIds.mine
const GROTTO_SITE_ID = TERRITORY_THANH_VAN.productionSiteIds.grotto

/** Dan phuong mo hinh hoa: 1 trong 8 dan pham Pham Nhan (chain Thao/Go). */
const HERB_RECIPE = alchemyRecipes.find((recipe) => recipe.id === 'alchemy_tu_linh_dan_mortal')!

/** Level Dan Phong 1 - bonus 0, success % dung bang bang base theo tuoi. */
const ALCHEMY_ROOM_LEVEL = 1

function createRegistry(): MaterialRegistry {
  const registry = new MaterialRegistry()

  for (const material of materials) {
    registry.register(material)
  }

  // SPIRIT_STONE_MATERIAL da nam trong catalog materials - chi dang ky
  // khi thieu (catalog doi tay khong con Linh Thach van chay duoc).
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

const WOOD_ID_PATTERN = /^material_spirit_wood_(decade|century|millennium|myriad_year|thuong_co)$/
const ORE_ID_PATTERN = /^material_spirit_ore_(decade|century|millennium|myriad_year|thuong_co)$/

// =========================
// Chuoi Thao (Dong Thien -> Dan Phong) - dung chung cho test thao va go
// (chain Go can phan bo tuoi cua job dan de tinh nhu cau nhien lieu).
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

    // Materials economy rework - seed Bui Go + Luyen Dan Tinh Hoa DU;
    // thieu hut go->bui_go la bai cua chain Go (tach bien).
    bag.add(registry.get('bui_go'), 1_000_000_000)
    bag.add(registry.get('luyen_dan_tinh_hoa'), 1_000_000_000)

    const pillBag = new PillBag()
    const alchemy = new AlchemySystem()

    alchemy.setRecipeLookup((recipeId) => alchemyRecipes.find((recipe) => recipe.id === recipeId))

    const jobsByAge = zeroByAge()
    let jobsStarted = 0

    const herbsProduced = new Map<string, number>()

    for (let nowMs = 0; nowMs <= SIM_END_MS; nowMs += STEP_MS) {
      // The enabled grotto runs independently without workforce allocation.
      system.tick(nowMs, bag, registry, 'mortal')

      accumulateEvents(herbsProduced, new Map(), system.drainSettlementEvents())

      // Dan Phong 1 job slot - luon chon bien the tuoi dau tien con du thao.
      if (!alchemy.hasActiveJob()) {
        const variant = HERB_RECIPE.herbVariants.find(
          (candidate) => bag.getAmount(candidate.materialId) >= HERB_RECIPE.herbAmount,
        )

        if (
          variant &&
          bag.getAmount('bui_go') >= HERB_RECIPE.fuelWoodAmount &&
          bag.getAmount('luyen_dan_tinh_hoa') >= HERB_RECIPE.luyenDanTinhHoaAmount
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

      // Settle job theo lich - roll extra pill dung cung stream seeded.
      alchemy.tick(nowMs, pillBag, (pillId) => ({ id: pillId }), random)
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
// Wood chain - independent forest site for 24h, then explicit fuel exchange.
// =========================

interface WoodChainResult {
  woodProduced: number

  fuelProduced: number

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
      system.tick(nowMs, bag, registry, 'mortal')

      accumulateEvents(produced, overflow, system.drainSettlementEvents())
    }

    const overflowTotal = [...overflow.values()].reduce((total, amount) => total + amount, 0)

    const woodIds = [...produced.keys()].filter(id => WOOD_ID_PATTERN.test(id))
    const decompose = new DecomposeSystem(bag)
    expect(woodIds.length).toBeGreaterThan(0)
    expect([...produced.keys()]).toEqual(woodIds)
    expect(decompose.decomposeWithResult(woodIds)).toEqual({ ok: true })
    const woodProduced = woodIds.reduce((total, id) => total + (produced.get(id) ?? 0), 0)
    return { woodProduced, fuelProduced: bag.getAmount(BUI_GO_ID), overflowTotal }
  } finally {
    spy.mockRestore()
  }
}

// =========================
// Chain Khoang - Quang + Phan Giai chay CUNG bag trong cung cua so 24h.
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

    let tinhHoaProduced = 0
    const decompose = new DecomposeSystem(bag, {
      onEssenceProduced: (materialId, amount) => {
        if (materialId === LUYEN_KHI_TINH_HOA_ID) tinhHoaProduced += amount
      },
    })

    const produced = new Map<string, number>()
    const overflow = new Map<string, number>()

    for (let nowMs = 0; nowMs <= SIM_END_MS; nowMs += STEP_MS) {
      system.tick(nowMs, bag, registry, 'mortal')

      accumulateEvents(produced, overflow, system.drainSettlementEvents())

    }

    // Decompose is now an explicit player command. The balance simulation
    // applies one batch conversion after the production window, rather than
    // advancing a retired background worker on every simulated second.
    for (const ore of decompose.getAvailableOres()) {
      decompose.decomposeOre(ore.materialId, ore.amount)
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

    // Khoang tieu thu = san xuat - tran stack - ton cuoi (khong duong ro khac).
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

    expect(RESOURCE_CYCLE_BASE_SECONDS).toBe(100)
    expect(PRODUCTION_RATE_TABLE).toHaveLength(realmCount * 3)

    for (const row of PRODUCTION_RATE_TABLE) {
      const baseSeconds = row.kind === 'grotto'
        ? CYCLE_BASE_SECONDS_BY_REALM[row.collectionRealmId] : RESOURCE_CYCLE_BASE_SECONDS

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

  it('resource yield IDs are age-only across every collection realm', () => {
    const forestMortal = PRODUCTION_RATE_TABLE.find(
      (row) => row.kind === 'forest' && row.collectionRealmId === 'mortal',
    )

    const mineMortal = PRODUCTION_RATE_TABLE.find(
      (row) => row.kind === 'mine' && row.collectionRealmId === 'mortal',
    )

    expect(forestMortal?.yieldMaterialIdPattern).toBe('material_spirit_wood_<age>')

    expect(mineMortal?.yieldMaterialIdPattern).toBe('material_spirit_ore_<age>')
    for (const row of PRODUCTION_RATE_TABLE.filter(row => row.kind !== 'grotto')) {
      expect(row.yieldMaterialIdPattern).toBe(`material_spirit_${row.kind === 'forest' ? 'wood' : 'ore'}_<age>`)
    }
  })
})

describe('Simulation 24h with independent sites — cân bằng từng chuỗi (gp123 6F)', () => {
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

  it('wood decomposes into enough canonical furnace fuel for the herb-chain jobs', () => {
    const herbChain = runHerbChain()
    const woodChain = runWoodChain()
    const fuelNeeded = herbChain.jobsStarted * HERB_RECIPE.fuelWoodAmount
    expect(fuelNeeded).toBeGreaterThan(0)
    expect(woodChain.woodProduced).toBeGreaterThan(0)
    expect(woodChain.fuelProduced).toBeGreaterThanOrEqual(fuelNeeded)
  })

  it('chuỗi Khoáng: khoáng sản xuất ≥ khoáng Phân Giải tiêu thụ', () => {
    const chain = runOreChain()

    console.log(
      `[6F Khoáng] SX=${chain.oreProduced} tràn=${chain.oreOverflow} ` +
      `tồn=${chain.oreRemaining} TT=${chain.oreConsumed} tinh_hoa=${chain.tinhHoaProduced}`,
    )

    // Bat dang thuc SX >= TT tren la hang dang thuc bao toan (tran + ton >= 0
    // luon dung) - khoa FALSIFIABLE nam o ton cuoi: Phan Giai (nguoi choi
    // spam decompose) phai theo kip Quang, khong de khoang ton dong cuoi 24h.
    expect(chain.oreRemaining).toBe(0)

    // Direct decompose van mint tinh hoa qua deliverOutput.
    expect(chain.tinhHoaProduced).toBeGreaterThan(0)

    expect(chain.oreProduced).toBeGreaterThanOrEqual(chain.oreConsumed)
  })
})
