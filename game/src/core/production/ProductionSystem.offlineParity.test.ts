import { afterEach, describe, expect, it, vi } from 'vitest'
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

const REALM = 'mortal'
const LAM = 'thanh_van_lam'
const QUANG = 'thanh_van_quang'
const DONG_THIEN = 'thanh_van_dong_thien'

function createSystem(siteIds: string[]): ProductionSystem {
  const system = new ProductionSystem({
    territory: TERRITORY_THANH_VAN,
    sites: THANH_VAN_PRODUCTION_SITES,
    forestRewards: THANH_VAN_FOREST_REWARDS,
    mineRewards: THANH_VAN_MINE_REWARDS,
    grottoHerbs: THANH_VAN_GROTTO_HERBS,
    now: () => 1_000_000,
  })
  system.restoreStates(siteIds.map((siteId) => ({
    siteId,
    level: 1,
    autoRestart: true,
    productionCycles: [],
  })), 1_000_000)
  return system
}

function createBag() {
  const registry = new MaterialRegistry()
  for (const material of materials) registry.register(material)
  return { bag: new MaterialBag(), registry }
}

afterEach(() => vi.restoreAllMocks())

describe('production offline parity with autonomous sites', () => {
  it('settles the same number of cycles per site regardless of other enabled sites', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const one = createSystem([LAM])
    const three = createSystem([LAM, QUANG, DONG_THIEN])
    const a = createBag()
    const b = createBag()
    const now = 1_000_000 + 300_000

    const oneCount = one.settleOffline(a.bag, a.registry, REALM, now, {
      offlineSinceMs: 1_000_000,
      rng: () => 0.25,
    })
    const threeCount = three.settleOffline(b.bag, b.registry, REALM, now, {
      offlineSinceMs: 1_000_000,
      rng: () => 0.25,
    })

    expect(oneCount).toBe(3)
    expect(threeCount).toBe(9)
    expect(three.drainSettlementEvents().filter((event) => event.siteId === LAM)).toHaveLength(3)
    expect(one.drainSettlementEvents().filter((event) => event.siteId === LAM)).toHaveLength(3)
  })

  it('retains ten hours per site during a long absence without transferring sibling allowance', () => {
    const ids = [LAM, QUANG, DONG_THIEN]
    const one = createSystem([LAM])
    const three = createSystem(ids)
    const a = createBag()
    const b = createBag()
    const now = 1_000_000 + 100 * 60 * 60 * 1000
    const options = { offlineSinceMs: 1_000_000, rng: () => 0.25 }
    expect(one.settleOffline(a.bag, a.registry, REALM, now, options)).toBe(360)
    expect(three.settleOffline(b.bag, b.registry, REALM, now, options)).toBe(1080)
    const events = three.drainSettlementEvents()
    for (const siteId of ids) expect(events.filter(event => event.siteId === siteId)).toHaveLength(360)
    expect(one.drainSettlementEvents()).toHaveLength(360)
    expect(three.settleOffline(b.bag, b.registry, REALM, now, options)).toBe(0)
  })

  it('settles retained in-flight work once even if auto-restart is off', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const system = createSystem([LAM])
    const inventory = createBag()
    system.tick(1_000_000, inventory.bag, inventory.registry, REALM, () => 0.25)
    const saved = structuredClone(system.getAllStates()).map((state) => ({ ...state, autoRestart: false }))
    system.restoreStates(saved, 1_000_000)

    const settled = system.settleOffline(inventory.bag, inventory.registry, REALM, 1_100_000, {
      offlineSinceMs: 1_000_000,
      rng: () => 0.25,
    })
    const repeated = system.settleOffline(inventory.bag, inventory.registry, REALM, 1_100_000, {
      offlineSinceMs: 1_000_000,
      rng: () => 0.25,
    })

    expect(settled).toBe(1)
    expect(repeated).toBe(0)
    expect(system.drainSettlementEvents()).toHaveLength(1)
  })
})
