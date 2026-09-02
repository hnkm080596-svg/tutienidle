import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import type { StatModifier } from '@/core/stats/StatCalculator'

// Task 5 (perf-optimize-pass, Phase 2) — dirty-check của
// setExternalModifiers. App.vue gọi hàm này mỗi tick (10Hz) với mảng
// MỚI; gán reference mới mỗi lần làm getter `finalStats` recompute vô
// ích. Test này khóa CẢ HAI mặt: (a) bỏ qua khi nội dung trùng, (b)
// KHÔNG bỏ sót thay đổi thật (kể cả khi nguồn mutate tại chỗ).
function attackModifier(id: string, flat: number): StatModifier {
  return {
    id,
    sourceId: id,
    sourceType: 'buff',
    stat: 'attack',
    flat,
  }
}

describe('player store — setExternalModifiers dirty-check', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('nội dung trùng → GIỮ NGUYÊN reference cũ, finalStats không recompute', () => {
    const store = usePlayerStore()

    store.setExternalModifiers([attackModifier('buff:attack', 42)])

    const appliedArray = store.externalModifiers
    const statsBefore = store.finalStats

    store.setExternalModifiers([attackModifier('buff:attack', 42)])

    // Reference mảng state không đổi → getter computed vẫn cache.
    expect(store.externalModifiers).toBe(appliedArray)
    expect(store.finalStats).toBe(statsBefore)
  })

  it('đổi bất kỳ field nào (flat/percent/stacks/tag/id) → gán lại, finalStats cập nhật', () => {
    const store = usePlayerStore()

    store.setExternalModifiers([attackModifier('buff:attack', 42)])

    const baseline = store.finalStats.attack

    store.setExternalModifiers([attackModifier('buff:attack', 43)])

    expect(store.finalStats.attack).toBe(baseline + 1)

    // Field không phải flat cũng phải phá chữ ký.
    const withStacks: StatModifier = { ...attackModifier('buff:attack', 43), stacks: 2 }

    store.setExternalModifiers([withStacks])

    expect(store.externalModifiers[0]!.stacks).toBe(2)
  })

  it('thêm/bớt entry (cùng length khác thứ tự cũng vậy) → gán lại', () => {
    const store = usePlayerStore()

    store.setExternalModifiers([attackModifier('a', 10), attackModifier('b', 20)])

    const before = store.finalStats.attack

    store.setExternalModifiers([attackModifier('a', 10)])

    expect(store.finalStats.attack).toBe(before - 20)

    // Đổi thứ tự (cùng số lượng, cùng tập entry) vẫn coi là khác.
    store.setExternalModifiers([attackModifier('a', 10), attackModifier('b', 20)])

    const applied = store.externalModifiers

    store.setExternalModifiers([attackModifier('b', 20), attackModifier('a', 10)])

    expect(store.externalModifiers).not.toBe(applied)
  })

  it('nguồn mutate TẠI CHỖ chính object modifier cũ → vẫn phát hiện (chữ ký snapshot theo giá trị)', () => {
    const store = usePlayerStore()

    // Mô phỏng BuffSystem trả về CÙNG object mỗi tick rồi tự đổi giá trị
    // bên trong — deep-compare với state sẽ bỏ sót vì hai bên cùng object.
    const shared = attackModifier('buff:attack', 42)

    store.setExternalModifiers([shared])

    const before = store.finalStats.attack

    shared.flat = 100

    store.setExternalModifiers([shared])

    expect(store.finalStats.attack).toBe(before - 42 + 100)
  })

  it('state bị thay từ nơi khác ($patch/load) → lần gán kế tiếp không bị chữ ký cũ chặn nhầm', () => {
    const store = usePlayerStore()

    store.setExternalModifiers([attackModifier('buff:attack', 42)])

    const withBuff = store.finalStats.attack

    // Ví dụ load save / reset: state thay mảng khác mà không qua action.
    store.$patch({ externalModifiers: [] })

    expect(store.finalStats.attack).toBeCloseTo(withBuff - 42, 6)

    // Tick kế tiếp gửi lại ĐÚNG nội dung cũ — phải gán lại thật.
    store.setExternalModifiers([attackModifier('buff:attack', 42)])

    expect(store.finalStats.attack).toBeCloseTo(withBuff, 6)
  })
})
