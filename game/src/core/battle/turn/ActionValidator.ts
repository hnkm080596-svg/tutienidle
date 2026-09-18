// ActionValidator.ts -- megaplan Reaction M4 / contract sec.70-72 / R10.
// Generic action-tag restriction for turn action selection. Cam Cong is
// a BuffDefinition carrying forbiddenActionTags:['attack'] resolved
// through this channel -- NOT a stun/CC branch (R-E: a sealed actor
// keeps its turn cadence and declares an EMPTY action, not a blocked
// one). No reaction-specific logic lives here.
//
// R-E2 -- tag inference: a TurnSkillDefinition without authored
// actionTags counts as ['attack'] iff it carries `damage`; the slot-less
// fallback basic (skillId 'basic_attack', skill null) is always
// ['attack']. Explicit actionTags always win. Untagged + damageless defs
// carry no inferred tags (always legal under an attack seal).

import type { BuffRegistry } from '../../buff2/BuffRegistry'
import type { BuffInstanceSnapshot } from '../../buff2/BuffInstance'
import type { SelectedAction, TurnSkillDefinition } from './TurnSkillAction'

/** The tag an action carries when its skill deals damage but authors no
    explicit actionTags (R-E2). */
export const INFERRED_ATTACK_TAG = 'attack'

export function actionTagsOfSkill(skill: TurnSkillDefinition): readonly string[] {
  if (skill.actionTags !== undefined) {
    return skill.actionTags
  }

  return skill.damage !== undefined ? [INFERRED_ATTACK_TAG] : []
}

/** R-E2 -- authored actionTags win; else damage implies ['attack'];
    damageless untagged actions carry no inferred tags. The fallback
    basic (skill null) is always ['attack']; the sealed NULL_ACTION
    (skillId '') carries no tags -- it is produced when nothing else is
    legal, never offered as a candidate. */
export function actionTagsOf(action: SelectedAction): readonly string[] {
  if (action.skill === null) {
    return action.skillId === '' ? [] : [INFERRED_ATTACK_TAG]
  }

  return actionTagsOfSkill(action.skill)
}

/** An action is legal iff NONE of its tags are in the forbidden set.
    An empty/absent forbidden set allows everything (unsealed selection
    is byte-identical to today). */
export function isActionAllowed(
  action: SelectedAction,
  forbidden: ReadonlySet<string> | undefined,
): boolean {
  if (forbidden === undefined || forbidden.size === 0) {
    return true
  }

  return !actionTagsOf(action).some((tag) => forbidden.has(tag))
}

export interface ActionValidator {
  /** The union of forbiddenActionTags across the entity's live buff
      instances, resolved through the buff2 registry. */
  forbiddenActionTags(entityId: string): ReadonlySet<string>
}

/** buff2 M4 -- resolves each live instance's BuffDefinition through the
    registry and unions its forbiddenActionTags. An instance whose def id
    is absent contributes no tags (def lookup is a data concern elsewhere
    -- selection must not crash on it). The instance read is a port so an
    unwired battle (no buff authority) simply sees no seals. Computed once
    per action declaration by TurnBattleSystem (contract sec.71). */
export class Buff2ActionValidator implements ActionValidator {
  constructor(
    private readonly registry: BuffRegistry,
    private readonly getForTarget: (entityId: string) => readonly BuffInstanceSnapshot[],
  ) {}

  forbiddenActionTags(entityId: string): ReadonlySet<string> {
    const forbidden = new Set<string>()

    for (const instance of this.getForTarget(entityId)) {
      const definition = this.registry.tryGet(instance.definitionId)

      if (definition?.forbiddenActionTags === undefined) {
        continue
      }

      for (const tag of definition.forbiddenActionTags) {
        forbidden.add(tag)
      }
    }

    return forbidden
  }
}
