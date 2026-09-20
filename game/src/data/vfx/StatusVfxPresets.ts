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
  // Canonical seals -- diamond, element-colored (canonical-seals S1)
  hoa_an: { color: 0xff7a45, shape: 'diamond' },
  doc_can: { color: 0x58e878, shape: 'diamond' },
  liet_thuong: { color: 0xe5484d, shape: 'diamond' },
  han_tuc: { color: 0x58c8ff, shape: 'diamond' },
  tran_an: { color: 0xd4a72c, shape: 'diamond' },
  // Reaction payoff statuses (canonical-seals S2/S5.3) -- square for
  // defense debuffs, diamond for wound/CC payoffs.
  defense_break: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  defense_erosion: { color: 0xd4a72c, shape: 'square' },
  reaction_bleed: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'diamond' },
  cam_cong: { color: 0xab47bc, shape: 'diamond' },
  // Ngo Dao aura (S3) -- circle buff, violet: the reaction-capability
  // marker the whole allied party carries.
  van_phap_than_hoa: { color: 0x9d7bff, shape: 'circle' },
  // statModifier debuff — square
  lam_cham: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  han_khi: { color: 0x8be9fd, shape: 'square' },
  cuong_bao: { color: 0xff7a45, shape: 'square' },
  suy_nhuoc: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  uy_ap: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  giap_ran: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  van_kiem_vu: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  // buff tạm — circle
  thach_giap_buff: { color: BUFF_PLACEHOLDER_COLOR, shape: 'circle' },
}

export function getStatusVfxPreset(buffId: string, polarity?: 'buff' | 'debuff'): StatusVfxPreset {
  // 1. Map trực tiếp theo id
  if (STATUS_PRESETS[buffId]) {
    return STATUS_PRESETS[buffId]!
  }

  // 2. Regex heuristic cũ — id lạ mô tả nguyên tố (compat data tương lai)
  if (/burn|fire|hot/.test(buffId)) return { color: 0xff7a45, shape: 'diamond' }
  if (/poison|toxic|wood/.test(buffId)) return { color: 0x58e878, shape: 'diamond' }
  if (/bleed|huyet|blood/.test(buffId)) return { color: 0xe5484d, shape: 'diamond' }
  if (/chill|frost|water/.test(buffId)) return { color: 0x58c8ff, shape: 'diamond' }

  // 3. Polarity fallback cuối — placeholder đỏ/xanh (mặc định đỏ cảnh báo)
  return {
    color: polarity === 'buff' ? BUFF_PLACEHOLDER_COLOR : DEBUFF_PLACEHOLDER_COLOR,
    shape: 'circle',
  }
}
