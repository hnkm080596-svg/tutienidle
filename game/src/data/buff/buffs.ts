import type { BuffDefinition } from '@/core/buff/BuffDefinition'
import { LEGACY_BUFFS } from './LegacyBuffs'
import { KIEM_PHO_BUFFS } from './KiemPhoBuffs'
import { THUAN_HE_BUFFS } from './ThuanHeBuffs'
import { TALENT_BUFFS } from './TalentBuffs'
import { BOSS_BUFFS } from './BossBuffs'
import { THE_TU_BUFFS } from './TheTuBuffs'

// Đột Phá Trúc Cơ (Phase 5) — áp lên buff PERSISTENT ngoài trận
// (GameManager.applyPersistentBuff()) khi thất bại Độ Kiếp (mục 13
// spec `breakthrough`) — phạt có cảm giác nhưng không huỷ hoại, KHÔNG
// reset cảnh giới. Xem composables/useTribulation.ts. Khai TRƯỚC mảng
// `buffs` bên dưới vì được tham chiếu lại trong đó.
export const KIEP_THUONG_DEBUFF: BuffDefinition = {
  id: 'kiep_thuong',

  name: 'Kiếp Thương',

  description:
    'Vết thương do Thiên Kiếp để lại sau khi Độ Kiếp thất bại, làm suy giảm toàn thân trong chốc lát.',

  polarity: 'debuff',

  duration: 60,

  stackMode: 'refresh',

  effects: [
    {
      type: 'statModifier',
      stat: 'might',
      percent: -0.15,
    },

    {
      type: 'statModifier',
      stat: 'defense',
      percent: -0.15,
    },
  ],
}

// Tran Phap formation buffs (B2, 2026-09-14) - one shared battle-long buff
// per formation, applied to every placed combatant at battle start by
// buildTurnBattle(). Spec 2026-09-05 §2.5: fewer slots = stronger buff.
export const TRAN_PHAP_DOC_HANH_BUFF: BuffDefinition = {
  id: 'tran_phap_doc_hanh_buff',
  name: 'Độc Hành Khí Tức',
  description: 'Một mình gánh trận — +12% công, +12% thủ.',
  polarity: 'buff',
  duration: Infinity,
  stackMode: 'refresh',
  effects: [
    { type: 'statModifier', stat: 'might', percent: 0.12 },
    { type: 'statModifier', stat: 'defense', percent: 0.12 },
  ],
}

export const TRAN_PHAP_LUONG_NGHI_BUFF: BuffDefinition = {
  id: 'tran_phap_luong_nghi_buff',
  name: 'Lưỡng Nghi Khí Tức',
  description: 'Hai cực tương trợ — +10% công.',
  polarity: 'buff',
  duration: Infinity,
  stackMode: 'refresh',
  effects: [{ type: 'statModifier', stat: 'might', percent: 0.1 }],
}

export const TRAN_PHAP_TAM_TAI_BUFF: BuffDefinition = {
  id: 'tran_phap_tam_tai_buff',
  name: 'Tam Tài Khí Tức',
  description: 'Thiên-địa-nhân hợp thế — +6% công, +6% tốc độ.',
  polarity: 'buff',
  duration: Infinity,
  stackMode: 'refresh',
  effects: [
    { type: 'statModifier', stat: 'might', percent: 0.06 },
    { type: 'statModifier', stat: 'speed', percent: 0.06 },
  ],
}

export const TRAN_PHAP_NGU_HANH_BUFF: BuffDefinition = {
  id: 'tran_phap_ngu_hanh_buff',
  name: 'Ngũ Hành Khí Tức',
  description: 'Ngũ hành tương sinh — +4% công, +6% thủ.',
  polarity: 'buff',
  duration: Infinity,
  stackMode: 'refresh',
  effects: [
    { type: 'statModifier', stat: 'might', percent: 0.04 },
    { type: 'statModifier', stat: 'defense', percent: 0.06 },
  ],
}

export const TRAN_PHAP_CUU_CUNG_BUFF: BuffDefinition = {
  id: 'tran_phap_cuu_cung_buff',
  name: 'Cửu Cung Khí Tức',
  description: 'Chín vị trí cùng trận — +2% công, +2% thủ.',
  polarity: 'buff',
  duration: Infinity,
  stackMode: 'refresh',
  effects: [
    { type: 'statModifier', stat: 'might', percent: 0.02 },
    { type: 'statModifier', stat: 'defense', percent: 0.02 },
  ],
}

// Buff/debuff mà skill effect tham chiếu qua buffId (xem
// SkillEffectSystem, data/skill/Skills.ts). Áp lên buff pool riêng
// theo entity trong trận (Battle.playerBuffs/enemyBuffs) — không
// phải buff persistent ngoài trận.
// Kiếm Thế / Kiếm Ý (spec 2026-08-29 mục 5.3): sword_wound (thuộc
// Thái Hư Nhất Kiếm) và phieu_van_bo_buff (thuộc Phiêu Vân Bộ) đã
// dọn CÙNG skill — 2 skill chuyển thành passive node route BK, không
// còn effect nào tham chiếu.
//
// Unified Buff System (Task 7, 2026-09-01) — Ailment/AilmentTemplate
// (data/ailment/ailments.ts, core/ailment/*) hợp nhất vào đúng shape
// `BuffDefinition` này: 'dot'/'cc'/'modifier' category cũ trở thành
// entries trong `effects[]`, onHitChance/onHitAppliesAilmentId trở
// thành 1 effect 'onHitProc' THÊM vào (không phải definition riêng).
// Số liệu port BYTE-FOR-BYTE từ ailments.ts — không đổi balance.
// ailments.ts CHƯA xoá (Task 16 mới xoá, sau khi mọi consumer
// chuyển hẳn sang BuffRegistry).
export const buffs: BuffDefinition[] = [
  KIEP_THUONG_DEBUFF,
  TRAN_PHAP_DOC_HANH_BUFF,
  TRAN_PHAP_LUONG_NGHI_BUFF,
  TRAN_PHAP_TAM_TAI_BUFF,
  TRAN_PHAP_NGU_HANH_BUFF,
  TRAN_PHAP_CUU_CUNG_BUFF,
  ...LEGACY_BUFFS,
  ...KIEM_PHO_BUFFS,
  ...THUAN_HE_BUFFS,
  ...TALENT_BUFFS,
  ...BOSS_BUFFS,
  ...THE_TU_BUFFS,
]


// Talent v4 — named exports cho consumer test/wiring (pattern
// KIEP_THUONG_DEBUFF): định nghĩa Tử Sinh Ngộ nằm trong mảng `buffs` ở
// trên; export này tra lại CHÍNH xác object đó (không định nghĩa lần 2).
export const TU_SINH_NGO_BUFF: BuffDefinition = buffs.find((buff) => buff.id === 'tu_sinh_ngo')!
