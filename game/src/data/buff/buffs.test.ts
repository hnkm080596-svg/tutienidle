import { describe, it, expect } from 'vitest'
import { buffs } from './buffs'

// Unified Buff System (Task 7, 2026-09-01) — parity test: mỗi definition
// ported từ AilmentTemplate (data/ailment/ailments.ts, KHÔNG bị xoá, vẫn
// đứng làm nguồn đối chiếu) phải khớp field-for-field, không đổi số liệu.
describe('buffs.ts — ported ailment definitions match original AilmentTemplate values', () => {
// Spec 2026-09-03 phap-tu-thuan-he Task 9 — bong ĐỔI có chủ đích (N1 đã
// duyệt): stack max 5, dpsRatio 0.15/tầng (1 tầng yếu hơn, 5 tầng = 0.75
// mạnh hơn bản refresh 0.3 cũ) — "chồng Thiêu Đốt" của chuỗi Hỏa mới có
// nghĩa. Test port-parity cũ được thay bằng test shape stackable mới.
describe('buffs.ts — bong stackable (N1, spec §2.1/§7)', () => {
  it('bong (dot) — stack max 5, dpsRatio 0.15/tầng', () => {
    const bong = buffs.find((b) => b.id === 'bong')!

    expect(bong.stackMode).toBe('stack')
    expect(bong.maxStacks).toBe(5)

    const dot = bong.effects.find((e) => e.type === 'dot')

    expect(dot).toMatchObject({ type: 'dot', dpsRatio: 0.15, element: 'fire' })
  })
})

// Spec §7 — 8 buff mới của chuỗi Thuần (thanh_tuyen/bang_giap/hoi_luu/
// cau_mang_can/kim_giap/dia_tru/thanh_luy + the_man_<el> ×5).
describe('buffs.ts — buff mới chuỗi Thuần (spec §7)', () => {
  function byId(id: string) {
    return buffs.find((b) => b.id === id)
  }

  it('thanh_tuyen — buff 6s refresh, manaRegenPerSecond +8 flat + manaRegenPercent +0.10', () => {
    const b = byId('thanh_tuyen')!

    expect(b.polarity).toBe('buff')
    expect(b.duration).toBe(6)
    expect(b.stackMode).toBe('refresh')
    expect(b.effects).toContainEqual({ type: 'statModifier', stat: 'manaRegenPerSecond', flat: 8 })
    expect(b.effects).toContainEqual({ type: 'statModifier', stat: 'manaRegenPercent', percent: 0.1 })
  })

  it('bang_giap — buff 6s refresh, wardMax +50 + wardRegenPerSecond +5', () => {
    const b = byId('bang_giap')!

    expect(b.polarity).toBe('buff')
    expect(b.duration).toBe(6)
    expect(b.stackMode).toBe('refresh')
    expect(b.effects).toContainEqual({ type: 'statModifier', stat: 'wardMax', flat: 50 })
    expect(b.effects).toContainEqual({ type: 'statModifier', stat: 'wardRegenPerSecond', flat: 5 })
  })

  it('hoi_luu — buff 4s refresh, leechPercent +0.20', () => {
    const b = byId('hoi_luu')!

    expect(b.polarity).toBe('buff')
    expect(b.duration).toBe(4)
    expect(b.stackMode).toBe('refresh')
    expect(b.effects).toContainEqual({ type: 'statModifier', stat: 'leechPercent', flat: 0.2 })
  })

  it('cau_mang_can — debuff root 4s refresh (bản dài của troi_chan, biến thể Mộc C1)', () => {
    const b = byId('cau_mang_can')!

    expect(b.polarity).toBe('debuff')
    expect(b.duration).toBe(4)
    expect(b.stackMode).toBe('refresh')
    expect(b.effects).toContainEqual({ type: 'cc', ccEffect: 'root' })
  })

  it('kim_giap — buff 6s refresh, defense +15% + thornsPercent +0.15', () => {
    const b = byId('kim_giap')!

    expect(b.polarity).toBe('buff')
    expect(b.duration).toBe(6)
    expect(b.stackMode).toBe('refresh')
    expect(b.effects).toContainEqual({ type: 'statModifier', stat: 'defense', percent: 0.15 })
    expect(b.effects).toContainEqual({ type: 'statModifier', stat: 'thornsPercent', flat: 0.15 })
  })

  it('dia_tru — buff 6s refresh, wardMax +60 + wardRegenPerSecond +6 + thornsPercent +0.10', () => {
    const b = byId('dia_tru')!

    expect(b.polarity).toBe('buff')
    expect(b.duration).toBe(6)
    expect(b.stackMode).toBe('refresh')
    expect(b.effects).toContainEqual({ type: 'statModifier', stat: 'wardMax', flat: 60 })
    expect(b.effects).toContainEqual({ type: 'statModifier', stat: 'wardRegenPerSecond', flat: 6 })
    expect(b.effects).toContainEqual({ type: 'statModifier', stat: 'thornsPercent', flat: 0.1 })
  })

  it('thanh_luy — buff 8s stack max 8, defense +6%/tầng', () => {
    const b = byId('thanh_luy')!

    expect(b.polarity).toBe('buff')
    expect(b.duration).toBe(8)
    expect(b.stackMode).toBe('stack')
    expect(b.maxStacks).toBe(8)
    expect(b.effects).toContainEqual({ type: 'statModifier', stat: 'defense', percent: 0.06 })
  })

  // Engine áp/gỡ THEO ID qua theManBuffId() (TheResourceSystem.ts) —
  // id phải khớp chính xác `the_man_<element>`.
  it('the_man_<el> ×5 — buff duration Infinity, engine-gỡ, effects theo bảng §4', () => {
    const expected: Record<string, { type: 'statModifier'; stat: string; flat?: number; percent?: number }[]> = {
      the_man_fire: [{ type: 'statModifier', stat: 'ailmentPotencyPercent', percent: 0.15 }],
      the_man_water: [{ type: 'statModifier', stat: 'manaRegenPerSecond', flat: 6 }],
      the_man_wood: [{ type: 'statModifier', stat: 'ailmentDurationPercent', percent: 0.2 }],
      the_man_metal: [{ type: 'statModifier', stat: 'criticalRate', percent: 0.08 }],
      the_man_earth: [{ type: 'statModifier', stat: 'defense', percent: 0.1 }],
    }

    for (const [id, effects] of Object.entries(expected)) {
      const b = byId(id)!

      expect(b, `thiếu buff ${id}`).toBeDefined()
      expect(b.polarity).toBe('buff')
      expect(b.duration).toBe(Infinity)
      expect(b.stackMode).toBe('refresh')
      expect(b.effects).toEqual(effects)
    }
  })

  it('ngung_lo/khai_son giữ nguyên (chỉ bị gỡ khỏi placeholder skill — Task 10)', () => {
    const ngungLo = byId('ngung_lo')!
    const khaiSon = byId('khai_son')!

    expect(ngungLo.effects).toContainEqual({ type: 'statModifier', stat: 'manaRegenPerSecond', flat: 5 })
    expect(khaiSon.effects).toContainEqual({ type: 'statModifier', stat: 'defense', percent: 0.08 })
  })

  // Review round 1 (Finding 1) — biến thể Thổ C không được mượn buff
  // hành khác (bang_giap/kim_giap → sai số liệu + đụng tên đa hành):
  // buff riêng theo đúng bảng §2.5.
  it('dia_tru_bich — buff 6s refresh, wardMax +100 + wardRegenPerSecond +8, KHÔNG thorns', () => {
    const b = byId('dia_tru_bich')!

    expect(b.polarity).toBe('buff')
    expect(b.duration).toBe(6)
    expect(b.stackMode).toBe('refresh')
    expect(b.effects).toContainEqual({ type: 'statModifier', stat: 'wardMax', flat: 100 })
    expect(b.effects).toContainEqual({ type: 'statModifier', stat: 'wardRegenPerSecond', flat: 8 })
    expect(b.effects.some((e) => e.type === 'statModifier' && e.stat === 'thornsPercent')).toBe(false)
  })

  it('dia_tru_thu — buff 6s refresh, wardMax +40 + thornsPercent +0.25', () => {
    const b = byId('dia_tru_thu')!

    expect(b.polarity).toBe('buff')
    expect(b.duration).toBe(6)
    expect(b.stackMode).toBe('refresh')
    expect(b.effects).toContainEqual({ type: 'statModifier', stat: 'wardMax', flat: 40 })
    expect(b.effects).toContainEqual({ type: 'statModifier', stat: 'thornsPercent', flat: 0.25 })
  })

  it('all 47 definitions (5 buffs + 2 reaction buffs + 5 on-hit proc buffs + 16 ported ailments + 14 thuan-he chain buffs + 5 talent v4 combat buffs) are present', () => {
    expect(buffs).toHaveLength(47)
  })
})

  it('choang (cc) — ccEffect port nguyên vẹn', () => {
    const choang = buffs.find((b) => b.id === 'choang')!
    expect(choang.effects).toContainEqual({ type: 'cc', ccEffect: 'stun' })
  })

  it('lam_cham (modifier) — statModifier effects + convertsToId/convertsAfterContinuousSeconds port nguyên vẹn', () => {
    const lamCham = buffs.find((b) => b.id === 'lam_cham')!

    expect(lamCham.duration).toBe(4)
    expect(lamCham.convertsToId).toBe('dong_bang')
    expect(lamCham.convertsAfterContinuousSeconds).toBe(2)
    expect(lamCham.effects).toContainEqual({ type: 'statModifier', stat: 'attackSpeed', percent: -0.3 })
    expect(lamCham.effects).toContainEqual({ type: 'statModifier', stat: 'movementSpeed', percent: -0.3 })
  })

  it('thach_hoa — carries BOTH its statModifier AND onHitProc effect in one definition', () => {
    const thachHoa = buffs.find((b) => b.id === 'thach_hoa')!

    expect(thachHoa.effects).toContainEqual({ type: 'statModifier', stat: 'evasionRate', percent: -0.3 })
    expect(thachHoa.effects).toContainEqual({ type: 'onHitProc', chance: 0.5, appliesBuffId: 'choang' })
  })

  it('van_kiem_vu — armorIgnorePercentByRealm port nguyên vẹn (Kiếm Tu bỏ qua giáp/kháng theo cảnh giới)', () => {
    const vanKiemVu = buffs.find((b) => b.id === 'van_kiem_vu')!
    const dot = vanKiemVu.effects.find((e) => e.type === 'dot')

    expect(dot).toMatchObject({
      type: 'dot',
      dpsRatio: 2,
      element: 'metal',
      armorIgnorePercentByRealm: true,
    })
  })

  it('doc_the — duration Infinity (permanent) + maxStacks/statModifier percent port nguyên vẹn', () => {
    const docThe = buffs.find((b) => b.id === 'doc_the')!

    expect(docThe.duration).toBe(Infinity)
    expect(docThe.maxStacks).toBe(5)
    expect(docThe.stackMode).toBe('stack')
    expect(docThe.effects).toContainEqual({ type: 'statModifier', stat: 'ailmentPotencyPercent', percent: 0.05 })
    expect(docThe.effects).toContainEqual({ type: 'statModifier', stat: 'poisonRecoveryPercent', percent: 0.02 })
  })
})
