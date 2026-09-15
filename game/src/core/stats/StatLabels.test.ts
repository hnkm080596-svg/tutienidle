import { describe, expect, it } from 'vitest'
import { formatStat, statLabel } from './StatLabels'

describe('formatStat', () => {
  it('formatStat percent stats as % with 1 decimal', () => {
    expect(formatStat('skillDamagePercent', 0.15)).toBe('15.0%')
    expect(formatStat('ailmentPotencyPercent', 0.05)).toBe('5.0%')
    expect(formatStat('realmPassivePercent', 0.10)).toBe('10.0%')
    expect(formatStat('affixDeltaPercent', 0.05)).toBe('5.0%')
    expect(formatStat('cultivationPercent', 0.05)).toBe('5.0%')
  })

  it('formatStat multiplier stats as 2-decimal number', () => {
    expect(formatStat('productionSpeedMultiplier', 1.25)).toBe('1.25')
    expect(formatStat('artifactGradeMultiplier', 1.12)).toBe('1.12')
    expect(formatStat('artifactGradeMultiplier', 1)).toBe('1')
  })

  it('formatStat rounds multiplier to 2 decimal places', () => {
    expect(formatStat('productionSpeedMultiplier', 1.256)).toBe('1.26')
    expect(formatStat('productionSpeedMultiplier', 1.254)).toBe('1.25')
  })

  it('criticalDamage displays as % while staying a multiplier in formulas — bug 2026-09-01', () => {
    // Base 1.5 (multiplier ×1.5 trong CombatSystem) → hiển thị "150%"
    // (100% đòn thường + 50% bonus). Display-only: unit vẫn multiplier.
    expect(formatStat('criticalDamage', 1.5)).toBe('150%')
    expect(formatStat('criticalDamage', 1.05)).toBe('105%')
    expect(formatStat('criticalDamage', 2.0)).toBe('200%')
  })

  it('blockEffectiveness is a percent stat — displays %, not raw fraction', () => {
    // Bug hệ thống: từng rơi vào DECIMAL_STAT_KEYS hiển thị "0.25".
    expect(formatStat('blockEffectiveness', 0.25)).toBe('25.0%')
    expect(formatStat('blockEffectiveness', 0.75)).toBe('75.0%')
  })

  it('speed is a flat rating stat — displays via formatNumber, not 2-decimal', () => {
    // Turn-based conversion (2026-09-04): speed ~100 scale (HSR SPD),
    // không còn multiplier 2-chữ-số như attackSpeed cũ.
    expect(formatStat('speed', 115)).toBe('115')
  })

  it('formatStat existing flat stat keys use formatNumber', () => {
    expect(formatStat('might', 1250)).toBe('1,250')
    expect(formatStat('maxHp', 0)).toBe('0')
  })
})

describe('statLabel', () => {
  it('returns label for format-adopted stat keys', () => {
    expect(statLabel('skillDamagePercent')).toBe('Sát thương kỹ năng')
    expect(statLabel('ailmentPotencyPercent')).toBe('Uy lực dị thường')
    expect(statLabel('realmPassivePercent')).toBe('Cộng % Cảnh Giới')
    expect(statLabel('affixDeltaPercent')).toBe('Tăng Trưởng Affix')
    expect(statLabel('productionSpeedMultiplier')).toBe('Hệ số tốc độ')
    expect(statLabel('artifactGradeMultiplier')).toBe('Hệ số Pháp Bảo')
    expect(statLabel('cultivationPercent')).toBe('Tu Vi (Đan Dược)')
  })
})
