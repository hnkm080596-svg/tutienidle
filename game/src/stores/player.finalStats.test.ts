import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import type { StatModifier } from '@/core/stats/StatCalculator'

// Task 1 (perf-optimize-pass, Phase 0) — safety-net cho finalStats getter.
// Khóa hành vi HIỆN TẠI (không phải TDD đỏ): Task 4 sẽ đụng vào cách
// finalStats/externalModifiers recompute (liên quan stateVersion) để tối
// ưu hiệu năng — test này phải VẪN xanh sau đó, nếu đỏ nghĩa là Task 4 đã
// phá reactivity.
function attackModifier(id: string, flat: number): StatModifier {
  return {
    id,
    sourceId: id,
    sourceType: 'buff',
    stat: 'attack',
    flat,
  }
}

describe('player store — finalStats reactivity qua externalModifiers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('setExternalModifiers với giá trị mới → finalStats phản ánh ngay khi đọc lại', () => {
    const store = usePlayerStore()

    const before = store.finalStats.attack

    store.setExternalModifiers([attackModifier('buff:attack', 100)])

    const afterFirst = store.finalStats.attack

    expect(afterFirst).toBe(before + 100)

    store.setExternalModifiers([attackModifier('buff:attack', 250)])

    const afterSecond = store.finalStats.attack

    expect(afterSecond).toBe(before + 250)
    expect(afterSecond).not.toBe(afterFirst)
  })

  it('gọi setExternalModifiers hai lần liên tiếp với nội dung GIỐNG HỆT (khác object reference) → finalStats vẫn đúng cả hai lần, không throw, không NaN', () => {
    const store = usePlayerStore()

    const before = store.finalStats.attack

    // Hai mảng khác object reference nhưng nội dung y hệt — mô phỏng
    // GameManager tạo mảng mới mỗi tick dù giá trị buff không đổi.
    const firstCall = () => store.setExternalModifiers([attackModifier('buff:attack', 42)])
    const secondCall = () => store.setExternalModifiers([attackModifier('buff:attack', 42)])

    expect(firstCall).not.toThrow()

    const afterFirst = store.finalStats.attack

    expect(afterFirst).toBe(before + 42)
    expect(Number.isNaN(afterFirst)).toBe(false)

    expect(secondCall).not.toThrow()

    const afterSecond = store.finalStats.attack

    expect(afterSecond).toBe(before + 42)
    expect(Number.isNaN(afterSecond)).toBe(false)
  })
})
