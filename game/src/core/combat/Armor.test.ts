// @vitest-environment node
// T5.4 (2026-09-01) — Armor K scale theo realmIndex (user-approved:
// phương án A — K = 50 × (1 + realmIndex × 0.8)). Giữ DNA Last Epoch
// (K mỗi level tăng, armor cũ giảm hiệu lực theo tiến trình) nhưng
// đơn giản hoá theo realm (10 bậc) thay vì per-level.
import { describe, expect, it } from 'vitest'
import { getArmorMitigationPercent, armorKForRealm } from './Armor'

describe('Armor — K scale theo realmIndex (T5.4)', () => {
  it('Phàm Nhân (realmIndex 0): K=50 như cũ — armor 10 → 16.7%', () => {
    expect(armorKForRealm(0)).toBe(50)
    expect(getArmorMitigationPercent(10, 0)).toBeCloseTo(10 / 60, 6)
  })

  it('mỗi realm +0.8× K: realm 4 (Kim Đan) K=210, realm 9 (Độ Kiếp) K=410', () => {
    expect(armorKForRealm(4)).toBeCloseTo(50 * (1 + 4 * 0.8))
    expect(armorKForRealm(9)).toBeCloseTo(50 * (1 + 9 * 0.8))
  })

  it('armor cũ tự giảm hiệu lực khi lên realm: armor 150 (75% ở Phàm Nhân) chỉ còn ~27% ở Độ Kiếp', () => {
    const mortal = getArmorMitigationPercent(150, 0)
    const tribulation = getArmorMitigationPercent(150, 9)

    expect(mortal).toBeCloseTo(0.75) // chạm trần
    expect(tribulation).toBeCloseTo(150 / (150 + 410), 6)
    expect(tribulation).toBeLessThan(0.3)
  })

  it('trần 75% giữ nguyên mọi realm — không bao giờ vượt', () => {
    expect(getArmorMitigationPercent(100000, 9)).toBe(0.75)
  })

  it('armor <= 0 → 0 mọi realm; realmIndex âm → coi như 0', () => {
    expect(getArmorMitigationPercent(0, 5)).toBe(0)
    expect(getArmorMitigationPercent(-5, 5)).toBe(0)
    expect(getArmorMitigationPercent(10, -3)).toBeCloseTo(10 / 60, 6)
  })

  it('backward-compat: gọi thiếu realmIndex mặc định 0 (callers cũ không vỡ)', () => {
    expect(getArmorMitigationPercent(10)).toBeCloseTo(10 / 60, 6)
  })
})
