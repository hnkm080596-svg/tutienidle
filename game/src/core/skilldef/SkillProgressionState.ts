// skilldef/SkillProgressionState.ts -- R6 state layer 2: persistent
// player-owned progression state. SkillSystem owns it; it is the save
// surface (spec sec.68). Covers every persistent non-authored field the
// legacy `Skill` object carried; the combat runtime never mutates it
// directly -- progression writes route through SkillSystem.

import type { SkillId } from '../battle/contracts/ids'

export interface SkillProgressionState {
  skillId: SkillId
  /** Cam Ngo leveling (Core Node) + cast-leveled auto-level inputs. */
  level: number
  /** in-level experience toward the next Cam Ngo upgrade. */
  experience: number
  /** lifetime cast-count mirror (SkillSystem.recordCast sink +
      CAST_LEVELING_THRESHOLDS auto-level for cast-leveled skills). */
  totalExperience: number
  /** specialization selection -- resolved into the effective definition
      BEFORE the resolver sees it (R-S6). */
  selectedSpecializationId?: string
}
