import type { ProfessionGrade } from '../profession/ProfessionGrade'
import { getProfessionGradeForRealm } from '../profession/ProfessionGrade'

export function canUseItemGrade(itemGrade: ProfessionGrade, playerRealmId: string): boolean {
  return getProfessionGradeForRealm(playerRealmId) === itemGrade
}
