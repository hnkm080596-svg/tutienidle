// R7 (AR-07) regression + parity coverage: tickWorkers and
// settleWorkersOffline must consume the SAME allocation rule. The
// all-manual + spare-capacity case used to crash online allocation
// ("Cannot read properties of undefined (reading 'activeWorkerSlots')")
// and diverge offline.
import { describe, expect, it } from 'vitest'
import { MaterialBag } from '../material/MaterialBag'
import { buildProductionCycle } from './ProductionCycles'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { materials } from '../../data/materials/materials'
import {
  TERRITORY_THANH_VAN,
  THANH_VAN_FOREST_REWARDS,
  THANH_VAN_GROTTO_HERBS,
  THANH_VAN_MINE_REWARDS,
  THANH_VAN_PRODUCTION_SITES,
} from './ProductionCatalog'
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

function makeAutoSystem(siteIds: string[]): ProductionSystem {
  const system = createSystem()
  // restoreStates REPLACES the whole map — pass all sites in ONE call.
  system.restoreStates(
    siteIds.map(siteId => ({
      siteId,
      level: 1,
      autoRestart: true,
      activeWorkerSlots: 0,
      workerCycles: [],
    })),
  )
  return system
}

const REALM = 'mortal'

describe('tickWorkers — AR-07 regression', () => {
  it('does not throw when every site is manual and capacity has remainder', () => {
    const system = makeAutoSystem(['thanh_van_lam'])
    const { bag, registry } = createBag()

    expect(() =>
      system.tickWorkers(Date.now(), bag, registry, REALM, 3, new Map([['thanh_van_lam', 1]])),
    ).not.toThrow()

    expect(system.getState('thanh_van_lam')!.activeWorkerSlots).toBe(1)
  })

  it('matches allocator output for mixed manual/auto sites', () => {
    const system = makeAutoSystem(['thanh_van_lam', 'thanh_van_quang', 'thanh_van_dong_thien'])
    const { bag, registry } = createBag()

    system.tickWorkers(
      Date.now(),
      bag,
      registry,
      REALM,
      6,
      new Map([
        ['thanh_van_lam', 4],
        ['thanh_van_quang', 1],
      ]),
    )

    expect(system.getState('thanh_van_lam')!.activeWorkerSlots).toBe(4)
    expect(system.getState('thanh_van_quang')!.activeWorkerSlots).toBe(1)
    // remainder 1 -> the only unassigned site (audit divergence case)
    expect(system.getState('thanh_van_dong_thien')!.activeWorkerSlots).toBe(1)
  })

  it('remainder is idle when all sites are manual', () => {
    const system = makeAutoSystem(['thanh_van_lam', 'thanh_van_quang'])
    const { bag, registry } = createBag()

    system.tickWorkers(
      Date.now(),
      bag,
      registry,
      REALM,
      6,
      new Map([
        ['thanh_van_lam', 2],
        ['thanh_van_quang', 2],
      ]),
    )

    expect(system.getState('thanh_van_lam')!.activeWorkerSlots).toBe(2)
    expect(system.getState('thanh_van_quang')!.activeWorkerSlots).toBe(2)
  })
})

describe('online/offline allocation parity (AR-07 divergence)', () => {
  it('settleOffline distributes exactly like tickWorkers for identical inputs', () => {
    const assignments = new Map<string, number>([
      ['thanh_van_lam', 4],
      ['thanh_van_quang', 1],
    ])

    const online = makeAutoSystem(['thanh_van_lam', 'thanh_van_quang', 'thanh_van_dong_thien'])
    const offline = makeAutoSystem(['thanh_van_lam', 'thanh_van_quang', 'thanh_van_dong_thien'])

    const onlineBag = createBag()
    const offlineBag = createBag()

    online.tickWorkers(Date.now(), onlineBag.bag, onlineBag.registry, REALM, 6, assignments)

    offline.settleOffline(offlineBag.bag, offlineBag.registry, REALM, Date.now() + 60_000, {
      workerCapacity: 6,
      workerAssignments: assignments,
    })

    // The audit divergence case: capacity 6, A=4 manual, B=1 manual,
    // C unassigned. Online gives the remainder to C; the old offline
    // loop round-robined ALL active states (giving it to A).
    expect(offline.getState('thanh_van_lam')!.activeWorkerSlots).toBe(4)
    expect(offline.getState('thanh_van_quang')!.activeWorkerSlots).toBe(1)
    expect(offline.getState('thanh_van_dong_thien')!.activeWorkerSlots).toBe(1)
    expect(online.getState('thanh_van_lam')!.activeWorkerSlots).toBe(4)
    expect(online.getState('thanh_van_quang')!.activeWorkerSlots).toBe(1)
    expect(online.getState('thanh_van_dong_thien')!.activeWorkerSlots).toBe(1)
  })

  it('offline remainder is idle when every site is manual (no second rule)', () => {
    const assignments = new Map<string, number>([
      ['thanh_van_lam', 2],
      ['thanh_van_quang', 2],
    ])

    const offline = makeAutoSystem(['thanh_van_lam', 'thanh_van_quang'])
    const { bag, registry } = createBag()

    offline.settleOffline(bag, registry, REALM, Date.now() + 60_000, {
      workerCapacity: 6,
      workerAssignments: assignments,
    })

    expect(offline.getState('thanh_van_lam')!.activeWorkerSlots).toBe(2)
    expect(offline.getState('thanh_van_quang')!.activeWorkerSlots).toBe(2)
  })
})

// D1 regression - INV-D-03: allocation dropping to zero must not freeze
// in-flight lanes. Retained work keeps its own deadline, settles once,
// and spawns no successor while capacity stays 0.
describe('D1 - capacity zero must not freeze retained lanes', () => {
  it('online: a lane in flight when capacity drops to 0 settles once and does not respawn', () => {
    const system = makeAutoSystem(['thanh_van_lam'])
    const { bag, registry } = createBag()
    const t0 = 1_000_000

    // Spawn one lane at capacity 1 (mortal/level-1 cycle = 100s).
    system.tickWorkers(t0, bag, registry, REALM, 1)
    expect(system.getState('thanh_van_lam')!.workerCycles).toHaveLength(1)

    // Decompose claims the whole pool before the deadline: the retained
    // lane is still in flight (not due yet), nothing settles.
    system.tickWorkers(t0 + 50_000, bag, registry, REALM, 0)
    expect(system.getState('thanh_van_lam')!.workerCycles).toHaveLength(1)
    expect(system.drainSettlementEvents()).toHaveLength(0)

    // Past the deadline the retained lane settles exactly once even
    // though capacity is still 0.
    system.tickWorkers(t0 + 150_000, bag, registry, REALM, 0)
    expect(system.getState('thanh_van_lam')!.workerCycles).toHaveLength(0)
    expect(system.drainSettlementEvents().length).toBeGreaterThan(0)

    // No successor lane spawns while capacity stays 0 - the pool is gone.
    system.tickWorkers(t0 + 400_000, bag, registry, REALM, 0)
    expect(system.getState('thanh_van_lam')!.workerCycles).toHaveLength(0)
    expect(system.drainSettlementEvents()).toHaveLength(0)
  })

  it('offline: workerCapacity 0 still settles a saved in-flight lane without respawning', () => {
    const system = makeAutoSystem(['thanh_van_lam'])
    const { bag, registry } = createBag()
    const t0 = 1_000_000

    // A saved in-flight lane due at t0 + 100s (mortal/level-1 cycle).
    const savedCycle = buildProductionCycle('thanh_van_lam', REALM, 1, 100, t0)
    system.restoreStates([{
      siteId: 'thanh_van_lam',
      level: 1,
      autoRestart: true,
      activeWorkerSlots: 1,
      workerCycles: [savedCycle],
    }])

    // The player was offline across the deadline with zero production
    // workers: the retained lane settles under the cap budget once.
    const settled = system.settleOffline(bag, registry, REALM, t0 + 200_000, {
      workerCapacity: 0,
      offlineSinceMs: t0,
    })

    expect(settled).toBe(1)
    expect(system.getState('thanh_van_lam')!.workerCycles).toHaveLength(0)
  })
})

// D2 regression - ProductionSystem is the domain owner of worker state:
// assignment is a command on the domain, and query surfaces hand out
// detached snapshots, never the live mutable record (A3/A7).
describe('D2 - worker assignment ownership boundary', () => {
  it('setWorkerAssignment clamps the request into [0, capacity]', () => {
    const system = makeAutoSystem(['thanh_van_lam'])

    expect(system.setWorkerAssignment('thanh_van_lam', 3, 5)).toBe(true)
    expect(system.getState('thanh_van_lam')!.assignedWorkers).toBe(3)

    expect(system.setWorkerAssignment('thanh_van_lam', 99, 5)).toBe(true)
    expect(system.getState('thanh_van_lam')!.assignedWorkers).toBe(5)
  })

  it('setWorkerAssignment(undefined) clears the request back to auto', () => {
    const system = makeAutoSystem(['thanh_van_lam'])
    system.setWorkerAssignment('thanh_van_lam', 2, 5)

    expect(system.setWorkerAssignment('thanh_van_lam', undefined, 5)).toBe(true)
    expect(system.getState('thanh_van_lam')!.assignedWorkers).toBeUndefined()
  })

  it('setWorkerAssignment rejects unknown sites and non-finite counts', () => {
    const system = makeAutoSystem(['thanh_van_lam'])

    expect(system.setWorkerAssignment('no_such_site', 1, 5)).toBe(false)
    expect(system.setWorkerAssignment('thanh_van_lam', Number.NaN, 5)).toBe(true)
    expect(system.getState('thanh_van_lam')!.assignedWorkers).toBe(0)
  })

  it('setWorkerAssignment materializes state on a defined site (D4 follow-up)', () => {
    // D4 made getSiteView observational: UI can now reach assignWorkers
    // for a defined site whose domain state was never materialized. The
    // command path must own materialization - silent no-op regressed
    // the ChiHienQuan allocation flow.
    const system = createSystem()

    expect(system.getState('thanh_van_lam')).toBeUndefined()
    expect(system.setWorkerAssignment('thanh_van_lam', 2, 5)).toBe(true)
    expect(system.getState('thanh_van_lam')!.assignedWorkers).toBe(2)
  })

  it('getState/getAllStates hand out detached snapshots - caller mutation cannot corrupt the domain', () => {
    const system = makeAutoSystem(['thanh_van_lam'])
    system.setWorkerAssignment('thanh_van_lam', 2, 5)

    const leaked = system.getState('thanh_van_lam')!
    leaked.assignedWorkers = 99
    leaked.workerCycles!.push(
      buildProductionCycle('thanh_van_lam', REALM, 1, 100, 1_000_000),
    )

    expect(system.getState('thanh_van_lam')!.assignedWorkers).toBe(2)
    expect(system.getState('thanh_van_lam')!.workerCycles).toHaveLength(0)

    const all = system.getAllStates()
    all[0]!.assignedWorkers = 77
    all[0]!.workerCycles!.push(
      buildProductionCycle('thanh_van_lam', REALM, 1, 100, 1_000_000),
    )

    expect(system.getState('thanh_van_lam')!.assignedWorkers).toBe(2)
    expect(system.getState('thanh_van_lam')!.workerCycles).toHaveLength(0)
  })

  // D4 - the same boundary on the presentation read surface: a UI query
  // must neither materialize domain state nor hand out a live record.
  it('getSiteView is observational - no state creation, detached projection', () => {
    const system = createSystem()

    const before = system.getAllStates()
    const absentView = system.getSiteView('thanh_van_lam', 0)!
    expect(absentView.state.level).toBe(1)
    absentView.state.level = 999

    expect(system.getAllStates()).toEqual(before)
    expect(system.getState('thanh_van_lam')).toBeUndefined()

    system.ensureSiteState('thanh_van_lam')
    const view = system.getSiteView('thanh_van_lam', 0)!
    view.state.level = 999
    view.state.assignedWorkers = 99
    view.state.workerCycles!.push(
      buildProductionCycle('thanh_van_lam', REALM, 1, 100, 1_000_000),
    )

    const domain = system.getState('thanh_van_lam')!
    expect(domain.level).toBe(1)
    expect(domain.assignedWorkers).toBeUndefined()
    expect(domain.workerCycles).toHaveLength(0)
  })
})
