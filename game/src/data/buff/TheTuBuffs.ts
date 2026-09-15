import type { BuffDefinition } from '@/core/buff/BuffDefinition'
import { THE_GAIN_ON_EVADE, THE_GAIN_ON_HIT_TAKEN, THE_GAIN_PER_ROUND } from '@/core/the-tu/TheEconomy'

// The Tu Reimagined (spec 2026-09-15 sections 5-6, plan Task 6) — the_tu
// buff family. All holder-turn state/protection buffs carry
// durationPolicy:'fixed_holder_turns' so the holder's own ailment
// resist/duration stats can never scale them (plan v2.4 review P0);
// khiem_khich is a real debuff ON the enemy and stays ailment_scaled.
//
// Tunable first-pass constants (spec section 11: "playtest-tunable"):
export const PHAN_CHINH_MAXHP_RATIO = 0.02
export const PHAN_CHINH_TAKEN_RATIO = 0.15
export const SON_NHAC_SELF_DR = 0.3
export const SON_NHAC_TURNS = 3
export const KHIEM_KHICH_TURNS = 2

/** Bat Tu Ba The — undying + Ba The window, counted in the holder's own turns. */
export const BAT_TU_BA_THE_BUFF: BuffDefinition = {
  id: 'bat_tu_ba_the',
  name: 'Bất Tử Bá Thể',
  description: 'Bất tử trong 3 lượt của bản thân; thanh tẩy khống chế khi kích hoạt, miễn dịch xô đẩy.',
  polarity: 'buff',
  duration: 3,
  durationPolicy: 'fixed_holder_turns',
  clearsCcOnApply: true,
  stackMode: 'replace',
  effects: [{ type: 'marker', displacementImmune: true }],
}

/**
 * Phan Chinh — Trấn Thể's permanent Reflection emblem buff. The
 * reflectsDamage effect is resolved by BuffSystem.rollReactiveTrigger +
 * TurnBattleSystem inside the taken-only gate (Task 8, D4/INV-8).
 */
export const PHAN_CHINH_BUFF: BuffDefinition = {
  id: 'phan_chinh',
  name: 'Phản Chấn',
  description: 'Phản lại một phần sát thương nhận vào cho kẻ tấn công.',
  polarity: 'buff',
  duration: Infinity,
  stackMode: 'replace',
  effects: [
    {
      type: 'reactiveTrigger',
      trigger: 'onImpactLanded',
      chance: 1,
      reflectsDamage: { maxHpRatio: PHAN_CHINH_MAXHP_RATIO, takenRatio: PHAN_CHINH_TAKEN_RATIO },
    },
  ],
}

/** Son Nhac — self damage-reduction window (fixed holder-turns). */
export const SON_NHAC_BUFF: BuffDefinition = {
  id: 'son_nhac',
  name: 'Sơn Nhạc',
  description: 'Thân như núi lớn: giảm sát thương cuối nhận vào trong vài lượt.',
  polarity: 'buff',
  duration: SON_NHAC_TURNS,
  durationPolicy: 'fixed_holder_turns',
  stackMode: 'replace',
  effects: [{ type: 'statModifier', stat: 'finalDamageReductionPercent', flat: SON_NHAC_SELF_DR }],
}

/**
 * Son Nhac Ho The — marker instance on each protected ally binding an
 * externalWard pool to this source (plan Task 11). uniquePerTarget:
 * a newer grant replaces older-source markers so marker and pool always
 * share one owner.
 */
export const SON_NHAC_HO_THE_BUFF: BuffDefinition = {
  id: 'son_nhac_ho_the',
  name: 'Sơn Nhạc Hộ Thể',
  description: 'Được Sơn Nhạc che chở: lớp giáp ngoài hấp thụ sát thương thay.',
  polarity: 'buff',
  duration: SON_NHAC_TURNS,
  durationPolicy: 'fixed_holder_turns',
  uniquePerTarget: true,
  stackMode: 'replace',
  effects: [{ type: 'marker', grantsExternalWard: true }],
}

/**
 * Khiem Khich — Taunt debuff ON the enemy; Buff.sourceId is the
 * taunter's entity id and selectTarget reads the victim's own pool
 * (Task 10). uniquePerTarget => newest taunt wins (INV-11). Stays
 * ailment_scaled: enemy ailment resist legitimately shortens Taunt.
 */
export const KHIEM_KHICH_DEBUFF: BuffDefinition = {
  id: 'khiem_khich',
  name: 'Khiêu Khích',
  description: 'Bị khiêu khích: chỉ có thể nhắm vào kẻ đã khiêu khích mình.',
  polarity: 'debuff',
  duration: KHIEM_KHICH_TURNS,
  uniquePerTarget: true,
  stackMode: 'replace',
  effects: [],
}

// --- the_tu_an markers (spec section 6, plan Task 14) ---
// ung_the owns the own-basic-lands income channel (single channel per
// review P1 — THAM_THE carries no gain field). The *_mon markers carry
// each root's reactiveProc spec read by the reactive windows (Tasks
// 15-18). tu_the/bach_ung modulate the check cost/window through
// reactiveEconomy (Tasks 15/19).

function makeHiddenMarker(
  id: string,
  name: string,
  description: string,
  effects: BuffDefinition['effects'],
): BuffDefinition {
  return {
    id,
    name,
    description,
    polarity: 'buff',
    hidden: true,
    duration: Infinity,
    stackMode: 'replace',
    effects,
  }
}

export const UNG_THE_BUFF = makeHiddenMarker('ung_the', 'Ứng Thế', 'Nội tại Thể Tu Ẩn: tích lũy Thế theo nhịp đánh.', [
  {
    type: 'theEconomy',
    gainOnBasicHit: 4,
    gainOnEvade: THE_GAIN_ON_EVADE,
    gainOnHitTaken: THE_GAIN_ON_HIT_TAKEN,
    gainPerRound: THE_GAIN_PER_ROUND,
  },
])
export const HO_MON_MARKER = makeHiddenMarker('ho_mon', 'Hộ Môn', 'Hộ: đón thay đòn cho đồng đội.', [
  { type: 'reactiveProc', trigger: 'onAllyTargeted', mechanic: 'intercept', chanceStat: 'protectChance' },
])
export const PHAN_MON_MARKER = makeHiddenMarker('phan_mon', 'Phản Môn', 'Phản: phản kích khi trúng hoặc né đòn.', [
  {
    type: 'reactiveProc',
    trigger: 'onImpactLanded',
    mechanic: 'counter',
    chanceStat: 'counterChance',
    queuedAction: { payloadSkillId: 'phan_kich', actionSource: 'counter', targetMode: 'attacker' },
  },
  {
    type: 'reactiveProc',
    trigger: 'onEvade',
    mechanic: 'counter',
    chanceStat: 'counterChance',
    queuedAction: { payloadSkillId: 'phan_kich', actionSource: 'counter', targetMode: 'attacker' },
  },
])
export const TRO_MON_MARKER = makeHiddenMarker('tro_mon', 'Trợ Môn', 'Trợ: đánh theo sau hành động của đồng đội.', [
  {
    type: 'reactiveProc',
    trigger: 'onAllyActionComplete',
    mechanic: 'follow_up',
    chanceStat: 'followUpChance',
    queuedAction: { payloadSkillId: 'tro_kich', actionSource: 'follow_up', targetMode: 'triggering_targets' },
  },
])

/** Tu The — stance window: reactive checks cost less (3 self-turns). */
export const TU_THE_BUFF: BuffDefinition = {
  id: 'tu_the',
  name: 'Tú Thế',
  description: 'Tích tụ nhịp thế: kiểm tra phản ứng rẻ hơn trong vài lượt.',
  polarity: 'buff',
  duration: 3,
  durationPolicy: 'fixed_holder_turns',
  stackMode: 'replace',
  effects: [{ type: 'reactiveEconomy', procCostFlatDelta: -5 }],
}

/**
 * Bach Ung — burst window: reactive checks are free and payloads gain
 * the authored upgrade rider (spec section 6.1 "counter hits +break":
 * the payload merges `payloadAilments` into its appliesAilments at
 * resolve time — a choang stun application through the existing ailment
 * mechanism, not an invented damage multiplier).
 */
export const BACH_UNG_BUFF: BuffDefinition = {
  id: 'bach_ung',
  name: 'Bách Ứng',
  description: 'Bách ứng bất lao: trong vài lượt, mọi kiểm tra phản ứng không tốn Thế.',
  polarity: 'buff',
  duration: 3,
  durationPolicy: 'fixed_holder_turns',
  stackMode: 'replace',
  effects: [
    {
      type: 'reactiveEconomy',
      freeProcs: true,
      payloadAilments: [{ buffDefinitionId: 'choang', chance: 0.5 }],
    },
  ],
}

/**
 * Ho Ve — marker on an ally rescued by a successful Ho intercept,
 * binding their externalWard pool to the protector source (Task 20,
 * spec 8.2 "intercept->ally ward"). Same existence-bound contract as
 * son_nhac_ho_the: uniquePerTarget + reconcileExternalWard.
 */
export const HO_VE_BUFF: BuffDefinition = {
  id: 'ho_ve',
  name: 'Hộ Vệ',
  description: 'Được Hộ Môn che chắn: lớp giáp ngoài hấp thụ sát thương thay.',
  polarity: 'buff',
  hidden: true,
  duration: 2,
  durationPolicy: 'fixed_holder_turns',
  uniquePerTarget: true,
  stackMode: 'replace',
  effects: [{ type: 'marker', grantsExternalWard: true }],
}

export const THE_TU_BUFFS: BuffDefinition[] = [
  BAT_TU_BA_THE_BUFF,
  PHAN_CHINH_BUFF,
  SON_NHAC_BUFF,
  SON_NHAC_HO_THE_BUFF,
  KHIEM_KHICH_DEBUFF,
  UNG_THE_BUFF,
  HO_MON_MARKER,
  PHAN_MON_MARKER,
  TRO_MON_MARKER,
  TU_THE_BUFF,
  BACH_UNG_BUFF,
  HO_VE_BUFF,
]
