// Instant Decompose tests cover atomic conversion, persisted legacy inertness, and the visible read model.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import { DecomposeSystem, parseOre } from './DecomposeSystem'
import { MaterialBag } from '../material/MaterialBag'
import { materials } from '../../data/materials/materials'
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'

let bag: MaterialBag

function addOre(id: string, amount: number): void {
  const material = materials.find((entry) => entry.id === id)
  if (!material) throw new Error(`materials fixture missing ${id}`)
  bag.add(material, amount)
}

beforeEach(() => { bag = new MaterialBag() })

describe('DecomposeSystem — immediate ore command', () => {
  it('converts the selected amount with authored grade/age rate and notifies only after commit', () => {
    addOre('mortal_ore_decade', 4)
    const onEssenceProduced = vi.fn()
    const system = new DecomposeSystem(bag, { onEssenceProduced })

    expect(system.previewDecomposeOre('mortal_ore_decade', 4)).toEqual({
      ok: true,
      materialId: LUYEN_KHI_TINH_HOA_ID,
      consumed: 4,
      produced: 2,
    })
    expect(system.decomposeOre('mortal_ore_decade', 4)).toEqual({
      ok: true,
      materialId: LUYEN_KHI_TINH_HOA_ID,
      consumed: 4,
      produced: 2,
    })
    expect(bag.getAmount('mortal_ore_decade')).toBe(0)
    expect(bag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(2)
    expect(onEssenceProduced).toHaveBeenCalledTimes(1)
    expect(onEssenceProduced).toHaveBeenCalledWith(LUYEN_KHI_TINH_HOA_ID, 2)
  })

  it('uses floor conversion so splitting requests cannot increase output', () => {
    const batchedBag = new MaterialBag()
    const splitBag = new MaterialBag()
    const oreId = 'qi_refining_ore_decade'
    const ore = materials.find((entry) => entry.id === oreId)!
    batchedBag.add(ore, 4)
    splitBag.add(ore, 4)

    const batched = new DecomposeSystem(batchedBag).decomposeOre(oreId, 4)
    const splitSystem = new DecomposeSystem(splitBag)
    const splitFirst = splitSystem.decomposeOre(oreId, 2)
    const splitSecond = splitSystem.decomposeOre(oreId, 2)

    expect(batched).toMatchObject({ ok: true, produced: 3 })
    expect(splitFirst).toMatchObject({ ok: true, produced: 1 })
    expect(splitSecond).toMatchObject({ ok: true, produced: 1 })
    expect(splitBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBeLessThanOrEqual(
      batchedBag.getAmount(LUYEN_KHI_TINH_HOA_ID),
    )
  })

  it('refuses a sub-unit yield without consuming ore', () => {
    addOre('mortal_ore_decade', 1)
    const system = new DecomposeSystem(bag)

    expect(system.decomposeOre('mortal_ore_decade', 1)).toEqual({ ok: false, reason: 'insufficient_amount' })
    expect(bag.getAmount('mortal_ore_decade')).toBe(1)
    expect(bag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(0)
  })

  it('refuses output overflow before consuming any ore', () => {
    addOre('mortal_ore_decade', 4)
    const essence = materials.find((entry) => entry.id === LUYEN_KHI_TINH_HOA_ID)!
    bag.add(essence, (essence.stackLimit ?? 999_999) - 1)
    const system = new DecomposeSystem(bag)

    expect(system.decomposeOre('mortal_ore_decade', 4)).toEqual({ ok: false, reason: 'output_capacity' })
    expect(bag.getAmount('mortal_ore_decade')).toBe(4)
    expect(bag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe((essence.stackLimit ?? 999_999) - 1)
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid amount %s without mutation',
    (amount) => {
      addOre('mortal_ore_decade', 4)
      const system = new DecomposeSystem(bag)
      expect(system.decomposeOre('mortal_ore_decade', amount)).toEqual({ ok: false, reason: 'invalid_amount' })
      expect(bag.getAmount('mortal_ore_decade')).toBe(4)
      expect(bag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(0)
    },
  )

  it('rejects invalid ore and insufficient stock without producing essence', () => {
    addOre('mortal_ore_decade', 1)
    const system = new DecomposeSystem(bag)
    expect(system.decomposeOre(LUYEN_KHI_TINH_HOA_ID, 1)).toEqual({ ok: false, reason: 'invalid_ore' })
    expect(system.decomposeOre('mortal_ore_decade', 2)).toEqual({ ok: false, reason: 'insufficient_ore' })
    expect(bag.getAmount('mortal_ore_decade')).toBe(1)
    expect(bag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(0)
  })

  it('lists detached ore-only snapshots', () => {
    addOre('mortal_ore_decade', 3)
    bag.add(materials.find((entry) => entry.id === LUYEN_KHI_TINH_HOA_ID)!, 8)
    const system = new DecomposeSystem(bag)
    const rows = system.getAvailableOres()
    rows[0]!.amount = 100
    expect(rows).toEqual([{ materialId: 'mortal_ore_decade', amount: 100 }])
    expect(system.getAvailableOres()).toEqual([{ materialId: 'mortal_ore_decade', amount: 3 }])
  })

  it('keeps old save settings/timers inert across restore and serialization', () => {
    const system = new DecomposeSystem(bag)
    system.restore({
      settings: { gradeFilter: 'tien_pham', ageFilter: 'myriad_year', workers: 99 },
      nextCycleAt: 123_456,
      started: true,
    })
    expect(system.getSaveState()).toEqual({
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: 0,
      started: false,
    })
  })
})

describe('parseOre', () => {
  it('parses authored ore IDs only', () => {
    expect(parseOre('mortal_ore_decade')).toEqual({ grade: 'cuu_pham', age: 'decade' })
    expect(parseOre('unregistered_ore_decade')).toBeNull()
    expect(parseOre('mortal_wood_decade')).toBeNull()
  })
})
