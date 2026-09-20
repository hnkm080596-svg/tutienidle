// contracts/settlement.ts -- what an immediate-event handler may return,
// plus the batch frame contract (contract sec.40-44).

import type { BuffInstanceId, CombatEntityId, CombatOperationId } from './ids'
import type { BuffModifierPayload, ResolvedCombatOperation } from './operations'
import type { CombatOperationOrigin } from './origin'
import type { CombatOperationResult } from './results'

export type ImmediateSettlement =
  | { kind: 'operations'; operations: readonly ResolvedCombatOperation[] }
  | { kind: 'batch'; batch: CombatOperationBatch }

export interface CombatOperationBatch {
  batchId: string
  origin: CombatOperationOrigin
  /** ALL preflighted before ANY op runs (contract sec.40-42). */
  preconditions: readonly CombatPrecondition[]
  /** Ordered, non-interleaved; per-op settle inside the frame
      (contract sec.43-44). */
  operations: readonly (ResolvedCombatOperation | DeferredOperation)[]
}

export type CombatPrecondition =
  | {
      kind: 'buff_participant'
      instanceId: BuffInstanceId
      expectedSourceId: CombatEntityId
      expectedTargetId: CombatEntityId
      expectedStacks: number
    }
  | { kind: 'entity_alive'; entityId: CombatEntityId }

/** Review r2/r3/r4 -- declarative primitive, NOT an arbitrary closure.
    A closure could capture mutable combat state; a data primitive is
    materialized by the batch runner from the typed result store.
    Extensible -- add members when a real consumer needs one (YAGNI).

    `operationId` is PRE-MINTED by the producer (R-C2 applies to deferred
    ops -- the batch runner must NOT mint ids); materialization preserves
    it.

    `resultOperationId` constraints (r4 BLOCKER 3/HIGH 2): must reference
    an EARLIER entry in the SAME batch whose resolved type matches the
    kind's declared dependency (`heal_from_damage_result` ->
    `deal_damage`; `add_modifier_on_apply_result` -> `apply_buff`) --
    enforced by static batch validation BEFORE any mutation. At
    materialize time, a referenced result that is not `resolved` yields
    {status:'skipped', reason:'dependency_not_resolved'} -- never a
    silent 0.

    canonical-seals addendum -- `add_modifier_on_apply_result`: binds a
    modifier to the EXACT instance a successful apply_buff returned. The
    apply's op status is 'resolved' even when its roll failed
    ({applied:false} -- contract sec.17), so `resolved` alone is not
    attachment permission: the runner skips the materialized
    add_buff_modifier with reason 'application_roll_failed' when
    applied:false (an identity-selector lookup could land on a stale
    same-identity instance after a resisted reapply), faults when
    applied:true carries no instanceId, and materializes
    {kind:'instance', instanceId} otherwise. */
export type DeferredOperation =
  | {
      kind: 'heal_from_damage_result'
      /** Producer-minted id of the ResolvedCombatOperation this becomes. */
      operationId: CombatOperationId
      /** An earlier in-batch `deal_damage` op whose result this heal
          derives from. */
      resultOperationId: CombatOperationId
      healTarget: 'source' | 'target'
      fraction: number
      origin: CombatOperationOrigin
    }
  | {
      kind: 'add_modifier_on_apply_result'
      /** Producer-minted id of the ResolvedCombatOperation this becomes. */
      operationId: CombatOperationId
      /** An earlier in-batch `apply_buff` op whose result decides
          attachment (applied:true + instanceId required). */
      resultOperationId: CombatOperationId
      /** Attached verbatim to the returned instance -- the payload is
          authored at emission, the selector is derived at
          materialization. */
      modifier: BuffModifierPayload
      origin: CombatOperationOrigin
    }

/** Typed read-only access to prior in-batch results -- the runner
    materializes DeferredOperations against THIS, never a raw array and
    never scheduler state. `getOperation` resolves the producing op so
    materialization can inspect its declared fields (healTarget etc.) --
    absent for result-only records that never had an operation. */
export interface BatchResultContext {
  get(operationId: CombatOperationId): CombatOperationResult | undefined
  getOperation(operationId: CombatOperationId): ResolvedCombatOperation | undefined
}
