// P7-M4 - the mortal-selectable basic set, owned by the skill domain.
// Was exported from kiem-tu/KiemTuState.ts (a path module owning a
// mortal concept). CAST_LEVELING_THRESHOLDS stays the LEVELING
// authority; this list is the mortal-selectable ROLE authority - the
// contract test pins the two sets equal. Post-path starter authority
// is a separate concern: PathWayDefinition.starterBasicSkillId.
export const MORTAL_PRECURSOR_SKILL_IDS = ['tram', 'linh_bao', 'huy_quyen'] as const

export const MORTAL_DEFAULT_BASIC_ID = 'tram'

export function isMortalPrecursorSkillId(id: string): boolean {
  return (MORTAL_PRECURSOR_SKILL_IDS as readonly string[]).includes(id)
}
