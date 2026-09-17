// contracts/results.ts -- result taxonomy LOCKED (contract sec.50-53, review r2):
//   'resolved'  = committed, typed payload attached
//   'skipped'   = normal runtime invalidation (dead target, stale state,
//                 insufficient resource) -- typed reason required
//   'failed'    = RESERVED -- kept in the union per spec sec.52 but NO v1
//                 producer may emit it (review r2: no concrete semantic
//                 exists yet; an application roll failure is
//                 'resolved' + result.applied:false, not 'failed').
//                 A producer emitting 'failed' fails tests -- add a
//                 semantic first.
//   STRUCTURAL  = missing port / unknown definition / malformed op ->
//                 NEVER a result. Dev+test: throw. Broken engine wiring is
//                 not a combat outcome (sec.50).
//
// NOTE: an ApplyBuffOperation whose application roll fails returns
// {status:'resolved', result:{applied:false}} -- the op executed fine; the
// BUFF result is the authority on success (contract sec.17).
// insufficient_resource -> 'skipped' (target state invalidation), not
// 'failed'.

import type { BuffInstanceId, CombatOperationId } from './ids'

export type CombatOperationResultStatus = 'resolved' | 'skipped' | 'failed'

export type CombatOperationResultReason =
  | 'stale_reaction_snapshot'
  | 'invalid_target_state'
  | 'application_roll_failed'
  | 'insufficient_resource'
  | 'blocked_by_restriction'
  | 'dependency_not_resolved'

export interface CombatOperationResultBase {
  operationId: CombatOperationId
  status: CombatOperationResultStatus // 'failed' reserved -- see header
  reason?: CombatOperationResultReason
}

// ---------------------------------------------------------------------------
// Result-side buff contract types -- pinned here so the union compiles; the
// buff megaplan implements them verbatim.
// ---------------------------------------------------------------------------

/** Canonical result (spec sec.17). Authoritative -- consumers do not infer
    application success by querying afterward. */
export interface ApplyBuffResult {
  applied: boolean
  instanceId?: BuffInstanceId
  created?: boolean
  stacksBefore?: number
  stacksAfter?: number
  requestedStacks?: number
  addedStacks?: number
  overflowStacks?: number
  durationBefore?: number
  durationAfter?: number
}

export interface StacksResult {
  stacksBefore: number
  stacksAfter: number
}

/** Buff spec sec.37 -- if stacks reach zero, removal reason = 'consumed'. */
export interface ConsumeStacksResult {
  consumed: number
  remaining: number
  removed: boolean
}

export interface HealResult {
  requested: number
  healed: number
  after?: number
}

// ---------------------------------------------------------------------------
// v7.1/v7.2/v7.5 additions (buff-plan review amendments).
// ---------------------------------------------------------------------------

/** spec sec.53/67 -- core mutation APIs never return void. `removed:false`
    when the selector resolves to no instance. */
export interface RemoveBuffResult {
  removed: boolean
  instanceId?: BuffInstanceId
  stacksAtRemoval?: number
}

/** spec sec.42 -- skipped = matched but dispellable:false. */
export interface CleanseResult {
  cleansed: BuffInstanceId[]
  skipped: BuffInstanceId[]
}

/** v7.5 (r5 BLOCKER 1) -- the trigger_buff_periodic op reports SERIES-START
    metadata only: later continuation units do not exist yet at return time
    (they emit via the periodic_operation_settled continuation). Per-request
    outcomes live on PeriodicRequestsCommitted / PeriodicOperationSettled /
    the trace, not on the initiating op's result. */
export interface TriggerPeriodicStartResult {
  /** false = no live unit was triggerable -- covers BOTH "selector matched
      nothing" AND "matched but every candidate is dead/invalid" (v7.6
      r6 MEDIUM 1: explicit all-dead branch; no firstRequestId, no pending
      continuation). */
  started: boolean
  /** The request emitted synchronously, when the series started. */
  firstRequestId?: string
  /** Ordered unit list size at trigger time -- candidates, NOT promised
      resolutions (later units may be skipped on revalidation or
      skip-settle). */
  candidateUnitCount: number
}

// ---------------------------------------------------------------------------
// Result union -- richer than {status} (review: the trace must reconstruct
// mutations).
// ---------------------------------------------------------------------------

export type CombatOperationResult =
  | {
      operationId: CombatOperationId
      type: 'deal_damage'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      damage?: { rawDamage: number; hpDamage: number; killed: boolean }
    }
  | {
      operationId: CombatOperationId
      type: 'heal'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      result?: HealResult
    }
  | {
      operationId: CombatOperationId
      type: 'apply_buff'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      result?: ApplyBuffResult
    }
  | {
      operationId: CombatOperationId
      type: 'add_buff_stacks' | 'remove_buff_stacks'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      result?: StacksResult
    }
  | {
      operationId: CombatOperationId
      type: 'consume_buff_stacks'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      result?: ConsumeStacksResult
    }
  | {
      operationId: CombatOperationId
      type: 'add_buff_modifier'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      /** v7.5 (r5 HIGH 1): modifierRuntimeId is the minted runtime identity
          of the new entry. */
      result?: {
        modifierId: string
        applied: boolean
        modifierRuntimeId?: string
      }
    }
  | {
      operationId: CombatOperationId
      type: 'remove_buff_modifier'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      /** v7.5 (r5 HIGH 1): remove is locked 'all_matching' -- every runtime
          generation carrying modifierId is removed and reported. */
      result?: {
        modifierId: string
        removed: boolean
        removedRuntimeIds: readonly string[]
      }
    }
  | {
      operationId: CombatOperationId
      type: 'refresh_buff_duration' | 'extend_buff_duration' | 'set_buff_duration'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      result?: { durationBefore: number; durationAfter: number }
    }
  | {
      operationId: CombatOperationId
      type: 'set_buff_stacks'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      result?: StacksResult
    }
  | {
      operationId: CombatOperationId
      type: 'cleanse_buff'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      result?: CleanseResult
    }
  | {
      operationId: CombatOperationId
      type: 'trigger_buff_periodic'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      result?: TriggerPeriodicStartResult
    }
  | {
      operationId: CombatOperationId
      type: 'remove_buff'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      result?: RemoveBuffResult
    }
  | {
      operationId: CombatOperationId
      type: 'push_gauge'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      result?: {
        before: number
        requestedDelta: number
        appliedDelta: number
        after: number
      }
    }
  | {
      operationId: CombatOperationId
      type: 'gain_resource' | 'consume_resource'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      result?: {
        before: number
        requested: number | 'all'
        applied: number
        after: number
      }
    }
  | {
      operationId: CombatOperationId
      type: 'apply_shield'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      result?: { applied: number; shieldAfter: number }
    }
