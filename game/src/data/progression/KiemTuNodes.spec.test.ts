import { describe, expect, it } from 'vitest'
import { KIEM_TU_NODES } from './KiemTuNodes'
import type { ProgressionNode } from '../../core/progression/ProgressionNode'

// Kiếm Thế / Kiếm Ý (spec 2026-08-29-kiem-the-kiem-y mục 4/5.3/3.3) —
// node data: 9 on-hit (2-9 theo cấp trận), 2 node ult unlock, 7 node
// chuyển skill cũ thành passive, node công năng kiếm ý BK, gỡ
// bat_kiem_thuc (route vĩnh viễn không cần gate đổi).

const ON_HIT_IDS = [
  'onhit_khiem_khi',
  'onhit_khiem_phong',
  'onhit_xuat_huyet',
  'onhit_tran_tru',
  'onhit_phan_kich',
  'onhit_hap_linh',
  'onhit_pha_giap',
  'onhit_quang_crit',
  'onhit_kiem_than',
] as const

describe('KiemTuNodes — on-hit Kiếm Trận (spec mục 4)', () => {
  it('đủ 9 node on-hit, branchTag kiem_tran, maxLevel 5, chance 3%/level max 15%', () => {
    for (const id of ON_HIT_IDS) {
      const node = KIEM_TU_NODES.find((n) => n.id === id)
      expect(node, `missing ${id}`).toBeDefined()
      expect(node!.branchTag).toBe('kiem_tran')
      expect(node!.maxLevel).toBe(5)
      expect(node!.type).toBe('minor')
      expect(node!.role).toBe('growth')
      const onHit = node!.effect.onHitEffect
      expect(onHit, `${id} thiếu onHitEffect`).toBeDefined()
      expect(onHit!.baseChancePercent).toBe(3)
      expect(onHit!.perLevelChancePercent).toBe(3)
      expect(3 + 3 * 4).toBe(15) // Lv5 = 15%
    }
  })

  it('4 node đầu mở theo trận trong-scope (Lưỡng Nghi/Tam Tài), 5 node sau gắn trận cao hơn', () => {
    const prereqOf = (id: string) => {
      const node = KIEM_TU_NODES.find((n) => n.id === id)!
      const nodePrereq = node.prerequisites?.find((p) => p.kind === 'node')
      return nodePrereq && 'nodeId' in nodePrereq ? nodePrereq.nodeId : undefined
    }
    // Lưỡng Nghi mở 2 node đầu, Tam Tài mở 2 node kế
    expect(prereqOf('onhit_khiem_khi')).toBe('kiem_tran_luong_nghi')
    expect(prereqOf('onhit_khiem_phong')).toBe('kiem_tran_luong_nghi')
    expect(prereqOf('onhit_xuat_huyet')).toBe('kiem_tran_tam_tai')
    expect(prereqOf('onhit_tran_tru')).toBe('kiem_tran_tam_tai')
    // 5 node sau gắn Tứ Tượng+ (realm ngoài scope, data chờ)
    expect(prereqOf('onhit_phan_kich')).toBe('kiem_tran_tu_tuong')
    expect(prereqOf('onhit_kiem_than')).toBe('kiem_tran_that_tinh')
  })

  it('mỗi node on-hit khai đúng kind thuộc union 9 loại', () => {
    const validKinds = new Set([
      'khiem_khi_dmg',
      'khiem_phong_haste',
      'xuat_huyet_dot',
      'tran_tru_cc',
      'phan_kich_dodge',
      'hap_linh_leech',
      'pha_giap_pen',
      'quang_crit',
      'than_ngu_hanh',
    ])
    for (const id of ON_HIT_IDS) {
      const node = KIEM_TU_NODES.find((n) => n.id === id)!
      expect(validKinds.has(node.effect.onHitEffect!.kind)).toBe(true)
    }
  })
})

describe('KiemTuNodes — node ult unlock (spec mục 2/3.4)', () => {
  it('kiem_tran_ult_tru_tien unlock TTKT, gate Trúc Cơ + Tam Tài', () => {
    const node = KIEM_TU_NODES.find((n) => n.id === 'kiem_tran_ult_tru_tien')
    expect(node).toBeDefined()
    expect(node!.branchTag).toBe('kiem_tran')
    expect(node!.effect.unlocksSkillIds).toEqual(['tru_tien_kiem_tran'])
    expect(node!.prerequisites).toContainEqual({ kind: 'realm', realmId: 'foundation_establishment' })
    expect(node!.prerequisites).toContainEqual({ kind: 'node', nodeId: 'kiem_tran_tam_tai' })
  })

  it('bat_kiem_ult_khai_thien unlock KKTM, gate Bạt Kiếm Ấn', () => {
    const node = KIEM_TU_NODES.find((n) => n.id === 'bat_kiem_ult_khai_thien')
    expect(node).toBeDefined()
    expect(node!.branchTag).toBe('bat_kiem')
    expect(node!.effect.unlocksSkillIds).toEqual(['kiem_khai_thien_mon'])
    expect(node!.prerequisites).toContainEqual({ kind: 'node', nodeId: 'bat_kiem_an' })
  })
})

describe('KiemTuNodes — node chuyển skill cũ thành passive (spec mục 5.3)', () => {
  it('5 node passive tồn tại đúng branch + tên (KKTM là ult; Kiếm Tâm Lãnh Liệt giữ làm innate tâm pháp)', () => {
    const expected: Array<{ id: string; name: string; branch: string }> = [
      { id: 'passive_ngu_kiem_thuat', name: 'Ngự Kiếm Thuật', branch: 'kiem_tran' },
      { id: 'passive_van_kiem_trieu_tong', name: 'Vạn Kiếm Triều Tông', branch: 'kiem_tran' },
      { id: 'passive_thai_hu_nhat_kiem', name: 'Thái Hư Nhất Kiếm', branch: 'bat_kiem' },
      { id: 'passive_phieu_van_bo', name: 'Phiêu Vân Bộ', branch: 'bat_kiem' },
      { id: 'passive_pha_thien_nhat_kich', name: 'Phá Thiên Nhất Kích', branch: 'bat_kiem' },
    ]
    for (const e of expected) {
      const node = KIEM_TU_NODES.find((n) => n.id === e.id)
      expect(node, `missing ${e.id}`).toBeDefined()
      expect(node!.name).toBe(e.name)
      expect(node!.branchTag).toBe(e.branch)
    }
    // Kiếm Tâm Lãnh Liệt KHÔNG thành node — giữ nguyên passive innate
    // của tâm pháp Ngự Kiếm (tránh double-dip crit stack).
    expect(KIEM_TU_NODES.find((n) => n.id === 'passive_kiem_tam_lanh_liet')).toBeUndefined()
  })
})

describe('KiemTuNodes — node công năng kiếm ý BK (spec mục 3.3)', () => {
  it('bat_kiem_do_don, bat_kiem_hoi_sinh, bat_kiem_amp_hoi_phuc tồn tại', () => {
    for (const id of ['bat_kiem_do_don', 'bat_kiem_hoi_sinh', 'bat_kiem_amp_hoi_phuc'] as const) {
      const node = KIEM_TU_NODES.find((n) => n.id === id)
      expect(node, `missing ${id}`).toBeDefined()
      expect(node!.branchTag).toBe('bat_kiem')
    }
    // Hồi sinh là major node (đổi behavior — 1 lần/trận)
    expect(KIEM_TU_NODES.find((n) => n.id === 'bat_kiem_hoi_sinh')!.type).toBe('major')
  })
})

describe('KiemTuNodes — gỡ bat_kiem_thuc (route vĩnh viễn)', () => {
  it('bat_kiem_thuc KHÔNG còn trong cây — route chốt ở Quán Khí', () => {
    expect(KIEM_TU_NODES.find((n) => n.id === 'bat_kiem_thuc')).toBeUndefined()
  })

  it('id node duy nhất trong cây', () => {
    const ids = KIEM_TU_NODES.map((n) => n.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
