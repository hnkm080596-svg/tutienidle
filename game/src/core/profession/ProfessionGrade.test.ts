// Mapping realm → phẩm nghề phải 1-1 đủ MƯỜI realm, khớp REALMS data
// (plan §11: "Mười realm map một-một sang Cửu…Tiên, không trùng/missing").
import { describe, expect, it } from 'vitest'
import { REALMS } from '../../data/realms/realm'
import {
  PROFESSION_GRADE_BY_REALM,
  PROFESSION_GRADE_NAMES,
  PROFESSION_GRADE_ORDER,
  compareProfessionGrades,
  getProfessionGradeForRealm,
  getRealmIdForProfessionGrade,
  isProfessionGrade,
} from './ProfessionGrade'

describe('ProfessionGrade — mapping realm → phẩm nghề', () => {
  it('đủ MƯỜI realm, mỗi realm đúng một phẩm, không trùng/missing', () => {
    const realmIds = REALMS.map((realm) => realm.id)

    expect(realmIds).toHaveLength(10)
    expect(Object.keys(PROFESSION_GRADE_BY_REALM)).toHaveLength(10)

    for (const realmId of realmIds) {
      expect(PROFESSION_GRADE_BY_REALM[realmId]).toBeDefined()
    }

    const grades = realmIds.map((realmId) => PROFESSION_GRADE_BY_REALM[realmId])

    expect(new Set(grades).size).toBe(10)
    expect([...grades].sort()).toEqual([...PROFESSION_GRADE_ORDER].sort())
  })

  it('thứ tự mapping đúng bảng plan: Phàm Nhân=Cửu Phẩm … Độ Kiếp=Tiên Phẩm', () => {
    expect(getProfessionGradeForRealm('mortal')).toBe('cuu_pham')
    expect(getProfessionGradeForRealm('qi_refining')).toBe('bat_pham')
    expect(getProfessionGradeForRealm('foundation_establishment')).toBe('that_pham')
    expect(getProfessionGradeForRealm('golden_core')).toBe('luc_pham')
    expect(getProfessionGradeForRealm('nascent_soul')).toBe('ngu_pham')
    expect(getProfessionGradeForRealm('soul_transformation')).toBe('tu_pham')
    expect(getProfessionGradeForRealm('void_refinement')).toBe('tam_pham')
    expect(getProfessionGradeForRealm('body_integration')).toBe('nhi_pham')
    expect(getProfessionGradeForRealm('mahayana')).toBe('nhat_pham')
    expect(getProfessionGradeForRealm('tribulation')).toBe('tien_pham')
  })

  it('lookup ngược realm ↔ grade là ánh xạ hai chiều', () => {
    for (const [realmId, grade] of Object.entries(PROFESSION_GRADE_BY_REALM)) {
      expect(getRealmIdForProfessionGrade(grade)).toBe(realmId)
    }

    expect(getProfessionGradeForRealm('unknown_realm')).toBeUndefined()
  })

  it('compareProfessionGrades theo thứ tự Cửu → Tiên', () => {
    expect(compareProfessionGrades('cuu_pham', 'tien_pham')).toBeLessThan(0)
    expect(compareProfessionGrades('tien_pham', 'cuu_pham')).toBeGreaterThan(0)
    expect(compareProfessionGrades('bat_pham', 'bat_pham')).toBe(0)
    expect(compareProfessionGrades('that_pham', 'luc_pham')).toBeLessThan(0)
  })

  it('isProfessionGrade + tên hiển thị đủ 10 phẩm', () => {
    expect(isProfessionGrade('cuu_pham')).toBe(true)
    expect(isProfessionGrade('hoang_pham')).toBe(false)
    expect(isProfessionGrade(42)).toBe(false)

    expect(Object.keys(PROFESSION_GRADE_NAMES)).toHaveLength(10)
    expect(PROFESSION_GRADE_NAMES.cuu_pham).toBe('Cửu Phẩm')
    expect(PROFESSION_GRADE_NAMES.tien_pham).toBe('Tiên Phẩm')
  })
})
