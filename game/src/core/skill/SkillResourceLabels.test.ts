import { describe, it, expect } from 'vitest'
import { skillResourceTypeLabel, SKILL_RESOURCE_TYPE_LABELS } from './SkillResourceLabels'

describe('SkillResourceLabels', () => {
  describe('SKILL_RESOURCE_TYPE_LABELS', () => {
    it('covers all two resource types (momentum + sword_intent retired)', () => {
      expect(Object.keys(SKILL_RESOURCE_TYPE_LABELS)).toHaveLength(2)
      expect(SKILL_RESOURCE_TYPE_LABELS.mana).toBe('Linh Lực')
      expect(SKILL_RESOURCE_TYPE_LABELS.the).toBe('Thế')
    })
  })

  describe('skillResourceTypeLabel()', () => {
    it('returns Linh Lực for mana', () => {
      expect(skillResourceTypeLabel('mana')).toBe('Linh Lực')
    })

    it('returns Thế for the', () => {
      expect(skillResourceTypeLabel('the')).toBe('Thế')
    })

    it('returns empty string for none', () => {
      expect(skillResourceTypeLabel('none')).toBe('')
    })
  })
})
