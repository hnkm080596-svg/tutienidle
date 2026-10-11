// @vitest-environment node
// Task 14 (rework P4, spec sec5.6) - DecomposeSystem: tab Phan Giai -
// phan giai Linh Khoang thanh Luyen Khi Tinh Hoa.
//
// DIRECT REWORK (2026-10-11): worker-cycle engine retired - direct
// multi-select action mirror Hoa Luyen trang bi. Suite nay pin:
//   yield(stack) = ceil(amount/6 x base(grade) x 2^ageIndex) (balance pass 2026-10-11)
//   base(grade) = 1 + gradeIndex x 0.5 (Cuu 1.0 -> Tien 5.5)
//   he so tuoi = 2^ageIndex (decade 1 -> thuong_co 16)
import { describe, expect, it, beforeEach, vi } from 'vitest'

// BETA SCOPE LOCK v2 Phase-5 - this suite exercises the scope-hidden
// system's ENABLED implementation (sec.11-15: dormant, not deleted).
// The flag is toggleable so the fail-closed arm is covered too.
const scope = vi.hoisted(() => ({ hidden: false }))

vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => scope.hidden,
}))

import { DecomposeSystem } from './DecomposeSystem'
import { MaterialBag } from '../material/MaterialBag'
import { materials } from '../../data/materials/materials'
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'

let bag: MaterialBag
let delivered: Array<{ materialId: string; amount: number }>

function createSystem(): DecomposeSystem {
  return new DecomposeSystem(bag, {
    deliverOutput: (entry) => {
      delivered.push(entry)
    },
  })
}

function addOre(id: string, amount: number): void {
  const material = materials.find((entry) => entry.id === id)

  if (!material) {
    throw new Error(`materials fixture thiếu ${id}`)
  }

  bag.add(material, amount)
}

beforeEach(() => {
  bag = new MaterialBag()
  delivered = []
  scope.hidden = false
})

describe('DecomposeSystem — listDecomposableIds (direct rework)', () => {
  it('liet ke moi stack phan giai duoc con stock; bo qua stack ngoai', () => {
    addOre('mortal_ore_decade', 40)
    addOre('qi_refining_ore_century', 5)
    addOre('luyen_khi_tinh_hoa', 10) // output id khong tu phan giai

    const system = createSystem()

    expect(system.listDecomposableIds()).toEqual(
      expect.arrayContaining(['mortal_ore_decade', 'qi_refining_ore_century']),
    )
    expect(system.listDecomposableIds()).not.toContain('luyen_khi_tinh_hoa')
    expect(system.listDecomposableIds()).toHaveLength(2)
  })

  it('tui rong -> []', () => {
    expect(createSystem().listDecomposableIds()).toEqual([])
  })

  it('scope-hidden -> [] (fail closed)', () => {
    addOre('mortal_ore_decade', 10)
    scope.hidden = true

    expect(createSystem().listDecomposableIds()).toEqual([])
  })
})

describe('DecomposeSystem — previewDecompose (direct rework)', () => {
  it('quote tong tinh hoa theo cong thuc; khong dot khoang, khong mutate', () => {
    addOre('mortal_ore_decade', 100) // base 1 x ageFactor 1 -> ceil(100/6) = 17

    const system = createSystem()

    expect(system.previewDecompose(['mortal_ore_decade'])).toEqual([
      { materialId: LUYEN_KHI_TINH_HOA_ID, minAmount: 17, maxAmount: 17 },
    ])
    expect(bag.getAmount('mortal_ore_decade')).toBe(100)
  })

  it('cong don nhieu stack; bo qua id ngoai/het hang', () => {
    addOre('mortal_ore_decade', 10) // ceil(10/6 x 1 x 1) = 2
    addOre('tribulation_ore_decade', 4) // ceil(4/6 x 5.5 x 1) = 4

    const system = createSystem()

    expect(
      system.previewDecompose(['mortal_ore_decade', 'tribulation_ore_decade', 'luyen_khi_tinh_hoa', 'ghost_id']),
    ).toEqual([{ materialId: LUYEN_KHI_TINH_HOA_ID, minAmount: 6, maxAmount: 6 }])
  })

  it('grade/age factor: mortal millennium (base 1 x 4) 100 -> 67', () => {
    addOre('mortal_ore_millennium', 100)

    expect(createSystem().previewDecompose(['mortal_ore_millennium'])).toEqual([
      { materialId: LUYEN_KHI_TINH_HOA_ID, minAmount: 67, maxAmount: 67 },
    ])
  })

  it('ids rong / toan id ngoai -> []', () => {
    addOre('mortal_ore_decade', 10)

    const system = createSystem()

    expect(system.previewDecompose([])).toEqual([])
    expect(system.previewDecompose(['luyen_khi_tinh_hoa'])).toEqual([])
  })

  it('scope-hidden -> [] (fail closed)', () => {
    addOre('mortal_ore_decade', 10)
    scope.hidden = true

    expect(createSystem().previewDecompose(['mortal_ore_decade'])).toEqual([])
  })
})

describe('DecomposeSystem — decompose (direct rework)', () => {
  it('dot nguyen stack, credit tinh hoa qua deliverOutput, tra true', () => {
    addOre('mortal_ore_decade', 100)

    const system = createSystem()

    expect(system.decompose(['mortal_ore_decade'])).toBe(true)
    expect(bag.getAmount('mortal_ore_decade')).toBe(0)
    expect(delivered).toEqual([{ materialId: LUYEN_KHI_TINH_HOA_ID, amount: 17 }])
  })

  it('preview khop commit: cung mot cong thuc cho quote va dot', () => {
    addOre('qi_refining_ore_century', 7) // base 1.5 x af 2 -> ceil(7/6 x 3) = ceil(3.5) = 4

    const system = createSystem()
    const preview = system.previewDecompose(['qi_refining_ore_century'])

    expect(system.decompose(['qi_refining_ore_century'])).toBe(true)
    expect(delivered).toEqual([
      { materialId: LUYEN_KHI_TINH_HOA_ID, amount: preview[0]!.minAmount },
    ])
    expect(preview[0]!.minAmount).toBe(4)
  })

  it('nhieu stack mot lan: dot het, tinh hoa cong don 1 delivery', () => {
    addOre('mortal_ore_decade', 10) // 2
    addOre('tribulation_ore_decade', 4) // 4

    const system = createSystem()

    expect(system.decompose(['mortal_ore_decade', 'tribulation_ore_decade'])).toBe(true)
    expect(bag.getAmount('mortal_ore_decade')).toBe(0)
    expect(bag.getAmount('tribulation_ore_decade')).toBe(0)
    expect(delivered).toEqual([{ materialId: LUYEN_KHI_TINH_HOA_ID, amount: 6 }])
  })

  it('id trung lap chi dot mot lan (dedupe)', () => {
    addOre('mortal_ore_decade', 10)

    const system = createSystem()

    expect(system.decompose(['mortal_ore_decade', 'mortal_ore_decade'])).toBe(true)
    expect(delivered).toEqual([{ materialId: LUYEN_KHI_TINH_HOA_ID, amount: 2 }])
  })

  it('ids rong / toan id ngoai -> false, khong mutate, khong delivery', () => {
    addOre('mortal_ore_decade', 10)

    const system = createSystem()

    expect(system.decompose([])).toBe(false)
    expect(system.decompose(['luyen_khi_tinh_hoa', 'ghost_id'])).toBe(false)
    expect(bag.getAmount('mortal_ore_decade')).toBe(10)
    expect(delivered).toEqual([])
  })

  it('stack da bi lay het -> false (foreign ids khong lot qua)', () => {
    addOre('mortal_ore_decade', 10)

    const system = createSystem()

    expect(system.decompose(['mortal_ore_decade'])).toBe(true)
    // Lan hai: stack da het -> khong con gi de phan giai.
    expect(system.decompose(['mortal_ore_decade'])).toBe(false)
    expect(delivered).toHaveLength(1)
  })

  it('scope-hidden -> false, khong dot khoang (fail closed)', () => {
    addOre('mortal_ore_decade', 10)
    scope.hidden = true

    const system = createSystem()

    expect(system.decompose(['mortal_ore_decade'])).toBe(false)
    expect(bag.getAmount('mortal_ore_decade')).toBe(10)
    expect(delivered).toEqual([])
  })

  it('khong deliverOutput callback (standalone) van dot stack, tra true', () => {
    addOre('mortal_ore_decade', 10)

    const system = new DecomposeSystem(bag)

    expect(system.decompose(['mortal_ore_decade'])).toBe(true)
    expect(bag.getAmount('mortal_ore_decade')).toBe(0)
  })
})

describe('DecomposeSystem — save slice (direct rework)', () => {
  it('getSaveState tra {} - direct decompose khong persist gi', () => {
    expect(createSystem().getSaveState()).toEqual({})
  })

  it('restore(payload legacy) accept-and-ignore: khong crash, khong revive worker state', () => {
    addOre('mortal_ore_decade', 10)

    const system = createSystem()

    expect(() =>
      system.restore({
        settings: { workers: 5, gradeFilter: 'cuu_pham', ageFilter: 'decade' },
        nextCycleAt: 123_456,
        started: true,
      }),
    ).not.toThrow()

    // Worker state khong hoi sinh: direct action hoat dong binh thuong,
    // khong co cycle nao chay ngam sau restore.
    expect(system.decompose(['mortal_ore_decade'])).toBe(true)
    expect(delivered).toEqual([{ materialId: LUYEN_KHI_TINH_HOA_ID, amount: 2 }])
  })

  it('restore(undefined) khong crash (slice vang)', () => {
    expect(() => createSystem().restore(undefined)).not.toThrow()
  })
})

// Materials economy rework (2026-10-11, owner-locked spec) - 3 nhanh
// output: ore -> luyen_khi_tinh_hoa, wood -> bui_go, herb ->
// luyen_dan_tinh_hoa. Moi output mot id duy nhat (khong variant
// realm/age); yield van = ceil(amount/6 x base x ageFactor).
describe('DecomposeSystem — rework vat lieu 3 nhanh (ore/wood/herb)', () => {
  it('listDecomposableIds tra ve ore + wood + herb, loai output id', () => {
    addOre('mortal_ore_decade', 10)
    addOre('mortal_wood_decade', 10)
    addOre('tu_linh_thao_mortal_decade', 8)
    addOre('bui_go', 99)
    addOre('luyen_dan_tinh_hoa', 99)
    addOre('luyen_khi_tinh_hoa', 99)

    const ids = createSystem().listDecomposableIds()

    expect(ids).toContain('mortal_ore_decade')
    expect(ids).toContain('mortal_wood_decade')
    expect(ids).toContain('tu_linh_thao_mortal_decade')
    // Output materials (va vat lieu khong theo grammar) khong tu phan giai.
    expect(ids).not.toContain('bui_go')
    expect(ids).not.toContain('luyen_dan_tinh_hoa')
    expect(ids).not.toContain('luyen_khi_tinh_hoa')
  })

  it('previewDecompose gom output theo dung id tung nhanh (mortal/decade: base 1, factor 1)', () => {
    addOre('mortal_ore_decade', 10)
    addOre('mortal_wood_decade', 10)
    addOre('tu_linh_thao_mortal_decade', 8)

    const preview = createSystem().previewDecompose([
      'mortal_ore_decade',
      'mortal_wood_decade',
      'tu_linh_thao_mortal_decade',
    ])

    expect(preview).toEqual([
      { materialId: 'luyen_khi_tinh_hoa', minAmount: 2, maxAmount: 2 },
      { materialId: 'bui_go', minAmount: 2, maxAmount: 2 },
      { materialId: 'luyen_dan_tinh_hoa', minAmount: 2, maxAmount: 2 },
    ])

    // Preview read-only - tui khong doi.
    expect(bag.getAmount('mortal_wood_decade')).toBe(10)
  })

  it('decompose tieu thu stack va deliver mot entry moi nhanh output', () => {
    addOre('mortal_ore_decade', 10)
    addOre('mortal_wood_decade', 10)
    addOre('tu_linh_thao_mortal_decade', 8)

    const system = createSystem()

    expect(system.decompose(['mortal_ore_decade', 'mortal_wood_decade', 'tu_linh_thao_mortal_decade'])).toBe(true)

    expect(bag.getAmount('mortal_ore_decade')).toBe(0)
    expect(bag.getAmount('mortal_wood_decade')).toBe(0)
    expect(bag.getAmount('tu_linh_thao_mortal_decade')).toBe(0)
    expect(delivered).toEqual([
      { materialId: 'luyen_khi_tinh_hoa', amount: 2 },
      { materialId: 'bui_go', amount: 2 },
      { materialId: 'luyen_dan_tinh_hoa', amount: 2 },
    ])
  })

  it('decompose(ids) chi dot stack duoc chon', () => {
    addOre('mortal_wood_decade', 10)
    addOre('tu_linh_thao_mortal_decade', 8)

    const system = createSystem()

    expect(system.decompose(['mortal_wood_decade'])).toBe(true)

    expect(delivered).toEqual([{ materialId: 'bui_go', amount: 2 }])
    expect(bag.getAmount('tu_linh_thao_mortal_decade')).toBe(8)
  })

  it('herb thieu realm/age hop le trong metadata -> khong phan giai duoc', () => {
    const orphanHerb = materials.find((entry) => entry.id === 'tu_linh_thao_mortal_decade')

    if (!orphanHerb) {
      throw new Error('materials fixture thieu herb')
    }

    // Metadata thieu realm -> classify fail-closed (spec: khong suy doan).
    bag.add({ ...orphanHerb, profession: { ...orphanHerb.profession!, realmId: 'khong_ton_tai' } }, 10)

    const system = createSystem()

    expect(system.listDecomposableIds()).toEqual([])
    expect(system.decompose(['tu_linh_thao_mortal_decade'])).toBe(false)
  })
})
