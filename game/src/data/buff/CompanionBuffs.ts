import type { BuffDefinition } from '@/core/buff2/BuffDefinition'
import type { CapabilityGrantDefinition } from '@/core/battle/contracts/capability'

// P7-M-G (beta companion roster, 2026-10) - companion support buffs for
// the two Beta-acquirable definitions. than_nong heals through the
// established hpRegenPerTurn stat channel (the ally recovers at the start
// of THEIR OWN turn and healing-received amplifiers apply - D18/INV-13);
// khai_minh reinforces party stats and wards allies through the proven
// son_nhac_ho_the marker channel. No PeriodicHealDefinition use: it has
// zero production users and the stat path is the smaller coherent choice.
//
// Conventions (spec section 3.3): friendly buffs never carry an
// `application` resistance block and keep lifetime.scaling 'fixed' so the
// HOLDER's own ailment resist/duration stats can never shorten or resist
// a friendly buff (The Tu precedent). Stat/regen buffs are non-stacking
// keep/refresh - a recast refreshes duration in place. The ward marker
// mirrors son_nhac_ho_the field-for-field: per_target + latest +
// replace-instance, so a recast replaces the marker and the
// reconcileExternalWard-bound pool shares one owner. Flat numbers are
// first-pass placeholders deferred to the balance phase.

const FIXED_TURNS = (n: number) => ({ clock: 'holder_turns', duration: n, scaling: 'fixed' }) as const
const KEEP_REFRESH = { onReapplyStacks: 'keep', onReapplyDuration: 'refresh' } as const
const REPLACE = { onReapplyStacks: 'replace', onReapplyDuration: 'refresh', replaceInstanceOnReapply: true } as const
const PER_TARGET = { instanceScope: 'per_target', sourceOwnership: 'latest' } as const

function cap(id: string, type: string, payload: unknown): CapabilityGrantDefinition {
  return { id, type, payload }
}

export const THAN_NONG_HOI_PHUC_BUFF: BuffDefinition = {
  id: 'than_nong_hoi_phuc',
  name: 'Hồi Phục Thuật',
  description: 'Dược lực Thần Nông thấm dần — hồi sinh lực vào đầu mỗi lượt của bản thân.',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, ...KEEP_REFRESH },
  lifetime: FIXED_TURNS(4),
  statModifiers: [{ stat: 'hpRegenPerTurn', flat: 12 }],
  dispellable: false,
}

export const THAN_NONG_THAN_DANG_HOI_PHUC_BUFF: BuffDefinition = {
  id: 'than_nong_than_dang_hoi_phuc',
  name: 'Thần Đằng Hồi Phục',
  description: 'Thần đằng dâng trào dược lực — hồi sinh lực lớn mỗi lượt và thanh tẩy khống chế.',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, ...KEEP_REFRESH },
  lifetime: FIXED_TURNS(5),
  clearsCcOnApply: true,
  statModifiers: [{ stat: 'hpRegenPerTurn', flat: 24 }],
  dispellable: false,
}

export const KHAI_MINH_HO_VE_BUFF: BuffDefinition = {
  id: 'khai_minh_ho_ve',
  name: 'Khai Minh Hộ Vệ',
  description: 'Cửu thủ Khai Minh gầm vang — toàn đội công thủ cùng tăng.',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, ...KEEP_REFRESH },
  lifetime: FIXED_TURNS(5),
  statModifiers: [
    { stat: 'might', percent: 0.12 },
    { stat: 'defense', percent: 0.12 },
  ],
  dispellable: false,
}

/**
 * Khai Minh Thanh Ho - marker on each warded ally binding an
 * externalWard pool to Khai Minh (spec 3.2). Mirrors son_nhac_ho_the:
 * per_target + latest so a newer grant replaces older-source markers and
 * marker/pool always share one owner; reconcileExternalWard clears the
 * pool when the marker expires.
 */
export const KHAI_MINH_THANH_HO_BUFF: BuffDefinition = {
  id: 'khai_minh_thanh_ho',
  name: 'Khai Minh Thanh Hộ',
  description: 'Được Khai Minh che chở — lớp giáp ngoài hấp thụ sát thương thay.',
  kind: 'marker',
  polarity: 'buff',
  ...PER_TARGET,
  stacking: { maxStacks: 1, ...REPLACE },
  lifetime: FIXED_TURNS(6),
  capabilities: [cap('khai_minh_thanh_ho.marker', 'marker', { grantsExternalWard: true })],
  dispellable: false,
}

export const COMPANION_BUFFS: readonly BuffDefinition[] = [
  THAN_NONG_HOI_PHUC_BUFF,
  THAN_NONG_THAN_DANG_HOI_PHUC_BUFF,
  KHAI_MINH_HO_VE_BUFF,
  KHAI_MINH_THANH_HO_BUFF,
]
