// @vitest-environment node
// Task 14 (rework P4, spec §5.6) — DecomposeSystem: tab Phân Giải —
// phân giải Linh Khoáng thành Luyện Khí Tinh Hoa.
//
// Công thức (spec-khóa, tuning sau playtest):
//   output/lượt = base(grade) × hệ_số(quality) × workers
//   base(grade) = 1 + gradeIndex × 0.5 (Cửu 1.0 → Tiên 5.5)
//   hệ_số chất = 2^qualityIndex (Hoang 1 → Tiên 16)
//   khoáng tiêu thụ mỗi cycle = min(workers × 2, owned) stacks khớp filter
//   cycle 30s; workers 0 → không chạy; workers clamp theo capacity.
import { describe, expect, it, beforeEach } from 'vitest'
import { DecomposeSystem } from './DecomposeSystem'
import { MaterialBag } from '../material/MaterialBag'
import { materials } from '../../data/materials/materials'
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'

let bag: MaterialBag

function addOre(id: string, amount: number): void {
  const material = materials.find((entry) => entry.id === id)

  if (!material) {
    throw new Error(`materials fixture thiếu ${id}`)
  }

  bag.add(material, amount)
}

beforeEach(() => {
  bag = new MaterialBag()
})

describe('DecomposeSystem — settings (Task 14)', () => {
  it('defaults: gradeFilter/ageFilter = all, workers = 0', () => {
    const system = new DecomposeSystem(bag, { autoWorkerCapacity: 6 })

    expect(system.getSettings()).toEqual({
      gradeFilter: 'all',
      ageFilter: 'all',
      workers: 0,
    })
  })

  it('setSetting: patch một phần; workers clamp theo capacity', () => {
    const system = new DecomposeSystem(bag, { autoWorkerCapacity: 6 })

    system.setSetting({ workers: 99 })

    expect(system.getSettings().workers).toBe(6)

    system.setSetting({ gradeFilter: 'luc_pham', ageFilter: 'millennium' })

    expect(system.getSettings()).toEqual({
      gradeFilter: 'luc_pham',
      ageFilter: 'millennium',
      workers: 6,
    })
  })
})

describe('DecomposeSystem — cycle + output (Task 14)', () => {
  it('workers 0 → tick không tiêu thụ, không output', () => {
    addOre('mortal_ore_decade', 100)

    const system = new DecomposeSystem(bag, { autoWorkerCapacity: 6, cycleSeconds: 30 })

    system.tick(0)
    system.tick(30_000)

    expect(system.drainOutput()).toHaveLength(0)
    expect(bag.getAmount('mortal_ore_decade')).toBe(100)
  })

  it('chu kỳ chưa đủ → chưa output; đủ 30s → output đúng công thức (Hoang+Cửu+1 worker)', () => {
    addOre('mortal_ore_decade', 100)

    const system = new DecomposeSystem(bag, { autoWorkerCapacity: 6, cycleSeconds: 30 })

    system.setSetting({ workers: 1 })

    system.tick(0)
    system.tick(29_999)

    expect(system.drainOutput()).toHaveLength(0)

    system.tick(30_000)

    const output = system.drainOutput()

    // base(1 + 0×0.5)=1 × chất Hoang 2^0=1 × 1 worker = 1 tinh hoa/lượt.
    expect(output).toEqual([{ materialId: LUYEN_KHI_TINH_HOA_ID, amount: 1 }])
  })

  it('tuyến tính theo nhân công: Địa chất + 3 workers = 12/lượt (Cửu phẩm base 1 × chất 4 × 3)', () => {
    addOre('mortal_ore_millennium', 100)

    const system = new DecomposeSystem(bag, { autoWorkerCapacity: 6, cycleSeconds: 30 })

    system.setSetting({ workers: 3 })

    system.tick(0)
    system.tick(30_000)

    expect(system.drainOutput()).toEqual([
      { materialId: LUYEN_KHI_TINH_HOA_ID, amount: 12 },
    ])
  })

  it('phẩm cao nhân thêm: Tiên phẩm (base 5.5) + Hoang chất + 2 workers = 11', () => {
    addOre('tribulation_ore_decade', 100)

    const system = new DecomposeSystem(bag, { autoWorkerCapacity: 6, cycleSeconds: 30 })

    system.setSetting({ workers: 2 })

    system.tick(0)
    system.tick(30_000)

    // 5.5 × 1 × 2 = 11.
    expect(system.drainOutput()).toEqual([
      { materialId: LUYEN_KHI_TINH_HOA_ID, amount: 11 },
    ])
  })

  it('tiêu thụ khoáng mỗi lượt = workers × 2 (nếu đủ tồn)', () => {
    addOre('mortal_ore_decade', 100)

    const system = new DecomposeSystem(bag, { autoWorkerCapacity: 6, cycleSeconds: 30 })

    system.setSetting({ workers: 3 })

    system.tick(0)
    system.tick(30_000)

    expect(bag.getAmount('mortal_ore_decade')).toBe(100 - 6)
  })

  it('filter phẩm/chất: chỉ tiêu thụ khoáng khớp; sai filter không chạy', () => {
    addOre('mortal_ore_decade', 50)
    addOre('qi_refining_ore_century', 50)

    const system = new DecomposeSystem(bag, { autoWorkerCapacity: 6, cycleSeconds: 30 })

    system.setSetting({ workers: 1, gradeFilter: 'cuu_pham', ageFilter: 'decade' })

    system.tick(0)
    system.tick(30_000)

    // Chỉ mortal_ore_decade (Cửu phẩm/Hoang) khớp: -2 khoáng, +1 tinh hoa.
    expect(bag.getAmount('mortal_ore_decade')).toBe(48)
    expect(bag.getAmount('qi_refining_ore_century')).toBe(50)
    expect(system.drainOutput()).toEqual([{ materialId: LUYEN_KHI_TINH_HOA_ID, amount: 1 }])
  })

  it('khoáng cạn: chạy với phần lẻ còn lại — consumed thực tế quyết định output (ceil fairness)', () => {
    addOre('mortal_ore_decade', 1)

    const system = new DecomposeSystem(bag, { autoWorkerCapacity: 6, cycleSeconds: 30 })

    system.setSetting({ workers: 3 })

    system.tick(0)
    system.tick(30_000)

    // Chỉ 1 khoáng (< target 6): fullOutput = 1×1×3 = 3;
    // fairness ceil: ceil(consumed × fullOutput / target) = ceil(3/6) = 1.
    const output = system.drainOutput()

    expect(output).toHaveLength(1)
    expect(output[0]!.amount).toBe(1)
    expect(bag.getAmount('mortal_ore_decade')).toBe(0)
  })

  it('multi-cycle tích lũy qua drainOutput (drain xóa hàng đợi)', () => {
    addOre('mortal_ore_decade', 100)

    const system = new DecomposeSystem(bag, { autoWorkerCapacity: 6, cycleSeconds: 30 })

    system.setSetting({ workers: 1 })

    system.tick(0)
    system.tick(30_000)
    system.tick(60_000)

    expect(system.drainOutput()).toEqual([
      { materialId: LUYEN_KHI_TINH_HOA_ID, amount: 1 },
      { materialId: LUYEN_KHI_TINH_HOA_ID, amount: 1 },
    ])

    expect(system.drainOutput()).toHaveLength(0)
  })
})
