// Buff bar (2026-09-02) — preset theo buff id: color + shape phân loại
// (circle = buff, diamond = CC/DoT, square = statModifier debuff). Không
// convey nghĩa CHỈ bằng màu (UX guideline) — shape là kênh thứ hai.
// Placeholder = hình học thuần; asset thật thay sau không đụng layout.
export type StatusIconShape = 'circle' | 'diamond' | 'square'

export interface StatusVfxPreset {
  color: number
  shape: StatusIconShape
}

export const BUFF_PLACEHOLDER_COLOR = 0x58e878
export const DEBUFF_PLACEHOLDER_COLOR = 0xe5484d
const CC_COLOR = 0xffd54f

const STATUS_PRESETS: Record<string, StatusVfxPreset> = {
  // CC — diamond (kế thừa hình icon cũ)
  choang: { color: CC_COLOR, shape: 'diamond' },
  dong_bang: { color: 0x8be9fd, shape: 'diamond' },
  troi_chan: { color: CC_COLOR, shape: 'diamond' },
  // DoT nguyên tố — diamond màu hệ
  bong: { color: 0xff7a45, shape: 'diamond' },
  trung_doc: { color: 0x58e878, shape: 'diamond' },
  chay_mau: { color: 0xe5484d, shape: 'diamond' },
  te_cong: { color: 0x58c8ff, shape: 'diamond' },
  hoai_tu: { color: 0x58c8ff, shape: 'diamond' },
  dung_nham: { color: 0xff7a45, shape: 'diamond' },
  huyet_doc: { color: 0xe5484d, shape: 'diamond' },
  // statModifier debuff — square
  lam_cham: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  han_khi: { color: 0x8be9fd, shape: 'square' },
  cuong_bao: { color: 0xff7a45, shape: 'square' },
  suy_nhuoc: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  uy_ap: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  giap_ran: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  van_kiem_vu: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  thach_hoa: { color: 0xd4a72c, shape: 'square' },
  // buff tạm — circle
  thach_giap_buff: { color: BUFF_PLACEHOLDER_COLOR, shape: 'circle' },
  doc_the: { color: BUFF_PLACEHOLDER_COLOR, shape: 'circle' },
  ngung_lo: { color: 0x4a90d9, shape: 'circle' },
  khai_son: { color: 0xd4a72c, shape: 'circle' },
}

export function getStatusVfxPreset(buffId: string, polarity?: 'buff' | 'debuff'): StatusVfxPreset {
  // 1. Map trực tiếp theo id
  if (STATUS_PRESETS[buffId]) {
    return STATUS_PRESETS[buffId]!
  }

  // 2. onhit_* prefix — pool vĩnh viễn player
  if (buffId.startsWith('onhit_')) {
    return { color: BUFF_PLACEHOLDER_COLOR, shape: 'circle' }
  }

  // 3. Regex heuristic cũ — id lạ mô tả nguyên tố (compat data tương lai)
  if (/burn|fire|hot/.test(buffId)) return { color: 0xff7a45, shape: 'diamond' }
  if (/poison|toxic|wood/.test(buffId)) return { color: 0x58e878, shape: 'diamond' }
  if (/bleed|huyet|blood/.test(buffId)) return { color: 0xe5484d, shape: 'diamond' }
  if (/chill|frost|water/.test(buffId)) return { color: 0x58c8ff, shape: 'diamond' }

  // 4. Polarity fallback cuối — placeholder đỏ/xanh (mặc định đỏ cảnh báo)
  return {
    color: polarity === 'buff' ? BUFF_PLACEHOLDER_COLOR : DEBUFF_PLACEHOLDER_COLOR,
    shape: 'circle',
  }
}
