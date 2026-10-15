import type { ProfessionGrade } from '../profession/ProfessionGrade'
import {
  PROFESSION_GRADE_ORDER,
  compareProfessionGrades,
  getProfessionGradeForRealm,
} from '../profession/ProfessionGrade'
import { REALMS } from '../../data/realms/realm'

export function canUseItemGrade(itemGrade: ProfessionGrade, playerRealmId: string): boolean {
  const playerGrade = getProfessionGradeForRealm(playerRealmId)
  if (playerGrade === undefined) return false
  return compareProfessionGrades(itemGrade, playerGrade) <= 0
}

// F-SCOPE-EQ-1: `equipped:true` is a writer-gated claim - equip()
// enforces canUseItemGrade (item grade <= current realm's grade), so
// the producible equipped grades for a realm are its own grade and any
// lower realm grade. Higher-grade equipment remains rejected.
export function producibleEquippedGrades(playerRealmId: string): ReadonlySet<ProfessionGrade> {
  const grades = new Set<ProfessionGrade>()
  const own = getProfessionGradeForRealm(playerRealmId)
  if (own === undefined) return grades
  for (const grade of PROFESSION_GRADE_ORDER) {
    if (compareProfessionGrades(grade, own) <= 0) {
      grades.add(grade)
    }
  }
  return grades
}

// Producible realms for the equipped-grade claim check: every authored
// realm id. Kept as a predicate so the caller can stay shape-level.
export function isAuthoredRealmId(realmId: string): boolean {
  return REALMS.some((realm) => realm.id === realmId)
}
