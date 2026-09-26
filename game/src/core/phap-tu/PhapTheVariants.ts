/**
 * Phap Tu Reimagined (spec D3-D7) — the Phap The element riders.
 *
 * At battle build the element basic carries
 * `empowerment: { theThreshold: SPELL_PATH_MAX_THE, empowered: variant }`;
 * at declare, `currentThe >= 5` swaps the resolved payload (checked
 * before cast, nothing consumed, nothing decays — the legacy
 * consumesAllThe burn is retired, not reused). Every variant shares the
 * base def's fields and carries NO The income beyond the basic's own
 * +1 — rider hits never grant The.
 */
import type { ElementType } from '../element/ElementType'
import type { BuffDefinitionId } from '../battle/contracts/ids'
import type {
  TurnSkillDefinition,
  TurnSkillAilmentApplication,
} from '../battle/turn/TurnSkillAction'
import type { AuthoredSkillOperation } from '../skilldef/AuthoredOperation'

/** Design-authored rider magnitudes (spec openQuestion 3 — all TBD-authored). */
export const KIM_PHAP_THE_PENETRATION = 25
export const THUY_PHAP_THE_COEFFICIENT = 0.5
export const THO_PHAP_THE_COEFFICIENT = 0.4

function baseAilments(
  base: TurnSkillDefinition,
): readonly TurnSkillAilmentApplication[] {
  return (
    base.appliesAilments ??
    (base.appliesAilment !== undefined ? [base.appliesAilment] : [])
  )
}

/** Base def's own-source ailment application cloned as an apply_buff op
    bound to the lane's landed target (water rider's onLanded lane —
    'loop_target' there resolves the secondary hit's target). */
function clonedApplyBuffOp(
  ailment: TurnSkillAilmentApplication,
): AuthoredSkillOperation {
  return {
    type: 'apply_buff',
    target: 'loop_target',
    definitionId: ailment.buffDefinitionId as BuffDefinitionId,
    reactionEligibility: 'eligible',
    chance: ailment.chance,
    ...(ailment.stacks !== undefined ? { stacks: ailment.stacks } : {}),
  }
}

/**
 * Build the empowered (Phap The) form of a committed element basic.
 * Riders (spec D3-D7):
 * - fire: pulse one pre-existing own-source ailment on the primary
 *   target — the op lands BEFORE the base application inside the landed
 *   gate (adapter emits landedConsequences first), so the pulsed
 *   instance is the pre-cast one. No consume, no duration loss.
 * - water: one secondary hit on a DIFFERENT enemy (0.5x authored); it
 *   re-applies the base ailment on that secondary target. No The
 *   income, no chain.
 * - wood: the base ailment application resolves with +1 stack.
 * - metal: flat elemental penetration points on the hit (skill-local).
 * - earth: one shockwave hit on every other enemy (0.4x authored); no
 *   ailment/marker ops — non-recursive by construction.
 */
export function buildPhapTheVariant(
  element: ElementType,
  base: TurnSkillDefinition,
): TurnSkillDefinition {
  const baseAilmentList = baseAilments(base)
  const primaryAilmentId = baseAilmentList[0]?.buffDefinitionId

  const riderConsequences: AuthoredSkillOperation[] = []

  if (element === 'fire' && primaryAilmentId !== undefined) {
    riderConsequences.push({
      type: 'trigger_buff_periodic',
      selector: {
        kind: 'identity',
        definitionId: primaryAilmentId as BuffDefinitionId,
        source: 'self',
        target: 'loop_target',
      },
    })
  }

  if (element === 'water') {
    riderConsequences.push({
      type: 'deal_damage',
      target: 'other_enemy',
      coefficient: THUY_PHAP_THE_COEFFICIENT,
      components: [{ kind: 'element', element: 'water', ratio: 1 }],
      onLanded: baseAilmentList.map(clonedApplyBuffOp),
    })
  }

  if (element === 'earth') {
    riderConsequences.push({
      type: 'deal_damage',
      target: 'other_enemies',
      coefficient: THO_PHAP_THE_COEFFICIENT,
      components: [{ kind: 'element', element: 'earth', ratio: 1 }],
    })
  }

  const woodStacksBump =
    element === 'wood'
      ? baseAilmentList.map((ailment) => ({
          ...ailment,
          stacks: (ailment.stacks ?? 1) + 1,
        }))
      : undefined

  return {
    ...base,
    // Wood: the empowered application is the SAME own-source ailment
    // bumped by one stack (spec D6) — the plural field replaces the
    // singular only for the wood variant.
    ...(woodStacksBump !== undefined
      ? { appliesAilment: undefined, appliesAilments: woodStacksBump }
      : {}),
    // Metal: skill-local penetration lives on this payload only (spec D7).
    ...(element === 'metal'
      ? { elementalPenetrationBonus: KIM_PHAP_THE_PENETRATION }
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
