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
  PRODUCTION_OFFLINE_CAP_SECONDS,
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

describe('ProductionSystem — workers-as-fuel (Mission D / spec D3)', () => {
  it('state has no activeCycle field at all — the manual lane does not exist', () => {
    const system = createSystem()
    const state = system.ensureSiteState('thanh_van_lam')
    expect('activeCycle' in state).toBe(false)
  })

  it('capacity 0 produces NOTHING online even with autoRestart on — workers are required fuel', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_lam', true)

    system.tickWorkers(60_000, bag, registry, 'mortal', 0)

    expect(system.getState('thanh_van_lam')!.workerCycles ?? []).toHaveLength(0)
    expect(bag.getAll()).toHaveLength(0)
  })

  it('capacity 0 produces NOTHING offline — no manual fallback phase', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.restoreStates([
      { siteId: 'thanh_van_lam', level: 1, autoRestart: true, activeWorkerSlots: 0, workerCycles: [] },
    ])

    const settled = system.settleOffline(bag, registry, 'mortal', 10_000_000, {
      workerCapacity: 0,
      offlineSinceMs: 0,
    })

    expect(settled).toBe(0)
    expect(bag.getAll()).toHaveLength(0)
  })

  it('lane count equals activeWorkerSlots exactly — 1 worker -> 1 lane, no implicit extra lane', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_lam', true)

    system.tickWorkers(1_000, bag, registry, 'mortal', 1)

    const state = system.getState('thanh_van_lam')!
    expect(state.activeWorkerSlots).toBe(1)
    expect(state.workerCycles).toHaveLength(1)
  })

  it('snapshot deadline from collectionRealmId + levelAtStart (worker lane)', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_lam', true)

    system.tickWorkers(1_000_000, bag, registry, 'qi_refining', 1)

    const cycle = system.getState('thanh_van_lam')!.workerCycles![0]!
    expect(cycle.collectionRealmId).toBe('qi_refining')
    expect(cycle.completesAtMs - cycle.startedAtMs).toBe(300 * 1000)
  })

  it('a due worker lane grants ONCE; the next tick refills the freed lane (idempotent, no double pay)', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_lam', true)

    system.tickWorkers(0, bag, registry, 'mortal', 1)
    const cycle = system.getState('thanh_van_lam')!.workerCycles![0]!
    cycle.rollSeed = 12345
    const expected = system.rollRewards(cycle).reduce((total, reward) => total + reward.amount, 0)

    system.tickWorkers(100_000, bag, registry, 'mortal', 1)
    const afterGrant = bag.getAll().reduce((total, stack) => total + stack.amount, 0)
    expect(afterGrant).toBe(expected)

    // Same instant re-tick: no second grant; the freed lane refills on
    // the NEXT observation (top-up-then-settle order).
    system.tickWorkers(100_000, bag, registry, 'mortal', 1)
    expect(bag.getAll().reduce((total, stack) => total + stack.amount, 0)).toBe(afterGrant)
  })

  it('autoRestart=false gets NO slots even with spare capacity (eligibility gate)', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_lam', false)

    system.tickWorkers(1_000, bag, registry, 'mortal', 5)

    expect(system.getState('thanh_van_lam')!.activeWorkerSlots).toBe(0)
    expect(system.getState('thanh_van_lam')!.workerCycles ?? []).toHaveLength(0)
  })

  it('getSiteView reports progress from the earliest worker lane (not a manual cycle)', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_lam', true)

    system.tickWorkers(1_000, bag, registry, 'mortal', 1)

    const view = system.getSiteView('thanh_van_lam', 1_000)!
    expect(view.cycleTotalMs).toBe(100_000)
    // The lane was seeded AT nowMs=1_000 (emptyLaneStartMs), so a full
    // 100s remains — not 99s.
    expect(view.cycleRemainingMs).toBe(100_000)
  })

  it('restoreStates drops a stale activeCycle key — tolerated, whitelisted out, never migrated', () => {
    const system = createSystem()
    const stale = {
      siteId: 'thanh_van_lam',
      level: 2,
      autoRestart: true,
      activeWorkerSlots: 0,
      workerCycles: [],
      // Pre-removal payload residue: must NOT round-trip into live state.
      activeCycle: {
        cycleId: 'old', siteId: 'thanh_van_lam', collectionRealmId: 'mortal',
        siteLevelAtStart: 1, rewardTableVersion: 1, rollSeed: 1,
        startedAtMs: 0, completesAtMs: 1,
      },
    }

    system.restoreStates([stale])

    const restored = system.getState('thanh_van_lam')!
    expect('activeCycle' in restored).toBe(false)
    expect(restored.level).toBe(2)
  })

  it('cùng collectionRealmId + level → cùng thời lượng bất kể reward roll ra gì (worker lane)', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_quang', true)

    for (let seedRun = 0; seedRun < 20; seedRun++) {
      system.tickWorkers(0, bag, registry, 'mortal', 3)

      const cycle = system.getState('thanh_van_quang')!.workerCycles![0]!
      cycle.rollSeed = seedRun * 7919

      const rewards = system.rollRewards(cycle)

      // Every outcome shares the snapshot deadline — completesAtMs does
      // not depend on the seed.
      expect(cycle.completesAtMs).toBe(computeCycleSeconds(100, 1) * 1000)
      expect(rewards.length).toBeGreaterThan(0)
    }
  })

  it('worker offline (T3): cycle dở dang từ save + cycle mới chạy trong cap như slot tay', () => {
    const { bag, registry } = createBag()

    const system = createSystem()

    const startMs = 1_000_000_000

    // Giả lập save: site autoRestart với 1 worker cycle dở dang (hoàn thành sau 100s).
    system.restoreStates([
      {
        siteId: 'thanh_van_lam',
        level: 1,
        autoRestart: true,
        activeWorkerSlots: 1,
        workerCycles: [
          {
            cycleId: 'worker_saved_1',
            siteId: 'thanh_van_lam',
            collectionRealmId: 'mortal',
            siteLevelAtStart: 1,
            rewardTableVersion: 1,
            rollSeed: 42,
            startedAtMs: startMs,
            completesAtMs: startMs + 100_000,
          },
        ],
      },
    ])

    // Vắng 1 giờ với 1 worker capacity.
    const settled = system.settleOffline(bag, registry, 'mortal', startMs + 3600_000, {
      workerCapacity: 1,
      offlineSinceMs: startMs,
    })

    // 1 giờ / 100s ≈ 36 cycle (1 dở dang + ~35 mới) — cho phép sai số guard.
    expect(settled).toBeGreaterThanOrEqual(30)

    expect(settled).toBeLessThanOrEqual(37)

    const woodTotal = bag.getAll().reduce((total, stack) => total + stack.amount, 0)

    expect(woodTotal).toBeGreaterThanOrEqual(settled)
  })

  it('worker offline tuân cap chung: vắng 100 giờ chỉ settle tối đa ~360 cycle', () => {
    const { bag, registry } = createBag()

    const system = createSystem()

    const startMs = 1_000_000_000

    system.restoreStates([
      {
        siteId: 'thanh_van_lam',
        level: 1,
        autoRestart: true,
        activeWorkerSlots: 1,
        workerCycles: [],
      },
    ])

    const settled = system.settleOffline(bag, registry, 'mortal', startMs + 100 * 3600_000, {
      workerCapacity: 1,
      offlineSinceMs: startMs,
    })

    // Cap 10h / 100s = 360 cycle — không được vượt dù vắng 100 giờ.
    expect(settled).toBeLessThanOrEqual(361)
  })
})

describe('Reward rolls — phân bố (sanity thống kê)', () => {
  it('mine: tuổi decade chiếm đa phần, thuong_co hiếm nhất (engine enforce thứ tự, 6E C2)', () => {
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

    const decade = counts.get('decade') ?? 0

    const thuongCo = counts.get('thuong_co') ?? 0

    expect(decade).toBeGreaterThan(thuongCo * 5)
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
        // Gỗ giờ roll theo tuổi (6E C2) — đếm MỌI biến thể Trúc Cơ.
        if (reward.materialId.startsWith('foundation_establishment_wood_')) {
          highTierPicks += 1
        }
      }
    }

    // Profile high 20/40/40 → tier cao ~40%+.
    expect(highTierPicks).toBeGreaterThan(250)
  })
})

describe('ProductionSystem.restoreStates — unknown siteId (Mission A review, MA-R1-04)', () => {
  it('drops states whose siteId has no definition — orphan sites must not hold worker capacity', () => {
    const system = createSystem()

    system.restoreStates([
      { siteId: 'ghost_site', level: 1, autoRestart: true, activeWorkerSlots: 0 },
      { siteId: 'thanh_van_lam', level: 1, autoRestart: false, activeWorkerSlots: 0 },
    ])

    expect(system.getState('ghost_site')).toBeUndefined()
    expect(system.getState('thanh_van_lam')).toBeDefined()
    expect(system.getAllStates()).toHaveLength(1)
  })
})
