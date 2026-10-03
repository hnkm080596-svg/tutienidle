import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import type { StatModifier } from '@/core/stats/StatCalculator'

// Task 1 (perf-optimize-pass, Phase 0) - safety-net cho finalStats getter.
// Khoa hanh vi HIEN TAI (khong phai TDD do): Task 4 se dung vao cach
// finalStats/externalModifiers recompute (lien quan stateVersion) de toi
// uu hieu nang - test nay phai VAN xanh sau do, neu do nghia la Task 4 da
// pha reactivity.
function attackModifier(id: string, flat: number): StatModifier {
  return {
    id,
    sourceId: id,
    sourceType: 'buff',
    stat: 'might',
    flat,
  }
}

describe('player store — finalStats reactivity qua externalModifiers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('setExternalModifiers với giá trị mới → finalStats phản ánh ngay khi đọc lại', () => {
    const store = usePlayerStore()

    const before = store.finalStats.might

    store.setExternalModifiers([attackModifier('buff:might', 100)])

    const afterFirst = store.finalStats.might

    expect(afterFirst).toBe(before + 100)

    store.setExternalModifiers([attackModifier('buff:might', 250)])

    const afterSecond = store.finalStats.might

    expect(afterSecond).toBe(before + 250)
    expect(afterSecond).not.toBe(afterFirst)
  })

  it('gọi setExternalModifiers hai lần liên tiếp với nội dung GIỐNG HỆT (khác object reference) → finalStats vẫn đúng cả hai lần, không throw, không NaN', () => {
    const store = usePlayerStore()

    const before = store.finalStats.might

    // Hai mang khac object reference nhung noi dung y het - mo phong
    // GameManager tao mang moi moi tick du gia tri buff khong doi.
    const firstCall = () => store.setExternalModifiers([attackModifier('buff:might', 42)])
    const secondCall = () => store.setExternalModifiers([attackModifier('buff:might', 42)])

    expect(firstCall).not.toThrow()

    const afterFirst = store.finalStats.might

    expect(afterFirst).toBe(before + 42)
    expect(Number.isNaN(afterFirst)).toBe(false)

    expect(secondCall).not.toThrow()

    const afterSecond = store.finalStats.might

    expect(afterSecond).toBe(before + 42)
    expect(Number.isNaN(afterSecond)).toBe(false)
  })
})
