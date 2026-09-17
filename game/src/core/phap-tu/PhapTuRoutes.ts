import type { StatModifier } from '../stats/StatCalculator'
import type { PlayerData } from '../player/Player'
import type { EffectiveSkill } from '../skill/SkillSystem'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { getNodeLevel, isNodeElementActive, isNodeRouteActive, nodeWayApplies } from '../progression/NodeSystem'
import { MAX_THE } from '../combat/CombatTypes'
import { isPhapTuNguHanh } from './PhapTuPath'
import type { PhapTuState, PhapTuRoute } from './PhapTuState'

// Phap Tu Reimagined (spec 2026-09-14 §4) — the ONE owner of route
// semantics. A route is the Phap Tu KIT's stance, not a character
// stance: the GameManager-side provider scopes it to kit skills only
// (mortal skills, passives, Kiem Tu and unrelated skills never see
// these factors).
//
// Two application seams, not one — ailmentStackBonus has no home on
// EffectiveSkill (TurnSkillAilmentApplication only exists after
// conversion), so:
//   applyRouteToEffectiveSkill — damage multiplier + ailment chance.
//   applyRouteToTurnSkill      — post-conversion ailment stack bonus.
// The converter itself stays generic.

/** Extra The granted on a direct-hit crit under the 'no' route. */
export const PHAP_TU_THE_GAIN_CRIT = 3

// Task 8 — authored per-skill The gains for the NORMAL Phap Tu kit
// (spec 2026-09-14 §3.1/§4): basic +5 / special +15 per landed cast;
// the ultimate grants nothing (it consumes the pool). These are base
// values — tu_the_<element> nodes add per-level deltas through
// aggregateTurnSkillResourceModifiers() at battle build.
export const PHAP_TU_THE_GAIN_BASIC = 5
export const PHAP_TU_THE_GAIN_SPECIAL = 15

/**
 * Task 10 — the empowered form of a chain-E ultimate. The route picks
 * WHICH payload variant resolves ('dot' -> detonate, 'no' -> nuke);
 * Task 13 differentiates them via detonateDoT/theScaling fields.
 */
export type PhapTuUltimateVariant = 'detonate' | 'nuke'

/**
 * Empowerment gate — spec P13: a CONSTANT 100, deliberately not
 * MAX_THE. A raised cap lets the player bank past the threshold and
 * burn the whole stockpile (consume always takes ALL).
 */
export const PHAP_TU_EMPOWERMENT_THE_THRESHOLD = 100

// Task 13 (spec §4) — the two empowered-ult route expressions, tuned
// here as the single owner. DETONATE_AMP multiplies each consumed DoT
// ailment's remaining tick damage (flat — it does NOT scale with The
// spent; the burn's payoff IS the consume). NUKE_THE_COEFF is the
// linear slope of the burn into damage: final x (1 + theBurned/100 x
// coeff) — balance owns the slope, not diminishing by design.
export const DETONATE_AMP = 1.5
export const NUKE_THE_COEFF = 1.0

export interface RouteProfile {
  directMultiplier: number
  ailmentChanceFactor: number
  ailmentStackBonus: number
  empoweredUlt?: PhapTuUltimateVariant
  statModifiers: StatModifier[]
  critTheGain?: number
}

/** No route picked (or no Phap Tu state): every factor is identity. */
export const NEUTRAL_ROUTE_PROFILE: RouteProfile = {
  directMultiplier: 1,
  ailmentChanceFactor: 1,
  ailmentStackBonus: 0,
  statModifiers: [],
}

// Route stat modifiers are full StatModifiers (post-stat-rework
// contract): sourceType 'realm'/sourceId 'phap_tu' matches
// CULTIVATION_PATH_MODULES way grants, domain 'phap_tu' keeps them inside the
// StatDomain gate. Ailment-potency lines use `flat` absolutes — percent
// on a zero-base stat is a no-op.
export const PHAP_TU_ROUTES: Record<PhapTuRoute, RouteProfile> = {
  dot: {
    directMultiplier: 0.85,
    ailmentChanceFactor: 1.25,
    ailmentStackBonus: 1,
    statModifiers: [
      {
        id: 'phap_tu_route_dot_potency',
        sourceId: 'phap_tu',
        sourceType: 'realm',
        stat: 'ailmentPotencyPercent',
        flat: 0.30,
        domain: 'phap_tu',
      },
      {
        id: 'phap_tu_route_dot_duration',
        sourceId: 'phap_tu',
        sourceType: 'realm',
        stat: 'ailmentDurationPercent',
        flat: 0.20,
        domain: 'phap_tu',
      },
    ],
    empoweredUlt: 'detonate',
  },
  no: {
    directMultiplier: 1.15,
    ailmentChanceFactor: 0.50,
    ailmentStackBonus: 0,
    statModifiers: [
      {
        id: 'phap_tu_route_no_critrate',
        sourceId: 'phap_tu',
        sourceType: 'realm',
        stat: 'criticalRate',
        flat: 0.08,
        domain: 'phap_tu',
      },
      {
        id: 'phap_tu_route_no_critdmg',
        sourceId: 'phap_tu',
        sourceType: 'realm',
        stat: 'criticalDamage',
        flat: 0.25,
        domain: 'phap_tu',
      },
    ],
    empoweredUlt: 'nuke',
    critTheGain: PHAP_TU_THE_GAIN_CRIT,
  },
}

/**
 * Route profile for a PhapTuState — NEUTRAL when there is no state or
 * no route (INV-11). ngo_dao players never reach this: route state
 * is not theirs.
 */
export function resolveRouteProfile(state?: PhapTuState): RouteProfile {
  if (!state?.route) {
    return NEUTRAL_ROUTE_PROFILE
  }

  return PHAP_TU_ROUTES[state.route]
}

/**
 * EffectiveSkill seam: multiplies every damage effect/trigger value by
 * directMultiplier and every debuff ailmentChance by
 * ailmentChanceFactor. The result still flows through the existing
 * +elementApplicationPercent / [0,1] clamp in resolveAilmentApplicationChance -
 * no second clamp here. Never fakes +1 stack by injecting an add_stack
 * effect — stack semantics stay in applyRouteToTurnSkill.
 */
export function applyRouteToEffectiveSkill(effective: EffectiveSkill, profile: RouteProfile): EffectiveSkill {
  if (profile === NEUTRAL_ROUTE_PROFILE) {
    return effective
  }

  return {
    ...effective,
    effects: effective.effects.map((effect) => {
      if (effect.type === 'damage' && effect.value !== undefined) {
        return { ...effect, value: effect.value * profile.directMultiplier }
      }

      if (effect.type === 'debuff' && effect.ailmentChance !== undefined) {
        return { ...effect, ailmentChance: effect.ailmentChance * profile.ailmentChanceFactor }
      }

      return effect
    }),
    triggers: effective.triggers?.map((binding) => ({
      ...binding,
      actions: binding.actions.map((action) =>
        action.type === 'dealDamage' && action.value !== undefined
          ? { ...action, value: action.value * profile.directMultiplier }
          : action,
      ),
    })),
  }
}

/**
 * Post-conversion seam: adds ailmentStackBonus onto the built
 * TurnSkillDefinition's ailment applications. Called by the
 * orchestration site AFTER toTurnSkillDefinition — the converter never
 * sees RouteProfile.
 */
export function applyRouteToTurnSkill(turnSkill: TurnSkillDefinition, profile: RouteProfile): TurnSkillDefinition {
  if (profile.ailmentStackBonus === 0) {
    return turnSkill
  }

  const addBonus = <T extends { stacks?: number }>(application: T): T => ({
    ...application,
    // Mission C Task 10c — an omitted stacks means 1 by engine default
    // (TurnBattleSystem ailment.stacks ?? 1); the bonus adds to that
    // implicit stack, not to zero.
    stacks: (application.stacks ?? 1) + profile.ailmentStackBonus,
  })

  return {
    ...turnSkill,
    ...(turnSkill.appliesAilment ? { appliesAilment: addBonus(turnSkill.appliesAilment) } : {}),
    ...(turnSkill.appliesAilments ? { appliesAilments: turnSkill.appliesAilments.map(addBonus) } : {}),
  }
}

/**
 * Route stat modifiers for the character modifier pipeline — injected
 * next to getCultivationPathStatModifiers() in BOTH static aggregators
 * (menu + battle base). Route can't change mid-battle, so these never
 * enter getLiveBattleModifiers().
 */
export function getRouteStatModifiers(player: PlayerData): StatModifier[] {
  // Review fix (HIGH-2): route bonuses are universal stats — gate on the
  // owning path so leaked/dirty phapTu.route state on ngo_dao or
  // kiem_tu players cannot inject crit/ailment modifiers.
  // M4 (R6): the WAY is the gate — a collapsed ('phap_tu','ngo_dao')
  // player owns no route machinery even with dirty phapTu state.
  if (!isPhapTuNguHanh(player)) {
    return []
  }

  return resolveRouteProfile(player.phapTu).statModifiers
}

/**
 * Task 8 — the The-cap query (ownership chain: player.nodeLevels ->
 * here -> CombatEntity.maxThe battle snapshot -> engine clamp).
 * MAX_THE + active `truong_the_<element>` contribution (theCapPerLevel
 * x node level, route/element-gated like every other node effect).
 * Query-derived, never persisted on PlayerData. Non-phap_tu players —
 * incl. Bat Kiem — get MAX_THE.
 */
export function resolveMaxThe(
  registry: { getAll(): ProgressionNode[] },
  player: PlayerData,
): number {
  // M4 (R6): the The pool is ngu_hanh machinery — ngo_dao has no The
  // tree, so the WAY is the gate (the requiredWay stamp also filters
  // truong_the in the loop below; this check keeps the early-out cheap
  // and self-documenting).
  if (!isPhapTuNguHanh(player)) {
    return MAX_THE
  }

  let bonus = 0

  for (const node of registry.getAll()) {
    const level = getNodeLevel(player, node.id)

    if (level <= 0 || !isNodeRouteActive(player, node) || !isNodeElementActive(player, node) || !nodeWayApplies(player, node)) {
      continue
    }

    bonus += (node.effect.theCapPerLevel ?? 0) * level
  }

  return MAX_THE + bonus
}
