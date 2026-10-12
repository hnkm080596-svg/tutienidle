import { describe, expect, it, vi } from 'vitest'

vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import { MaterialBag } from '../material/MaterialBag'
import { DecomposeSystem } from './DecomposeSystem'

describe('DecomposeSystem immediate command contract', () => {
  it('has no worker capacity or worker settings in its public contract', () => {
    const system = new DecomposeSystem(new MaterialBag())
    expect(system.getSaveState()).toEqual({
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: 0,
      started: false,
    })
    expect(system).not.toHaveProperty('updateCapacity')
    expect(system).not.toHaveProperty('setSetting')
    expect(system).not.toHaveProperty('tick')
    expect(system).not.toHaveProperty('settleOffline')
  })
})
