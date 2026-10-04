import { CORE_SKILLS } from '@/data/skill/CoreSkills'
import { MORTAL_PRECURSOR_SKILL_IDS } from '@/core/skill/MortalPrecursors'
import { isBetaMortalStarterId } from '@/core/betaScope'

export interface CreationSkillOption {
  id: string
  name: string
  description: string
  icon?: string
  motif: 'sword' | 'orb' | 'fist'
  /** Locked precursors render dimmed and stay non-interactive. */
  locked: boolean
}

// Read-only display options. Selection is local UI state, not a creation
// command. Locked precursors lead; the selectable beta starter sits last.
export const CREATION_SKILL_PREVIEW: readonly CreationSkillOption[] = MORTAL_PRECURSOR_SKILL_IDS
  .filter((id) => !isBetaMortalStarterId(id))
  .concat(MORTAL_PRECURSOR_SKILL_IDS.filter(isBetaMortalStarterId))
  .flatMap((id) => {
    const skill = CORE_SKILLS.find((candidate) => candidate.id === id)
    if (!skill) return []
    const motifs = { tram: 'sword', linh_bao: 'orb', huy_quyen: 'fist' } as const
    return [{ id, name: skill.name, description: skill.description, motif: motifs[id], locked: !isBetaMortalStarterId(id) }]
  })
