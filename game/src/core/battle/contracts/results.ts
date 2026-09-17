// contracts/results.ts — result taxonomy LOCKED (contract §50-53, review r2):
//   'resolved'  = committed, typed payload attached
//   'skipped'   = normal runtime invalidation (dead target, stale state,
//                 insufficient resource) — typed reason required
//   'failed'    = RESERVED — kept in the union per spec §52 but NO v1
//                 producer may emit it (review r2: no concrete semantic
//                 exists yet; an application roll failure is
//                 'resolved' + result.applied:false, not 'failed').
//                 A producer emitting 'failed' fails tests — add a
//                 semantic first.
//   STRUCTURAL  = missing port / unknown definition / malformed op ->
//                 NEVER a result. Dev+test: throw. Broken engine wiring is
//                 not a combat outcome (§50).
//
// NOTE: an ApplyBuffOperation whose application roll fails returns
// {status:'resolved', result:{applied:false}} — the op executed fine; the
// BUFF result is the authority on success (contract §17).
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
  status: CombatOperationResultStatus // 'failed' reserved — see header
  reason?: CombatOperationResultReason
}

// ---------------------------------------------------------------------------
// Result-side buff contract types — pinned here so the union compiles; the
// buff megaplan implements them verbatim.
// ---------------------------------------------------------------------------

/** Canonical result (spec §17). Authoritative — consumers do not infer
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

/** Buff spec §37 — if stacks reach zero, removal reason = 'consumed'. */
export interface ConsumeStacksResult {
  consumed: number
  remaining: number
  removed: boolean
}

export interface HealResult {
  requested: number
  healed: number
  after: number
}

// ---------------------------------------------------------------------------
// Result union — richer than {status} (review: the trace must reconstruct
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
      type: 'add_buff_modifier' | 'remove_buff_modifier'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      result?: { modifierId: string; applied: boolean }
    }
  | {
      operationId: CombatOperationId
      type: 'refresh_buff_duration' | 'extend_buff_duration'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      result?: { durationBefore: number; durationAfter: number }
    }
  | {
      operationId: CombatOperationId
      type: 'trigger_buff_periodic'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
      result?: { resolutionsEmitted: number }
    }
  | {
      operationId: CombatOperationId
      type: 'remove_buff'
      status: CombatOperationResultStatus
      reason?: CombatOperationResultReason
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
