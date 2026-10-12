import { describe, expect, it, vi } from 'vitest'

vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import { DecomposeSystem } from './DecomposeSystem'
import { MaterialBag } from '../material/MaterialBag'

describe('DecomposeSystem legacy save compatibility', () => {
  it('normalizes retired worker and timer state to inert defaults', () => {
    const system = new DecomposeSystem(new MaterialBag())
    system.restore({
      settings: { gradeFilter: 'all', ageFilter: 'decade', workers: 4 },
      nextCycleAt: 9_000_000,
      started: true,
    })

    expect(system.getSaveState()).toEqual({
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: 0,
      started: false,
    })
    expect(system.restore(undefined)).toBeUndefined()
    expect(system.getSaveState().nextCycleAt).toBe(0)
  })

  it('ignores malformed legacy timing and worker values without creating authority', () => {
    const system = new DecomposeSystem(new MaterialBag())
    expect(() => system.restore({
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: Number.NaN },
      nextCycleAt: Number.NaN,
      started: true,
    })).not.toThrow()
    expect(system.getSaveState().started).toBe(false)
    expect(system.getSaveState().nextCycleAt).toBe(0)
  })
})
