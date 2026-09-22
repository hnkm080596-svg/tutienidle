import type { Skill } from '@/core/skill/Skill'
import type { TurnSkillDisplayMeta } from '@/data/skill/TurnSkillDisplayMeta'

// M-QI-05 / QI-D3 - the shared skill-path presentation contract. The
// left list and the detail surface consume ONE entry shape so native
// TurnSkillDefinition actions render beside learned Skill templates
// without fake Skill authority objects. `level` is always the
// canonical Core Node level (nodeLevels[core_<id>]); fixed Lv1 entries
// (no core) report 1.
export type SkillPathEntry =
  | {
      kind: 'skill'
      id: string
      name: string
      description?: string
      level: number
      maxLevel: number
      realmId: string
      skill: Skill
    }
  | {
      kind: 'native'
      id: string
      name: string
      description?: string
      level: number
      maxLevel: number
      realmId: string
      // D7 - the native view-model projects the upgrade surface up
      // front: cost of the next Core level (undefined when maxed or
      // Insight-ineligible) and the affordability flag NativeCoreDetail
      // renders without pulling GameManager reads into presentation.
      upgradeCost?: number
      canUpgrade: boolean
      meta?: TurnSkillDisplayMeta
    }

export type NativeSkillPathEntry = Extract<SkillPathEntry, { kind: 'native' }>
