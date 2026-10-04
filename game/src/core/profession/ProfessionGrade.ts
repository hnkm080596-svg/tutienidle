// ProfessionGrade (2026-08-24) - thang pham NGHE theo dai canh gioi cho
// toan bo kinh te Khai Thac/Tu Nghe (Dan/Phu/Tran/recipe/validator/UI).
//
// KHONG tai su dung thang Ngu Pham (ItemGrade) cua Equipment/Talisman -
// "pham nghe theo canh gioi" va "do hiem trang bi" la hai truc khac nhau
// (resource-professions-rework-plan.md sec3.1/sec13). Bang
// PROFESSION_GRADE_BY_REALM la NGUON SU THAT DUY NHAT - khong suy pham
// tu index rai rac tai call site.

/** Thang Cuu Pham (thap nhat) -> Tien Pham (cao nhat). */
export type ProfessionGrade =
  | 'cuu_pham'
  | 'bat_pham'
  | 'that_pham'
  | 'luc_pham'
  | 'ngu_pham'
  | 'tu_pham'
  | 'tam_pham'
  | 'nhi_pham'
  | 'nhat_pham'
  | 'tien_pham'

/** Thu tu tang dan: Cuu Pham (index 0) -> Tien Pham (index 9). */
export const PROFESSION_GRADE_ORDER: readonly ProfessionGrade[] = [
  'cuu_pham',
  'bat_pham',
  'that_pham',
  'luc_pham',
  'ngu_pham',
  'tu_pham',
  'tam_pham',
  'nhi_pham',
  'nhat_pham',
  'tien_pham',
]

/** Mapping co dinh realm -> pham nghe (plan sec3.1). Nguon su that duy nhat. */
export const PROFESSION_GRADE_BY_REALM: Readonly<Record<string, ProfessionGrade>> = {
  mortal: 'cuu_pham',
  qi_refining: 'bat_pham',
  foundation_establishment: 'that_pham',
  golden_core: 'luc_pham',
  nascent_soul: 'ngu_pham',
  soul_transformation: 'tu_pham',
  void_refinement: 'tam_pham',
  body_integration: 'nhi_pham',
  mahayana: 'nhat_pham',
  tribulation: 'tien_pham',
}

/** Ten hien thi - UI dung, khong ghep tu id. */
export const PROFESSION_GRADE_NAMES: Readonly<Record<ProfessionGrade, string>> = {
  cuu_pham: 'Cửu Phẩm',
  bat_pham: 'Bát Phẩm',
  that_pham: 'Thất Phẩm',
  luc_pham: 'Lục Phẩm',
  ngu_pham: 'Ngũ Phẩm',
  tu_pham: 'Tứ Phẩm',
  tam_pham: 'Tam Phẩm',
  nhi_pham: 'Nhị Phẩm',
  nhat_pham: 'Nhất Phẩm',
  tien_pham: 'Tiên Phẩm',
}

// Seal glyphs for the cell stamp (item-info-card spec 2026-09-14, seal
// art pass 2026-09-15): single Han characters rendered calligraphically
// inside the carved seal-frame art - 9..1 for the nine grades, then the
// immortal mark. Index order matches PROFESSION_GRADE_ORDER - seal
// rank = index + 1.
export const PROFESSION_GRADE_SEAL_ORDINALS = [
  '九', '八', '七', '六', '五', '四', '三', '二', '一', '仙',
] as const

export function isProfessionGrade(value: unknown): value is ProfessionGrade {
  return typeof value === 'string' && PROFESSION_GRADE_ORDER.includes(value as ProfessionGrade)
}

export function getProfessionGradeForRealm(realmId: string): ProfessionGrade | undefined {
  return PROFESSION_GRADE_BY_REALM[realmId]
}

export function getRealmIdForProfessionGrade(grade: ProfessionGrade): string | undefined {
  return Object.keys(PROFESSION_GRADE_BY_REALM).find(
    (realmId) => PROFESSION_GRADE_BY_REALM[realmId] === grade,
  )
}

export function realmFromGrade(grade: ProfessionGrade): string {
  const realmId = getRealmIdForProfessionGrade(grade)

  if (!realmId) {
    throw new Error(`Missing realm for profession grade ${grade}`)
  }

  return realmId
}

/** So sanh thu tu pham nghe: am neu a < b, duong neu a > b, 0 neu bang. */
export function compareProfessionGrades(a: ProfessionGrade, b: ProfessionGrade): number {
  return PROFESSION_GRADE_ORDER.indexOf(a) - PROFESSION_GRADE_ORDER.indexOf(b)
}
