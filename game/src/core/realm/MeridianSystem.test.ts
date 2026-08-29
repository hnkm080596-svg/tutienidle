import { describe, it, expect } from 'vitest'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { MERIDIANS } from '../../data/realm/Meridians'
import { investThongMachDan, getOpenedMeridianCount, applyMeridianModifiers } from './MeridianSystem'

function createLuyenKhiPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'qi_refining'
  player.realmLevel = 18
  return player
}

describe('MeridianSystem — Bát Mạch (spec dot-pha-loi-kiep §4.1a)', () => {
  it('data: 9 đường đúng thứ tự Nhâm → Đốc + Kỳ Kinh tầng 18, cost tăng dần, KHÔNG chạm mana', () => {
    expect(MERIDIANS.map((m) => m.id)).toEqual([
      'nham_mach', 'doi_mach', 'am_kieu_mach', 'am_duy_mach',
      'duong_duy_mach', 'duong_kieu_mach', 'xung_mach', 'doc_mach', 'ky_kinh_thien_dia_chi_kieu',
    ])
    expect(MERIDIANS[0]!.requiredRealmLevel).toBe(2)
    expect(MERIDIANS[7]!.requiredRealmLevel).toBe(16)
    expect(MERIDIANS[8]!.requiredRealmLevel).toBe(18)
    expect(MERIDIANS[8]!.requiresThienDiaChiKieu).toBe(true)
    // mana bị cấm (Global Constraint) — maxMp/manaRegenPerSecond không được xuất hiện
    const allStats = MERIDIANS.flatMap((m) => m.stats)
    expect(allStats).not.toContain('maxMp')
    expect(allStats).not.toContain('manaRegenPerSecond')
    // cost tăng dần đều (tuần tự đầu tư)
    for (let i = 1; i < MERIDIANS.length; i++) {
      expect(MERIDIANS[i]!.thongMachDanCost).toBeGreaterThan(MERIDIANS[i - 1]!.thongMachDanCost)
    }
  })

  it('tuần tự: đường đầu (Nhâm) mở với đúng cost 1 đan', () => {
    const player = createLuyenKhiPlayer()
    player.openedMeridianIds = []
    const consumed = investThongMachDan(player, 10)
    expect(consumed).toBe(1)
    expect(player.openedMeridianIds).toEqual(['nham_mach'])
  })

  it('gate tầng: đứng tầng 3 (Luyện Khí) không đầu tư đường 2 (mở tầng 4)', () => {
    const player = createLuyenKhiPlayer()
    player.realmLevel = 3
    player.openedMeridianIds = ['nham_mach']
    expect(investThongMachDan(player, 10)).toBe(0)
    expect(player.openedMeridianIds).toEqual(['nham_mach'])
  })

  it('Kỳ Kinh (đường 9) cần cả Thông Mạch Đan lẫn Thiên Địa Chi Kiều', () => {
    const player = createLuyenKhiPlayer()
    player.openedMeridianIds = MERIDIANS.slice(0, 8).map((m) => m.id)
    // có 40 đan nhưng KHÔNG có Thiên Địa Chi Kiều -> không mở
    const consumed = investThongMachDan(player, 40)
    expect(consumed).toBe(0)
    expect(player.openedMeridianIds).toHaveLength(8)
  })

  it('đủ 9/9: mở Kỳ Kinh khi có cả 2 nguyên liệu, passive áp đủ 9 đường', () => {
    const player = createLuyenKhiPlayer()
    player.openedMeridianIds = MERIDIANS.slice(0, 8).map((m) => m.id)
    const consumed = investThongMachDan(player, 40, 1)
    expect(consumed).toBe(40)
    expect(player.openedMeridianIds).toHaveLength(9)
    applyMeridianModifiers(player)
    expect(player.modifiers.filter((m) => m.id.startsWith('bat-mach:')).length).toBe(
      MERIDIANS.reduce((sum, m) => sum + m.stats.length, 0),
    )
  })

  it('rời Luyện Khí (đã vào Trúc Cơ): vẫn được tiêu nốt đan dở (pattern Luyện Th thể)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.openedMeridianIds = ['nham_mach']
    const consumed = investThongMachDan(player, 5)
    expect(consumed).toBe(2) // Đới Mạch cost 2
    expect(getOpenedMeridianCount(player)).toBe(2)
  })
})
