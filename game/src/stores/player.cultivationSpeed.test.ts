import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import { TU_LINH_TRAN_BUFF_PERCENT } from '../core/economy/TuLinhTranBalance'

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

  // Tụ Linh Trận (economy-fixes-sinks-plan §3.2 B1) — effect active nhân
  // tốc độ tu luyện thêm cultivationSpeedPercent; hết hạn thì mất buff.
  it('effect tu_linh_tran active — cultivationPerSecond nhân (1 + 25%)', () => {
    const store = usePlayerStore()

    store.persistentTimedEffects.push({
      id: 'tu_linh_tran',

      sourceItemId: 'tu_linh_tran',

      effectGroup: 'tu_linh_tran',

      appliedAtMs: Date.now() - 1000,

      expiresAtMs: Date.now() + 60_000,

      modifiers: [],

      cultivationSpeedPercent: TU_LINH_TRAN_BUFF_PERCENT,
    })

    store.cultivate(1)

    expect(store.cultivationPerSecond).toBeCloseTo(10 * (1 + TU_LINH_TRAN_BUFF_PERCENT))
  })

  it('effect tu_linh_tran hết hạn — không còn buff', () => {
    const store = usePlayerStore()

    store.persistentTimedEffects.push({
      id: 'tu_linh_tran',

      sourceItemId: 'tu_linh_tran',

      effectGroup: 'tu_linh_tran',

      appliedAtMs: Date.now() - 120_000,

      expiresAtMs: Date.now() - 60_000,

      modifiers: [],

      cultivationSpeedPercent: TU_LINH_TRAN_BUFF_PERCENT,
    })

    store.cultivate(1)

    expect(store.cultivationPerSecond).toBe(10)
  })
})
