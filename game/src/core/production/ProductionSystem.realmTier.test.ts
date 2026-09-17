// Mission D (spec D2, audit T3-17) — every realm entering production
// resolves through ONE clamp to a supported territory tier: in-list
// passes through, above top tier clamps down, unknown resolves to the
// bottom tier. Never rejected, never a silent -1 profile.
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
  resolveTerritoryTier,
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

describe('resolveTerritoryTier (Mission D / spec D2)', () => {
  it('supported realms pass through unchanged', () => {
    expect(resolveTerritoryTier(TERRITORY_THANH_VAN, 'mortal')).toBe('mortal')
    expect(resolveTerritoryTier(TERRITORY_THANH_VAN, 'qi_refining')).toBe('qi_refining')
    expect(resolveTerritoryTier(TERRITORY_THANH_VAN, 'foundation_establishment')).toBe('foundation_establishment')
  })

  it('every realm above the beta scope clamps to foundation_establishment', () => {
    for (const realmId of ['golden_core', 'nascent_soul', 'soul_transformation', 'void_refinement', 'body_integration', 'mahayana', 'tribulation']) {
      expect(resolveTerritoryTier(TERRITORY_THANH_VAN, realmId)).toBe('foundation_establishment')
    }
  })

  it('an unknown realm resolves to the bottom tier — never rejected, never -1', () => {
    expect(resolveTerritoryTier(TERRITORY_THANH_VAN, 'not_a_realm')).toBe('mortal')
  })
})

describe('clamp applied at every production entry point (T3-17)', () => {
  it('tickWorkers: a golden_core player spawns foundation-tier lanes at 900s, not 2700s ghost lanes', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.setAutoRestart('thanh_van_lam', true)

    system.tickWorkers(1_000, bag, registry, 'golden_core', 2)

    const state = system.getState('thanh_van_lam')!
    expect(state.activeWorkerSlots).toBe(2)
    expect(state.workerCycles).toHaveLength(2)
    for (const cycle of state.workerCycles!) {
      expect(cycle.collectionRealmId).toBe('foundation_establishment')
      expect(cycle.completesAtMs - cycle.startedAtMs).toBe(900_000)
    }
  })

  it('settleOffline: golden_core settles worker lanes on the clamped tier', () => {
    const { bag, registry } = createBag()
    const system = createSystem()
    system.restoreStates([
      { siteId: 'thanh_van_lam', level: 1, autoRestart: true, activeWorkerSlots: 0, workerCycles: [] },
    ])

    const settled = system.settleOffline(bag, registry, 'golden_core', 1_000_000 + 3_600_000, {
      workerCapacity: 1,
      offlineSinceMs: 1_000_000,
    })

    expect(settled).toBe(4) // 1h / 900s foundation cycles — not frozen, not 2700s
    expect(bag.getAll().length).toBeGreaterThan(0)
  })

  it('rollRewards uses the high-tier profile for clamped foundation cycles (reward table consistent with duration)', () => {
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
        if (reward.materialId.startsWith('foundation_establishment_wood_')) {
          highTierPicks += 1
        }
      }
    }
    expect(highTierPicks).toBeGreaterThan(250) // high profile 20/40/40 -> ~40%
  })
})
