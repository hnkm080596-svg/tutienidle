import type { SkillResourceType } from './SkillTypes'

// Skill resource type labels — 2026-08-30 frontend-design pass (moved
// from SkillDetailView.vue). Covers the meaningful resource types on
// Skill.resourceType. 'none' is excluded (no cost shown). 'the' added
// Phase A3 (2026-09-07) — Pháp Tu Thế pool.
export const SKILL_RESOURCE_TYPE_LABELS: Record<Exclude<SkillResourceType, 'none'>, string> = {
  mana: 'Linh Lực',
  sword_intent: 'Kiếm Ý',
  momentum: 'Đà Thế',
  the: 'Thế',
}

export function skillResourceTypeLabel(type: SkillResourceType | undefined): string {
  if (!type || type === 'none') {
    return ''
  }

  return SKILL_RESOURCE_TYPE_LABELS[type] ?? type
}
