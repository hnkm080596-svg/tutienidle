import { MAX_THE } from '../combat/CombatTypes'
import type { CombatEntity } from '../combat/CombatEntity'
import type { ActiveCapabilityGrant } from '../battle/contracts/capability'

import { UNG_THE_BUFF } from '../../data/buff/TheTuBuffs'

import { asTheEconomy } from './TheTuCapabilities'

// The Tu An -- Ung The beta (design authority
// docs/design/the-tu-an-ung-the-design.txt) -- the ung_the proc-fuel
// economy. The is a THROUGHPUT BUDGET funded ONLY by observation:
// Tham The landed hits and observed enemies completing normal actions.
// There is no passive round income, no taken/evade income, and no
// reactive refund -- a successful reaction only ever SPENDS The.
//
// Boundaries (A2/A9):
// - eligibility is the ung_the marker's presence -- never cultivationPath
//   re-reads at combat time (mechanics are participant-generic).
// - income channels live on the marker's the_economy grant
//   (gainOnBasicHit = Tham The landed; gainOnObservedAction = observed
//   enemy action completion; node bonuses bake onto the participant-local
//   clone at build).
// - every GAIN routes through grantThe's single clamp expression; the
//   spend/burn lanes (consume op, consumesAllThe drain) write currentThe
//   directly through their own adapters by design.
// - reactive cost is a flat authored per-proc `theCost` paid ONLY on a
//   successful roll (success-only consume, design Part XI) -- the pay-
//   before-roll + refund lane is superseded.
// - Ung Tre / Qua The: each committed reaction adds one uniform
//   reactionDebt on the holder PARTICIPANT (battle-scoped, not a buff,
//   not dispellable); debt >= REACTION_DEBT_CAP is Qua The (no new
//   windows); the holder's next natural action resets it. Gauge delay is
//   applied as UNG_TRE_GAUGE_PENALTY per debt at commit.

export const THE_PROC_COST = 15

/** Qua The cap: reaching it closes every new reactive window. */
export const REACTION_DEBT_CAP = 3

/** Single Qua The predicate - engine window gate and presentation share it. */
export function isQuaTheDebt(reactionDebt: number | undefined): boolean {
  return (reactionDebt ?? 0) >= REACTION_DEBT_CAP
}

/** ATB gauge subtracted per committed reaction (may go negative). */
export const UNG_TRE_GAUGE_PENALTY = 400

/** Dan The one-shot: observed-action income multiplied while it sits. */
export const DAN_THE_INCOME_MULT = 3

const UNG_THE_ID = UNG_THE_BUFF.id

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
 * Own-basic-lands income - reads the authored theEconomy.gainOnBasicHit
 * field off the holder's marker clone (Tham The landed; node bonuses
 * bake at participant build).
 */
export function theGainOnBasicHit(grants: readonly ActiveCapabilityGrant[]): number {
  return theEconomyField(grants, 'gainOnBasicHit')
}

// The income channels read marker-clone fields (node bonuses bake onto
// the participant-local def at build). One read pattern per channel.
function theEconomyField(
  grants: readonly ActiveCapabilityGrant[],
  field: 'gainOnBasicHit' | 'gainOnObservedAction',
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

/** Observation income when an observed enemy completes a normal action. */
export function theGainOnObservedAction(grants: readonly ActiveCapabilityGrant[]): number {
  return theEconomyField(grants, 'gainOnObservedAction')
}
