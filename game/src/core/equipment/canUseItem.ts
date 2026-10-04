import type { ProfessionGrade } from '../profession/ProfessionGrade'
import { getProfessionGradeForRealm } from '../profession/ProfessionGrade'
import { REALMS } from '../../data/realms/realm'

export function canUseItemGrade(itemGrade: ProfessionGrade, playerRealmId: string): boolean {
  return getProfessionGradeForRealm(playerRealmId) === itemGrade
}

// F-SCOPE-EQ-1: `equipped:true` is a writer-gated claim - equip()
// enforces canUseItemGrade and every tribulation transition unequips
// all gear, so the only producible equipped grades are the current
// realm's own plus whatever survived the last non-unequip transition.
// The mortal -> qi_refining initiation is the single authored
// non-unequip transition: qi_refining may still carry equipped
// cuu_pham, every other realm admits only its own grade.
export function producibleEquippedGrades(playerRealmId: string): ReadonlySet<ProfessionGrade> {
  const grades = new Set<ProfessionGrade>()
  const own = getProfessionGradeForRealm(playerRealmId)
  if (own !== undefined) grades.add(own)
  if (playerRealmId === 'qi_refining') {
    const mortalGrade = getProfessionGradeForRealm('mortal')
    if (mortalGrade !== undefined) grades.add(mortalGrade)
  }
  return grades
}

// Producible realms for the equipped-grade claim check: every authored
// realm id. Kept as a predicate so the caller can stay shape-level.
export function isAuthoredRealmId(realmId: string): boolean {
  return REALMS.some((realm) => realm.id === realmId)
}
