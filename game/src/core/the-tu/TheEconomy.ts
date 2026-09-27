import { MAX_THE } from '../combat/CombatTypes'
import type { CombatEntity } from '../combat/CombatEntity'
import type { ActiveCapabilityGrant } from '../battle/contracts/capability'

import { asReactiveEconomy, asTheEconomy } from './TheTuCapabilities'

// The Tu Reimagined (spec 2026-09-15 section 4.1, plan Task 15) -- the
// ung_the proc-fuel economy. The is a THROUGHPUT BUDGET, not a
// probability: pay-per-attempt on each reactive window, free income from
// the authored table only, clamped at the participant's maxThe cap.
//
// Boundaries (A2/A9):
// - eligibility is the ung_the marker's presence -- never cultivationPath
//   re-reads at combat time (mechanics are participant-generic).
// - the own-basic-lands income lives on the marker's theEconomy grant
//   (review P1 single-channel lock -- the landed-cast gain channel is
//   TurnSkillDefinition.theGainOnLandedCast on the skill def itself, so
//   THAM_THE carries no duplicate grant field).
// - every mutation is module-owned: the three write sites below are the
//   only currentThe writers (grant clamps to the cap, consume floors to
//   0, drain writes 0) -- same authority, three clamp expressions.
// - buff-megaplan M4: grant reads take ActiveCapabilityGrant[]
//   (buffs.getCapabilities(entityId)); pool-era effect iteration retired.

export const THE_PROC_COST = 15
export const THE_PROC_GAIN = 20
export const THE_GAIN_ON_EVADE = 8
export const THE_GAIN_ON_HIT_TAKEN = 6
export const THE_GAIN_PER_ROUND = 5

const UNG_THE_ID = 'ung_the'

/** Single cap authority -- entity.maxThe is baked at participant build. */
export function theCap(entity: Pick<CombatEntity, 'maxThe'>): number {
  // A corrupt baked maxThe (NaN) would flow through the grant clamp and
  // brick the pool -- fall back to the constant cap like an absent field.
  return Number.isFinite(entity.maxThe) ? (entity.maxThe as number) : MAX_THE
}

/** Single gain authority -- all income routes through here. */
export function grantThe(entity: Pick<CombatEntity, 'currentThe' | 'maxThe'>, amount: number): void {
  // Non-finite amounts (NaN/Infinity) must not reach the clamp -- a NaN
  // write bricks the pool silently (every later '>=' comparison fails).
  // Mirrors the adapter's requireWellFormedAmount contract.
  if (!Number.isFinite(amount) || amount <= 0) return
  entity.currentThe = Math.min(theCap(entity), (entity.currentThe ?? 0) + amount)
}

/** consumesAllThe burn - drains the whole pool through the same
    mutation authority (engine-unit lane has no resource adapter). */
export function drainAllThe(entity: Pick<CombatEntity, 'currentThe'>): void {
  entity.currentThe = 0
}

/** Partial consume -- the all-or-nothing insufficient check stays at
    the caller (the adapter throws its skip); this is the single write
    site for a decreasing debit so consume does not duplicate the
    field mutation inline. The pool still hard-floors at 0 -- a
    caller-side check must not turn a race or an oversized direct
    debit into negative currentThe. */
export function consumeThe(entity: Pick<CombatEntity, 'currentThe'>, amount: number): void {
  // amount <= 0 returns early WITHOUT touching the field -- the old
  // normalize-on-read (undefined -> 0, negative -> 0) is gone; every
  // writer funnels through grantThe/drainAllThe/consumeThe and every
  // reader is '?? 0'-guarded, so no reachable state depends on it.
  if (!Number.isFinite(amount) || amount <= 0) return
  entity.currentThe = Math.max(0, (entity.currentThe ?? 0) - amount)
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
 * happens -- the mechanic is inert this window. True = cost committed;
 * the caller rolls and reports success via onProcSuccess.
 *
 * DORMANT: zero production callers -- the live proc lane gates
 * `(currentThe ?? 0) >= cost` inline and spends via
 * settleOp(consume_resource) -> EntityResourceAdapter; proc-success gain
 * rides gain_resource ops -> grantThe. Kept as the authored spec-4.1
 * semantics pinned by TurnBattleSystem.theEconomy.test.ts; wire or
 * remove when the pay-per-attempt lane lands.
 */
export function tryPayProcCost(entity: CombatEntity, cost: number): boolean {
  const pool = entity.currentThe ?? 0
  // A non-finite cost must not report "paid" while paying nothing.
  if (!Number.isFinite(cost) || pool < cost) return false
  consumeThe(entity, cost)
  return true
}

/**
 * A successful proc credits THE_PROC_GAIN through the capped pool.
 * DORMANT: see tryPayProcCost -- zero production callers.
 */
export function onProcSuccess(entity: CombatEntity, gain = THE_PROC_GAIN): void {
  grantThe(entity, gain)
}

/**
 * Own-basic-lands income -- reads the authored theEconomy.gainOnBasicHit
 * field off the holder's marker clone (node-adjusted at participant
 * build; review P1: this is the ONLY basic-income channel).
 */
export function theGainOnBasicHit(grants: readonly ActiveCapabilityGrant[]): number {
  return theEconomyField(grants, 'gainOnBasicHit')
}

// Task 20 -- the remaining income channels read the same marker-clone
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
