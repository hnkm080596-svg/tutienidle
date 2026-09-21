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
// The element pool is NOT authored here (review fix, HIGH-1): a static
// duplicate of the five basics had already drifted from the authored
// Skills (doc_chuong is ailment-only; the duplicate gave it a hit, and
// no entry carried authored manaScalingRatio/attributeScaling).
// GameManager builds the pool through the canonical
// SkillSystem.getEffectiveSkill -> toTurnSkillDefinition pipeline and
// injects it — one source of truth for "what a spell basic does".
import type { TurnSkillDefinition } from '../../core/battle/turn/TurnSkillAction'
import { MAX_MULTICAST } from '../../core/battle/turn/TurnSkillAction'

/** Spec: da_phap_lien_tuyen fires the basic X times (X = 3 baseline). */
export const AN_SPECIAL_FIRES = 3

/** Spec: ngo_dao_hon_don multicast baseline 25%. */
export const AN_MULTICAST_CHANCE = 0.25

/**
 * van_phap_tuy_tam — the composite pick that makes each cast land a
 * random element. `multicastOwned` = the player holds ngo_dao_hon_don
 * (granted at the ritual via innateSkillId): the dao passive expresses
 * as the `multicast` field on the basic def. `elementPool` is the
 * GameManager-built canonical conversion of the five authored basics.
 */
export function applyAnKitToBasic(
  def: TurnSkillDefinition,
  multicastOwned: boolean,
  elementPool: readonly TurnSkillDefinition[],
): TurnSkillDefinition {
  return {
    ...def,
    compositePicks: { poolType: 'element_basic', count: 1, pool: elementPool },
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
export function applyAnKitToSpecial(
  def: TurnSkillDefinition,
  elementPool: readonly TurnSkillDefinition[],
): TurnSkillDefinition {
  return {
    ...def,
    compositePicks: { poolType: 'element_basic', count: 1, pool: elementPool },
    repeatCasts: AN_SPECIAL_FIRES - 1,
  }
}
