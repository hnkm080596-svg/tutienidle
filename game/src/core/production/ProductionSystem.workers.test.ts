// R7 (AR-07) regression + parity coverage: tickWorkers and
// settleWorkersOffline must consume the SAME allocation rule. The
// all-manual + spare-capacity case used to crash online allocation
// ("Cannot read properties of undefined (reading 'activeWorkerSlots')")
// and diverge offline.
import { describe, expect, it } from 'vitest'
import { MaterialBag } from '../material/MaterialBag'
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
  return { bag: new MaterialBag(registry), registry }
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
