// contracts/settlement.ts -- what an immediate-event handler may return,
// plus the batch frame contract (contract sec.40-44).

import type { BuffInstanceId, CombatEntityId, CombatOperationId } from './ids'
import type { ResolvedCombatOperation } from './operations'
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
    an EARLIER entry in the SAME batch whose resolved type is
    `deal_damage` -- enforced by static batch validation BEFORE any
    mutation. At materialize time, a referenced result that is not
    `resolved` yields {status:'skipped', reason:'dependency_not_resolved'}
    -- never a silent 0. */
export type DeferredOperation = {
  kind: 'heal_from_damage_result'
  /** Producer-minted id of the ResolvedCombatOperation this becomes. */
  operationId: CombatOperationId
  /** An earlier in-batch `deal_damage` op whose result this heal derives
      from. */
  resultOperationId: CombatOperationId
  healTarget: 'source' | 'target'
  fraction: number
  origin: CombatOperationOrigin
}

/** Typed read-only access to prior in-batch results -- the runner
    materializes DeferredOperations against THIS, never a raw array and
    never scheduler state. */
export interface BatchResultContext {
  get(operationId: CombatOperationId): CombatOperationResult | undefined
}
