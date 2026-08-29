import { describe, expect, it } from 'vitest'
import { KIEM_TU_NODES } from './KiemTuNodes'

// Kiếm Thế / Kiếm Ý (spec 2026-08-29) — cập nhật theo cây node mới:
// bat_kiem_thuc đã GỠ (route vĩnh viễn), thêm node ult/kiếm ý/on-hit.

describe('KiemTuNodes data validation', () => {
  it('chain Kiếm Trận đủ 9 trận đúng thứ tự realm (KHÔNG tính ult keystone)', () => {
    const tran = KIEM_TU_NODES.filter(
      (node) =>
        node.role === 'keystone' &&
        node.branchTag === 'kiem_tran' &&
        node.id.startsWith('kiem_tran_') &&
        !node.id.startsWith('kiem_tran_ult_'),
    )
    expect(tran.map((node) => node.id)).toEqual([
      'kiem_tran_luong_nghi', 'kiem_tran_tam_tai', 'kiem_tran_tu_tuong',
      'kiem_tran_ngu_hanh', 'kiem_tran_luc_dao', 'kiem_tran_that_tinh',
      'kiem_tran_bat_quai', 'kiem_tran_cuu_cung', 'kiem_tran_vo_cuc',
    ])
  })

  it('cây Bạt Kiếm KHÔNG chứa node giảm thời gian tụ', () => {
    const forbidden = KIEM_TU_NODES.filter(
      (node) =>
        node.branchTag === 'bat_kiem' &&
        JSON.stringify(node.effect).includes('tickSeconds') &&
        /"flat":\s*-/.test(JSON.stringify(node.effect)),
    )
    expect(forbidden).toHaveLength(0)
  })

  it('root Bạt Kiếm gate Lv3 + 9999 cast', () => {
    const root = KIEM_TU_NODES.find((node) => node.id === 'bat_kiem_an')!
    expect(root.prerequisites).toContainEqual({
      kind: 'skillCastCount', skillId: 'tram', level: 3, count: 9999,
    })
  })

  it('mỗi trận node (trừ Lưỡng Nghi) gate đúng realm VÀ trận trước', () => {
    const realmByRank = [
      'qi_refining', 'foundation_establishment', 'golden_core', 'nascent_soul',
      'soul_transformation', 'void_refinement', 'body_integration', 'mahayana', 'tribulation',
    ]
    const tranIds = [
      'kiem_tran_luong_nghi', 'kiem_tran_tam_tai', 'kiem_tran_tu_tuong',
      'kiem_tran_ngu_hanh', 'kiem_tran_luc_dao', 'kiem_tran_that_tinh',
      'kiem_tran_bat_quai', 'kiem_tran_cuu_cung', 'kiem_tran_vo_cuc',
    ]

    tranIds.forEach((id, index) => {
      const node = KIEM_TU_NODES.find((entry) => entry.id === id)!
      expect(node.prerequisites).toContainEqual({ kind: 'realm', realmId: realmByRank[index] })

      if (index > 0) {
        expect(node.prerequisites).toContainEqual({ kind: 'node', nodeId: tranIds[index - 1] })
      }
    })
  })

  it('bat_kiem_thuc đã GỠ — route vĩnh viễn không cần gate đổi (spec 2026-08-29)', () => {
    expect(KIEM_TU_NODES.find((node) => node.id === 'bat_kiem_thuc')).toBeUndefined()
  })

  it('cây Bạt Kiếm chỉ chứa stat tăng-tường/damage/phòng-thủ, không đụng tickSeconds', () => {
    const bonusNodes = KIEM_TU_NODES.filter(
      (node) => node.branchTag === 'bat_kiem' && node.id !== 'bat_kiem_an',
    )
    // Spec 2026-08-29 mục 3.3/5.3 — node BK mới thêm chỉ số công/thủ
    // (đỡ đòn, chí mạng, né tránh, tốc đánh) của node chuyển skill cũ
    // + node công năng kiếm ý.
    const allowedStats = new Set([
      'skillDamagePercent', 'wardMax', 'ailmentResistPercent', 'finalDamageReductionPercent', 'metalPower',
      'blockChance', 'blockEffectiveness', 'criticalRate', 'criticalDamage', 'evasionRate', 'attackSpeed',
    ])

    for (const node of bonusNodes) {
      for (const modifier of node.effect.statModifiers ?? []) {
        expect(allowedStats.has(modifier.stat)).toBe(true)
        // Không node nào được phép có flat/percent âm (giảm bất kỳ chỉ số nào trong nhóm này).
        expect(modifier.flat ?? 0).toBeGreaterThanOrEqual(0)
        expect(modifier.percent ?? 0).toBeGreaterThanOrEqual(0)
      }

      expect(JSON.stringify(node.effect)).not.toContain('tickSeconds')
    }
  })
})
