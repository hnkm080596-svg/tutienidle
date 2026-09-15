// Phap Tu Reimagined Task 11 — Phap Tu An kit resolution semantics.
// Task 7 created the Skill shells in CoreSkills.ts; this module authors
// the TURN-side behavior attached at battle build by GameManager:
//
// - van_phap_tuy_tam (basic): compositePicks 'element_basic' — every cast
//   resolves AS a uniform-random pick among the 5 element basics.
// - da_phap_lien_tuyen (special): same pick + repeatCasts — fires exactly
//   AN_SPECIAL_FIRES executions per cast, each independently re-rolled.
// - ngo_dao_hon_don (dao passive, no button): `multicast` attached to the
//   An basic — each basic execution may chain extra casts, depth-capped.
//
// The pool reuses PHAP_TU_BASICS — the pick lands the SAME payload a
// phap_tu element basic would (spec S7: damage type + ailment from the
// picked def).
import type { TurnSkillDefinition } from '../../core/battle/turn/TurnSkillAction'
import { MAX_MULTICAST } from '../../core/battle/turn/TurnSkillAction'
import { PHAP_TU_BASICS } from './TurnBasicAttacks'

/** Spec: da_phap_lien_tuyen fires the basic X times (X = 3 baseline). */
export const AN_SPECIAL_FIRES = 3

/** Spec: ngo_dao_hon_don multicast baseline 25%. */
export const AN_MULTICAST_CHANCE = 0.25

/** The uniform composite pool — all five element-basic payloads. */
export const AN_ELEMENT_BASIC_POOL: readonly TurnSkillDefinition[] = [
  PHAP_TU_BASICS.fire,
  PHAP_TU_BASICS.water,
  PHAP_TU_BASICS.wood,
  PHAP_TU_BASICS.metal,
  PHAP_TU_BASICS.earth,
]

/**
 * van_phap_tuy_tam — the composite pick that makes each cast land a
 * random element. `multicastOwned` = the player holds ngo_dao_hon_don
 * (granted at the ritual via innateSkillId): the dao passive expresses
 * as the `multicast` field on the basic def.
 */
export function applyAnKitToBasic(
  def: TurnSkillDefinition,
  multicastOwned: boolean,
): TurnSkillDefinition {
  return {
    ...def,
    compositePicks: { poolType: 'element_basic', count: 1, pool: AN_ELEMENT_BASIC_POOL },
    ...(multicastOwned
      ? { multicast: { chance: AN_MULTICAST_CHANCE, maxExtraCasts: MAX_MULTICAST } }
      : {}),
  }
}

/**
 * da_phap_lien_tuyen — composite pick + repeatCasts. repeatCasts counts
 * the EXTRA executions after the original: AN_SPECIAL_FIRES - 1 repeats
 * + the original = exactly AN_SPECIAL_FIRES fires per cast.
 */
export function applyAnKitToSpecial(def: TurnSkillDefinition): TurnSkillDefinition {
  return {
    ...def,
    compositePicks: { poolType: 'element_basic', count: 1, pool: AN_ELEMENT_BASIC_POOL },
    repeatCasts: AN_SPECIAL_FIRES - 1,
  }
}
