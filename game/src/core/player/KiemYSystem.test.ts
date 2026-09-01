import { describe, expect, it } from 'vitest'
import {
  getKiemYDamageMultipliers,
  getKiemYPermanent,
  getKiemYTier,
  MAX_KIEM_Y_TIER,
} from './KiemYSystem'

// Spec 2026-08-29-kiem-the-kiem-y mục 3.1/3.3 — tầng Kiếm Ý vĩnh viễn
// theo boss diệt: tầng N cần tổng 10 + 5×(N-1) boss cộng dồn (t1: 10,
// t2: 25, t3: 45, t4: 70...), mỗi tầng +10 kiếm ý vĩnh viễn.
describe('KiemYSystem — tầng kiếm ý vĩnh viễn theo boss diệt', () => {
  it('tầng 0 khi chưa diệt boss nào', () => {
    expect(getKiemYTier(0)).toBe(0)
    expect(getKiemYPermanent(0)).toBe(0)
  })

  it('tầng 1 tại 10 boss, tầng 2 tại 25, tầng 3 tại 45 (chi phí tăng dần)', () => {
    expect(getKiemYTier(9)).toBe(0)
    expect(getKiemYTier(10)).toBe(1)
    expect(getKiemYTier(24)).toBe(1)
    expect(getKiemYTier(25)).toBe(2)
    expect(getKiemYTier(45)).toBe(3)
    expect(getKiemYTier(70)).toBe(4)
  })

  it('+10 Kiếm Ý vĩnh viễn mỗi tầng', () => {
    expect(getKiemYPermanent(25)).toBe(20)
    expect(getKiemYPermanent(45)).toBe(30)
    expect(getKiemYPermanent(0)).toBe(0)
  })

  it('multiplier sát thương theo tầng: 0.5%/tầng mỗi loại (thay SwordIntentSystem cũ)', () => {
    expect(getKiemYDamageMultipliers(0)).toEqual({
      skillDamagePercent: 0,
      criticalRate: 0,
      criticalDamage: 0,
    })
    expect(getKiemYDamageMultipliers(2)).toEqual({
      skillDamagePercent: 0.01,
      criticalRate: 0.01,
      criticalDamage: 0.01,
    })
    expect(getKiemYDamageMultipliers(10)).toEqual({
      skillDamagePercent: 0.05,
      criticalRate: 0.05,
      criticalDamage: 0.05,
    })
  })
})

// Audit fix 2026-08-31 — ceiling guard: bossKillCount không được validate
// trong save shape, hand-edit 1e300 từng treo UI thread O(√n) vòng.
describe('getKiemYTier — ceiling guard (audit 2026-08-31)', () => {
  it('bossKillCount khổng lồ không treo — trả ceiling', () => {
    expect(getKiemYTier(1e300)).toBe(MAX_KIEM_Y_TIER)
  })

  it('giá trị thường vẫn đúng theo công thức cộng dồn', () => {
    expect(getKiemYTier(0)).toBe(0)
    expect(getKiemYTier(9)).toBe(0)
    expect(getKiemYTier(10)).toBe(1) // t1: 10
    expect(getKiemYTier(25)).toBe(2) // t2: 25
    expect(getKiemYTier(45)).toBe(3) // t3: 45
    expect(getKiemYTier(70)).toBe(4) // t4: 70
  })

  it('âm/NaN không tăng tier', () => {
    expect(getKiemYTier(-5)).toBe(0)
    expect(getKiemYTier(Number.NaN)).toBe(0)
  })
})
