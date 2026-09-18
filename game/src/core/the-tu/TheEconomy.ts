import { MAX_THE } from '../combat/CombatTypes'
import type { CombatEntity } from '../combat/CombatEntity'
import type { ActiveCapabilityGrant } from '../battle/contracts/capability'

import { asReactiveEconomy, asTheEconomy } from './TheTuCapabilities'

// The Tu Reimagined (spec 2026-09-15 section 4.1, plan Task 15) — the
// ung_the proc-fuel economy. The is a THROUGHPUT BUDGET, not a
// probability: pay-per-attempt on each reactive window, free income from
// the authored table only, clamped at the participant's maxThe cap.
//
// Boundaries (A2/A9):
// - eligibility is the ung_the marker's presence — never cultivationPath
//   re-reads at combat time (mechanics are participant-generic).
// - the own-basic-lands income lives on the marker's theEconomy grant
//   (review P1 single-channel lock — TurnSkillDefinition has no
//   landed-cast gain field, so THAM_THE carries none).
// - every mutation goes through grantThe's single clamp expression.
// - buff-megaplan M4: grant reads take ActiveCapabilityGrant[]
//   (buffs.getCapabilities(entityId)); pool-era effect iteration retired.

export const THE_PROC_COST = 15
export const THE_PROC_GAIN = 20
export const THE_GAIN_ON_EVADE = 8
export const THE_GAIN_ON_HIT_TAKEN = 6
export const THE_GAIN_PER_ROUND = 5

const UNG_THE_ID = 'ung_the'

/** Single cap authority — entity.maxThe is baked at participant build. */
export function theCap(entity: Pick<CombatEntity, 'maxThe'>): number {
  return entity.maxThe ?? MAX_THE
}

/** Single mutation authority — all income/gain routes through here. */
export function grantThe(entity: Pick<CombatEntity, 'currentThe' | 'maxThe'>, amount: number): void {
  if (amount <= 0) return
  entity.currentThe = Math.min(theCap(entity), (entity.currentThe ?? 0) + amount)
}

/** The holder is a reactive combatant iff the ung_the marker is live. */
export function isUngTheCombatant(grants: readonly ActiveCapabilityGrant[]): boolean {
  return grants.some((grant) => grant.definitionId === UNG_THE_ID)
}

/**
 * Resolve the per-attempt proc cost from the holder's reactive_economy
 * grants: bach_ung's freeProcs zeroes it; otherwise the base cost plus
 * every procCostFlatDelta (tu_the: -5), floored at 0.
 */
export function resolveProcCost(
  grants: readonly ActiveCapabilityGrant[],
  baseCost = THE_PROC_COST,
): number {
  let delta = 0
  for (const grant of grants) {
    const economy = asReactiveEconomy(grant)
    if (economy === undefined) continue
    if (economy.freeProcs === true) return 0
    delta += economy.procCostFlatDelta ?? 0
  }
  return Math.max(0, baseCost + delta)
}

/**
 * Pay-per-attempt (spec 4.1): false = the pool cannot pay and NO roll
 * happens — the mechanic is inert this window. True = cost committed;
 * the caller rolls and reports success via onProcSuccess.
 */
export function tryPayProcCost(entity: CombatEntity, cost: number): boolean {
  const pool = entity.currentThe ?? 0
  if (pool < cost) return false
  entity.currentThe = pool - cost
  return true
}

/** A successful proc credits THE_PROC_GAIN through the capped pool. */
export function onProcSuccess(entity: CombatEntity, gain = THE_PROC_GAIN): void {
  grantThe(entity, gain)
}

/**
 * Own-basic-lands income — reads the authored theEconomy.gainOnBasicHit
 * field off the holder's marker clone (node-adjusted at participant
 * build; review P1: this is the ONLY basic-income channel).
 */
export function theGainOnBasicHit(grants: readonly ActiveCapabilityGrant[]): number {
  return theEconomyField(grants, 'gainOnBasicHit')
}

// Task 20 — the remaining income channels read the same marker-clone
// fields (node bonuses bake onto the participant-local def at build).
// One read pattern per channel, same single-channel rule as basic.
function theEconomyField(
  grants: readonly ActiveCapabilityGrant[],
  field: 'gainOnEvade' | 'gainOnHitTaken' | 'gainPerRound' | 'gainOnBasicHit',
): number {
  let gain = 0
  for (const grant of grants) {
    if (grant.definitionId !== UNG_THE_ID) continue
    const economy = asTheEconomy(grant)
    if (economy === undefined) continue
    gain += economy[field] ?? 0
  }
  return gain
}

/** Free income when the holder dodges a hit. */
export function theGainOnEvade(grants: readonly ActiveCapabilityGrant[]): number {
  return theEconomyField(grants, 'gainOnEvade')
}

/** Free income when the holder takes real HP damage (not absorbed). */
export function theGainOnHitTaken(grants: readonly ActiveCapabilityGrant[]): number {
  return theEconomyField(grants, 'gainOnHitTaken')
}

/** Free income at each round boundary. */
export function theGainPerRound(grants: readonly ActiveCapabilityGrant[]): number {
  return theEconomyField(grants, 'gainPerRound')
}
