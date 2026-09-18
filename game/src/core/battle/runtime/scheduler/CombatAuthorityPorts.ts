// CombatAuthorityPorts.ts -- intent-level inputs; the AUTHORITY resolves
// formulas. EVERY method takes ctx (review r3 BLOCKER 1): authorities emit
// envelope-free payloads via ctx.events -- the op-scoped CombatEventSink
// mints eventIds + causationOperationId itself (r4 MEDIUM 3).
//
// Ports are OPTIONAL per domain -- an op routed to an unwired port is a
// STRUCTURAL failure (contract sec.50): the executor throws
// CombatSettlementFault, never a typed 'failed' result.

import type { CombatAuthorityExecutionContext } from '../../contracts/context'
import type { CombatEntityId } from '../../contracts/ids'
import type {
  ApplyBuffRequest,
  BuffCleanseQuery,
  BuffModifierPayload,
  BuffRemovalReason,
  ConsumeResourceOperation,
  DealDamageOperation,
  HealOperation,
} from '../../contracts/operations'
import type {
  ApplyBuffResult,
  CleanseResult,
  ConsumeStacksResult,
  RemoveBuffResult,
  StacksResult,
  TriggerPeriodicStartResult,
} from '../../contracts/results'
import type { BuffInstanceSelector } from '../../contracts/selectors'

export interface BuffAuthority {
  apply(
    req: ApplyBuffRequest,
    ctx: CombatAuthorityExecutionContext,
  ): ApplyBuffResult
  addStacks(
    sel: BuffInstanceSelector,
    stacks: number,
    ctx: CombatAuthorityExecutionContext,
  ): StacksResult
  removeStacks(
    sel: BuffInstanceSelector,
    stacks: number,
    ctx: CombatAuthorityExecutionContext,
  ): StacksResult
  consumeStacks(
    sel: BuffInstanceSelector,
    stacks: number | 'all',
    reason: 'consumed' | 'reaction',
    ctx: CombatAuthorityExecutionContext,
  ): ConsumeStacksResult
  /** v7.5 -- reports the minted modifierRuntimeId (the entry's exact
      runtime identity -- r5 HIGH 1). */
  addModifier(
    sel: BuffInstanceSelector,
    mod: BuffModifierPayload,
    ctx: CombatAuthorityExecutionContext,
  ): { applied: boolean; modifierRuntimeId?: string }
  /** v7.5 -- all_matching (r5 HIGH 1): removes EVERY runtime entry
      carrying modifierId and reports the removed generations. */
  removeModifier(
    sel: BuffInstanceSelector,
    modifierId: string,
    ctx: CombatAuthorityExecutionContext,
  ): { removed: boolean; removedRuntimeIds: readonly string[] }
  refreshDuration(
    sel: BuffInstanceSelector,
    duration: number | undefined,
    ctx: CombatAuthorityExecutionContext,
  ): { durationBefore: number; durationAfter: number }
  extendDuration(
    sel: BuffInstanceSelector,
    turns: number,
    maxRemaining: number | undefined,
    ctx: CombatAuthorityExecutionContext,
  ): { durationBefore: number; durationAfter: number }
  /** Commits periodic use/modifier semantics, then emits the FIRST unit's
      single-request `PeriodicRequestsCommitted` via ctx.events -- the
      scheduler's built-in handler converts it to an op (review r4
      BLOCKER 2). Multi-unit triggers queue the rest as a settled-event
      continuation: the emitter's `periodic_operation_settled` handler
      emits each next unit's single-request event through its
      event-scoped sink, so EVERY request computes against
      post-settlement state (r4-review BLOCKER 1).
      v7.5 -- returns TriggerPeriodicStartResult (r5 BLOCKER 1: start
      metadata only -- the op must not claim un-emitted resolutions). */
  triggerPeriodic(
    sel: BuffInstanceSelector,
    periodicId: string | undefined,
    ctx: CombatAuthorityExecutionContext,
  ): TriggerPeriodicStartResult
  /** v7.2 -- spec sec.53: core mutation APIs never return void. */
  remove(
    sel: BuffInstanceSelector,
    reason: BuffRemovalReason,
    ctx: CombatAuthorityExecutionContext,
  ): RemoveBuffResult
  /** v7.1 -- spec sec.36/38/42/67 required-API parity. */
  setStacks(
    sel: BuffInstanceSelector,
    stacks: number,
    ctx: CombatAuthorityExecutionContext,
  ): StacksResult
  setRemainingDuration(
    sel: BuffInstanceSelector,
    duration: number,
    ctx: CombatAuthorityExecutionContext,
  ): { durationBefore: number; durationAfter: number }
  /** v7.1 -- spec sec.42: removes dispellable instances on targetId
      matching query (reason 'cleansed'). Contract v1.6 `limit`:
      undefined = all matching dispellable; N = the first N in canonical
      sortedForTarget order; `skipped` still reports every matched-but-
      non-dispellable instance. */
  cleanse(
    targetId: CombatEntityId,
    query: BuffCleanseQuery,
    limit: number | undefined,
    ctx: CombatAuthorityExecutionContext,
  ): CleanseResult
}

export interface DamageAuthority {
  /** Intent in, result out. DamageSystem picks the internal channel from
      damageProfile + origin.kind + canCrit/canMiss -- NOT the executor and
      NOT a "closest existing method" guess. */
  dealDamage(
    op: DealDamageOperation['payload'],
    ctx: CombatAuthorityExecutionContext,
  ): { rawDamage: number; hpDamage: number; killed: boolean }
}

export interface GaugeAuthority {
  pushGauge(
    targetId: CombatEntityId,
    fractionOfMax: number,
    ctx: CombatAuthorityExecutionContext,
  ): { before: number; requestedDelta: number; appliedDelta: number; after: number }
}

export interface ResourceAuthority {
  gain(
    targetId: CombatEntityId,
    resourceId: string,
    amount: number,
    ctx: CombatAuthorityExecutionContext,
  ): { before: number; requested: number; applied: number; after: number }
  /** `valueSource` is the op payload's -- 'cast_snapshot' asserts the
      numeric amount was frozen at cast; 'all'+snapshot is contradictory
      and faults at the authority (P5 F-B: the field must reach the port,
      not die at the executor). */
  consume(
    targetId: CombatEntityId,
    resourceId: string,
    amount: number | 'all',
    valueSource: ConsumeResourceOperation['payload']['valueSource'],
    ctx: CombatAuthorityExecutionContext,
  ): { before: number; requested: number | 'all'; applied: number; after: number }
}

export interface ShieldAuthority {
  applyShield(
    targetId: CombatEntityId,
    amount: number,
    ctx: CombatAuthorityExecutionContext,
  ): { applied: number; shieldAfter: number }
}

export interface HealAuthority {
  heal(
    payload: HealOperation['payload'],
    ctx: CombatAuthorityExecutionContext,
  ): { requested: number; healed: number; after: number }
}

export interface CombatAuthorityPorts {
  buffs?: BuffAuthority
  damage?: DamageAuthority
  gauge?: GaugeAuthority
  resource?: ResourceAuthority
  shield?: ShieldAuthority
  heal?: HealAuthority
}
