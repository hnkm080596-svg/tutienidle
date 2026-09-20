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
  /** v7.2 -- authority-minted unique id
      (`req.${instanceId}.${periodicId}.${tickOrdinal}` -- per-instance
      monotonic counter; rootActionId-scoped minting would collide when
      two manual triggers share one root transaction). The built-in
      handler names the generated op `periodic.${requestId}` so the
      emitter can correlate the settled op status back to this request
      (uses-consumption gating -- spec sec.34 'removed immediately after
      resolution'). */
  requestId: string
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
  /** Instance-local penetration bonus (canonical-seals addendum): the
      folded 'elemental_penetration' channel value -- ADDITIVE points on
      the Resistance.ts scale (1 = 1% net resistance), resolved on top of
      the source stat; never a stats mutation. Legal iff damageProfile
      === 'legacy_dot' AND element is an ElementType -- the bridge and
      batch validators fault any other carrier. */
  elementalPenetrationBonus?: number
  /** v7.1 -- present iff the periodic def's scaling==='snapshot': the
      source's offensive context captured at apply (Buff Final Spec
      sec.25). DamageSystem resolves against THIS instead of live source
      stats when present; target mitigation still resolves live at
      tick. */
  snapshot?: Readonly<Record<string, number>>
}

export interface BuffPeriodicHealRequest {
  /** v7.2 -- same correlation contract as damage. */
  requestId: string
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
