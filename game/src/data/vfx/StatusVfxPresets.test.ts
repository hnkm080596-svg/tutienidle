// Buff bar (2026-09-02) — preset theo buff id + shape phân loại
// (circle=buff, diamond=CC/DoT, square=stat debuff) — không convey nghĩa
// chỉ bằng màu. Placeholder polarity cuối: buff xanh, debuff đỏ.
import { describe, expect, it } from 'vitest'
import {
  getStatusVfxPreset,
  BUFF_PLACEHOLDER_COLOR,
  DEBUFF_PLACEHOLDER_COLOR,
} from './StatusVfxPresets'

describe('StatusVfxPresets — map theo buff id (buff bar)', () => {
  it('CC → diamond vàng/ice', () => {
    expect(getStatusVfxPreset('choang')).toMatchObject({ color: 0xffd54f, shape: 'diamond' })
    expect(getStatusVfxPreset('dong_bang').shape).toBe('diamond')
    expect(getStatusVfxPreset('troi_chan').shape).toBe('diamond')
  })

  it('DoT nguyên tố → diamond màu hệ', () => {
    expect(getStatusVfxPreset('bong')).toMatchObject({ color: 0xff7a45, shape: 'diamond' })
    expect(getStatusVfxPreset('trung_doc')).toMatchObject({ color: 0x58e878, shape: 'diamond' })
    expect(getStatusVfxPreset('te_cong')).toMatchObject({ color: 0x58c8ff, shape: 'diamond' })
  })

  it('statModifier debuff → square', () => {
    expect(getStatusVfxPreset('lam_cham').shape).toBe('square')
    expect(getStatusVfxPreset('suy_nhuoc').shape).toBe('square')
  })

  it('buff tạm → circle', () => {
    expect(getStatusVfxPreset('khai_son').shape).toBe('circle')
    expect(getStatusVfxPreset('thach_giap_buff').shape).toBe('circle')
  })

  it('onhit_* prefix → circle màu buff (fallback id chưa map)', () => {
    expect(getStatusVfxPreset('onhit_chua_co_trong_bang')).toMatchObject({
      color: BUFF_PLACEHOLDER_COLOR,
      shape: 'circle',
    })
  })

  it('id lạ + polarity → placeholder theo polarity', () => {
    expect(getStatusVfxPreset('buff_la_ma', 'buff')).toMatchObject({ color: BUFF_PLACEHOLDER_COLOR })
    expect(getStatusVfxPreset('debuff_la_ma', 'debuff')).toMatchObject({
      color: DEBUFF_PLACEHOLDER_COLOR,
    })
  })

  it('id lạ không polarity → debuff placeholder (mặc định đỏ cảnh báo)', () => {
    expect(getStatusVfxPreset('vo_danh')).toMatchObject({ color: DEBUFF_PLACEHOLDER_COLOR })
  })

  it('regex heuristic cũ vẫn hoạt động cho id lạ mô tả nguyên tố', () => {
    expect(getStatusVfxPreset('fire_nova_moi')).toMatchObject({ color: 0xff7a45, shape: 'diamond' })
    expect(getStatusVfxPreset('blood_dot_moi')).toMatchObject({ color: 0xe5484d, shape: 'diamond' })
  })
})
