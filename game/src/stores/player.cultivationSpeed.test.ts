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

  it('Tiên Thiên Đạo Thể (retired v4) — không còn +100%, về nền 10/s', () => {
    const store = usePlayerStore()

    store.selectedTalentIds = ['tien_thien_dao_the']
    store.cultivate(1)

    expect(store.cultivationPerSecond).toBeCloseTo(10)
  })

  it('Đại Trí Nhược Ngu (retired v4) — không còn −25%, về nền 10/s', () => {
    const store = usePlayerStore()

    store.selectedTalentIds = ['dai_tri_nhuoc_ngu']
    store.cultivate(1)

    expect(store.cultivationPerSecond).toBeCloseTo(10)
  })

  it('Nghịch Thiên (retired v4) — không còn +50%, về nền 10/s', () => {
    const store = usePlayerStore()

    store.selectedTalentIds = ['nghich_thien']
    store.cultivate(1)

    expect(store.cultivationPerSecond).toBeCloseTo(10)
  })

  it('Phàm Nhân Chi Cốt (thưởng Đại Đạo v4) — tu luyện 17.5/s', () => {
    const store = usePlayerStore()

    store.selectedTalentIds = ['pham_nhan_chi_cot']
    store.cultivate(1)

    expect(store.cultivationPerSecond).toBeCloseTo(17.5)
  })

  it('save edit nhiều id (v4 siết id đầu) — chỉ Phàm Cốt đầu được đọc, 2.5/s', () => {
    const store = usePlayerStore()

    store.selectedTalentIds = ['pham_cot', 'pham_cot', 'pham_cot', 'pham_cot']
    store.cultivate(1)

    // v4 (spec §3.2): chỉ id ĐẦU được đọc — 4 lần pham_cot không cộng
    // dồn thành −300% (kéo về 0), giữ đúng −75% của 1 talent.
    expect(store.cultivationPerSecond).toBeCloseTo(2.5)
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
