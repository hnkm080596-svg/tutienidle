import { describe, it, expect } from 'vitest'
import { skillResourceTypeLabel, SKILL_RESOURCE_TYPE_LABELS } from './SkillResourceLabels'

describe('SkillResourceLabels', () => {
  describe('SKILL_RESOURCE_TYPE_LABELS', () => {
    it('covers all four resource types (Phase A3 added the)', () => {
      expect(Object.keys(SKILL_RESOURCE_TYPE_LABELS)).toHaveLength(4)
      expect(SKILL_RESOURCE_TYPE_LABELS.mana).toBe('Linh Lực')
      expect(SKILL_RESOURCE_TYPE_LABELS.sword_intent).toBe('Kiếm Ý')
      expect(SKILL_RESOURCE_TYPE_LABELS.momentum).toBe('Đà Thế')
      expect(SKILL_RESOURCE_TYPE_LABELS.the).toBe('Thế')
    })
  })

  describe('skillResourceTypeLabel()', () => {
    it('returns Linh Lực for mana', () => {
      expect(skillResourceTypeLabel('mana')).toBe('Linh Lực')
    })

    it('returns Kiếm Ý for sword_intent', () => {
      expect(skillResourceTypeLabel('sword_intent')).toBe('Kiếm Ý')
    })

    it('returns Đà Thế for momentum', () => {
      expect(skillResourceTypeLabel('momentum')).toBe('Đà Thế')
    })

    it('returns empty string for none', () => {
      expect(skillResourceTypeLabel('none')).toBe('')
    })
  })
})
