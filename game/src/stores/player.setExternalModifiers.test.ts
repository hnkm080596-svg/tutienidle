import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import type { StatModifier } from '@/core/stats/StatCalculator'

// Task 5 (perf-optimize-pass, Phase 2) - dirty-check cua
// setExternalModifiers. App.vue goi ham nay moi tick (10Hz) voi mang
// MOI; gan reference moi moi lan lam getter `finalStats` recompute vo
// ich. Test nay khoa CA HAI mat: (a) bo qua khi noi dung trung, (b)
// KHONG bo sot thay doi that (ke ca khi nguon mutate tai cho).
function attackModifier(id: string, flat: number): StatModifier {
  return {
    id,
    sourceId: id,
    sourceType: 'buff',
    stat: 'might',
    flat,
  }
}

describe('player store — setExternalModifiers dirty-check', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('nội dung trùng → GIỮ NGUYÊN reference cũ, finalStats không recompute', () => {
    const store = usePlayerStore()

    store.setExternalModifiers([attackModifier('buff:might', 42)])

    const appliedArray = store.externalModifiers
    const statsBefore = store.finalStats

    store.setExternalModifiers([attackModifier('buff:might', 42)])

    // Reference mang state khong doi -> getter computed van cache.
    expect(store.externalModifiers).toBe(appliedArray)
    expect(store.finalStats).toBe(statsBefore)
  })

  it('đổi bất kỳ field nào (flat/percent/stacks/tag/id) → gán lại, finalStats cập nhật', () => {
    const store = usePlayerStore()

    store.setExternalModifiers([attackModifier('buff:might', 42)])

    const baseline = store.finalStats.might

    store.setExternalModifiers([attackModifier('buff:might', 43)])

    expect(store.finalStats.might).toBe(baseline + 1)

    // Field khong phai flat cung phai pha chu ky.
    const withStacks: StatModifier = { ...attackModifier('buff:might', 43), stacks: 2 }

    store.setExternalModifiers([withStacks])

    expect(store.externalModifiers[0]!.stacks).toBe(2)
  })

  it('thêm/bớt entry (cùng length khác thứ tự cũng vậy) → gán lại', () => {
    const store = usePlayerStore()

    store.setExternalModifiers([attackModifier('a', 10), attackModifier('b', 20)])

    const before = store.finalStats.might

    store.setExternalModifiers([attackModifier('a', 10)])

    expect(store.finalStats.might).toBe(before - 20)

    // Doi thu tu (cung so luong, cung tap entry) van coi la khac.
    store.setExternalModifiers([attackModifier('a', 10), attackModifier('b', 20)])

    const applied = store.externalModifiers

    store.setExternalModifiers([attackModifier('b', 20), attackModifier('a', 10)])

    expect(store.externalModifiers).not.toBe(applied)
  })

  it('nguồn mutate TẠI CHỖ chính object modifier cũ → vẫn phát hiện (chữ ký snapshot theo giá trị)', () => {
    const store = usePlayerStore()

    // Mo phong BuffSystem tra ve CUNG object moi tick roi tu doi gia tri
    // ben trong - deep-compare voi state se bo sot vi hai ben cung object.
    const shared = attackModifier('buff:might', 42)

    store.setExternalModifiers([shared])

    const before = store.finalStats.might

    shared.flat = 100

    store.setExternalModifiers([shared])

    expect(store.finalStats.might).toBe(before - 42 + 100)
  })

  it('chỉ đổi domain (cùng id/stat/flat) → chữ ký khác, modifier domain mới được apply', () => {
    const store = usePlayerStore()

    // Gated stat + no domain -> dev-mode gate throws on read.
    store.setExternalModifiers([
      { id: 'mod:mp', sourceId: 'mod:mp', sourceType: 'buff', stat: 'maxMp', flat: 100 },
    ])

    expect(() => store.finalStats.maxMp).toThrow(/gate violation/)

    // Same fields, now carrying the owning domain - must NOT be
    // signature-equal (domain decides whether the gate delivers it);
    // a stale signature would keep the untagged array and still throw.
    store.setExternalModifiers([
      { id: 'mod:mp', sourceId: 'mod:mp', sourceType: 'buff', stat: 'maxMp', flat: 100, domain: 'spell' },
    ])

    expect(store.finalStats.maxMp).toBe(100)
  })

  it('state bị thay từ nơi khác ($patch/load) → lần gán kế tiếp không bị chữ ký cũ chặn nhầm', () => {
    const store = usePlayerStore()

    store.setExternalModifiers([attackModifier('buff:might', 42)])

    const withBuff = store.finalStats.might

    // Vi du load save / reset: state thay mang khac ma khong qua action.
    store.$patch({ externalModifiers: [] })

    expect(store.finalStats.might).toBeCloseTo(withBuff - 42, 6)

    // Tick ke tiep gui lai DUNG noi dung cu - phai gan lai that.
    store.setExternalModifiers([attackModifier('buff:might', 42)])

    expect(store.finalStats.might).toBeCloseTo(withBuff, 6)
  })
})
