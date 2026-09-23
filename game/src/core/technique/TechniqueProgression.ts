import { getSpiritStoneMaterialIdForRealmTier } from '../material/SpiritStoneMaterial'
import { getRealmIndex } from '../realm/realmSystem'
import { getRealmTier } from '../realm/RealmTierMap'
import type {
  Technique,
  TechniqueCompletionState,
  TechniqueCycleOutcome,
  TechniqueGradeInheritance,
  TechniqueTier,
  TechniqueTierEffect,
} from './Technique'

// P7-M3 - Canonical technique progression helpers. Leaf module: only
// type + realm/material leaf imports so way modules and core ops can
// both use it without cycles. Replaces the retired TechniqueTier.ts
// insight-share model (BASE_TECHNIQUE_INSIGHT_REQUIRED /
// TECHNIQUE_TIER_COST_SHARES / getTechniqueTierProgress).

// M-F-TECHNIQUE (F4) - per-grade rank cycle: the ladder is 0..18
// (realmLevel-scaled ceiling while the live grade matches the realm
// band); a cycle seals into gradeHistory when its lifetime ends.
export const TECHNIQUE_RANK_CAP = 18

export const BASE_RANK_MASTERY = 300

// Mastery needed for the NEXT rank inside `grade` - 300 x grade
// (grade 1 = 300/rank, grade 2 = 600/rank, ...). Spec sec. 4.2.
export function getTechniqueMasteryForNextRank(grade: number): number {
  return BASE_RANK_MASTERY * grade
}

// Rank bands reuse the legacy four-tier vocabulary as DISPLAY bands,
// rescaled to the 18-rank ladder (M-F-TECHNIQUE, proportional to the
// retired 0|1-2|3-5|6-10 envelope): 0 so_nhap, 1-4 tieu_thanh,
// 5-9 dai_thanh, 10-18 vien_man. Display only - completionState under
// the frozen-cycle model resolves via resolveTechniqueCompletionState.
export function getTechniqueTierForRank(rank: number): TechniqueTier {
  if (rank >= 10) return 'vien_man'
  if (rank >= 5) return 'dai_thanh'
  if (rank >= 1) return 'tieu_thanh'
  return 'so_nhap'
}

// Active effect = gradeEffects[highest authored grade <= technique.grade]
// [band from rank]. Techniques with no gradeEffects (or no authored
// table at/below the grade) contribute nothing - same "undeclared means
// zero" contract as the retired tierEffects.
export function getTechniqueEffects(technique: Technique): TechniqueTierEffect | undefined {
  const tables = technique.gradeEffects
  if (!tables) return undefined

  let authoredGrade = -1
  for (const key of Object.keys(tables)) {
    const grade = Number(key)
    if (grade <= technique.grade && grade > authoredGrade) {
      authoredGrade = grade
    }
  }
  if (authoredGrade < 0) return undefined

  return tables[authoredGrade]?.[getTechniqueTierForRank(technique.rank)]
}

// Grade ceiling = the player's major-realm index (mortal 0 - mortals
// hold no canonical technique at all; unknown realm -1 fails every
// grade check). Spec sec. 4.3.
export function getTechniqueGradeCeiling(realmId: string): number {
  return getRealmIndex(realmId)
}

// M-F-TECHNIQUE (F4) - effective trainable ceiling for the live
// cycle: while the live grade equals the current realm band, ranks
// climb with the minor realm level (min(18, realmLevel)); a
// lagging/sealed cycle (grade < realm index) cannot train at all
// (ceiling 0). Rank 18 - and therefore vien_man - is only reachable
// at the realm's summit (realmLevel 18).
export function getTechniqueRankCeiling(
  technique: Technique,
  realmId: string,
  realmLevel: number,
): number {
  const realmIndex = getRealmIndex(realmId)

  // realmIndex <= 0 covers mortal (0) and unknown realms (-1): a
  // technique can never be in-band there, so the ceiling is 0 - the
  // grade 0 holder matching index 0 is a forged state, not a trainable
  // cycle.
  return realmIndex > 0 && technique.grade === realmIndex
    ? Math.min(TECHNIQUE_RANK_CAP, Math.max(0, Math.floor(realmLevel)))
    : 0
}

// M-F-TECHNIQUE (F4) - sealed-cycle completion vocabulary. vien_man
// only at the absolute summit (finalRank 18); dai_thanh when the
// player trained to the achievable ceiling for that cycle's lifetime
// (finalRank == the realmLevel at freeze, e.g. an early breakthrough
// at realmLevel 12 with rank 12); partial otherwise. An early exit
// therefore forecloses vien_man permanently (CORE_REALM_LEVEL 12
// admits tribulation below the summit).
export function resolveTechniqueCompletionState(
  finalRank: number,
  realmLevelAtFreeze: number,
): TechniqueCompletionState {
  if (finalRank >= TECHNIQUE_RANK_CAP) return 'vien_man'
  if (realmLevelAtFreeze > 0 && finalRank === realmLevelAtFreeze) return 'dai_thanh'
  return 'partial'
}

// M-F-TECHNIQUE (F-BREAK-CONFIRM) - panel read-model: the outcome the
// live cycle would seal NOW. A live in-band cycle projects from its
// current rank + current realmLevel (rank < realmLevel projects
// partial - dai_thanh remains achievable before exit); an
// already-sealed live grade returns its frozen record verbatim.
export function projectTechniqueCompletion(
  technique: Technique,
  realmLevel: number,
): TechniqueCycleOutcome {
  const sealed = technique.gradeHistory[technique.grade]
  if (sealed !== undefined) return sealed

  return {
    finalRank: technique.rank,
    completionState: resolveTechniqueCompletionState(technique.rank, realmLevel),
  }
}

// M-F-TECHNIQUE (F4) - inheritance scaffold. Monotonic under the
// pinned order (partial < dai_thanh < vien_man, componentwise on
// (finalRank, completionState)): a higher finalRank at equal state,
// or a better state at equal rank, may never reduce any output. The
// applied payload NEVER grants rank or mastery; authored coefficients
// are deferred to a balance pass so the payload carries no fields yet.
export function computeTechniqueGradeInheritance(
  _outcome: TechniqueCycleOutcome | undefined,
): TechniqueGradeInheritance {
  return {}
}

// M-F-TECHNIQUE (F5) - gate-effective rank. The techniqueProgress
// mirror stays literal (a lagging holder still stores its sealed rank
// for display), but gates see rank 0 whenever the live grade lags the
// realm - a sealed cycle's rank dies at freeze, frozen-before-
// grade-up window included. techniqueGrade gates read the live grade
// directly (monotonic nondecreasing across catch-up).
export function getEffectiveTechniqueRank(
  progress: { rank: number; grade: number } | null | undefined,
  realmId: string,
): number {
  if (progress == null) return 0

  // Same forged-state guard as the ceiling: no technique is ever
  // in-band at mortal (index 0) or an unknown realm (-1).
  const realmIndex = getRealmIndex(realmId)
  return realmIndex > 0 && progress.grade === realmIndex ? progress.rank : 0
}

// M-F-TECHNIQUE (F4) - catch-up-only check: the grade ceiling equals
// the realm index, so a live grade can only lag its band AFTER a
// freeze - the retired rank>=CAP arm is gone (it would deadlock
// unperfected freezes). Grade-up is the only grade mutation.
export function canAdvanceTechniqueGrade(technique: Technique | undefined, realmId: string): boolean {
  return !!technique && technique.grade >= 1 && technique.grade < getTechniqueGradeCeiling(realmId)
}

// Extensible cost rule (spec sec. 4.4, locked): 100 x targetGrade paid in
// the player's CURRENT-realm-tier spirit stone.
export function getTechniqueGradeUpgradeCost(targetGrade: number, realmId: string): { materialId: string; amount: number } {
  return {
    materialId: getSpiritStoneMaterialIdForRealmTier(getRealmTier(realmId)),
    amount: 100 * targetGrade,
  }
}

export const TECHNIQUE_TIER_LABELS: Record<TechniqueTier, string> = {
  so_nhap: 'Sơ Nhập',
  tieu_thanh: 'Tiểu Thành',
  dai_thanh: 'Đại Thành',
  vien_man: 'Viên Mãn',
}
