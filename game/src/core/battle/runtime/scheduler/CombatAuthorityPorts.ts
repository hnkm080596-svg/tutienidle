// CombatAuthorityPorts.ts -- intent-level inputs; the AUTHORITY resolves
// formulas. EVERY method takes ctx (review r3 BLOCKER 1): authorities mint
// eventIds + causationOperationId from ctx.operationId and emit via
// ctx.events (the op-scoped CombatEventSink).
//
// Ports are OPTIONAL per domain -- an op routed to an unwired port is a
// STRUCTURAL failure (contract sec.50): the executor throws
// CombatSettlementFault, never a typed 'failed' result.

import type { CombatAuthorityExecutionContext } from '../../contracts/context'
import type { CombatEntityId } from '../../contracts/ids'
import type {
  ApplyBuffRequest,
  BuffModifierPayload,
  BuffRemovalReason,
  ConsumeResourceOperation,
  DealDamageOperation,
  HealOperation,
} from '../../contracts/operations'
import type { PeriodicResolution } from '../../contracts/periodic'
import type {
  ApplyBuffResult,
  ConsumeStacksResult,
  StacksResult,
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
  addModifier(
    sel: BuffInstanceSelector,
    mod: BuffModifierPayload,
    ctx: CombatAuthorityExecutionContext,
  ): { applied: boolean }
  removeModifier(
    sel: BuffInstanceSelector,
    modifierId: string,
    ctx: CombatAuthorityExecutionContext,
  ): { removed: boolean }
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
  /** Commits periodic use/modifier semantics, then emits
      `PeriodicRequestsCommitted` (carrying the typed requests) via
      ctx.events -- the scheduler's built-in handler converts them to ops
      (review r4 BLOCKER 2). The return value feeds
      result.resolutionsEmitted only. */
  triggerPeriodic(
    sel: BuffInstanceSelector,
    periodicId: string | undefined,
    ctx: CombatAuthorityExecutionContext,
  ): readonly PeriodicResolution[]
  remove(
    sel: BuffInstanceSelector,
    reason: BuffRemovalReason,
    ctx: CombatAuthorityExecutionContext,
  ): void
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
