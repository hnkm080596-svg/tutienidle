// Production module tests (plan §12 Production):
// - Địa Giới có đúng 1 Lâm/Quáng/Động Thiên + đúng 3 realm (validator).
// - Weight 60/20/10 normalize; bảng không âm/tổng 0.
// - Cycle snapshot: đột phá/nâng level giữa cycle KHÔNG đổi deadline/profile.
// - Cùng collectionRealmId + level → cùng thời lượng, bất kể phẩm/niên đại.
// - Settle idempotent: tick lặp không cấp đôi; Auto tạo cycle mới; Auto
//   tắt về idle.
// - Offline settle tuần tự trong cap, mỗi cycle seed riêng.
import { describe, expect, it } from 'vitest'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { SPIRIT_STONE_MATERIAL } from '../material/SpiritStoneMaterial'
import { materials } from '../../data/materials/materials'
import {
  TERRITORY_THANH_VAN,
  THANH_VAN_FOREST_REWARDS,
  THANH_VAN_GROTTO_HERBS,
  THANH_VAN_MINE_REWARDS,
  THANH_VAN_PRODUCTION_SITES,
  validateTerritory,
  validateWeightOrdering,
} from './ProductionCatalog'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
  getSiteSpeedMultiplier,
  getTierWeightProfile,
  rollWeightedIndex,
} from './ProductionBalance'
import { ProductionSystem } from './ProductionSystem'

function createSystem(): ProductionSystem {
  return new ProductionSystem({
    territory: TERRITORY_THANH_VAN,
    sites: THANH_VAN_PRODUCTION_SITES,
    forestRewards: THANH_VAN_FOREST_REWARDS,
    mineRewards: THANH_VAN_MINE_REWARDS,
    grottoHerbs: THANH_VAN_GROTTO_HERBS,
  })
}

function createBag(): { bag: MaterialBag; registry: MaterialRegistry } {
  const registry = new MaterialRegistry()

  for (const material of materials) {
    registry.register(material)
  }

  return { bag: new MaterialBag(), registry }
}

describe('ProductionCatalog — validator (plan §3.1)', () => {
  it('Thanh Vân hợp lệ: đúng 1 Lâm/Quáng/Động Thiên + đủ rewards 3 tier', () => {
    const result = validateTerritory(
      TERRITORY_THANH_VAN,
      THANH_VAN_PRODUCTION_SITES,
      THANH_VAN_FOREST_REWARDS,
      THANH_VAN_MINE_REWARDS,
      THANH_VAN_GROTTO_HERBS,
    )

    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('từ chối Địa Giới thiếu nguồn hoặc trùng loại', () => {
    const broken = {
      ...TERRITORY_THANH_VAN,
      realmIds: ['mortal', 'mortal', 'foundation_establishment'] as readonly [
        string,
        string,
        string,
      ],
    }

    const result = validateTerritory(
      broken,
      [THANH_VAN_PRODUCTION_SITES[0]!, THANH_VAN_PRODUCTION_SITES[0]!],
      [],
      [],
      [],
    )

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('trọng số phẩm Quáng/niên đại giảm dần tuyệt đối (§5.3/§6.2)', () => {
    expect(validateWeightOrdering()).toEqual([])
  })
})

describe('ProductionBalance', () => {
  it('baseline cycle time 100/300/900 và speed multiplier theo level', () => {
    expect(CYCLE_BASE_SECONDS_BY_REALM['mortal']).toBe(100)

    expect(computeCycleSeconds(100, 1)).toBe(100)

    expect(computeCycleSeconds(100, 5)).toBe(50)

    expect(getSiteSpeedMultiplier(3)).toBeCloseTo(1.35)
  })

  it('profile low chuẩn hoá tổng 90 → xác suất 60/90 đầu tiên', () => {
    const profile = getTierWeightProfile('mortal', TERRITORY_THANH_VAN.realmIds)

    expect(profile).toEqual([60, 20, 10])

    // Roll với random luôn trả 0.89 (dưới 80/90 nhưng trên 70/90) → tier 2.
    expect(rollWeightedIndex(profile, () => 0.89)).toBe(2)

    expect(rollWeightedIndex(profile, () => 0.0)).toBe(0)
  })
})

describe('ProductionSystem — cycle lifecycle (plan §4)', () => {
  it('snapshot deadline từ collectionRealmId + levelAtStart', () => {
    const system = createSystem()

    system.ensureSiteState('thanh_van_lam')

    expect(system.startCycle('thanh_van_lam', 'qi_refining', 1_000_000)).toBe(true)

    const state = system.getState('thanh_van_lam')!

    expect(state.activeCycle!.completesAtMs - state.activeCycle!.startedAtMs).toBe(300 * 1000)
  })

  it('nâng level giữa cycle không đổi deadline của cycle đang chạy', () => {
    const { bag, registry } = createBag()

    bag.add(registry.get('mortal_wood'), 50)

    // Plan Workstream F — Linh Thạch là MATERIAL trong bag.
    bag.add(SPIRIT_STONE_MATERIAL, 5000)

    const system = createSystem()

    system.ensureSiteState('thanh_van_lam')

    system.startCycle('thanh_van_lam', 'mortal', 0)

    const before = system.getState('thanh_van_lam')!.activeCycle!

    expect(system.upgradeSite('thanh_van_lam', bag)).toBe(true)

    expect(system.getState('thanh_van_lam')!.level).toBe(2)

    expect(system.getState('thanh_van_lam')!.activeCycle!.completesAtMs).toBe(before.completesAtMs)
  })

  it('cùng collectionRealmId + level → cùng thời lượng bất kể reward roll ra gì', () => {
    const system = createSystem()

    system.ensureSiteState('thanh_van_quang')

    for (let seedRun = 0; seedRun < 20; seedRun++) {
      system.startCycle('thanh_van_quang', 'mortal', 0)

      const cycle = system.getState('thanh_van_quang')!.activeCycle!

      cycle.rollSeed = seedRun * 7919

      const rewards = system.rollRewards(cycle)

      // Mọi kết quả (kể cả phẩm Tiên) cùng deadline đã snapshot — kiểm tra
      // qua completesAtMs không phụ thuộc seed.
      expect(cycle.completesAtMs).toBe(computeCycleSeconds(100, 1) * 1000)

      expect(rewards.length).toBeGreaterThan(0)
    }
  })

  it('settle gửi Bag đúng một lần; tick lặp không cấp đôi (idempotent)', () => {
    const { bag, registry } = createBag()

    const system = createSystem()

    system.startCycle('thanh_van_lam', 'mortal', 0)

    // Pin seed để kết quả deterministic (tier roll từ seed snapshot).
    const cycle = system.getState('thanh_van_lam')!.activeCycle!

    cycle.rollSeed = 12345

    const expected = system.rollRewards(cycle).reduce((total, reward) => total + reward.amount, 0)

    system.tick(999_999_999, bag, registry, 'mortal')

    const woodTotal = bag.getAll().reduce((total, stack) => total + stack.amount, 0)

    expect(woodTotal).toBe(expected)

    system.tick(1_000_000_000, bag, registry, 'mortal')

    expect(bag.getAll().reduce((total, stack) => total + stack.amount, 0)).toBe(woodTotal)

    expect(system.getState('thanh_van_lam')!.activeCycle).toBeUndefined()
  })

  it('Auto tắt → về idle sau settle; Auto bật → cycle mới với cảnh giới hiện tại', () => {
    const { bag, registry } = createBag()

    const system = createSystem()

    system.setAutoRestart('thanh_van_lam', false)

    system.startCycle('thanh_van_lam', 'mortal', 0)

    system.tick(999_999_999, bag, registry, 'qi_refining')

    expect(system.getState('thanh_van_lam')!.activeCycle).toBeUndefined()

    system.setAutoRestart('thanh_van_lam', true)

    system.startCycle('thanh_van_lam', 'mortal', 0)

    system.tick(1_999_999_999, bag, registry, 'qi_refining')

    const restarted = system.getState('thanh_van_lam')!.activeCycle!

    expect(restarted.collectionRealmId).toBe('qi_refining')

    expect(restarted.startedAtMs).toBeLessThanOrEqual(1_999_999_999)
  })

  it('offline settle tuần tự từng cycle, tuân cap, không nhân một roll', () => {
    const { bag, registry } = createBag()

    const system = createSystem()

    system.setAutoRestart('thanh_van_quang', true)

    const startMs = 1_000_000_000

    system.startCycle('thanh_van_quang', 'mortal', startMs)

    // Giả lập quay lại sau 1 giờ: nhiều cycle 100s settle tuần tự, mỗi
    // cycle một roll riêng (tổng quáng ≥ số cycle vì mỗi cycle ≥ 1).
    const settled = system.settleOffline(bag, registry, 'mortal', startMs + 3600 * 1000)

    expect(settled).toBeGreaterThan(10)

    const oreStacks = bag.getAll().filter((stack) => stack.material.id.includes('_ore_'))

    const oreTotal = oreStacks.reduce((total, stack) => total + stack.amount, 0)

    expect(oreTotal).toBeGreaterThanOrEqual(settled)

    // Cap: quay lại sau 100 giờ chỉ settle đúng ~360 cycle (10h / 100s),
    // phần dư bị ngân sách chặn.
    const cappedBag = new MaterialBag()

    const cappedSystem = createSystem()

    cappedSystem.setAutoRestart('thanh_van_quang', true)

    cappedSystem.startCycle('thanh_van_quang', 'mortal', startMs)

    const cappedSettled = cappedSystem.settleOffline(
      cappedBag,
      registry,
      'mortal',
      startMs + 100 * 3600 * 1000,
    )

    expect(cappedSettled).toBeLessThanOrEqual(361)
  })
})

describe('Reward rolls — phân bố (sanity thống kê)', () => {
  it('mine: phẩm hoang chiếm đa phần, tien hiếm nhất (engine enforce thứ tự)', () => {
    const system = createSystem()

    const counts = new Map<string, number>()

    for (let seed = 0; seed < 2000; seed++) {
      const cycle = {
        cycleId: `t${seed}`,
        siteId: 'thanh_van_quang',
        collectionRealmId: 'mortal',
        siteLevelAtStart: 1,
        rewardTableVersion: 1,
        rollSeed: seed * 2654435761,
        startedAtMs: 0,
        completesAtMs: 1,
      }

      for (const reward of system.rollRewards(cycle)) {
        counts.set(reward.detail ?? '', (counts.get(reward.detail ?? '') ?? 0) + 1)
      }
    }

    const hoang = counts.get('hoang') ?? 0

    const tien = counts.get('tien') ?? 0

    expect(hoang).toBeGreaterThan(tien * 5)
  })

  it('grotto: niên đại decade phổ biến hơn myriad_year', () => {
    const system = createSystem()

    const counts = new Map<string, number>()

    for (let seed = 0; seed < 2000; seed++) {
      const cycle = {
        cycleId: `t${seed}`,
        siteId: 'thanh_van_dong_thien',
        collectionRealmId: 'foundation_establishment',
        siteLevelAtStart: 1,
        rewardTableVersion: 1,
        rollSeed: seed * 40503 + 7,
        startedAtMs: 0,
        completesAtMs: 1,
      }

      for (const reward of system.rollRewards(cycle)) {
        counts.set(reward.detail ?? '', (counts.get(reward.detail ?? '') ?? 0) + 1)
      }
    }

    expect(counts.get('decade') ?? 0).toBeGreaterThan(counts.get('myriad_year') ?? 0)
  })

  it('tier profile high (Trúc Cơ thu thập) nghiêng về tier cao', () => {
    const system = createSystem()

    let highTierPicks = 0

    for (let seed = 0; seed < 1000; seed++) {
      const cycle = {
        cycleId: `t${seed}`,
        siteId: 'thanh_van_lam',
        collectionRealmId: 'foundation_establishment',
        siteLevelAtStart: 1,
        rewardTableVersion: 1,
        rollSeed: seed * 48271,
        startedAtMs: 0,
        completesAtMs: 1,
      }

      for (const reward of system.rollRewards(cycle)) {
        if (reward.materialId === 'foundation_establishment_wood') {
          highTierPicks += 1
        }
      }
    }

    // Profile high 20/40/40 → tier cao ~40%+.
    expect(highTierPicks).toBeGreaterThan(250)
  })
})
