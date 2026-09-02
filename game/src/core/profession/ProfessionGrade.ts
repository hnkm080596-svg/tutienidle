// ProfessionGrade (2026-08-24) — thang phẩm NGHỀ theo đại cảnh giới cho
// toàn bộ kinh tế Khai Thác/Tứ Nghệ (Đan/Phù/Trận/recipe/validator/UI).
//
// KHÔNG tái sử dụng thang Ngũ Phẩm (ItemGrade) của Equipment/Talisman —
// "phẩm nghề theo cảnh giới" và "độ hiếm trang bị" là hai trục khác nhau
// (resource-professions-rework-plan.md §3.1/§13). Bảng
// PROFESSION_GRADE_BY_REALM là NGUỒN SỰ THẬT DUY NHẤT — không suy phẩm
// từ index rải rác tại call site.

/** Thang Cửu Phẩm (thấp nhất) → Tiên Phẩm (cao nhất). */
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

/** Thứ tự tăng dần: Cửu Phẩm (index 0) → Tiên Phẩm (index 9). */
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

/** Mapping cố định realm → phẩm nghề (plan §3.1). Nguồn sự thật duy nhất. */
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

/** Tên hiển thị — UI dùng, không ghép từ id. */
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

/** So sánh thứ tự phẩm nghề: âm nếu a < b, dương nếu a > b, 0 nếu bằng. */
export function compareProfessionGrades(a: ProfessionGrade, b: ProfessionGrade): number {
  return PROFESSION_GRADE_ORDER.indexOf(a) - PROFESSION_GRADE_ORDER.indexOf(b)
}
