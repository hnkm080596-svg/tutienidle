// contracts/periodic.ts -- typed periodic requests (review r3 BLOCKER 3:
// canonicalized to the Buff Final Spec shape -- damageProfile +
// coefficient + crit/miss, NOT `rawPower`). Buff resolves lifecycle/stack
// semantics (stack scaling already folded into `coefficient`;
// `stackCount` rides along only if the profile needs it); DamageSystem
// resolves the combat formula. The scheduler converts each request 1:1
// into a ResolvedCombatOperation (deal_damage/heal, origin.kind
// 'buff_periodic', origin minted by the scheduler from the buff instance)
// and settles them like any other op.

import type { ElementType } from '../../element/ElementType'

import type { BuffInstanceId, CombatEntityId } from './ids'

export interface BuffPeriodicDamageRequest {
  instanceId: BuffInstanceId
  periodicId: string
  sourceId: CombatEntityId
  targetId: CombatEntityId
  element?: ElementType | 'physical'
  damageProfile: string
  /** Stack-scaled effective coefficient -- NOT raw damage. */
  coefficient: number
  hitCount: number
  canCrit: boolean
  canMiss: boolean
  /** Metadata for profiles that scale on stacks. */
  stackCount?: number
  tags?: readonly string[]
}

export interface BuffPeriodicHealRequest {
  instanceId: BuffInstanceId
  periodicId: string
  sourceId: CombatEntityId
  targetId: CombatEntityId
  amount: number
}

/** The CONTRACT shape -- a bundle of typed requests committed by a
    periodic trigger. NOT the buff spec's same-named resolution-record
    interface (the contract supersedes; the buff plan reconciles its own
    naming later). */
export interface PeriodicResolution {
  requests: readonly (BuffPeriodicDamageRequest | BuffPeriodicHealRequest)[]
}
