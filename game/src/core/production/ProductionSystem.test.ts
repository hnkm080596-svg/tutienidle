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
  mulberry32,
  rollWeightedIndex,
} from './ProductionBalance'
import { ProductionSystem } from './ProductionSystem'
import {
  GROTTO_CHANNEL_SEED_TAG,
  type GrottoChannel,
} from '../../data/drop/HiddenMaterialChannels'
import type { ProductionCycle } from './ProductionTypes'

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

describe('ProductionSystem - workers-as-fuel (Mission D / spec D3)', () => {
  it('state has no activeCycle field at all - the manual lane does not exist', () => {
    const system = createSystem()
    const state = system.ensureSiteState('thanh_van_lam')
    expect('activeCycle' in state).toBe(false)
  })

  it('capacity 0 produces NOTHING online even with autoRestart on - workers are required fuel', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_lam', true)

    system.tickWorkers(60_000, bag, registry, 'mortal', 0)

    expect(system.getState('thanh_van_lam')!.workerCycles ?? []).toHaveLength(0)
    expect(bag.getAll()).toHaveLength(0)
  })

  it('capacity 0 produces NOTHING offline - no manual fallback phase', () => {
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

  it('lane count equals activeWorkerSlots exactly - 1 worker -> 1 lane, no implicit extra lane', () => {
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
    // getState() returns a detached snapshot (spec D2): identical fields,
    // so rollRewards on the copy predicts the domain grant exactly.
    const cycle = system.getState('thanh_van_lam')!.workerCycles![0]!
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
    // 100s remains - not 99s.
    expect(view.cycleRemainingMs).toBe(100_000)
  })

  it('restoreStates drops a stale activeCycle key - tolerated, whitelisted out, never migrated', () => {
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

  it('same collectionRealmId + level -> same duration regardless of the rolled reward (worker lane)', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_quang', true)

    for (let seedRun = 0; seedRun < 20; seedRun++) {
      system.tickWorkers(0, bag, registry, 'mortal', 3)

      const cycle = system.getState('thanh_van_quang')!.workerCycles![0]!
      cycle.rollSeed = seedRun * 7919

      const rewards = system.rollRewards(cycle)

      // Every outcome shares the snapshot deadline - completesAtMs does
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

// M-F-BODY-HIDDEN (spec sec.4, plan Step 1.3) - grotto hidden-channel
// emission. Fixture materials/channels only: the shipped registry is
// empty so every arm exercises injected deps (channels are a dep
// precisely so data/ never reads catalogs). A 'chancePerCycle: 0'
// fixture is the bound-only channel: validate() would reject it in
// authored data, but the mechanism consumes draws only on the chance
// path, which the bound arm must bypass.
describe('ProductionSystem - hidden grotto channels (m-f-body-hidden sec.4)', () => {
  const GROTTO = 'thanh_van_dong_thien'
  const CHANNEL_MATERIAL = 'bp_fixture_perfection'

  function grottoChannel(overrides: Partial<GrottoChannel> = {}): GrottoChannel {
    return {
      kind: 'grotto',
      id: 'fixture_channel',
      bandRealmId: 'mortal',
      materialId: CHANNEL_MATERIAL,
      chancePerCycle: 1,
      ...overrides,
    }
  }

  function channelSystem(channels: readonly GrottoChannel[]): ProductionSystem {
    return new ProductionSystem({
      territory: TERRITORY_THANH_VAN,
      sites: THANH_VAN_PRODUCTION_SITES,
      forestRewards: THANH_VAN_FOREST_REWARDS,
      mineRewards: THANH_VAN_MINE_REWARDS,
      grottoHerbs: THANH_VAN_GROTTO_HERBS,
      hiddenGrottoChannels: channels,
    })
  }

  function registerChannelMaterial(
    registry: MaterialRegistry,
    breakthroughRealmId?: string,
  ): void {
    registry.register({
      id: CHANNEL_MATERIAL,
      name: CHANNEL_MATERIAL,
      category: 'other',
      sourceType: 'exploration',
      breakthroughRealmId,
    })
  }

  // Drives exactly ONE due worker cycle through the real settle path:
  // the saved lane is re-seeded via restoreStates (chosen rollSeed so
  // channel draws are reproducible) and one tick at the deadline
  // settles it. Prior site state - hiddenChannelCycles included -
  // rides the restore payload so counters persist across calls.
  function settleOneCycle(
    system: ProductionSystem,
    bag: MaterialBag,
    registry: MaterialRegistry,
    collectionRealmId: string,
    rollSeed: number,
  ): void {
    const prior = system.getAllStates()
    const grotto = prior.find((state) => state.siteId === GROTTO)

    system.restoreStates([
      ...prior,
      {
        siteId: GROTTO,
        level: 1,
        autoRestart: false,
        activeWorkerSlots: 0,
        hiddenChannelCycles: grotto?.hiddenChannelCycles,
        workerCycles: [
          {
            cycleId: `cycle_${rollSeed}_${prior.length}`,
            siteId: GROTTO,
            collectionRealmId,
            siteLevelAtStart: 1,
            rewardTableVersion: 1,
            rollSeed,
            startedAtMs: 0,
            completesAtMs: 1,
          },
        ],
      },
    ])

    system.tickWorkers(1, bag, registry, collectionRealmId, 0)
  }

  function bagAmount(bag: MaterialBag, materialId: string): number {
    return bag.getAll().find((stack) => stack.material.id === materialId)?.amount ?? 0
  }

  it('emission rides the settle seam: bag.add + pendingEvents carry the channel material', () => {
    const { bag, registry } = createBag()
    registerChannelMaterial(registry)
    const system = channelSystem([grottoChannel()])

    settleOneCycle(system, bag, registry, 'mortal', 7)

    expect(bagAmount(bag, CHANNEL_MATERIAL)).toBe(1)

    const events = system.drainSettlementEvents()
    expect(events.some((event) => event.materialId === CHANNEL_MATERIAL && event.amount === 1)).toBe(
      true,
    )
    expect(system.drainSettlementEvents()).toEqual([])
  })

  it('counter resets ONLY on emission; a suppressed emission leaves it primed (F6)', () => {
    const { bag, registry } = createBag()
    registerChannelMaterial(registry)
    const system = channelSystem([
      grottoChannel({ chancePerCycle: 0, guaranteedAfterCycles: 2 }),
    ])

    // Cycle 1: counter 1 (< bound) -> primed, nothing emitted.
    settleOneCycle(system, bag, registry, 'mortal', 11)
    expect(bagAmount(bag, CHANNEL_MATERIAL)).toBe(0)
    expect(system.getState(GROTTO)!.hiddenChannelCycles).toEqual({ fixture_channel: 1 })

    // Cycle 2: bound reached -> emits once, counter drops to 0.
    settleOneCycle(system, bag, registry, 'mortal', 12)

    expect(bagAmount(bag, CHANNEL_MATERIAL)).toBe(1)
    expect(system.getState(GROTTO)!.hiddenChannelCycles).toEqual({ fixture_channel: 0 })
  })

  it('reach eligibility: cycles below bandRealmId never advance the counter (r82-H2)', () => {
    const { bag, registry } = createBag()
    registerChannelMaterial(registry)
    const system = channelSystem([
      grottoChannel({ bandRealmId: 'foundation_establishment', chancePerCycle: 1 }),
    ])

    // mortal (index 0) and qi_refining (1) are both below the band (2):
    // counter does not even materialize, no draws, no emission.
    settleOneCycle(system, bag, registry, 'mortal', 21)
    settleOneCycle(system, bag, registry, 'qi_refining', 22)

    expect(bagAmount(bag, CHANNEL_MATERIAL)).toBe(0)
    expect(system.getState(GROTTO)!.hiddenChannelCycles ?? {}).toEqual({})

    // A cycle AT the band is eligible and emits.
    settleOneCycle(system, bag, registry, 'foundation_establishment', 23)

    expect(bagAmount(bag, CHANNEL_MATERIAL)).toBe(1)
  })

  it('isBreakthroughAcquisitionEnabled gate at origination: suppressed material never emits, counter stays primed', () => {
    const { bag, registry } = createBag()
    // golden_core is beyond the release ceiling (foundation_establishment)
    // so the breakthrough-scoped acquisition gate stays closed.
    registerChannelMaterial(registry, 'golden_core')
    const system = channelSystem([grottoChannel({ chancePerCycle: 1 })])

    settleOneCycle(system, bag, registry, 'mortal', 31)
    settleOneCycle(system, bag, registry, 'mortal', 32)
    settleOneCycle(system, bag, registry, 'mortal', 33)

    expect(bagAmount(bag, CHANNEL_MATERIAL)).toBe(0)
    // Suppression is not a reset: the counter kept climbing and will
    // emit on the first cycle after the policy gate opens.
    expect(system.getState(GROTTO)!.hiddenChannelCycles).toEqual({ fixture_channel: 3 })
    expect(system.drainSettlementEvents().every((event) => event.materialId !== CHANNEL_MATERIAL)).toBe(
      true,
    )
  })

  it('a bound emission consumes NO channel draw: the next channel reads the first stream value', () => {
    const { bag, registry } = createBag()
    registerChannelMaterial(registry)

    const rollSeed = 41
    const rng = mulberry32(rollSeed ^ GROTTO_CHANNEL_SEED_TAG)
    const v0 = rng()
    const v1 = rng()
    const probeChance = (v0 + v1) / 2

    for (const id of ['probe_material', 'other_material']) {
      registry.register({ id, name: id, category: 'other', sourceType: 'exploration' })
    }

    const boundFirst = channelSystem([
      grottoChannel({ id: 'bound_chan', chancePerCycle: 0, guaranteedAfterCycles: 1 }),
      grottoChannel({ id: 'probe_chan', materialId: 'probe_material', chancePerCycle: probeChance }),
    ])
    const drawFirst = channelSystem([
      grottoChannel({ id: 'draw_chan', materialId: 'other_material', chancePerCycle: 0 }),
      grottoChannel({ id: 'probe_chan', materialId: 'probe_material', chancePerCycle: probeChance }),
    ])

    // Run A: bound_chan emits at cycle 1 WITHOUT a draw -> probe sees v0.
    const bagA = new MaterialBag()
    settleOneCycle(boundFirst, bagA, registry, 'mortal', rollSeed)
    const probeEmittedWithBound = bagAmount(bagA, 'probe_material') === 1

    // Run B: draw_chan consumes v0 on its (always-missing) chance roll ->
    // probe sees v1.
    const bagB = new MaterialBag()
    settleOneCycle(drawFirst, bagB, registry, 'mortal', rollSeed)
    const probeEmittedAfterDraw = bagAmount(bagB, 'probe_material') === 1

    expect(probeEmittedWithBound).toBe(v0 < probeChance)
    expect(probeEmittedAfterDraw).toBe(v1 < probeChance)
    // The two predictions are opposite halves - the bound path provably
    // left the stream untouched.
    expect(probeEmittedWithBound).not.toBe(probeEmittedAfterDraw)
  })

  it('table-roll parity: channel draws live on the tagged stream so table rewards stay bit-identical', () => {
    const { bag, registry } = createBag()
    registerChannelMaterial(registry)

    const rollSeeds = [101, 102, 103]
    const tableRewards = (system: ProductionSystem) =>
      rollSeeds.flatMap((rollSeed) => {
        const cycle: ProductionCycle = {
          cycleId: 'c',
          siteId: GROTTO,
          collectionRealmId: 'mortal',
          siteLevelAtStart: 1,
          rewardTableVersion: 1,
          rollSeed,
          startedAtMs: 0,
          completesAtMs: 1,
        }
        return system.rollRewards(cycle).map((reward) => `${reward.materialId}:${reward.amount}`)
      })

    const silent = createSystem()
    const emitting = channelSystem([grottoChannel({ chancePerCycle: 1 })])

    expect(tableRewards(emitting)).toEqual(tableRewards(silent))

    // Settle-level parity: the emitted-channel system's table stacks are
    // identical to the silent system's (the channel stack is additive).
    for (const rollSeed of rollSeeds) {
      settleOneCycle(silent, bag, registry, 'mortal', rollSeed)
    }
    const tableStacks = bag.getAll().filter((stack) => stack.material.id !== CHANNEL_MATERIAL)

    const emittingBag = new MaterialBag()
    for (const rollSeed of rollSeeds) {
      settleOneCycle(emitting, emittingBag, registry, 'mortal', rollSeed)
    }

    expect(
      emittingBag.getAll().filter((stack) => stack.material.id !== CHANNEL_MATERIAL),
    ).toEqual(tableStacks)
    expect(bagAmount(emittingBag, CHANNEL_MATERIAL)).toBeGreaterThan(0)
  })

  it('restore/settle split: restoreStates rehydrates counters with NO rolls or emission (r82-M2)', () => {
    const { bag, registry } = createBag()
    registerChannelMaterial(registry)
    const system = channelSystem([grottoChannel({ chancePerCycle: 1 })])

    system.restoreStates([
      {
        siteId: GROTTO,
        level: 1,
        autoRestart: true,
        activeWorkerSlots: 0,
        workerCycles: [],
        hiddenChannelCycles: { fixture_channel: 7 },
      },
    ])

    // Pure rehydration: counter restored verbatim, nothing queued.
    expect(system.getState(GROTTO)!.hiddenChannelCycles).toEqual({ fixture_channel: 7 })
    expect(system.drainSettlementEvents()).toEqual([])
    expect(bagAmount(bag, CHANNEL_MATERIAL)).toBe(0)

    // Offline settle is the operation that MAY emit - it goes through
    // grantCycleRewards and leaves discovery pending on the event drain.
    const settled = system.settleOffline(bag, registry, 'mortal', 300_000, {
      workerCapacity: 1,
      offlineSinceMs: 0,
    })
    expect(settled).toBeGreaterThan(0)
    expect(bagAmount(bag, CHANNEL_MATERIAL)).toBeGreaterThan(0)
    expect(
      system.drainSettlementEvents().some((event) => event.materialId === CHANNEL_MATERIAL),
    ).toBe(true)
  })

  it('non-grotto sites never roll channel rewards even when a channel band matches', () => {
    const { bag, registry } = createBag()
    registerChannelMaterial(registry)
    const system = channelSystem([grottoChannel({ chancePerCycle: 1 })])

    system.restoreStates([
      {
        siteId: 'thanh_van_lam',
        level: 1,
        autoRestart: false,
        activeWorkerSlots: 0,
        workerCycles: [
          {
            cycleId: 'forest_cycle',
            siteId: 'thanh_van_lam',
            collectionRealmId: 'mortal',
            siteLevelAtStart: 1,
            rewardTableVersion: 1,
            rollSeed: 55,
            startedAtMs: 0,
            completesAtMs: 1,
          },
        ],
      },
    ])
    system.tickWorkers(1, bag, registry, 'mortal', 0)

    expect(bagAmount(bag, CHANNEL_MATERIAL)).toBe(0)
  })
})
