// R9 (AR-23) - quote/commit parity: quoteSiteUpgrade must agree with
// what upgradeSite will actually do for the same state (one rule, one
// implementation; the panel renders the quote).
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
import { SPIRIT_STONE_MATERIAL } from '../material/SpiritStoneMaterial'

function createSystem(): ProductionSystem {
  return new ProductionSystem({
    territory: TERRITORY_THANH_VAN,
    sites: THANH_VAN_PRODUCTION_SITES,
    forestRewards: THANH_VAN_FOREST_REWARDS,
    mineRewards: THANH_VAN_MINE_REWARDS,
    grottoHerbs: THANH_VAN_GROTTO_HERBS,
  })
}

function setupWithSite(level = 1) {
  const system = createSystem()
  const registry = new MaterialRegistry()
  for (const material of materials) {
    registry.register(material)
  }
  const bag = new MaterialBag()
  const siteId = THANH_VAN_PRODUCTION_SITES[0]!.siteId
  system.restoreStates([{ siteId, level, autoRestart: false, activeWorkerSlots: 0, workerCycles: [] }])
  return { system, registry, bag, siteId }
}

describe('quoteSiteUpgrade - quote/commit parity (AR-23)', () => {
  it('affordable quote -> upgradeSite succeeds; quote reflects new level', () => {
    const { system, bag, siteId } = setupWithSite(1)
    // Fill generously: the real upgrade costs come from the catalog.
    for (const material of materials) {
      bag.add(material, 1_000_000)
    }
    bag.add(SPIRIT_STONE_MATERIAL, 1_000_000)

    const quote = system.quoteSiteUpgrade(siteId, bag, 9)
    expect(quote.upgradable).toBe(true)
    expect(quote.cost).toBeDefined()

    expect(system.upgradeSite(siteId, bag, 9)).toBe(true)
    expect(system.getState(siteId)!.level).toBe(2)

    // After the upgrade the quote targets the next level with the
    // next cost row (same rule, no duplicated panel logic).
    const quote2 = system.quoteSiteUpgrade(siteId, bag, 9)
    expect(quote2.cost).toBeDefined()
    expect(quote2.cost!.woodAmount).toBeGreaterThan(0)
  })

  it('realm-gated quote -> upgradeSite fails with the same gate', () => {
    const { system, bag, siteId } = setupWithSite(3)
    for (const material of materials) {
      bag.add(material, 1_000_000)
    }
    bag.add(SPIRIT_STONE_MATERIAL, 1_000_000)

    // Target level 4 > realm tier 1.
    const quote = system.quoteSiteUpgrade(siteId, bag, 1)
    expect(quote.upgradable).toBe(false)
    expect(quote.reasons).toContain('realm_gate')

    expect(system.upgradeSite(siteId, bag, 1)).toBe(false)
  })

  it('missing resources -> quote lists them and upgradeSite fails', () => {
    const { system, bag, siteId } = setupWithSite(1)

    const quote = system.quoteSiteUpgrade(siteId, bag, 9)
    expect(quote.upgradable).toBe(false)
    expect(quote.reasons.length).toBeGreaterThan(0)

    expect(system.upgradeSite(siteId, bag, 9)).toBe(false)
  })

  it('max level -> quote reports max_level', () => {
    const { system, bag, siteId } = setupWithSite(1)
    for (const material of materials) {
      bag.add(material, 1_000_000)
    }
    bag.add(SPIRIT_STONE_MATERIAL, 1_000_000)

    const maxLevel = system.getSiteDefinition(siteId)!.maxLevel
    system.restoreStates([{ siteId, level: maxLevel, autoRestart: false, activeWorkerSlots: 0, workerCycles: [] }])

    const quote = system.quoteSiteUpgrade(siteId, bag, 99)
    expect(quote.upgradable).toBe(false)
    expect(quote.reasons).toEqual(['max_level'])
    expect(system.upgradeSite(siteId, bag, 99)).toBe(false)
  })
})
