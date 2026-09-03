import { describe, expect, it } from 'vitest'
import { SKILL_RESOURCE_STAT_LABELS, formatSkillResourceStat } from './SkillResourceStatLabels'
import { i18n } from '@/i18n'

describe('SKILL_RESOURCE_STAT_LABELS — i18n key mapping (Task 4)', () => {
  it('mọi entry có labelKey/descriptionKey tồn tại trong locale vi + en', () => {
    for (const entry of SKILL_RESOURCE_STAT_LABELS) {
      expect(i18n.global.t(entry.labelKey)).not.toContain('skillResource.')
      expect(i18n.global.t(entry.descriptionKey)).not.toContain('skillResource.')
    }
  })

  it('formatSkillResourceStat giữ nguyên hành vi percent/flat', () => {
    expect(formatSkillResourceStat('thuyThePercent', 0.155)).toBe('15.5%')
    expect(formatSkillResourceStat('earthAoeRadius', 2.4)).toBe('2')
  })
})
