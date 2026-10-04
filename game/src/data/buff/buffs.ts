import type { BuffDefinition } from '@/core/buff2/BuffDefinition'
import { LEGACY_BUFFS } from './LegacyBuffs'
import { KIEM_PHO_BUFFS } from './KiemPhoBuffs'
import { THUAN_HE_BUFFS } from './ThuanHeBuffs'
import { TALENT_BUFFS } from './TalentBuffs'
import { BOSS_BUFFS } from './BossBuffs'
import { THE_TU_BUFFS } from './TheTuBuffs'
import { REACTION_STATUS_BUFFS } from './ReactionStatusBuffs'
import { COMPANION_BUFFS } from './CompanionBuffs'
import { PHAP_TU_TRANG_BUFFS } from './PhapTuTrangBuffs'

// Dot Pha Truc Co (Phase 5) - ap len buff PERSISTENT ngoai tran
// (GameManager.applyPersistentBuff()) khi that bai Do Kiep (muc 13
// spec `breakthrough`) - phat co cam giac nhung khong huy hoai, KHONG
// reset canh gioi. Xem composables/useTribulation.ts.
// buff2 migration (M4): a persistent wall debuff -- 'seconds' clock
// (advanced by onTimePassed), NOT a battle ailment. Session-scoped by
// design: the buff2 persistent pool has no save seam, so a reload
// forgives the wound (60s debuff - the acceptable bound).
export const KIEP_THUONG_DEBUFF: BuffDefinition = {
  id: 'kiep_thuong',
  name: 'Kiếp Thương',
  description:
    'Vết thương do Thiên Kiếp để lại sau khi Độ Kiếp thất bại, làm suy giảm toàn thân trong chốc lát.',
  kind: 'debuff',
  polarity: 'debuff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'seconds', duration: 60, scaling: 'fixed' },
  statModifiers: [
    { stat: 'might', percent: -0.15 },
    { stat: 'defense', percent: -0.15 },
  ],
  dispellable: true,
}

// Tran Phap formation buffs (B2, 2026-09-14) - one shared battle-long buff
// per formation, applied to every placed combatant at battle start by
// buildTurnBattle(). Spec 2026-09-05 sec2.5: fewer slots = stronger buff.
export const TRAN_PHAP_DOC_HANH_BUFF: BuffDefinition = {
  id: 'tran_phap_doc_hanh_buff',
  name: 'Độc Hành Khí Tức',
  description: 'Một mình gánh trận — +12% công, +12% thủ.',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'permanent', scaling: 'fixed' },
  statModifiers: [
    { stat: 'might', percent: 0.12 },
    { stat: 'defense', percent: 0.12 },
  ],
  dispellable: false,
}

export const TRAN_PHAP_LUONG_NGHI_BUFF: BuffDefinition = {
  id: 'tran_phap_luong_nghi_buff',
  name: 'Lưỡng Nghi Khí Tức',
  description: 'Hai cực tương trợ — +10% công.',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'permanent', scaling: 'fixed' },
  statModifiers: [{ stat: 'might', percent: 0.1 }],
  dispellable: false,
}

export const TRAN_PHAP_TAM_TAI_BUFF: BuffDefinition = {
  id: 'tran_phap_tam_tai_buff',
  name: 'Tam Tài Khí Tức',
  description: 'Thiên-địa-nhân hợp thế — +6% công, +6% tốc độ.',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'permanent', scaling: 'fixed' },
  statModifiers: [
    { stat: 'might', percent: 0.06 },
    { stat: 'speed', percent: 0.06 },
  ],
  dispellable: false,
}

export const TRAN_PHAP_NGU_HANH_BUFF: BuffDefinition = {
  id: 'tran_phap_ngu_hanh_buff',
  name: 'Ngũ Hành Khí Tức',
  description: 'Ngũ hành tương sinh — +4% công, +6% thủ.',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'permanent', scaling: 'fixed' },
  statModifiers: [
    { stat: 'might', percent: 0.04 },
    { stat: 'defense', percent: 0.06 },
  ],
  dispellable: false,
}

export const TRAN_PHAP_CUU_CUNG_BUFF: BuffDefinition = {
  id: 'tran_phap_cuu_cung_buff',
  name: 'Cửu Cung Khí Tức',
  description: 'Chín vị trí cùng trận — +2% công, +2% thủ.',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'permanent', scaling: 'fixed' },
  statModifiers: [
    { stat: 'might', percent: 0.02 },
    { stat: 'defense', percent: 0.02 },
  ],
  dispellable: false,
}

// Buffs/debuffs referenced by skill effects via buffId (see
// data/skill/Skills.ts). Applied to the per-entity buff pool inside a
// battle (Battle.playerBuffs/enemyBuffs) - not persistent out-of-battle
// buffs.
// Kiem The / Kiem Y (spec 2026-08-29 muc 5.3): sword_wound (thuoc
// Thai Hu Nhat Kiem) va phieu_van_bo_buff (thuoc Phieu Van Bo) da
// don CUNG skill - 2 skill chuyen thanh passive node route BK, khong
// con effect nao tham chieu.
//
// Unified Buff System (Task 7, 2026-09-01) - Ailment/AilmentTemplate
// (data/ailment/ailments.ts, core/ailment/*) hop nhat vao dung shape
// `BuffDefinition` nay: 'dot'/'cc'/'modifier' category cu tro thanh
// entries trong `effects[]`, onHitChance/onHitAppliesAilmentId tro
// thanh 1 effect 'onHitProc' THEM vao (khong phai definition rieng).
// So lieu port BYTE-FOR-BYTE tu ailments.ts - khong doi balance.
// ailments.ts CHUA xoa (Task 16 moi xoa, sau khi moi consumer
// chuyen han sang BuffRegistry).
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
  ...REACTION_STATUS_BUFFS,
  ...COMPANION_BUFFS,
  // Phap Tu Reimagine (2026-09-26 spec) -- Phap Trang windows + their
  // bound target markers.
  ...PHAP_TU_TRANG_BUFFS,
]


// Talent v4 - named exports cho consumer test/wiring (pattern
// KIEP_THUONG_DEBUFF): dinh nghia Tu Sinh Ngo nam trong mang `buffs` o
// tren; export nay tra lai CHINH xac object do (khong dinh nghia lan 2).
export const TU_SINH_NGO_BUFF: BuffDefinition = buffs.find((buff) => buff.id === 'tu_sinh_ngo')!
