import { describe, it, expect } from 'vitest'
import { buffs } from './buffs'

// Unified Buff System (Task 7, 2026-09-01) — parity test: mỗi definition
// ported từ AilmentTemplate (data/ailment/ailments.ts, KHÔNG bị xoá, vẫn
// đứng làm nguồn đối chiếu) phải khớp field-for-field, không đổi số liệu.
describe('buffs.ts — ported ailment definitions match original AilmentTemplate values', () => {
  it('bong (dot) — dpsRatio và element port nguyên vẹn', () => {
    const bong = buffs.find((b) => b.id === 'bong')!
    const dot = bong.effects.find((e) => e.type === 'dot')

    expect(dot).toMatchObject({ type: 'dot', dpsRatio: 0.3, element: 'fire' })
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

  it('all 28 definitions (5 buffs + 2 reaction buffs + 5 on-hit proc buffs + 16 ported ailments) are present', () => {
    expect(buffs).toHaveLength(28)
  })
})
