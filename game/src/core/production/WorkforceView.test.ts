import { describe, expect, it } from 'vitest'
import { ProductionSystem } from './ProductionSystem'
import {
  TERRITORY_THANH_VAN,
  THANH_VAN_FOREST_REWARDS,
  THANH_VAN_GROTTO_HERBS,
  THANH_VAN_MINE_REWARDS,
  THANH_VAN_PRODUCTION_SITES,
} from './ProductionCatalog'

describe('workforce projection retirement', () => {
  it('production sites expose only their autonomous cycle state', () => {
    const system = new ProductionSystem({
      territory: TERRITORY_THANH_VAN,
      sites: THANH_VAN_PRODUCTION_SITES,
      forestRewards: THANH_VAN_FOREST_REWARDS,
      mineRewards: THANH_VAN_MINE_REWARDS,
      grottoHerbs: THANH_VAN_GROTTO_HERBS,
    })
    system.ensureSiteState('thanh_van_lam')
    const state = system.getState('thanh_van_lam')!
    expect(state).toHaveProperty('productionCycles')
    expect(state).not.toHaveProperty('assignedWorkers')
    expect(state).not.toHaveProperty('activeWorkerSlots')
    expect(system).not.toHaveProperty('setWorkerAssignment')
  })
})
