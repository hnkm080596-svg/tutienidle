import { describe, expect, it } from 'vitest'
import { formatStat, statLabel } from './StatLabels'

describe('formatStat', () => {
  it('formatStat percent stats as % with 1 decimal', () => {
    expect(formatStat('maxMpPercent', 0.15)).toBe('15.0%')
    expect(formatStat('manaRegenPercent', 0.05)).toBe('5.0%')
    expect(formatStat('realmPassivePercent', 0.10)).toBe('10.0%')
    expect(formatStat('affixDeltaPercent', 0.05)).toBe('5.0%')
    expect(formatStat('cultivationPercent', 0.05)).toBe('5.0%')
  })

  it('formatStat multiplier stats as 2-decimal number', () => {
    expect(formatStat('speedMultiplier', 1.25)).toBe('1.25')
    expect(formatStat('artifactGradeMultiplier', 1.12)).toBe('1.12')
    expect(formatStat('artifactGradeMultiplier', 1)).toBe('1')
  })

  it('formatStat rounds multiplier to 2 decimal places', () => {
    expect(formatStat('speedMultiplier', 1.256)).toBe('1.26')
    expect(formatStat('speedMultiplier', 1.254)).toBe('1.25')
  })

  it('formatStat existing decimal stat keys work', () => {
    expect(formatStat('criticalDamage', 1.5)).toBe('1.5')
    expect(formatStat('attackSpeed', 1.25)).toBe('1.25')
  })

  it('formatStat existing flat stat keys use formatNumber', () => {
    expect(formatStat('attack', 1250)).toBe('1,250')
    expect(formatStat('maxHp', 0)).toBe('0')
  })
})

describe('statLabel', () => {
  it('returns label for format-adopted stat keys', () => {
    expect(statLabel('maxMpPercent')).toBe('Linh lực tối đa (Tâm Pháp)')
    expect(statLabel('manaRegenPercent')).toBe('Hồi Linh lực (Tâm Pháp)')
    expect(statLabel('realmPassivePercent')).toBe('Cộng % Cảnh Giới')
    expect(statLabel('affixDeltaPercent')).toBe('Tăng Trưởng Affix')
    expect(statLabel('speedMultiplier')).toBe('Hệ số tốc độ')
    expect(statLabel('artifactGradeMultiplier')).toBe('Hệ số Pháp Bảo')
    expect(statLabel('cultivationPercent')).toBe('Tu Vi (Đan Dược)')
  })
})
