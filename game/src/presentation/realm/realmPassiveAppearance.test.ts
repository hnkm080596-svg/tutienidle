import { describe, expect, it } from 'vitest'
import { realmPassiveAppearance } from './realmPassiveAppearance'
const t = (key: string, values?: Record<string, unknown>) => `${key}:${values?.tier ?? ''}`
describe('realm passive earned tier presentation', () => {
  it('distinguishes all six earned Nhap Dao grades without inventing new stats', () => {
    for (let grade = 1; grade <= 6; grade++) {
      const card = realmPassiveAppearance('qi_refining', { breakthroughGrade: grade, highestFoundationAchieved: undefined }, false, t)
      expect(card.tierIndex).toBe(grade)
      expect(card.tierCount).toBe(6)
      expect(card.tierLabel).toBe(`realmPassive.tier:${grade}`)
      expect(card.iconUrl).toContain('nhap-dao')
    }
  })
  it('keeps an earned hidden variant distinct rather than pretending it is grade six', () => {
    const card = realmPassiveAppearance('qi_refining', { breakthroughGrade: 6, highestFoundationAchieved: undefined }, true, t)
    expect(card.tierLabel).toBe('realmPassive.perfected:')
    expect(card.tierIndex).toBe(7)
    expect(card.tierCount).toBe(7)
  })
  it('shows the recorded foundation type and does not resolve eligibility', () => {
    const card = realmPassiveAppearance('foundation_establishment', { breakthroughGrade: 1, highestFoundationAchieved: 'heaven' }, false, t)
    expect(card.tierIndex).toBe(3)
    expect(card.tierLabel).toBe('realmPassive.foundation.heaven:')
  })
})

