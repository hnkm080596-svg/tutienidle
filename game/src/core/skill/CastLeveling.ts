// Phap Tu Reimagined Task 2 + The Tu Reimagined (spec 2026-09-15, T6) -
// THE table of skills that level ONLY by cast count (their Core Nodes
// reject Insight upgrades, INV-9): any id listed here auto-levels by
// totalExperience in recordCast(). tram's curve is the existing one;
// linh_bao/huy_quyen are the mortal-path actives - linh_bao Lv3 is the
// hidden_spell_pathway offer gate, huy_quyen Lv3 the hidden_body_pathway gate - so the
// thresholds are also read directly by chooseCultivationPath.
//
// P1 - extracted from SkillSystem into a leaf module: the cultivation
// path catalog (CultivationPathKit) evaluates offer gates through
// getCastLeveledSkillLevel, and NodeSystem consumes the path authority -
// keeping this table on SkillSystem would close the import cycle
// NodeSystem -> CultivationPathSystem -> Kit -> SkillSystem ->
// SpellPathRoutes -> NodeSystem. This module imports nothing.
export const CAST_LEVELING_THRESHOLDS: Record<string, { lv2: number; lv3: number }> = {
  tram:      { lv2: 1000, lv3: 10000 },
  linh_bao:  { lv2: 1000, lv3: 10000 },
  huy_quyen: { lv2: 1000, lv3: 10000 },
}

/**
 * Level a cast-leveled skill SHOULD be at for its total cast count, or
 * undefined when the skill is not cast-leveled (manual insight upgrade).
 */
export function getCastLeveledSkillLevel(skillId: string, totalExperience: number): number | undefined {
  const thresholds = CAST_LEVELING_THRESHOLDS[skillId]

  if (!thresholds) {
    return undefined
  }

  if (totalExperience >= thresholds.lv3) return 3
  if (totalExperience >= thresholds.lv2) return 2
  return 1
}

/** Cast threshold for Huy Kiem reaching Lv3 - the Kiem Tu route locks
 * Bat Kiem when tram >= this mark (spec 2026-08-29-kiem-the-kiem-y
 * section 1). Re-aliases the threshold table - no second constant
 * source. */
export const HUY_KIEM_L3_CASTS = CAST_LEVELING_THRESHOLDS.tram!.lv3

/** Cast threshold for Huy Quyen reaching Lv3 - the hidden_body_pathway way offer
 * gate at the Initiation Ritual (spec 2026-09-15 T6, see PathOfferGate
 * in CultivationPathKit.ts). */
export const HUY_QUYEN_L3_CASTS = CAST_LEVELING_THRESHOLDS.huy_quyen!.lv3
