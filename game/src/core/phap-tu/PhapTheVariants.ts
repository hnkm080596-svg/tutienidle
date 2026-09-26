/**
 * Phap Tu Reimagined (spec D3-D7) - the Phap The element riders.
 *
 * At battle build the element basic carries
 * `empowerment: { theThreshold: SPELL_PATH_MAX_THE, empowered: variant }`;
 * at declare, `currentThe >= 5` swaps the resolved payload (checked
 * before cast, nothing consumed, nothing decays - the legacy
 * consumesAllThe burn is retired, not reused). Every variant shares the
 * base def's fields and carries NO The income beyond the basic's own
 * +1 - rider hits never grant The.
 *
 * Rider op payloads are data-owned (PHAP_TU_PHAP_THE_LANDED_CONSEQUENCES
 * in src/data/skill/PhapTuSkills.ts); this builder owns only the
 * payload-level edits the table cannot express (wood stack bump, metal
 * flat pierce) and the landed-lane ordering (riders prepend so a fire
 * pulse hits the pre-cast ailment instance).
 */
import type { ElementType } from '../element/ElementType'
import type {
  TurnSkillDefinition,
  TurnSkillAilmentApplication,
} from '../battle/turn/TurnSkillAction'
import {
  KIM_PHAP_THE_PENETRATION_BONUS,
  PHAP_TU_PHAP_THE_LANDED_CONSEQUENCES,
} from '../../data/skill/PhapTuSkills'

function baseAilments(
  base: TurnSkillDefinition,
): readonly TurnSkillAilmentApplication[] {
  return (
    base.appliesAilments ??
    (base.appliesAilment !== undefined ? [base.appliesAilment] : [])
  )
}

/**
 * Build the empowered (Phap The) form of a committed element basic.
 * Riders (spec D3-D7, payloads authored in the data table):
 * - fire: pulse one pre-existing own-source ailment on the primary
 *   target - riders prepend inside the landed gate, so the pulsed
 *   instance is the pre-cast one. No consume, no duration loss.
 * - water: one secondary hit on a DIFFERENT enemy; no The income, no
 *   chain.
 * - wood: the base ailment application resolves with +1 stack (payload
 *   edit - the table entry is empty).
 * - metal: flat elemental penetration points on the hit (skill-local).
 * - earth: one shockwave hit on every other enemy; no ailment/marker
 *   ops - non-recursive by construction.
 */
export function buildPhapTheVariant(
  element: ElementType,
  base: TurnSkillDefinition,
): TurnSkillDefinition {
  const riderConsequences = PHAP_TU_PHAP_THE_LANDED_CONSEQUENCES[element]

  const woodStacksBump =
    element === 'wood'
      ? baseAilments(base).map((ailment) => ({
          ...ailment,
          stacks: (ailment.stacks ?? 1) + 1,
        }))
      : undefined

  return {
    ...base,
    // Wood: the empowered application is the SAME own-source ailment
    // bumped by one stack (spec D6) - the plural field replaces the
    // singular only for the wood variant.
    ...(woodStacksBump !== undefined
      ? { appliesAilment: undefined, appliesAilments: woodStacksBump }
      : {}),
    // Metal: skill-local penetration lives on this payload only (spec D7).
    ...(element === 'metal'
      ? { elementalPenetrationBonus: KIM_PHAP_THE_PENETRATION_BONUS }
      : {}),
    ...(riderConsequences.length > 0
      ? {
          landedConsequences: [
            ...riderConsequences,
            ...(base.landedConsequences ?? []),
          ],
        }
      : {}),
  }
}
