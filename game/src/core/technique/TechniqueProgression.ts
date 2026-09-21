import { getSpiritStoneMaterialIdForRealmTier } from '../material/SpiritStoneMaterial'
import { getRealmIndex } from '../realm/realmSystem'
import { getRealmTier } from '../realm/RealmTierMap'
import type { Technique, TechniqueTier, TechniqueTierEffect } from './Technique'

// P7-M3 - Canonical technique progression helpers. Leaf module: only
// type + realm/material leaf imports so way modules and core ops can
// both use it without cycles. Replaces the retired TechniqueTier.ts
// insight-share model (BASE_TECHNIQUE_INSIGHT_REQUIRED /
// TECHNIQUE_TIER_COST_SHARES / getTechniqueTierProgress).

export const TECHNIQUE_RANK_CAP = 10

export const BASE_RANK_MASTERY = 300

// Mastery needed for the NEXT rank inside `grade` - 300 x grade
// (grade 1 = 300/rank, grade 2 = 600/rank, ...). Spec sec. 4.2.
export function getTechniqueMasteryForNextRank(grade: number): number {
  return BASE_RANK_MASTERY * grade
}

// Rank bands reuse the legacy four-tier vocabulary as DISPLAY bands:
// 0 so_nhap, 1-2 tieu_thanh, 3-5 dai_thanh, 6-10 vien_man.
export function getTechniqueTierForRank(rank: number): TechniqueTier {
  if (rank >= 6) return 'vien_man'
  if (rank >= 3) return 'dai_thanh'
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

export function canAdvanceTechniqueGrade(technique: Technique | undefined, realmId: string): boolean {
  return !!technique && technique.rank >= TECHNIQUE_RANK_CAP && technique.grade < getTechniqueGradeCeiling(realmId)
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
