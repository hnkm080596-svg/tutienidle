import type { BuffDefinition } from '@/core/buff/BuffDefinition'

export const KIEM_TRAN_BUFFS: BuffDefinition[] = [
  // Kiếm Trận on-hit (spec 2026-08-29 mục 4, BattleSystem.dispatchOnHitEffect
  // 'khiem_phong_haste'/'phan_kich_dodge'/'pha_giap_pen'/'quang_crit'/
  // 'than_ngu_hanh' cases) — 5 self-buff, stack vô hạn tạm trong trận
  // (duration Infinity, tự mất khi BuffPool per-battle bị vứt lúc trận kết
  // thúc), mỗi tầng +2% vào đúng 1 stat. Id khớp `onhit_${kind}` mà
  // BattleSystem tra registry.
  {
    id: 'onhit_khiem_phong_haste',
    name: 'On-hit Khiêm Phong Haste',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'stack',
    effects: [{ type: 'statModifier', stat: 'speed', percent: 0.02 }],
  },
  {
    id: 'onhit_phan_kich_dodge',
    name: 'On-hit Phản Kích Dodge',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'stack',
    effects: [{ type: 'statModifier', stat: 'evasionRate', percent: 0.02 }],
  },
  {
    id: 'onhit_pha_giap_pen',
    name: 'On-hit Phá Giáp Pen',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'stack',
    effects: [{ type: 'statModifier', stat: 'metalPenetration', percent: 0.02 }],
  },
  {
    id: 'onhit_quang_crit',
    name: 'On-hit Quang Crit',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'stack',
    effects: [{ type: 'statModifier', stat: 'criticalRate', percent: 0.02 }],
  },
  {
    id: 'onhit_than_ngu_hanh',
    name: 'On-hit Thần Ngũ Hành',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'stack',
    effects: [{ type: 'statModifier', stat: 'metalPower', percent: 0.02 }],
  },
]
