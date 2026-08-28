import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'

// Khóa hành vi cultivation_speed (talent-direction-choice-plan §9) —
// BASE_CULTIVATION_PER_SECOND = 10: Phàm Cốt −75% → đúng 2.5/s, Tiên
// Thiên Đạo Thể +100% → đúng 20/s, guard không cho về 0/âm.
describe('player store — tốc độ tu luyện theo thiên phú', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('không có thiên phú — 10/s nền', () => {
    const store = usePlayerStore()

    store.cultivate(1)

    expect(store.cultivationPerSecond).toBe(10)
  })

  it('Phàm Cốt — cultivationPerSecond đúng 2.5', () => {
    const store = usePlayerStore()

    store.selectedTalentIds = ['pham_cot']
    store.cultivate(1)

    expect(store.cultivationPerSecond).toBeCloseTo(2.5)
  })

  it('Tiên Thiên Đạo Thể — cultivationPerSecond đúng 20', () => {
    const store = usePlayerStore()

    store.selectedTalentIds = ['tien_thien_dao_the']
    store.cultivate(1)

    expect(store.cultivationPerSecond).toBeCloseTo(20)
  })

  it('Đại Trí Nhược Ngu — tu luyện 7.5/s', () => {
    const store = usePlayerStore()

    store.selectedTalentIds = ['dai_tri_nhuoc_ngu']
    store.cultivate(1)

    expect(store.cultivationPerSecond).toBeCloseTo(7.5)
  })

  it('Nghịch Thiên — tu luyện 15/s', () => {
    const store = usePlayerStore()

    store.selectedTalentIds = ['nghich_thien']
    store.cultivate(1)

    expect(store.cultivationPerSecond).toBeCloseTo(15)
  })

  it('save cũ nhiều percent âm — guard 0.01, không bao giờ ≤ 0', () => {
    const store = usePlayerStore()

    store.selectedTalentIds = ['pham_cot', 'pham_cot', 'pham_cot', 'pham_cot']
    store.cultivate(1)

    expect(store.cultivationPerSecond).toBeCloseTo(0.1) // 10 × 0.01
  })
})
