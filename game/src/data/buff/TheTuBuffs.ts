import type { BuffDefinition } from '@/core/buff2/BuffDefinition'
import type { CapabilityGrantDefinition } from '@/core/battle/contracts/capability'
import { THE_GAIN_ON_EVADE, THE_GAIN_ON_HIT_TAKEN, THE_GAIN_PER_ROUND } from '@/core/the-tu/TheEconomy'

// The Tu Reimagined (spec 2026-09-15 sections 5-6, plan Task 6) — the_tu
// buff family. All holder-turn state/protection buffs carry
// durationPolicy:'fixed_holder_turns' -> lifetime.scaling:'fixed' so the
// holder's own ailment resist/duration stats can never scale them
// (plan v2.4 review P0); khiem_khich is a real debuff ON the enemy and
// stays ailment_scaled.
//
// buff2 migration (M4): stackMode:'replace' -> stacking{onReapplyStacks:
// 'replace', onReapplyDuration:'refresh', replaceInstanceOnReapply:true};
// uniquePerTarget -> instanceScope:'per_target' + sourceOwnership:'latest';
// marker/reactive*/theEconomy effects -> capabilities[] (owner modules in
// core/proc + core/the-tu validate the payloads).

// Tunable first-pass constants (spec section 11: "playtest-tunable"):
export const PHAN_CHAN_BASE_RATIO = 0.03
export const PHAN_CHAN_MARKED_RATIO = 0.06
export const CHAN_AN_TURNS = 3
export const TRAN_KINH_WEAKEN_RATIO = 0.15
export const TRAN_KINH_TURNS = 1
export const SON_NHAC_SELF_DR = 0.3
export const SON_NHAC_TURNS = 3
export const KHIEM_KHICH_TURNS = 2

function cap(id: string, type: string, payload: unknown): CapabilityGrantDefinition {
  return { id, type, payload }
}

const FIXED_TURNS = (n: number) => ({ clock: 'holder_turns', duration: n, scaling: 'fixed' }) as const
const PERMANENT = { clock: 'permanent', scaling: 'fixed' } as const
const REPLACE = { onReapplyStacks: 'replace', onReapplyDuration: 'refresh', replaceInstanceOnReapply: true } as const
const PER_TARGET = { instanceScope: 'per_target', sourceOwnership: 'latest' } as const

/** Bat Tu Ba The — undying + Ba The window, counted in the holder's own turns. */
export const BAT_TU_BA_THE_BUFF: BuffDefinition = {
  id: 'bat_tu_ba_the',
  name: 'Bất Tử Bá Thể',
  description: 'Bất tử trong 3 lượt của bản thân; thanh tẩy khống chế khi kích hoạt, miễn dịch xô đẩy.',
  kind: 'marker',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, ...REPLACE },
  lifetime: FIXED_TURNS(3),
  clearsCcOnApply: true,
  capabilities: [cap('bat_tu_ba_the.marker', 'marker', { displacementImmune: true })],
  dispellable: false,
}

/**
 * Phan Chan — Trấn Thể's permanent Reflect passive (granted when the
 * Phản Chấn special is learned). Once-per-hostile-action: hits of the
 * same hostile action merge into one pending reflect; the action-end
 * flush emits a single flat 'reflection' op at the attacker for
 * maxHp x ratio -- a marked (Chấn Ấn) attacker reflects at the marked
 * ratio. The mark is never consumed; takenRatio/per-hit reflect is
 * retired (beta design: fixed Max-HP coefficient only).
 */
export const PHAN_CHAN_BUFF: BuffDefinition = {
  id: 'phan_chan',
  name: 'Phản Chấn',
  description: 'Phản lại sát thương bằng một tỉ lệ Sinh Mệnh Tối Đa cho kẻ tấn công.',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, ...REPLACE },
  lifetime: PERMANENT,
  capabilities: [
    cap('phan_chan.reactive', 'reactive_trigger', {
      trigger: 'onImpactLanded',
      chance: 1,
      reflectsDamage: {
        maxHpRatio: PHAN_CHAN_BASE_RATIO,
        markedMaxHpRatio: PHAN_CHAN_MARKED_RATIO,
        markedBy: 'chan_an',
      },
    }),
  ],
  dispellable: false,
}

/**
 * Chan An — the Phản Chấn mark: a debuff ON every enemy the cast
 * reached. Mark-only by design (beta spec): no DoT, no stat change,
 * never consumed -- the phan_chan reflect reads its presence at
 * action-end for the higher marked ratio. per_target+latest => a
 * recast refreshes the holder's own mark.
 */
export const CHAN_AN_DEBUFF: BuffDefinition = {
  id: 'chan_an',
  name: 'Chấn Ấn',
  description: 'Bị Chấn Ấn đánh dấu: phản kích của Trấn Thể mạnh hơn lên kẻ mang ấn.',
  kind: 'ailment',
  polarity: 'debuff',
  ...PER_TARGET,
  stacking: { maxStacks: 1, ...REPLACE },
  lifetime: { clock: 'holder_turns', duration: CHAN_AN_TURNS, scaling: 'ailment_scaled' },
  application: { resistance: 'ailment' },
  dispellable: true,
}

/**
 * Tran Kinh — the Trấn Kình debuff: an enemy hit by Trấn Áp has the
 * damage of its next hostile turn weakened by a flat
 * finalDamagePercent cut. Implemented as a one-holder-turn ailment
 * window (the design's "next hit" weakens on the enemy's next turn);
 * ailment resistance legitimately shortens it.
 */
export const TRAN_KINH_DEBUFF: BuffDefinition = {
  id: 'tran_kinh',
  name: 'Trấn Kình',
  description: 'Bị Trấn Kình đánh yếu: đòn kế tiếp gây sát thương giảm.',
  kind: 'ailment',
  polarity: 'debuff',
  ...PER_TARGET,
  // Stacks ARE the Trấn Kình node's amplification channel -- the
  // finalDamagePercent flat scales x stacks (StatCalculator parity).
  stacking: { maxStacks: 9, ...REPLACE },
  lifetime: { clock: 'holder_turns', duration: TRAN_KINH_TURNS, scaling: 'ailment_scaled' },
  application: { resistance: 'ailment' },
  statModifiers: [{ stat: 'finalDamagePercent', flat: -TRAN_KINH_WEAKEN_RATIO }],
  dispellable: true,
}

/** Son Nhac — self damage-reduction window (fixed holder-turns). */
export const SON_NHAC_BUFF: BuffDefinition = {
  id: 'son_nhac',
  name: 'Sơn Nhạc',
  description: 'Thân như núi lớn: giảm sát thương cuối nhận vào trong vài lượt.',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, ...REPLACE },
  lifetime: FIXED_TURNS(SON_NHAC_TURNS),
  statModifiers: [{ stat: 'finalDamageReductionPercent', flat: SON_NHAC_SELF_DR }],
  dispellable: false,
}

/**
 * Son Nhac Ho The — marker instance on each protected ally binding an
 * externalWard pool to this source (plan Task 11). uniquePerTarget ->
 * per_target + latest: a newer grant replaces older-source markers so
 * marker and pool always share one owner.
 */
export const SON_NHAC_HO_THE_BUFF: BuffDefinition = {
  id: 'son_nhac_ho_the',
  name: 'Sơn Nhạc Hộ Thể',
  description: 'Được Sơn Nhạc che chở: lớp giáp ngoài hấp thụ sát thương thay.',
  kind: 'marker',
  polarity: 'buff',
  ...PER_TARGET,
  stacking: { maxStacks: 1, ...REPLACE },
  lifetime: FIXED_TURNS(SON_NHAC_TURNS),
  capabilities: [cap('son_nhac_ho_the.marker', 'marker', { grantsExternalWard: true })],
  dispellable: false,
}

/**
 * Khiem Khich — Taunt debuff ON the enemy; the instance's sourceId is the
 * taunter's entity id and selectTarget reads the victim's own pool
 * (Task 10). per_target+latest => newest taunt wins (INV-11). Stays
 * ailment_scaled: enemy ailment resist legitimately shortens Taunt.
 */
export const KHIEM_KHICH_DEBUFF: BuffDefinition = {
  id: 'khiem_khich',
  name: 'Khiêu Khích',
  description: 'Bị khiêu khích: chỉ có thể nhắm vào kẻ đã khiêu khích mình.',
  kind: 'ailment',
  polarity: 'debuff',
  ...PER_TARGET,
  stacking: { maxStacks: 1, ...REPLACE },
  lifetime: { clock: 'holder_turns', duration: KHIEM_KHICH_TURNS, scaling: 'ailment_scaled' },
  application: { resistance: 'ailment' },
  dispellable: true,
}

// --- ung_the markers (spec section 6, plan Task 14) ---
// ung_the owns the own-basic-lands income channel (single channel per
// review P1 — THAM_THE carries no gain field). The *_mon markers carry
// each root's reactiveProc spec read by the reactive windows (Tasks
// 15-18). tu_the/bach_ung modulate the check cost/window through
// reactiveEconomy (Tasks 15/19).

function makeHiddenMarker(
  id: string,
  name: string,
  description: string,
  capabilities: readonly CapabilityGrantDefinition[],
): BuffDefinition {
  return {
    id,
    name,
    description,
    kind: 'marker',
    polarity: 'buff',
    hidden: true,
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, ...REPLACE },
    lifetime: PERMANENT,
    capabilities,
    dispellable: false,
  }
}

export const UNG_THE_BUFF = makeHiddenMarker('ung_the', 'Ứng Thế', 'Nội tại Thể Tu Ẩn: tích lũy Thế theo nhịp đánh.', [
  cap('ung_the.economy', 'the_economy', {
    gainOnBasicHit: 4,
    gainOnEvade: THE_GAIN_ON_EVADE,
    gainOnHitTaken: THE_GAIN_ON_HIT_TAKEN,
    gainPerRound: THE_GAIN_PER_ROUND,
  }),
])
export const HO_MON_MARKER = makeHiddenMarker('ho_mon', 'Hộ Môn', 'Hộ: đón thay đòn cho đồng đội.', [
  cap('ho_mon.proc', 'reactive_proc', { trigger: 'onAllyTargeted', mechanic: 'intercept', chanceStat: 'protectChance' }),
])
export const PHAN_MON_MARKER = makeHiddenMarker('phan_mon', 'Phản Môn', 'Phản: phản kích khi trúng hoặc né đòn.', [
  cap('phan_mon.proc_impact', 'reactive_proc', {
    trigger: 'onImpactLanded', mechanic: 'counter', chanceStat: 'counterChance',
    queuedAction: { payloadSkillId: 'phan_kich', actionSource: 'counter', targetMode: 'attacker' },
  }),
  cap('phan_mon.proc_evade', 'reactive_proc', {
    trigger: 'onEvade', mechanic: 'counter', chanceStat: 'counterChance',
    queuedAction: { payloadSkillId: 'phan_kich', actionSource: 'counter', targetMode: 'attacker' },
  }),
])
export const TRO_MON_MARKER = makeHiddenMarker('tro_mon', 'Trợ Môn', 'Trợ: đánh theo sau hành động của đồng đội.', [
  cap('tro_mon.proc', 'reactive_proc', {
    trigger: 'onAllyActionComplete', mechanic: 'follow_up', chanceStat: 'followUpChance',
    queuedAction: { payloadSkillId: 'tro_kich', actionSource: 'follow_up', targetMode: 'triggering_targets' },
  }),
])

/** Tu The — stance window: reactive checks cost less (3 self-turns). */
export const TU_THE_BUFF: BuffDefinition = {
  id: 'tu_the',
  name: 'Tú Thế',
  description: 'Tích tụ nhịp thế: kiểm tra phản ứng rẻ hơn trong vài lượt.',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, ...REPLACE },
  lifetime: FIXED_TURNS(3),
  capabilities: [cap('tu_the.economy', 'reactive_economy', { procCostFlatDelta: -5 })],
  dispellable: false,
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
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, ...REPLACE },
  lifetime: FIXED_TURNS(3),
  capabilities: [
    cap('bach_ung.economy', 'reactive_economy', {
      freeProcs: true,
      payloadAilments: [{ buffDefinitionId: 'choang', chance: 0.5 }],
    }),
  ],
  dispellable: false,
}

/**
 * Ho Ve — marker on an ally rescued by a successful Ho intercept,
 * binding their externalWard pool to the protector source (Task 20,
 * spec 8.2 "intercept->ally ward"). Same existence-bound contract as
 * son_nhac_ho_the: per_target + reconcileExternalWard.
 */
export const HO_VE_BUFF: BuffDefinition = {
  id: 'ho_ve',
  name: 'Hộ Vệ',
  description: 'Được Hộ Môn che chắn: lớp giáp ngoài hấp thụ sát thương thay.',
  kind: 'marker',
  polarity: 'buff',
  hidden: true,
  ...PER_TARGET,
  stacking: { maxStacks: 1, ...REPLACE },
  lifetime: FIXED_TURNS(2),
  capabilities: [cap('ho_ve.marker', 'marker', { grantsExternalWard: true })],
  dispellable: false,
}

export const THE_TU_BUFFS: BuffDefinition[] = [
  BAT_TU_BA_THE_BUFF,
  PHAN_CHAN_BUFF,
  CHAN_AN_DEBUFF,
  TRAN_KINH_DEBUFF,
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
