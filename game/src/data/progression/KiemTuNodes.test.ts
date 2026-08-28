import { describe, expect, it } from 'vitest'
import { KIEM_TU_NODES } from './KiemTuNodes'

describe('KiemTuNodes data validation', () => {
  it('chain Kiếm Trận đủ 9 trận đúng thứ tự realm', () => {
    const tran = KIEM_TU_NODES.filter((node) => node.role === 'keystone' && node.branchTag === 'kiem_tran')
    expect(tran.map((node) => node.id)).toEqual([
      'kiem_tran_luong_nghi', 'kiem_tran_tam_tai', 'kiem_tran_tu_tuong',
      'kiem_tran_ngu_hanh', 'kiem_tran_luc_dao', 'kiem_tran_that_tinh',
      'kiem_tran_bat_quai', 'kiem_tran_cuu_cung', 'kiem_tran_vo_cuc',
    ])
  })

  it('cây Bạt Kiếm KHÔNG chứa node giảm thời gian tụ', () => {
    const forbidden = KIEM_TU_NODES.filter(
      (node) => node.branchTag === 'bat_kiem' &&
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

  it('keystone bat_kiem_thuc gate bởi root bat_kiem_an và mua được sau khi mua root', () => {
    const keystone = KIEM_TU_NODES.find((node) => node.id === 'bat_kiem_thuc')!
    expect(keystone.role).toBe('keystone')
    expect(keystone.branchTag).toBe('bat_kiem')
    expect(keystone.prerequisites).toContainEqual({ kind: 'node', nodeId: 'bat_kiem_an' })
  })

  it('cây Bạt Kiếm chỉ chứa stat tăng-tường/damage/phòng-thủ trong lúc tụ, không đụng tickSeconds', () => {
    const bonusNodes = KIEM_TU_NODES.filter((node) => node.branchTag === 'bat_kiem' && node.id !== 'bat_kiem_an' && node.id !== 'bat_kiem_thuc')
    const allowedStats = new Set(['skillDamagePercent', 'wardMax', 'ailmentResistPercent', 'finalDamageReductionPercent', 'metalPower'])

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
