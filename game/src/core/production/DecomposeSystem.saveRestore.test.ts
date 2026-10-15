import { describe, expect, it, vi } from 'vitest'

vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import { DecomposeSystem } from './DecomposeSystem'
import { MaterialBag } from '../material/MaterialBag'
import { materials } from '../../data/materials/materials'
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'

describe('DecomposeSystem legacy save compatibility', () => {
  it('discards retired worker and timer state from serialization', () => {
    const system = new DecomposeSystem(new MaterialBag())
    system.restore({
      settings: { gradeFilter: 'all', ageFilter: 'decade', workers: 4 },
      nextCycleAt: 9_000_000,
      started: true,
    })

    expect(system.getSaveState()).toEqual({})
    expect(system.restore(undefined)).toBeUndefined()
    expect(system.getSaveState()).toEqual({})
  })

  it('ignores malformed legacy timing and worker values without creating authority', () => {
    const system = new DecomposeSystem(new MaterialBag())
    expect(() => system.restore({
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: Number.NaN },
      nextCycleAt: Number.NaN,
      started: true,
    })).not.toThrow()
    expect(system.getSaveState()).toEqual({})
  })

  it('keeps inventory and delivery inert across repeated hostile restores, then allows one explicit instant exchange', () => {
    const bag = new MaterialBag()
    const oreId = 'material_spirit_ore_decade'
    const ore = materials.find((entry) => entry.id === oreId)!
    bag.add(ore, 12)
    const onEssenceProduced = vi.fn()
    const system = new DecomposeSystem(bag, { onEssenceProduced })
    const before = structuredClone(bag.getAll())
    const legacy = {
      settings: { gradeFilter: 'tien_pham', ageFilter: 'myriad_year', workers: 99 },
      nextCycleAt: Number.MAX_SAFE_INTEGER,
      started: true,
    }

    for (const clock of [0, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER]) {
      system.restore(legacy, clock)
      system.restore(system.getSaveState(), clock)
      expect(system.getSaveState()).toEqual({})
      expect(bag.getAll()).toEqual(before)
      expect(onEssenceProduced).not.toHaveBeenCalled()
    }

    const detached = system.getSaveState()
    detached.settings = legacy.settings
    detached.nextCycleAt = legacy.nextCycleAt
    detached.started = true
    expect(system.getSaveState()).toEqual({})
    expect(JSON.parse(JSON.stringify(system.getSaveState()))).toEqual({})

    expect(system.decomposeOre(oreId, 12)).toMatchObject({ ok: true, consumed: 12, produced: 2 })
    expect(bag.getAmount(oreId)).toBe(0)
    expect(bag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(2)
    expect(onEssenceProduced).toHaveBeenCalledExactlyOnceWith(LUYEN_KHI_TINH_HOA_ID, 2, expect.objectContaining({ producer: 'inventory', payload: { kind: 'material_delivered', materialId: LUYEN_KHI_TINH_HOA_ID, delivered: 2 } }))
    system.restore(legacy, 0)
    expect(bag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(2)
    expect(onEssenceProduced).toHaveBeenCalledTimes(1)
    expect(system.getSaveState()).toEqual({})
  })
})
