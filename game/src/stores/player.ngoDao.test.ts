import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import { getTalentDefinition } from '../data/talent/Talents'

// Thiên phú Ngộ Đạo (talent-direction-choice-plan §6) — tu luyện ONLINE
// tích luỹ tu vi đổi Cảm Ngộ Kỹ năng theo ngưỡng cultivationPerInsight
// (2000). Dùng qi_refining tầng 1 (required 13200) để cultivate() không
// bị clamp ở trần đột phá trong phạm vi test.
describe('player store — thiên phú Ngộ Đạo (insight_per_cultivation)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function storeAtQiRefining(): ReturnType<typeof usePlayerStore> {
    const store = usePlayerStore()

    store.realmId = 'qi_refining'
    store.realmLevel = 1
    store.cultivation = 0

    return store
  }

  it('không có thiên phú — tu luyện không sinh Cảm Ngộ Kỹ năng', () => {
    const store = storeAtQiRefining()

    store.cultivate(500) // 10/s × 500s = 5000 tu vi

    expect(store.skillInsight).toBe(0)
    expect(store.totalSkillInsightGained).toBe(0)
    expect(store.cultivationInsightAccumulator).toBe(0)
  })

  it('Ngộ Đạo — đúng 2000 tu vi đổi 1 Cảm Ngộ, accumulator về 0', () => {
    const store = storeAtQiRefining()

    store.selectedTalentIds = ['ngo_dao']
    store.cultivate(200) // 2000 tu vi

    expect(store.skillInsight).toBe(1)
    expect(store.totalSkillInsightGained).toBe(1)
    expect(store.cultivationInsightAccumulator).toBe(0)
  })

  it('Ngộ Đạo — chưa đủ 2000 tu vi thì KHÔNG trigger, dồn accumulator sang lần sau', () => {
    const store = storeAtQiRefining()

    store.selectedTalentIds = ['ngo_dao']
    store.cultivate(100) // 1000 tu vi

    expect(store.skillInsight).toBe(0)
    expect(store.cultivationInsightAccumulator).toBe(1000)

    store.cultivate(100) // +1000 → đủ 2000

    expect(store.skillInsight).toBe(1)
    expect(store.cultivationInsightAccumulator).toBe(0)
  })

  it('Ngộ Đạo — một lần tu vượt nhiều ngưỡng đổi nhiều Cảm Ngộ, giữ phần dư', () => {
    const store = storeAtQiRefining()

    store.selectedTalentIds = ['ngo_dao']
    store.cultivate(500) // 5000 tu vi → 2 Cảm Ngộ, dư 1000

    expect(store.skillInsight).toBe(2)
    expect(store.totalSkillInsightGained).toBe(2)
    expect(store.cultivationInsightAccumulator).toBe(1000)
  })

  it('Ngộ Đạo — tu vi bị clamp ở trần đột phá thì chỉ tính phần THẬT cộng', () => {
    const store = storeAtQiRefining()

    store.selectedTalentIds = ['ngo_dao']
    store.cultivation = 12_000 // required qi_refining 1 = 13200 → chỉ còn cộng được 1200

    store.cultivate(500) // muốn cộng 5000 nhưng clamp ở 1200

    expect(store.skillInsight).toBe(0)
    expect(store.cultivationInsightAccumulator).toBe(1200)
  })

  // Audit fix 2026-08-31 — talent data edit (mod/save hand-edit) đặt
  // cultivationPerInsight: 0 từng tạo infinite loop trong cultivate():
  // while (accumulator >= 0) không bao giờ sai nên accumulator -= 0 lặp
  // vĩnh viễn, freeze tick 100ms. Guard `> 0` phải chặn hoàn toàn nhánh
  // insight khi ngưỡng không hợp lệ (0).
  it('ngưỡng 0 (data edit cultivationPerInsight: 0) — KHÔNG treo, bỏ hẳn nhánh insight', () => {
    const store = storeAtQiRefining()

    // Giả lập talent data edit: mutate definition của ngo_dao trong catalog
    // (module-level, chạy trước khi cultivate đọc effect). Khôi phục sau
    // test để không rò rỉ sang test khác.
    const talent = getTalentDefinition('ngo_dao')!
    const effect = talent.effects.find(
      (candidate): candidate is Extract<(typeof talent.effects)[number], { kind: 'insight_per_cultivation' }> =>
        candidate.kind === 'insight_per_cultivation',
    )!
    const originalThreshold = effect.cultivationPerInsight
    effect.cultivationPerInsight = 0

    try {
      store.selectedTalentIds = ['ngo_dao']
      store.cultivate(500) // 5000 tu vi — trước guard: treo while-loop

      expect(store.skillInsight).toBe(0)
      expect(store.totalSkillInsightGained).toBe(0)
      expect(store.cultivationInsightAccumulator).toBe(0)
    } finally {
      effect.cultivationPerInsight = originalThreshold
    }
  })
})
