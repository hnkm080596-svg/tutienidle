import type { ElementType } from '../element/ElementType'
import type { ItemQuality } from '../item/ItemQuality'
import type { StatModifier } from '../stats/StatCalculator'

// P7-M3 - Canonical Technique model. A Way owns exactly ONE canonical
// Technique (see data/technique/Techniques.ts + CultivationPathWay.
// techniqueId). Progression vocabulary: `rank` (0..TECHNIQUE_RANK_CAP)
// inside a `grade` (realm-gated, 1..getTechniqueGradeCeiling(realmId)),
// fed by `mastery` (the `techniqueMastery` battle-reward channel), with
// `quality` = ItemQuality display axis. Rank bands still resolve to the
// four legacy tiers (So Nhap/Tieu Thanh/Dai Thanh/Vien Man) via
// getTechniqueTierForRank - see TechniqueProgression.ts.
export type TechniqueTier = 'so_nhap' | 'tieu_thanh' | 'dai_thanh' | 'vien_man'

// M-F-TECHNIQUE (F4) - frozen-cycle model. Each grade's rank cycle
// seals once into per-grade history when its lifetime ends (realm
// exit, grade-up supersession, or skipped entry below the band);
// records are write-if-absent immutable.
export type TechniqueCompletionState = 'partial' | 'dai_thanh' | 'vien_man'

// Canonical runtime list matching the union above - the save
// boundary validates persisted records against it. Keep in sync with
// the union (the reverse assertion lives in TechniqueProgression.ts
// tests via resolveTechniqueCompletionState coverage).
export const TECHNIQUE_COMPLETION_STATES: readonly TechniqueCompletionState[] = [
  'partial',
  'dai_thanh',
  'vien_man',
]

export interface TechniqueCycleOutcome {
  finalRank: number // integer 0..TECHNIQUE_RANK_CAP

  completionState: TechniqueCompletionState
}

// M-F-TECHNIQUE (F4) - grade-up inheritance scaffold.
// computeTechniqueGradeInheritance(outcome) reads the OUTGOING cycle's
// sealed record and returns a payload applied to the new cycle.
// Ordering pinned: partial < dai_thanh < vien_man, componentwise on
// (finalRank, completionState) - a higher finalRank at equal state, or
// a better state at equal rank, may never reduce any output. The
// applied payload NEVER grants rank or mastery; authored coefficients
// are a later balance pass, so the payload carries no fields yet
// (Record<string, never> = "no properties allowed" - the seam is
// typed now so future fields slot in without touching the
// transaction).
export type TechniqueGradeInheritance = Record<string, never>

// Per-band stat block - same shape as the retired tierEffects entries.
// manaRegenIncreasePercent is an Increased-percent on manaRegenPerTurn
// (NOT a percent of maxMp - avoids the circular dependency on a not-yet
// computed maxMp, same contract as before).
export interface TechniqueTierEffect {
  mightFlat?: number

  defenseFlat?: number

  maxMpIncreasePercent?: number

  manaRegenIncreasePercent?: number

  hpRegenFlat?: number

  mpRegenFlat?: number
}

/**
 * Canonical technique: authored template data (id/name/description/
 * icon/element/resourceLabel/combatTypeId/gradeEffects/combatModifiers)
 * plus live progression state (grade/rank/mastery/quality). The same
 * object serves as both template (Techniques.ts) and instance
 * (TechniqueManager) - grant() structured-clones the template.
 *
 * gradeEffects[grade][tierBand] replaces the retired `tierEffects`:
 * effect lookup resolves the band from `rank` inside the table of the
 * highest authored grade <= current grade (see getTechniqueEffects).
 */
export interface Technique {
  id: string

  name: string

  description: string

  // Path anh minh hoa (vd '/assets/techniques/xich_viem.png') - declared
  // on the data item itself (2026-08-15 convention: icon belongs to the
  // item's own declaration, not a shared lookup). Optional - tooltip
  // simply renders no <img> without one.
  icon?: string

  // Chien Dau noi tai (optional - only combat-focused techniques
  // declare). See CombatTechniqueTypeConfig (data/technique/
  // CombatTechniqueTypes.ts) - display/organization only, no hard
  // runtime binding.
  combatTypeId?: string

  // Phap Tu profession-tier ladder - attaches the Ngu Hanh identity for
  // UI. `resourceLabel` renames the Rage bar (CombatHud.vue) while this
  // technique is active - NOT a new resource.
  element?: ElementType

  resourceLabel?: string

  // P7-M3 progression state. Templates declare grade 1 / rank 0 /
  // mastery 0 / quality 'hoang'; runtime mutates via TechniqueSystem
  // (gainMastery / advanceTechniqueGrade / setTechniqueQuality).
  grade: number

  rank: number

  mastery: number

  quality: ItemQuality

  // M-F-TECHNIQUE - per-grade frozen completion history: grade ->
  // sealed cycle outcome. Templates/grants declare {}; runtime seals
  // write-if-absent inside TechniqueSystem (realm-exit freeze +
  // grade-up transaction, incl. the {0,partial} seal written when a
  // skipped grade is entered below the band). Canonical persisted
  // state - never republished to player.techniqueProgress (the
  // mirror stays the live cycle's {rank, grade} only).
  gradeHistory: Record<number, TechniqueCycleOutcome>

  // Effects per grade -> per rank-band (technique tier vocabulary).
  // Optional/band-optional - an undeclared band contributes nothing.
  gradeEffects?: Partial<Record<number, Partial<Record<TechniqueTier, TechniqueTierEffect>>>>

  // Combat-gate-teleport-autocast plan sec. 9 - fixed combat modifiers
  // (not band-scaled) active while the technique is the active one.
  // Aggregated ONLY via GameManager.getAggregatedModifiers() so they
  // never double-apply (plan sec. 19 risk 9). (Task 3, D16: the old +2
  // range grant retired with the attackRange stat - no technique
  // currently declares combatModifiers.)
  combatModifiers?: StatModifier[]
}
