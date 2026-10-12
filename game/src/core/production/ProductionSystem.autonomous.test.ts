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

function makeSystem(siteIds: string[]): ProductionSystem {
  const system = new ProductionSystem({
    territory: TERRITORY_THANH_VAN,
    sites: THANH_VAN_PRODUCTION_SITES,
    forestRewards: THANH_VAN_FOREST_REWARDS,
    mineRewards: THANH_VAN_MINE_REWARDS,
    grottoHerbs: THANH_VAN_GROTTO_HERBS,
    now: () => 1_000,
  })
  system.restoreStates(siteIds.map((siteId) => ({ siteId, level: 1, autoRestart: true } as never)), 1_000)
  return system
}

function makeInventory() {
  const registry = new MaterialRegistry()
  for (const material of materials) registry.register(material)
  return { bag: new MaterialBag(), registry }
}

describe('autonomous production contract', () => {
  it('starts one cycle for a site regardless of capacity, assignments, or other enabled sites', () => {
    const oneSite = makeSystem(['thanh_van_lam'])
    const threeSites = makeSystem([
      'thanh_van_lam',
      'thanh_van_quang',
      'thanh_van_dong_thien',
    ])
    const a = makeInventory()
    const b = makeInventory()

    oneSite.tick(1_000, a.bag, a.registry, 'mortal', () => 0.25)
    threeSites.tick(1_000, b.bag, b.registry, 'mortal', () => 0.25)

    expect(oneSite.getState('thanh_van_lam')?.productionCycles).toHaveLength(1)
    expect(threeSites.getState('thanh_van_lam')?.productionCycles).toHaveLength(1)
  })
})
