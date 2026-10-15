// Instant Decompose tests cover atomic conversion, persisted legacy inertness, and the visible read model.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import { DECOMPOSE_OUTPUT_BY_FAMILY, DecomposeSystem, parseOre } from './DecomposeSystem'
import { MaterialBag } from '../material/MaterialBag'
import { materials } from '../../data/materials/materials'
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'

let bag: MaterialBag
let delivered: Array<{ materialId: string; amount: number }>

function addOre(id: string, amount: number): void {
  const material = materials.find((entry) => entry.id === id)
  if (!material) throw new Error(`materials fixture missing ${id}`)
  bag.add(material, amount)
}

beforeEach(() => { bag = new MaterialBag() })

describe('DecomposeSystem — immediate ore command', () => {
  it('converts the selected amount with authored grade/age rate and notifies only after commit', () => {
    addOre('material_spirit_ore_decade', 12)
    const onEssenceProduced = vi.fn()
    const system = new DecomposeSystem(bag, { onEssenceProduced })

    expect(system.previewDecomposeOre('material_spirit_ore_decade', 12)).toEqual({
      ok: true,
      materialId: LUYEN_KHI_TINH_HOA_ID,
      consumed: 12,
      produced: 2,
    })
    expect(system.decomposeOre('material_spirit_ore_decade', 12)).toEqual({
      ok: true,
      materialId: LUYEN_KHI_TINH_HOA_ID,
      consumed: 12,
      produced: 2,
    })
    expect(bag.getAmount('material_spirit_ore_decade')).toBe(0)
    expect(bag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(2)
    expect(onEssenceProduced).toHaveBeenCalledTimes(1)
    expect(onEssenceProduced).toHaveBeenCalledWith(LUYEN_KHI_TINH_HOA_ID, 2, expect.objectContaining({ producer: 'inventory', payload: { kind: 'material_delivered', materialId: LUYEN_KHI_TINH_HOA_ID, delivered: 2 } }))
  })
  it('uses floor conversion so splitting requests cannot increase output', () => {
    const batchedBag = new MaterialBag()
    const splitBag = new MaterialBag()
    const oreId = 'material_spirit_ore_decade'
    const ore = materials.find((entry) => entry.id === oreId)!
    batchedBag.add(ore, 12)
    splitBag.add(ore, 12)

    const batched = new DecomposeSystem(batchedBag).decomposeOre(oreId, 12)
    const splitSystem = new DecomposeSystem(splitBag)
    const splitFirst = splitSystem.decomposeOre(oreId, 6)
    const splitSecond = splitSystem.decomposeOre(oreId, 6)

    expect(batched).toMatchObject({ ok: true, produced: 2 })
    expect(splitFirst).toMatchObject({ ok: true, produced: 1 })
    expect(splitSecond).toMatchObject({ ok: true, produced: 1 })
    expect(splitBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBeLessThanOrEqual(
      batchedBag.getAmount(LUYEN_KHI_TINH_HOA_ID),
    )
  })

  it('refuses a sub-unit yield without consuming ore', () => {
    addOre('material_spirit_ore_decade', 1)
    const system = new DecomposeSystem(bag)

    expect(system.decomposeOre('material_spirit_ore_decade', 1)).toEqual({ ok: false, reason: 'insufficient_amount' })
    expect(bag.getAmount('material_spirit_ore_decade')).toBe(1)
    expect(bag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(0)
  })

  it('refuses output overflow before consuming any ore', () => {
    addOre('material_spirit_ore_decade', 12)
    const essence = materials.find((entry) => entry.id === LUYEN_KHI_TINH_HOA_ID)!
    bag.add(essence, (essence.stackLimit ?? 999_999) - 1)
    const system = new DecomposeSystem(bag)

    expect(system.decomposeOre('material_spirit_ore_decade', 12)).toEqual({ ok: false, reason: 'output_capacity' })
    expect(bag.getAmount('material_spirit_ore_decade')).toBe(12)
    expect(bag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe((essence.stackLimit ?? 999_999) - 1)
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid amount %s without mutation',
    (amount) => {
      addOre('material_spirit_ore_decade', 12)
      const system = new DecomposeSystem(bag)
      expect(system.decomposeOre('material_spirit_ore_decade', amount)).toEqual({ ok: false, reason: 'invalid_amount' })
      expect(bag.getAmount('material_spirit_ore_decade')).toBe(12)
      expect(bag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(0)
    },
  )

  it('rejects invalid ore and insufficient stock without producing essence', () => {
    addOre('material_spirit_ore_decade', 1)
    const system = new DecomposeSystem(bag)
    expect(system.decomposeOre(LUYEN_KHI_TINH_HOA_ID, 1)).toEqual({ ok: false, reason: 'invalid_ore' })
    expect(system.decomposeOre('material_spirit_ore_decade', 2)).toEqual({ ok: false, reason: 'insufficient_ore' })
    expect(bag.getAmount('material_spirit_ore_decade')).toBe(1)
    expect(bag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(0)
  })

  it('applies the same /6 floor to authored ore, wood, and herb families', () => {
    const ids = [
      'material_spirit_ore_decade',
      'material_spirit_wood_decade',
      materials.find((entry) => entry.profession?.resourceKind === 'herb' && entry.profession.realmId === 'mortal' && entry.profession.age === 'decade')!.id,
    ]
    for (const id of ids) {
      const material = materials.find((entry) => entry.id === id)!
      bag.add(material, 12)
    }
    const system = new DecomposeSystem(bag)

    expect(system.previewDecompose(ids)).toEqual([
      { materialId: DECOMPOSE_OUTPUT_BY_FAMILY.ore, minAmount: 2, maxAmount: 2 },
      { materialId: DECOMPOSE_OUTPUT_BY_FAMILY.wood, minAmount: 2, maxAmount: 2 },
      { materialId: DECOMPOSE_OUTPUT_BY_FAMILY.herb, minAmount: 2, maxAmount: 2 },
    ])
    expect(system.decompose(ids)).toBe(true)
    for (const id of ids) expect(bag.getAmount(id)).toBe(0)
    for (const output of Object.values(DECOMPOSE_OUTPUT_BY_FAMILY)) expect(bag.getAmount(output)).toBe(2)
  })

  it('generic decomposition credits outputs through the production bag path', () => {
    addOre('material_spirit_ore_decade', 12)
    const onEssenceProduced = vi.fn()
    const system = new DecomposeSystem(bag, { onEssenceProduced })

    expect(system.previewDecompose(['material_spirit_ore_decade'])).toEqual([
      { materialId: LUYEN_KHI_TINH_HOA_ID, minAmount: 2, maxAmount: 2 },
    ])
    expect(system.decompose(['material_spirit_ore_decade'])).toBe(true)
    expect(bag.getAmount('material_spirit_ore_decade')).toBe(0)
    expect(bag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(2)
    expect(onEssenceProduced).toHaveBeenCalledTimes(1)
    expect(onEssenceProduced).toHaveBeenCalledWith(LUYEN_KHI_TINH_HOA_ID, 2, expect.objectContaining({ producer: 'inventory', payload: { kind: 'material_delivered', materialId: LUYEN_KHI_TINH_HOA_ID, delivered: 2 } }))
  })

  it('generic output adapter receives credit once and capacity failure preserves inputs', () => {
    addOre('material_spirit_ore_decade', 12)
    const adapter = vi.fn()
    const adaptedSystem = new DecomposeSystem(bag, { deliverOutput: adapter })
    expect(adaptedSystem.decompose(['material_spirit_ore_decade'])).toBe(true)
    expect(adapter).toHaveBeenCalledTimes(1)
    expect(adapter).toHaveBeenCalledWith({ materialId: LUYEN_KHI_TINH_HOA_ID, amount: 2 })
    expect(bag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(0)

    const capacityBag = new MaterialBag()
    const ore = materials.find((entry) => entry.id === 'material_spirit_ore_decade')!
    const essence = materials.find((entry) => entry.id === LUYEN_KHI_TINH_HOA_ID)!
    capacityBag.add(ore, 12)
    capacityBag.add(essence, (essence.stackLimit ?? 999_999) - 1)
    const capacitySystem = new DecomposeSystem(capacityBag)
    expect(capacitySystem.decompose(['material_spirit_ore_decade'])).toBe(false)
    expect(capacityBag.getAmount('material_spirit_ore_decade')).toBe(12)
  })

  it('lists detached ore-only snapshots', () => {
    addOre('material_spirit_ore_decade', 3)
    bag.add(materials.find((entry) => entry.id === LUYEN_KHI_TINH_HOA_ID)!, 8)
    const system = new DecomposeSystem(bag)
    const rows = system.getAvailableOres()
    rows[0]!.amount = 100
    expect(rows).toEqual([{ materialId: 'material_spirit_ore_decade', amount: 100 }])
    expect(system.getAvailableOres()).toEqual([{ materialId: 'material_spirit_ore_decade', amount: 3 }])
  })

  it('keeps old save settings/timers inert across restore and serialization', () => {
    const system = new DecomposeSystem(bag)
    system.restore({
      settings: { gradeFilter: 'tien_pham', ageFilter: 'myriad_year', workers: 99 },
      nextCycleAt: 123_456,
      started: true,
    })
    expect(system.getSaveState()).toEqual({})
  })
})

describe('parseOre', () => {
  it('parses authored ore IDs only', () => {
    expect(parseOre('material_spirit_ore_decade')).toEqual({ grade: 'cuu_pham', age: 'decade' })
    expect(parseOre('unregistered_ore_decade')).toBeNull()
    expect(parseOre('material_spirit_wood_decade')).toBeNull()
  })
})

describe('repeated mixed decomposition', () => {
  it('keeps sub-unit herbs inert until replenished and allows the next conversion', () => {
    const herbId = 'hoi_linh_thao_mortal_decade'
    addOre('material_spirit_ore_decade', 6)
    addOre(herbId, 5)
    const system = new DecomposeSystem(bag)
    expect(system.listDecomposableIds()).toEqual(['material_spirit_ore_decade'])
    expect(system.decomposeWithResult(['material_spirit_ore_decade', herbId])).toEqual({ ok: true })
    expect(bag.getAmount(herbId)).toBe(5)
    expect(system.listDecomposableIds()).toEqual([])
    expect(system.decomposeWithResult([herbId])).toEqual({ ok: false, reason: 'insufficient_amount' })
    expect(bag.getAmount(herbId)).toBe(5)
    addOre(herbId, 1)
    expect(system.listDecomposableIds()).toEqual([herbId])
    expect(system.decomposeWithResult([herbId])).toEqual({ ok: true })
    expect(bag.getAmount(herbId)).toBe(0)
    expect(bag.getAmount(DECOMPOSE_OUTPUT_BY_FAMILY.herb)).toBe(1)
  })

  it('reports capacity rejection without consuming any selected stack', () => {
    addOre('material_spirit_ore_decade', 12)
    const essence = materials.find((entry) => entry.id === LUYEN_KHI_TINH_HOA_ID)!
    bag.add(essence, essence.stackLimit ?? 999_999)
    expect(new DecomposeSystem(bag).decomposeWithResult(['material_spirit_ore_decade'])).toEqual({ ok: false, reason: 'output_capacity' })
    expect(bag.getAmount('material_spirit_ore_decade')).toBe(12)
  })
})
