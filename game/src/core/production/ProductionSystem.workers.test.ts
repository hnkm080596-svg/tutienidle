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
import type { ProductionCycle } from './ProductionTypes'

function makeSystem(siteIds: string[]): ProductionSystem {
  const system = new ProductionSystem({
    territory: TERRITORY_THANH_VAN,
    sites: THANH_VAN_PRODUCTION_SITES,
    forestRewards: THANH_VAN_FOREST_REWARDS,
    mineRewards: THANH_VAN_MINE_REWARDS,
    grottoHerbs: THANH_VAN_GROTTO_HERBS,
    now: () => 1_000,
  })
  system.restoreStates(siteIds.map((siteId) => ({
    siteId,
    level: 1,
    autoRestart: true,
    productionCycles: [],
  })), 1_000)
  return system
}

function makeInventory() {
  const registry = new MaterialRegistry()
  for (const material of materials) registry.register(material)
  return { bag: new MaterialBag(), registry }
}

describe('autonomous production contract', () => {
  it('preserves and settles all legacy pending cycles once, then resumes with one site cycle', () => {
    const start = 1_000
    const due = start + 100_000
    const legacyCycles: ProductionCycle[] = [11, 22, 33].map((rollSeed, index) => ({
      cycleId: `legacy-${index}`,
      siteId: 'thanh_van_lam',
      collectionRealmId: 'mortal',
      siteLevelAtStart: 1,
      rewardTableVersion: 1,
      rollSeed,
      startedAtMs: start,
      completesAtMs: due,
    }))
    const system = makeSystem(['thanh_van_lam'])
    system.restoreStates([{
      siteId: 'thanh_van_lam',
      level: 1,
      autoRestart: true,
      workerCycles: legacyCycles,
    }], start)
    const inventory = makeInventory()

    expect(system.getState('thanh_van_lam')?.productionCycles?.map((cycle) => cycle.rollSeed)).toEqual([11, 22, 33])
    const settled = system.settleOffline(inventory.bag, inventory.registry, 'mortal', due, {
      offlineSinceMs: start,
      rng: () => 0.25,
    })
    const repeated = system.settleOffline(inventory.bag, inventory.registry, 'mortal', due, {
      offlineSinceMs: start,
      rng: () => 0.25,
    })

    expect(settled).toBe(3)
    expect(repeated).toBe(0)
    expect(system.drainSettlementEvents()).toHaveLength(3)
    expect(system.getState('thanh_van_lam')?.productionCycles).toHaveLength(1)
  })

  it('starts one cycle per site regardless of capacity, assignments, or enabled site count', () => {
    const oneSite = makeSystem(['thanh_van_lam'])
    const threeSites = makeSystem(['thanh_van_lam', 'thanh_van_quang', 'thanh_van_dong_thien'])
    const a = makeInventory()
    const b = makeInventory()

    oneSite.tick(1_000, a.bag, a.registry, 'mortal', () => 0.25)
    threeSites.tick(1_000, b.bag, b.registry, 'mortal', () => 0.25)

    for (const siteId of ['thanh_van_lam', 'thanh_van_quang', 'thanh_van_dong_thien']) {
      expect(threeSites.getState(siteId)?.productionCycles).toHaveLength(1)
    }
    expect(oneSite.getState('thanh_van_lam')?.productionCycles).toHaveLength(1)
  })
})
