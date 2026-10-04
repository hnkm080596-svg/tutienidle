import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import { getTalentDefinition } from '../data/talent/Talents'

// Thien phu Ngo Dao (talent-direction-choice-plan sec6) - tu luyen ONLINE
// tich luy tu vi doi Cam Ngo Ky nang theo nguong cultivationPerInsight
// (2000). Dung qi_refining tang 1 (required 13200) de cultivate() khong
// bi clamp o tran dot pha trong pham vi test.
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

    store.cultivate(500) // 10/s x 500s = 5000 tu vi

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

    store.cultivate(100) // +1000 -> du 2000

    expect(store.skillInsight).toBe(1)
    expect(store.cultivationInsightAccumulator).toBe(0)
  })

  it('Ngộ Đạo — một lần tu vượt nhiều ngưỡng đổi nhiều Cảm Ngộ, giữ phần dư', () => {
    const store = storeAtQiRefining()

    store.selectedTalentIds = ['ngo_dao']
    store.cultivate(500) // 5000 tu vi -> 2 Cam Ngo, du 1000

    expect(store.skillInsight).toBe(2)
    expect(store.totalSkillInsightGained).toBe(2)
    expect(store.cultivationInsightAccumulator).toBe(1000)
  })

  it('Ngộ Đạo — tu vi bị clamp ở trần đột phá thì chỉ tính phần THẬT cộng', () => {
    const store = storeAtQiRefining()

    store.selectedTalentIds = ['ngo_dao']
    store.cultivation = 12_000 // required qi_refining 1 = 13200 -> chi con cong duoc 1200

    store.cultivate(500) // muon cong 5000 nhung clamp o 1200

    expect(store.skillInsight).toBe(0)
    expect(store.cultivationInsightAccumulator).toBe(1200)
  })

  // Audit fix 2026-08-31 - talent data edit (mod/save hand-edit) dat
  // cultivationPerInsight: 0 tung tao infinite loop trong cultivate():
  // while (accumulator >= 0) khong bao gio sai nen accumulator -= 0 lap
  // vinh vien, freeze tick 100ms. Guard `> 0` phai chan hoan toan nhanh
  // insight khi nguong khong hop le (0).
  it('ngưỡng 0 (data edit cultivationPerInsight: 0) — KHÔNG treo, bỏ hẳn nhánh insight', () => {
    const store = storeAtQiRefining()

    // Gia lap talent data edit: mutate definition cua ngo_dao trong catalog
    // (module-level, chay truoc khi cultivate doc effect). Khoi phuc sau
    // test de khong ro ri sang test khac.
    const talent = getTalentDefinition('ngo_dao')!
    const effect = talent.effects.find(
      (candidate): candidate is Extract<(typeof talent.effects)[number], { kind: 'insight_per_cultivation' }> =>
        candidate.kind === 'insight_per_cultivation',
    )!
    const originalThreshold = effect.cultivationPerInsight
    effect.cultivationPerInsight = 0

    try {
      store.selectedTalentIds = ['ngo_dao']
      store.cultivate(500) // 5000 tu vi - truoc guard: treo while-loop

      expect(store.skillInsight).toBe(0)
      expect(store.totalSkillInsightGained).toBe(0)
      expect(store.cultivationInsightAccumulator).toBe(0)
    } finally {
      effect.cultivationPerInsight = originalThreshold
    }
  })
})
