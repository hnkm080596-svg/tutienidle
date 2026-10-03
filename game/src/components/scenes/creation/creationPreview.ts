import { CORE_SKILLS } from '@/data/skill/CoreSkills'
import { MORTAL_PRECURSOR_SKILL_IDS } from '@/core/skill/MortalPrecursors'

export interface CreationSkillOption {
  id: string
  name: string
  description: string
  icon?: string
  motif: 'sword' | 'orb' | 'fist'
}

// Read-only display options. Selection is local UI state, not a creation command.
export const CREATION_SKILL_PREVIEW: readonly CreationSkillOption[] = MORTAL_PRECURSOR_SKILL_IDS.flatMap(id => {
  const skill = CORE_SKILLS.find(candidate => candidate.id === id)
  if (!skill) return []
  const motifs = { tram: 'sword', linh_bao: 'orb', huy_quyen: 'fist' } as const
  return [{ id, name: skill.name, description: skill.description, motif: motifs[id] }]
})
