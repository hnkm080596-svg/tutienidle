import type { CultivationPathRealmReward } from '../../core/player/CultivationPathKit'

// P7-M2 - the canonical realm-entry passive ladder, authored ONCE here
// (formerly tu_linh_quyet.passiveSkillIdsByRealm: 9 passives, one per
// major realm). This module is a data leaf: way modules
// (KiemTuPath/PhapTuPath/TheTuPath) compose it into their own
// realmRewards at declaration time, so runtime resolves the ACTIVE WAY's
// record only - way -> realmRewards[realm] -> passiveSkillId (D2). There
// is no runtime fallback to this table; a way-less player gets nothing.
export const CANONICAL_REALM_PASSIVE_LADDER: Readonly<Record<string, string>> = {
  qi_refining: 'passive_linh_khi_cam_ung',
  foundation_establishment: 'passive_truc_co_y_chi',
  golden_core: 'passive_kim_dan_chi_quang',
  nascent_soul: 'passive_nguyen_anh_minh_triet',
  soul_transformation: 'passive_hoa_than_chi_uy',
  void_refinement: 'passive_luyen_hu_bo',
  body_integration: 'passive_hop_the_chi_khu',
  mahayana: 'passive_dai_thua_dao_tam',
  tribulation: 'passive_do_kiep_chi_tam',
} as const

/**
 * Builds a way's realmRewards table: every canonical realm gets the
 * canonical passive; the way's own records overlay it - artifactId
 * merges into the same record, a passiveSkillId string replaces the
 * canonical pick, and passiveSkillId: null suppresses it (an authored
 * "no passive at this realm" directive).
 */
export function composeRealmRewards(
  overrides: Readonly<Record<string, CultivationPathRealmReward>> = {},
): Record<string, CultivationPathRealmReward> {
  const table: Record<string, CultivationPathRealmReward> = {}

  for (const [realmId, passiveSkillId] of Object.entries(CANONICAL_REALM_PASSIVE_LADDER)) {
    table[realmId] = { passiveSkillId }
  }

  for (const [realmId, reward] of Object.entries(overrides)) {
    const base = table[realmId] ?? {}

    table[realmId] = {
      ...reward,
      passiveSkillId:
        reward.passiveSkillId !== undefined ? reward.passiveSkillId : base.passiveSkillId,
    }
  }

  return table
}
