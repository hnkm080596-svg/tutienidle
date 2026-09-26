// BuffSystem.ts -- the SOLE buff mutation and lifecycle authority (spec
// sec.67). Implements the contract's BuffAuthority port; every mutator
// takes ctx, every lifecycle method takes lctx. Queries delegate to the
// BuffReadPort -- this class never exposes the store.
//
// Emission ORDER locked (r4 HIGH 5): the canonical elemental fact
// (ElementalApplicationCommitted) precedes generic buff observability
// (buff_applied / buff_stacks_changed / buff_duration_changed), so
// reaction evaluation can never be preempted by gauge/proc
// consequences -- depth-first settlement drains in emit order.
//
// ZERO-STACK RULE (spec addendum sec.7): ANY stacks mutation landing at 0
// removes the instance -- removeStacks/setStacks -> reason 'consumed';
// consumeStacks -> its passed reason. A zero-stacks instance never
// persists.

import type { CombatAuthorityExecutionContext } from '../battle/contracts/context'
import type { PeriodicOperationSettled, PeriodicTriggerKind } from '../battle/contracts/events'
import type {
  BuffDefinitionId,
  BuffInstanceId,
  CombatEntityId,
} from '../battle/contracts/ids'
import type { ElementalStateRegistry } from '../battle/contracts/elemental'
import type {
  ApplyBuffRequest,
  BuffCleanseQuery,
  BuffModifierPayload,
  BuffRemovalReason,
} from '../battle/contracts/operations'
import type { CombatOperationOrigin } from '../battle/contracts/origin'
import type {
  BuffPeriodicDamageRequest,
  BuffPeriodicHealRequest,
} from '../battle/contracts/periodic'
import type {
  ApplyBuffResult,
  CleanseResult,
  ConsumeStacksResult,
  RemoveBuffResult,
  StacksResult,
  TriggerPeriodicStartResult,
} from '../battle/contracts/results'
import type { BuffInstanceSelector } from '../battle/contracts/selectors'
import type { CombatEventSink } from '../battle/contracts/sink'
import type { BuffAuthority } from '../battle/runtime/scheduler/CombatAuthorityPorts'
import type { ApplicationResolver } from './ApplicationResolver'
import type {
  BuffDefinition,
  BuffLifetimeClock,
  BuffPeriodicDefinition,
} from './BuffDefinition'
import type { BuffInstance, BuffSnapshotData } from './BuffInstance'
import type { BuffModifier } from './BuffModifier'
import {
  attachModifier,
  removeModifiersById,
} from './BuffModifierEngine'
import { periodicGrowthPayloadOf } from './PeriodicGrowthCapabilities'
import {
  computePeriodicRequest,
  type PendingUseMark,
} from './BuffPeriodicResolver'
import type { BuffReadPort } from './BuffQuery'
import { createBuffReadPort, sourceTypeOf } from './BuffQuery'
import type { BuffLifecycleContext } from './BuffLifecycleContext'
import type { BuffRegistry } from './BuffRegistry'
import type { BuffStore } from './BuffStore'

/** Bounded stat-read port -- application resolution (sec.12/19) ONLY.
    Periodic resolution never touches stats; snapshots capture through
    the profile-owned port below; liveness reads through
    BuffEntityReadPort. */
export interface BuffStatReadPort {
  getStats(entityId: CombatEntityId):
    | Readonly<{
        elementApplicationPercent?: number
        ailmentDurationPercent?: number
        ailmentResistPercent?: number
      }>
    | undefined
}

/** Entity-state read port -- liveness for Phase-B sweeps, revalidation,
    and removeOnSourceDeath. Entity state, not a Stat responsibility. */
export interface BuffEntityReadPort {
  isAlive(entityId: CombatEntityId): boolean
}

/** Profile-owned snapshot capture (r4 HIGH 4): the damage profile owns
    WHAT a snapshot means (schema + source context). buff2 stores the
    opaque result and never reads its keys. */
export interface DamageProfileSnapshotPort {
  capture(
    damageProfileId: string,
    sourceId: CombatEntityId,
    fields: readonly string[],
  ): BuffSnapshotData
}

interface PeriodicUnit {
  instanceId: BuffInstanceId
  periodicId: string
}

/** Unit with the sort keys resolved (spec sec.55 comparator inputs). */
interface RankedUnit extends PeriodicUnit {
  targetId: CombatEntityId
  definitionId: BuffDefinitionId
  sourceId: CombatEntityId
}

interface PendingSeries {
  trigger: { type: PeriodicTriggerKind; anchorEntityId?: CombatEntityId }
  units: readonly RankedUnit[]
  next: number
}

/** spec sec.55 canonical comparator (periodicId last). */
function compareUnits(a: RankedUnit, b: RankedUnit): number {
  return (
    a.targetId.localeCompare(b.targetId) ||
    a.definitionId.localeCompare(b.definitionId) ||
    a.sourceId.localeCompare(b.sourceId) ||
    a.instanceId.localeCompare(b.instanceId) ||
    a.periodicId.localeCompare(b.periodicId)
  )
}

export class BuffSystem implements BuffAuthority, BuffReadPort {
  private readonly read: BuffReadPort
  /** requestId -> the 'uses' marks reserved for that in-flight request. */
  private readonly pendingUses = new Map<string, readonly PendingUseMark[]>()
  /** requestId -> manual-trigger continuation (r4 BLOCKER 1). */
  private readonly pendingSeries = new Map<string, PendingSeries>()
  /** instanceId -> modifierRuntimeId mint ordinal (`bmr.${instanceId}.${n}`). */
  private readonly modifierOrdinals = new Map<BuffInstanceId, number>()

  constructor(
    private readonly store: BuffStore,
    private readonly registry: BuffRegistry,
    private readonly resolver: ApplicationResolver,
    private readonly stats: BuffStatReadPort,
    private readonly entities: BuffEntityReadPort,
    private readonly snapshots: DamageProfileSnapshotPort,
    private readonly elemental: ElementalStateRegistry,
  ) {
    this.read = createBuffReadPort(store, registry)
  }

  // =====================================================================
  // BuffAuthority -- application (spec sec.10-16 + contract sec.15-22)
  // =====================================================================

  apply(req: ApplyBuffRequest, ctx: CombatAuthorityExecutionContext): ApplyBuffResult {
    const def = this.registry.get(req.definitionId) // unknown -> throw (structural, contract sec.50)
    const existing =
      def.instanceScope === 'per_source'
        ? this.store.find(def.id, req.sourceId, req.targetId)
        : this.store.findOnTarget(def.id, req.targetId)

    const { success, duration } = this.resolver.resolve(req, {
      source: { stats: this.stats.getStats(req.sourceId) ?? {} },
      target: { stats: this.stats.getStats(req.targetId) ?? {} },
      definition: def,
      existing,
    })

    if (!success) {
      ctx.events.emit({
        type: 'buff_application_failed',
        definitionId: def.id,
        sourceId: req.sourceId,
        targetId: req.targetId,
        reason: 'application_roll_failed',
        origin: req.origin,
      })
      return { applied: false } // spec sec.14 -- no state touched
    }

    // clearsCcOnApply: strip the target's control instances BEFORE own
    // commit (legacy parity).
    if (def.clearsCcOnApply === true) {
      for (const instance of this.sortedForTarget(req.targetId)) {
        const instanceDef = this.registry.get(instance.definitionId)
        if (instanceDef.controls !== undefined && instanceDef.controls.length > 0) {
          this.removeInstance(instance, 'cleansed', ctx.events, ctx.origin.rootActionId)
        }
      }
    }

    const stacksBefore = existing?.stacks ?? 0
    const durationBefore = existing?.remaining ?? 0
    const maxStacks = def.stacking.maxStacks

    // Convert-at-cap (R-B7): the add-axis reapply reaching maxStacks
    // converts INSTEAD of committing stacks.
    if (
      existing !== undefined &&
      def.convertsToId !== undefined &&
      def.convertsAtStackCap === true &&
      def.stacking.onReapplyStacks === 'add' &&
      existing.stacks + req.stacks >= maxStacks
    ) {
      const convertSource = existing.sourceId
      const convertTarget = existing.targetId
      this.removeInstance(existing, 'replaced', ctx.events, ctx.origin.rootActionId)
      return this.apply(
        {
          definitionId: def.convertsToId,
          sourceId: convertSource,
          targetId: convertTarget,
          stacks: 1,
          baseChance: 1,
          reactionEligibility: 'suppressed', // R-B7 -- continuation lane
          origin: this.continuationOrigin(existing.instanceId, convertSource, ctx),
        },
        ctx,
      )
    }

    let instance: BuffInstance
    let created = false
    let stacksAfter: number

    if (existing === undefined || def.stacking.replaceInstanceOnReapply === true) {
      if (existing !== undefined) {
        this.removeInstance(existing, 'replaced', ctx.events, ctx.origin.rootActionId)
      }
      instance = {
        instanceId: this.store.nextInstanceId(),
        definitionId: def.id,
        sourceId: req.sourceId,
        targetId: req.targetId,
        stacks: Math.min(req.stacks, maxStacks),
        remaining: duration,
        continuousTurns: 0,
        continuousSeconds: 0,
        modifiers: [],
        createdSequence: ctx.combatSequence,
        lastAppliedSequence: ctx.combatSequence,
      }
      this.store.add(instance)
      created = true
      stacksAfter = instance.stacks
    } else {
      instance = existing
      // Stacks axis (independent of duration axis -- spec sec.9).
      switch (def.stacking.onReapplyStacks) {
        case 'add':
          stacksAfter = Math.min(instance.stacks + req.stacks, maxStacks)
          break
        case 'replace':
          stacksAfter = Math.min(req.stacks, maxStacks)
          break
        case 'keep':
        default:
          stacksAfter = instance.stacks
          break
      }
      instance.stacks = stacksAfter
      // Duration axis.
      switch (def.stacking.onReapplyDuration) {
        case 'refresh':
          instance.remaining = duration
          break
        case 'extend':
          instance.remaining =
            (instance.remaining ?? 0) + (duration ?? 0) // uncapped (open q5)
          break
        case 'keep':
        default:
          break
      }
      // per_target + 'latest' -> transfer sourceId (instanceId UNCHANGED -- R-B4).
      if (
        def.instanceScope === 'per_target' &&
        (def.sourceOwnership ?? 'latest') === 'latest' &&
        instance.sourceId !== req.sourceId
      ) {
        this.store.remove(instance.instanceId)
        instance.sourceId = req.sourceId
        this.store.add(instance)
      }
      instance.lastAppliedSequence = ctx.combatSequence
    }

    // Snapshot recapture -- EVERY successful apply, AFTER source-ownership
    // resolution (R-B9/BLOCKER 4): sourceId and snapshot can never disagree.
    for (const p of def.periodic ?? []) {
      if (p.type === 'damage' && p.scaling === 'snapshot') {
        instance.snapshots ??= {}
        instance.snapshots[p.id] = this.snapshots.capture(
          p.damageProfile,
          instance.sourceId,
          p.snapshotFields ?? [],
        )
      }
    }

    const stacksAfterFinal = instance.stacks
    const addedStacks = stacksAfterFinal - stacksBefore
    const durationAfter = instance.remaining ?? 0

    // Emission order locked: canonical elemental fact FIRST (r4 HIGH 5).
    const element = this.elemental.getElement(def.id)
    if (element !== null && addedStacks > 0) {
      ctx.events.emit({
        type: 'elemental_application_committed',
        instanceId: instance.instanceId,
        sourceId: instance.sourceId,
        targetId: instance.targetId,
        definitionId: def.id,
        element,
        stacksBefore,
        stacksAfter: stacksAfterFinal,
        requestedStacks: req.stacks,
        addedStacks,
        reactionEligibility: req.reactionEligibility,
        origin: req.origin,
      })
    }
    ctx.events.emit({
      type: 'buff_applied',
      rootActionId: ctx.origin.rootActionId,
      instanceId: instance.instanceId,
      definitionId: def.id,
      sourceId: instance.sourceId,
      targetId: instance.targetId,
      created,
    })
    if (!created && stacksAfterFinal !== stacksBefore) {
      ctx.events.emit({
        type: 'buff_stacks_changed',
        rootActionId: ctx.origin.rootActionId,
        instanceId: instance.instanceId,
        stacksBefore,
        stacksAfter: stacksAfterFinal,
        addedStacks,
      })
    }
    if (!created && durationAfter !== durationBefore) {
      ctx.events.emit({
        type: 'buff_duration_changed',
        rootActionId: ctx.origin.rootActionId,
        instanceId: instance.instanceId,
        durationBefore,
        durationAfter,
      })
    }

    return {
      applied: true,
      instanceId: instance.instanceId,
      created,
      stacksBefore,
      stacksAfter: stacksAfterFinal,
      requestedStacks: req.stacks,
      addedStacks,
      overflowStacks: Math.max(0, req.stacks - addedStacks),
      durationBefore,
      durationAfter,
    }
  }

  // =====================================================================
  // BuffAuthority -- stacks (spec sec.36-37 + zero-stack rule)
  // =====================================================================

  addStacks(sel: BuffInstanceSelector, stacks: number, ctx: CombatAuthorityExecutionContext): StacksResult {
    const instance = this.resolveInstance(sel)
    if (instance === undefined) return { stacksBefore: 0, stacksAfter: 0 }
    const def = this.registry.get(instance.definitionId)
    const stacksBefore = instance.stacks
    const stacksAfter = Math.min(stacksBefore + stacks, def.stacking.maxStacks)
    return this.commitStacks(instance, stacksBefore, stacksAfter, 'consumed', ctx)
  }

  removeStacks(sel: BuffInstanceSelector, stacks: number, ctx: CombatAuthorityExecutionContext): StacksResult {
    const instance = this.resolveInstance(sel)
    if (instance === undefined) return { stacksBefore: 0, stacksAfter: 0 }
    const stacksBefore = instance.stacks
    const stacksAfter = Math.max(0, stacksBefore - stacks)
    return this.commitStacks(instance, stacksBefore, stacksAfter, 'consumed', ctx)
  }

  setStacks(sel: BuffInstanceSelector, stacks: number, ctx: CombatAuthorityExecutionContext): StacksResult {
    const instance = this.resolveInstance(sel)
    if (instance === undefined) return { stacksBefore: 0, stacksAfter: 0 }
    const def = this.registry.get(instance.definitionId)
    const stacksBefore = instance.stacks
    const stacksAfter = Math.min(def.stacking.maxStacks, Math.max(0, stacks))
    return this.commitStacks(instance, stacksBefore, stacksAfter, 'consumed', ctx)
  }

  consumeStacks(
    sel: BuffInstanceSelector,
    stacks: number | 'all',
    reason: 'consumed' | 'reaction',
    ctx: CombatAuthorityExecutionContext,
  ): ConsumeStacksResult {
    const instance = this.resolveInstance(sel)
    if (instance === undefined) return { consumed: 0, remaining: 0, removed: false }
    const consumed = stacks === 'all' ? instance.stacks : Math.min(stacks, instance.stacks)
    const stacksBefore = instance.stacks
    const stacksAfter = stacksBefore - consumed
    instance.stacks = stacksAfter
    if (stacksAfter === 0) {
      this.removeInstance(instance, reason, ctx.events, ctx.origin.rootActionId)
      return { consumed, remaining: 0, removed: true }
    }
    if (stacksAfter !== stacksBefore) {
      ctx.events.emit({
        type: 'buff_stacks_changed',
        rootActionId: ctx.origin.rootActionId,
        instanceId: instance.instanceId,
        stacksBefore,
        stacksAfter,
        addedStacks: stacksAfter - stacksBefore,
      })
    }
    return { consumed, remaining: stacksAfter, removed: false }
  }

  private commitStacks(
    instance: BuffInstance,
    stacksBefore: number,
    stacksAfter: number,
    zeroReason: BuffRemovalReason,
    ctx: CombatAuthorityExecutionContext,
  ): StacksResult {
    instance.stacks = stacksAfter // post-mutation state: stacksAtRemoval reports 0
    if (stacksAfter <= 0) {
      this.removeInstance(instance, zeroReason, ctx.events, ctx.origin.rootActionId)
      return { stacksBefore, stacksAfter: 0 }
    }
    if (stacksAfter !== stacksBefore) {
      ctx.events.emit({
        type: 'buff_stacks_changed',
        rootActionId: ctx.origin.rootActionId,
        instanceId: instance.instanceId,
        stacksBefore,
        stacksAfter,
        addedStacks: stacksAfter - stacksBefore,
      })
    }
    return { stacksBefore, stacksAfter }
  }

  // =====================================================================
  // BuffAuthority -- modifiers (spec sec.29-35; runtime-entry identity)
  // =====================================================================

  addModifier(
    sel: BuffInstanceSelector,
    mod: BuffModifierPayload,
    ctx: CombatAuthorityExecutionContext,
  ): { applied: boolean; modifierRuntimeId?: string } {
    const instance = this.resolveInstance(sel)
    if (instance === undefined) return { applied: false }
    const { entry, evicted } = attachModifier(instance, mod, () =>
      this.mintModifierRuntimeId(instance.instanceId),
    )
    for (const e of evicted) this.releaseMarksFor(e)
    ctx.events.emit({
      type: 'buff_modifier_added',
      rootActionId: ctx.origin.rootActionId,
      instanceId: instance.instanceId,
      modifierId: entry.id,
      modifierRuntimeId: entry.modifierRuntimeId,
    })
    return { applied: true, modifierRuntimeId: entry.modifierRuntimeId }
  }

  /** all_matching (r5 HIGH 1): removes EVERY runtime entry carrying the
      authored modifierId; one buff_modifier_removed per generation. */
  removeModifier(
    sel: BuffInstanceSelector,
    modifierId: string,
    ctx: CombatAuthorityExecutionContext,
  ): { removed: boolean; removedRuntimeIds: readonly string[] } {
    const instance = this.resolveInstance(sel)
    if (instance === undefined) return { removed: false, removedRuntimeIds: [] }
    const removed = removeModifiersById(instance, modifierId)
    for (const entry of removed) {
      this.releaseMarksFor(entry)
      ctx.events.emit({
        type: 'buff_modifier_removed',
        rootActionId: ctx.origin.rootActionId,
        instanceId: instance.instanceId,
        modifierId: entry.id,
        modifierRuntimeId: entry.modifierRuntimeId,
      })
    }
    return {
      removed: removed.length > 0,
      removedRuntimeIds: removed.map((m) => m.modifierRuntimeId),
    }
  }

  // =====================================================================
  // BuffAuthority -- duration (spec sec.38)
  // =====================================================================

  refreshDuration(
    sel: BuffInstanceSelector,
    duration: number | undefined,
    ctx: CombatAuthorityExecutionContext,
  ): { durationBefore: number; durationAfter: number } {
    const instance = this.resolveInstance(sel)
    if (instance === undefined) return { durationBefore: 0, durationAfter: 0 }
    const def = this.registry.get(instance.definitionId)
    const durationBefore = instance.remaining ?? 0
    const durationAfter = duration ?? def.lifetime.duration ?? 0
    instance.remaining = durationAfter
    this.emitDurationChanged(instance, durationBefore, durationAfter, ctx)
    return { durationBefore, durationAfter }
  }

  extendDuration(
    sel: BuffInstanceSelector,
    turns: number,
    maxRemaining: number | undefined,
    ctx: CombatAuthorityExecutionContext,
  ): { durationBefore: number; durationAfter: number } {
    const instance = this.resolveInstance(sel)
    if (instance === undefined) return { durationBefore: 0, durationAfter: 0 }
    const durationBefore = instance.remaining ?? 0
    let durationAfter = durationBefore + turns
    if (maxRemaining !== undefined) durationAfter = Math.min(durationAfter, maxRemaining)
    instance.remaining = durationAfter
    this.emitDurationChanged(instance, durationBefore, durationAfter, ctx)
    return { durationBefore, durationAfter }
  }

  setRemainingDuration(
    sel: BuffInstanceSelector,
    duration: number,
    ctx: CombatAuthorityExecutionContext,
  ): { durationBefore: number; durationAfter: number } {
    const instance = this.resolveInstance(sel)
    if (instance === undefined) return { durationBefore: 0, durationAfter: 0 }
    const durationBefore = instance.remaining ?? 0
    instance.remaining = duration
    this.emitDurationChanged(instance, durationBefore, duration, ctx)
    return { durationBefore, durationAfter: duration }
  }

  private emitDurationChanged(
    instance: BuffInstance,
    durationBefore: number,
    durationAfter: number,
    ctx: CombatAuthorityExecutionContext,
  ): void {
    if (durationAfter === durationBefore) return
    ctx.events.emit({
      type: 'buff_duration_changed',
      rootActionId: ctx.origin.rootActionId,
      instanceId: instance.instanceId,
      durationBefore,
      durationAfter,
    })
  }

  // =====================================================================
  // BuffAuthority -- removal / cleanse (spec sec.42/53)
  // =====================================================================

  remove(
    sel: BuffInstanceSelector,
    reason: BuffRemovalReason,
    ctx: CombatAuthorityExecutionContext,
  ): RemoveBuffResult {
    const instance = this.resolveInstance(sel)
    if (instance === undefined) return { removed: false }
    const stacksAtRemoval = instance.stacks
    this.removeInstance(instance, reason, ctx.events, ctx.origin.rootActionId)
    return { removed: true, instanceId: instance.instanceId, stacksAtRemoval }
  }

  /** spec sec.42 + contract v1.6 -- removes dispellable instances on
      targetId matching query (reason 'cleansed'); matched-but-non-
      dispellable land in `skipped`. `limit`: undefined = every matching
      dispellable instance; N = the first N in canonical sortedForTarget
      order (limit-bound matches beyond N are simply left, not reported). */
  cleanse(
    targetId: CombatEntityId,
    query: BuffCleanseQuery,
    limit: number | undefined,
    ctx: CombatAuthorityExecutionContext,
  ): CleanseResult {
    const cleansed: BuffInstanceId[] = []
    const skipped: BuffInstanceId[] = []
    for (const instance of this.sortedForTarget(targetId)) {
      const def = this.registry.get(instance.definitionId)
      if (query.kind !== undefined && def.kind !== query.kind) continue
      if (query.polarity !== undefined && sourceTypeOf(def) !== query.polarity) continue
      if (query.element !== undefined && def.element !== query.element) continue
      if (query.definitionId !== undefined && def.id !== query.definitionId) continue
      if (
        query.tags !== undefined &&
        !query.tags.every((t) => def.tags?.includes(t) === true)
      ) {
        continue
      }
      if (!def.dispellable) {
        skipped.push(instance.instanceId)
        continue
      }
      if (limit !== undefined && cleansed.length >= limit) continue
      this.removeInstance(instance, 'cleansed', ctx.events, ctx.origin.rootActionId)
      cleansed.push(instance.instanceId)
    }
    return { cleansed, skipped }
  }

  // =====================================================================
  // BuffAuthority -- manual periodic trigger (spec sec.27/62 + r4/r5/r6)
  // =====================================================================

  /** Emits only the FIRST unit's single-request PeriodicRequestsCommitted
      via ctx.events; the remaining unit list stores as a pending
      continuation keyed by the emitted requestId -- handlePeriodicSettled
      emits each next unit one-at-a-time, computed against post-settlement
      state. NEVER advances lifetimes, NEVER decrements turn-based
      modifier lifetimes. */
  triggerPeriodic(
    sel: BuffInstanceSelector,
    periodicId: string | undefined,
    ctx: CombatAuthorityExecutionContext,
  ): TriggerPeriodicStartResult {
    const instance = this.resolveInstance(sel)
    if (instance === undefined) return { started: false, candidateUnitCount: 0 }
    const def = this.registry.get(instance.definitionId)
    const units = (def.periodic ?? [])
      .filter((p) => periodicId === undefined || p.id === periodicId)
      .map((p) => ({
        instanceId: instance.instanceId,
        periodicId: p.id,
        targetId: instance.targetId,
        definitionId: def.id,
        sourceId: instance.sourceId,
      }))
      .sort(compareUnits)
    if (units.length === 0) return { started: false, candidateUnitCount: 0 }

    // v7.6 r6 MEDIUM 1 -- all-dead branch: matched candidates but none
    // live -> no request, no pendingSeries, no marks.
    const firstLiveIndex = units.findIndex((u) => this.unitIsLive(u.instanceId))
    if (firstLiveIndex < 0) {
      return { started: false, candidateUnitCount: units.length }
    }
    const first = units[firstLiveIndex]!
    const computation = this.computeUnitRequest(instance, first.periodicId)
    if (computation === undefined) return { started: false, candidateUnitCount: units.length }

    const trigger = { type: 'manual' as const, anchorEntityId: instance.targetId }
    ctx.events.emit({
      type: 'periodic_requests_committed',
      trigger,
      rootActionId: ctx.origin.rootActionId,
      requests: [computation.request],
    })
    this.pendingUses.set(computation.request.requestId, computation.marks)
    const remaining = units.slice(firstLiveIndex + 1)
    if (remaining.length > 0) {
      this.pendingSeries.set(computation.request.requestId, {
        trigger,
        units: remaining,
        next: 0,
      })
    }
    return {
      started: true,
      firstRequestId: computation.request.requestId,
      candidateUnitCount: units.length,
    }
  }

  // =====================================================================
  // Scheduler-registered handler -- NOT a BuffAuthority port member.
  // Registered at composition as the 'periodic_operation_settled'
  // immediate handler; receives the event-scoped sink.
  // =====================================================================

  handlePeriodicSettled(event: PeriodicOperationSettled, sink: CombatEventSink): void {
    // (a) Finalize pending uses-marks (v7.3): 'resolved' -> consume a use
    //     per marked entry (removal at 0 is evented -- r4 HIGH 2);
    //     anything else -> release. Marks naming a dead entry/instance
    //     die with it -- the replacement generation is untouched.
    const marks = this.pendingUses.get(event.requestId)
    if (marks !== undefined) {
      this.pendingUses.delete(event.requestId)
      for (const mark of marks) {
        const instance = this.store.get(mark.instanceId)
        const entry = instance?.modifiers.find(
          (m) => m.modifierRuntimeId === mark.modifierRuntimeId,
        )
        if (instance === undefined || entry === undefined) continue
        entry.pendingRequestId = undefined
        if (event.status === 'resolved' && entry.lifetime.type === 'uses') {
          const remaining = entry.lifetime.remaining - 1
          if (remaining <= 0) {
            instance.modifiers.splice(instance.modifiers.indexOf(entry), 1)
            sink.emit({
              type: 'buff_modifier_removed',
              rootActionId: event.rootActionId,
              instanceId: instance.instanceId,
              modifierId: entry.id,
              modifierRuntimeId: entry.modifierRuntimeId,
            })
          } else {
            entry.lifetime = { ...entry.lifetime, remaining }
          }
        }
      }
    }

    // (b) Manual-trigger continuation (r4 BLOCKER 1): emit the next live
    //     unit's single-request event through the event-scoped sink;
    //     re-key the series under the new requestId.
    const series = this.pendingSeries.get(event.requestId)
    if (series === undefined) return
    this.pendingSeries.delete(event.requestId)
    while (series.next < series.units.length) {
      const unit = series.units[series.next++]!
      const instance = this.store.get(unit.instanceId)
      if (instance === undefined || !this.entities.isAlive(instance.targetId)) continue
      const computation = this.computeUnitRequest(instance, unit.periodicId)
      if (computation === undefined) continue
      sink.emit({
        type: 'periodic_requests_committed',
        trigger: series.trigger,
        rootActionId: event.rootActionId,
        requests: [computation.request],
      })
      this.pendingUses.set(computation.request.requestId, computation.marks)
      if (series.next < series.units.length) {
        this.pendingSeries.set(computation.request.requestId, series)
      }
      return
    }
  }

  // =====================================================================
  // Lifecycle entry points (spec sec.21/26/28 + sec.40-41). Each is a
  // root transaction: periodic units emit + settle ONE AT A TIME, then
  // Phase B runs (dead sweeps -> modifier lifetimes -> continuous
  // counters + conversion -> buff lifetimes -> expiry -> final barrier).
  // NEVER advances a clock or modifier lifetime outside its own anchor.
  // =====================================================================

  onHolderTurnStart(entityId: CombatEntityId, lctx: BuffLifecycleContext): void {
    this.runPeriodicPhase('holder_turn_start', 'target', entityId, lctx)
    this.runPhaseB(lctx, {})
  }

  onHolderTurnEnd(entityId: CombatEntityId, lctx: BuffLifecycleContext): void {
    this.runPeriodicPhase('holder_turn_end', 'target', entityId, lctx)
    this.runPhaseB(lctx, {
      affected: (i) => i.targetId === entityId,
      buffClock: 'holder_turns',
      modifierLifetime: 'holder_turns',
      continuous: 'turns',
    })
  }

  onSourceTurnStart(entityId: CombatEntityId, lctx: BuffLifecycleContext): void {
    this.runPeriodicPhase('source_turn_start', 'source', entityId, lctx)
    this.runPhaseB(lctx, {})
  }

  onSourceTurnEnd(entityId: CombatEntityId, lctx: BuffLifecycleContext): void {
    this.runPeriodicPhase('source_turn_end', 'source', entityId, lctx)
    this.runPhaseB(lctx, {
      affected: (i) => i.sourceId === entityId,
      buffClock: 'source_turns',
      modifierLifetime: 'source_turns',
    })
  }

  onRoundEnd(lctx: BuffLifecycleContext): void {
    // spec sec.22 has no round-timed periodic -- Phase B only.
    this.runPhaseB(lctx, {
      buffClock: 'rounds',
      modifierLifetime: 'rounds',
    })
  }

  onTimePassed(seconds: number, lctx: BuffLifecycleContext): void {
    // Boundedness: a negative delta would corrupt intervalElapsed /
    // grow remaining. Clocks only move forward; clamp here rather than
    // trusting every caller.
    const elapsed = Math.max(0, seconds)
    // Interval multi-crossing (r4 BLOCKER 2): crossings expand into units
    // ordered by absolute tick time inside the window; each computes
    // AFTER the previous unit's settle (never precomputed).
    for (const { unit } of this.collectIntervalUnits(elapsed)) {
      this.emitLifecycleUnit(unit, { type: 'interval' }, lctx)
    }
    this.runPhaseB(lctx, {
      buffClock: 'seconds',
      seconds: elapsed,
      continuous: 'seconds',
    })
  }

  /** spec sec.40-41 -- invoked only at a quiescent point. UNCONDITIONAL
      on the dead target; removeOnSourceDeath gates the source lane. */
  onEntityDeath(entityId: CombatEntityId, lctx: BuffLifecycleContext): void {
    for (const instance of this.sortedAll()) {
      if (instance.targetId === entityId) {
        this.removeInstance(instance, 'death', lctx.events, lctx.rootActionId)
        continue
      }
      const def = this.registry.get(instance.definitionId)
      if (
        instance.sourceId === entityId &&
        def.lifetime.removeOnSourceDeath === true
      ) {
        this.removeInstance(instance, 'source_death', lctx.events, lctx.rootActionId)
      }
    }
    lctx.settle()
  }

  onBattleEnd(lctx: BuffLifecycleContext): void {
    for (const instance of this.sortedAll()) {
      this.removeInstance(instance, 'battle_end', lctx.events, lctx.rootActionId)
    }
    lctx.settle()
  }

  // =====================================================================
  // Queries -- BuffReadPort delegation (spec sec.51)
  // =====================================================================

  getInstance: BuffReadPort['getInstance'] = (sel) => this.read.getInstance(sel)
  getForTarget: BuffReadPort['getForTarget'] = (t) => this.read.getForTarget(t)
  getForSource: BuffReadPort['getForSource'] = (s) => this.read.getForSource(s)
  getByDefinition: BuffReadPort['getByDefinition'] = (t, d) => this.read.getByDefinition(t, d)
  getStacks: BuffReadPort['getStacks'] = (sel) => this.read.getStacks(sel)
  getModifiers: BuffReadPort['getModifiers'] = (sel) => this.read.getModifiers(sel)
  getStatModifiers: BuffReadPort['getStatModifiers'] = (t) => this.read.getStatModifiers(t)
  getCapabilities: BuffReadPort['getCapabilities'] = (t) => this.read.getCapabilities(t)
  hasControl: BuffReadPort['hasControl'] = (t, c) => this.read.hasControl(t, c)
  hasForbiddenTags: BuffReadPort['hasForbiddenTags'] = (e) => this.read.hasForbiddenTags(e)
  has: BuffReadPort['has'] = (sel) => this.read.has(sel)

  // =====================================================================
  // Internals
  // =====================================================================

  private resolveInstance(sel: BuffInstanceSelector): BuffInstance | undefined {
    switch (sel.kind) {
      case 'instance':
        return this.store.get(sel.instanceId)
      case 'identity':
        return this.store.find(sel.definitionId, sel.sourceId, sel.targetId)
      case 'target_definition':
        return this.store.findOnTarget(sel.definitionId, sel.targetId)
    }
  }

  /** spec sec.55 canonical sort over the WHOLE store (dead sweeps,
      expiry, death/battle-end removals). */
  private sortedAll(): readonly BuffInstance[] {
    return [...this.store.all()].sort(
      (a, b) =>
        a.targetId.localeCompare(b.targetId) ||
        a.definitionId.localeCompare(b.definitionId) ||
        a.sourceId.localeCompare(b.sourceId) ||
        a.instanceId.localeCompare(b.instanceId),
    )
  }

  /** Boundary unit list: (instance, periodic) pairs matching the anchor
      + timing, canonical-sorted. */
  private collectBoundaryUnits(
    timing: PeriodicTriggerKind,
    anchor: 'target' | 'source',
    entityId: CombatEntityId,
  ): RankedUnit[] {
    const units: RankedUnit[] = []
    for (const instance of this.store.all()) {
      if (
        anchor === 'target'
          ? instance.targetId !== entityId
          : instance.sourceId !== entityId
      ) {
        continue
      }
      const def = this.registry.get(instance.definitionId)
      for (const p of def.periodic ?? []) {
        if (p.timing !== timing) continue
        units.push({
          instanceId: instance.instanceId,
          periodicId: p.id,
          targetId: instance.targetId,
          definitionId: def.id,
          sourceId: instance.sourceId,
        })
      }
    }
    return units.sort(compareUnits)
  }

  /** Interval crossings (r4 BLOCKER 2): each periodic's accumulator
      advances by `seconds`; every crossed boundary expands into a unit
      at offset (j*intervalSeconds - prevElapsed) inside the window.
      Units sort by offset, ties by the canonical comparator. The
      remainder carries REGARDLESS of later settlements -- a killed unit
      still consumed its crossings. */
  private collectIntervalUnits(
    seconds: number,
  ): { unit: RankedUnit; offset: number }[] {
    const out: { unit: RankedUnit; offset: number }[] = []
    for (const instance of this.store.all()) {
      const def = this.registry.get(instance.definitionId)
      for (const p of def.periodic ?? []) {
        if (p.timing !== 'interval' || p.intervalSeconds === undefined) continue
        const prev = instance.intervalElapsed?.[p.id] ?? 0
        const elapsed = prev + seconds
        const ticks = Math.floor(elapsed / p.intervalSeconds)
        for (let j = 1; j <= ticks; j++) {
          out.push({
            unit: {
              instanceId: instance.instanceId,
              periodicId: p.id,
              targetId: instance.targetId,
              definitionId: def.id,
              sourceId: instance.sourceId,
            },
            offset: j * p.intervalSeconds - prev,
          })
        }
        instance.intervalElapsed ??= {}
        instance.intervalElapsed[p.id] = elapsed - ticks * p.intervalSeconds
      }
    }
    out.sort((a, b) => a.offset - b.offset || compareUnits(a.unit, b.unit))
    return out
  }

  private runPeriodicPhase(
    timing: PeriodicTriggerKind,
    anchor: 'target' | 'source',
    entityId: CombatEntityId,
    lctx: BuffLifecycleContext,
  ): void {
    const trigger = { type: timing, anchorEntityId: entityId }
    for (const unit of this.collectBoundaryUnits(timing, anchor, entityId)) {
      this.emitLifecycleUnit(unit, trigger, lctx)
    }
  }

  /** ONE unit: revalidate (store + target alive -- an earlier unit's
      settlement may have killed this instance or its target), compute
      against CURRENT state, mark pending, emit the single-request event,
      then the per-unit barrier (r4 BLOCKER 2). */
  private emitLifecycleUnit(
    unit: RankedUnit,
    trigger: { type: PeriodicTriggerKind; anchorEntityId?: CombatEntityId },
    lctx: BuffLifecycleContext,
  ): void {
    const instance = this.store.get(unit.instanceId)
    if (instance === undefined || !this.entities.isAlive(instance.targetId)) {
      return
    }
    this.applyPeriodicGrowth(instance, lctx)
    const computation = this.computeUnitRequest(instance, unit.periodicId)
    if (computation === undefined) return
    lctx.events.emit({
      type: 'periodic_requests_committed',
      trigger,
      rootActionId: lctx.rootActionId,
      requests: [computation.request],
    })
    this.pendingUses.set(computation.request.requestId, computation.marks)
    lctx.settle()
  }

  /** Phap Tu Reimagined spec D11 -- 'periodic_growth' capability feed:
      a marker on the ticking instance's HOLDER grows the instance's
      stacks BEFORE its unit computes (the bump feeds stack-scaled
      ticks). A marker matches when its def declares periodic_growth
      naming the ticking definitionId AND the marker's sourceId equals
      the ticking instance's sourceId (own-source Sinh Co binding);
      `consume: true` removes the marker in the same transaction. */
  private applyPeriodicGrowth(
    instance: BuffInstance,
    lctx: BuffLifecycleContext,
  ): void {
    const def = this.registry.get(instance.definitionId)
    for (const marker of this.store.forTarget(instance.targetId)) {
      if (marker.instanceId === instance.instanceId) continue
      if (marker.sourceId !== instance.sourceId) continue
      const markerDef = this.registry.get(marker.definitionId)
      if (markerDef.capabilities === undefined) continue
      for (const capability of markerDef.capabilities) {
        const growth = periodicGrowthPayloadOf(capability)
        if (growth === undefined) continue
        if (growth.definitionId !== instance.definitionId) continue
        const stacksBefore = instance.stacks
        instance.stacks = Math.min(
          stacksBefore + growth.stacks,
          def.stacking.maxStacks,
        )
        if (instance.stacks !== stacksBefore) {
          lctx.events.emit({
            type: 'buff_stacks_changed',
            rootActionId: lctx.rootActionId,
            instanceId: instance.instanceId,
            stacksBefore,
            stacksAfter: instance.stacks,
            addedStacks: instance.stacks - stacksBefore,
          })
        }
        if (growth.consume === true) {
          this.removeInstance(marker, 'consumed', lctx.events, lctx.rootActionId)
        }
        break // one periodic_growth feed per marker instance
      }
    }
  }

  /** Phase B (spec sec.28 steps 3-8): liveness sweeps BEFORE any
      lifetime work, then matching-clock decrements/counters/conversions,
      expiry, and the final barrier. Everything emits through
      lctx.events; settle() publishes them + drains consequences inside
      this root transaction. */
  private runPhaseB(
    lctx: BuffLifecycleContext,
    opts: {
      /** Boundary anchor predicate (decrement/continuous scope). */
      affected?: (instance: BuffInstance) => boolean
      /** Buff clock to decrement on affected instances. */
      buffClock?: BuffLifetimeClock
      /** Decrement step for 'seconds' clock (turn/round clocks use 1). */
      seconds?: number
      /** Modifier lifetime type to decrement on affected instances. */
      modifierLifetime?: 'holder_turns' | 'source_turns' | 'rounds'
      /** continuousTurns++ (holder end) or continuousSeconds += s. */
      continuous?: 'turns' | 'seconds'
    },
  ): void {
    // (1) Liveness revalidation BEFORE any lifetime work (HIGH 2/r4
    //     HIGH 1): the WHOLE store, canonical-sorted -- a dead entity's
    //     non-ticking buffs leave now, never as 'expired' later.
    for (const instance of this.sortedAll()) {
      if (!this.entities.isAlive(instance.targetId)) {
        this.removeInstance(instance, 'death', lctx.events, lctx.rootActionId)
        continue
      }
      const def = this.registry.get(instance.definitionId)
      if (
        def.lifetime.removeOnSourceDeath === true &&
        !this.entities.isAlive(instance.sourceId)
      ) {
        this.removeInstance(instance, 'source_death', lctx.events, lctx.rootActionId)
        continue
      }
      // Phap Tu Reimagined spec D10 -- boundToSourceBuffId: the marker
      // dies 'expired' the moment its source no longer holds the named
      // definition (the bound buff may already have left earlier in
      // this same canonical-order sweep).
      if (
        def.boundToSourceBuffId !== undefined &&
        this.store.findOnTarget(def.boundToSourceBuffId, instance.sourceId) ===
          undefined
      ) {
        this.removeInstance(instance, 'expired', lctx.events, lctx.rootActionId)
      }
    }

    const affected = opts.affected ?? (() => true)
    const live = this.sortedAll().filter(affected)

    // (2) Modifier lifetimes -- matching clock, live only.
    if (opts.modifierLifetime !== undefined) {
      for (const instance of live) {
        for (const entry of [...instance.modifiers]) {
          if (entry.lifetime.type !== opts.modifierLifetime) continue
          const remaining = entry.lifetime.remaining - 1
          if (remaining <= 0) {
            this.releaseMarksFor(entry)
            instance.modifiers.splice(instance.modifiers.indexOf(entry), 1)
            lctx.events.emit({
              type: 'buff_modifier_removed',
              rootActionId: lctx.rootActionId,
              instanceId: instance.instanceId,
              modifierId: entry.id,
              modifierRuntimeId: entry.modifierRuntimeId,
            })
          } else {
            entry.lifetime = { ...entry.lifetime, remaining }
          }
        }
      }
    }

    // (3) Continuous counters + convertsAfter* threshold -- converts via
    //     internal apply (R-B7, suppressed eligibility, 'replaced').
    if (opts.continuous === 'turns') {
      for (const instance of live) instance.continuousTurns++
      this.runConversions(
        live,
        lctx,
        (i, d) =>
          d.convertsAfterContinuousTurns !== undefined &&
          i.continuousTurns >= d.convertsAfterContinuousTurns,
      )
    } else if (opts.continuous === 'seconds') {
      const s = opts.seconds ?? 0
      for (const instance of live) instance.continuousSeconds += s
      this.runConversions(
        live,
        lctx,
        (i, d) =>
          d.convertsAfterContinuousSeconds !== undefined &&
          i.continuousSeconds >= d.convertsAfterContinuousSeconds,
      )
    }

    // (4) Buff lifetime decrement -- matching clock, live only (a
    //     conversion above already removed its instance).
    if (opts.buffClock !== undefined) {
      const step = opts.buffClock === 'seconds' ? (opts.seconds ?? 0) : 1
      for (const instance of live) {
        if (this.store.get(instance.instanceId) === undefined) continue
        const def = this.registry.get(instance.definitionId)
        if (
          def.lifetime.clock !== opts.buffClock ||
          instance.remaining === undefined
        ) {
          continue
        }
        const before = instance.remaining
        instance.remaining = before - step
        lctx.events.emit({
          type: 'buff_duration_changed',
          rootActionId: lctx.rootActionId,
          instanceId: instance.instanceId,
          durationBefore: before,
          durationAfter: instance.remaining,
        })
      }
    }

    // (5) Expiry -- canonical-sorted sweep; remaining <= 0 leaves as
    //     'expired' (dead entities already left above as 'death').
    for (const instance of this.sortedAll()) {
      if (instance.remaining !== undefined && instance.remaining <= 0) {
        this.removeInstance(instance, 'expired', lctx.events, lctx.rootActionId)
      }
    }

    // (5b) boundToSourceBuffId re-sweep -- a window that expired in THIS
    //     pass's decrement/expiry step retires its bound markers NOW
    //     (spec D10: the marker dies the moment the source no longer
    //     holds the definition), not at the next phase boundary. Without
    //     this a stale marker can still feed e.g. periodic_growth reads
    //     landing between expiry and the next runPhaseB.
    for (const instance of this.sortedAll()) {
      const def = this.registry.get(instance.definitionId)
      if (
        def.boundToSourceBuffId !== undefined &&
        this.store.findOnTarget(def.boundToSourceBuffId, instance.sourceId) ===
          undefined
      ) {
        this.removeInstance(instance, 'expired', lctx.events, lctx.rootActionId)
      }
    }

    // (6) Final barrier -- lifecycle emissions + their consequences
    //     resolve inside this root transaction.
    lctx.settle()
  }

  /** convertsAfter* continuation (R-B7): remove 'replaced', then an
      internal apply at stacks:1 / baseChance:1 / suppressed -- provenance
      chains under the lifecycle root (no parent op exists). */
  private runConversions(
    live: readonly BuffInstance[],
    lctx: BuffLifecycleContext,
    reached: (instance: BuffInstance, def: BuffDefinition) => boolean,
  ): void {
    for (const instance of live) {
      if (this.store.get(instance.instanceId) === undefined) continue
      const def = this.registry.get(instance.definitionId)
      if (def.convertsToId === undefined || !reached(instance, def)) continue
      const origin: CombatOperationOrigin = {
        kind: 'scripted',
        originId: `buff_convert.${instance.instanceId}`,
        sourceId: instance.sourceId,
        rootActionId: lctx.rootActionId,
      }
      this.removeInstance(instance, 'replaced', lctx.events, lctx.rootActionId)
      this.apply(
        {
          definitionId: def.convertsToId,
          sourceId: instance.sourceId,
          targetId: instance.targetId,
          stacks: 1,
          baseChance: 1,
          reactionEligibility: 'suppressed',
          origin,
        },
        {
          operationId: `lifecycle_convert.${instance.instanceId}`,
          origin,
          events: lctx.events,
          combatSequence: lctx.sequence,
        },
      )
    }
  }

  private unitIsLive(instanceId: BuffInstanceId): boolean {
    const instance = this.store.get(instanceId)
    return instance !== undefined && this.entities.isAlive(instance.targetId)
  }

  private computeUnitRequest(
    instance: BuffInstance,
    periodicId: string,
  ): { request: BuffPeriodicDamageRequest | BuffPeriodicHealRequest; marks: readonly PendingUseMark[] } | undefined {
    const def = this.registry.get(instance.definitionId)
    const periodic: BuffPeriodicDefinition | undefined = (def.periodic ?? []).find(
      (p) => p.id === periodicId,
    )
    if (periodic === undefined) return undefined
    instance.periodicTickCount ??= {}
    const ordinal = (instance.periodicTickCount[periodicId] ?? 0) + 1
    instance.periodicTickCount[periodicId] = ordinal
    const computation = computePeriodicRequest(instance, periodic, ordinal)
    for (const mark of computation.marks) {
      const entry = instance.modifiers.find(
        (m) => m.modifierRuntimeId === mark.modifierRuntimeId,
      )
      if (entry !== undefined) entry.pendingRequestId = computation.request.requestId
    }
    return computation
  }

  private mintModifierRuntimeId(instanceId: BuffInstanceId): string {
    const ordinal = (this.modifierOrdinals.get(instanceId) ?? 0) + 1
    this.modifierOrdinals.set(instanceId, ordinal)
    return `bmr.${instanceId}.${ordinal}`
  }

  /** Drop pending marks naming an evicted/removed entry -- a dead
      generation can never be consumed (the mark dies with the entry). */
  private releaseMarksFor(entry: BuffModifier): void {
    if (entry.pendingRequestId === undefined) return
    const marks = this.pendingUses.get(entry.pendingRequestId)
    if (marks !== undefined) {
      this.pendingUses.set(
        entry.pendingRequestId,
        marks.filter((m) => m.modifierRuntimeId !== entry.modifierRuntimeId),
      )
    }
    entry.pendingRequestId = undefined
  }

  private removeInstance(
    instance: BuffInstance,
    reason: BuffRemovalReason,
    sink: CombatEventSink,
    rootActionId: string,
  ): void {
    const removed = this.store.remove(instance.instanceId)
    if (removed === undefined) return
    // Pending bookkeeping dies with the instance.
    for (const entry of removed.modifiers) this.releaseMarksFor(entry)
    for (const [requestId, marks] of this.pendingUses) {
      const surviving = marks.filter((m) => m.instanceId !== removed.instanceId)
      if (surviving.length === 0) this.pendingUses.delete(requestId)
      else if (surviving.length !== marks.length) this.pendingUses.set(requestId, surviving)
    }
    this.modifierOrdinals.delete(removed.instanceId)
    sink.emit({
      type: 'buff_removed',
      rootActionId,
      instanceId: removed.instanceId,
      definitionId: removed.definitionId,
      sourceId: removed.sourceId,
      targetId: removed.targetId,
      reason,
      stacksAtRemoval: removed.stacks,
    })
  }

  private sortedForTarget(targetId: CombatEntityId): readonly BuffInstance[] {
    return [...this.store.forTarget(targetId)].sort((a, b) =>
      a.targetId.localeCompare(b.targetId) ||
      a.definitionId.localeCompare(b.definitionId) ||
      a.sourceId.localeCompare(b.sourceId) ||
      a.instanceId.localeCompare(b.instanceId),
    )
  }

  /** convertsToId continuation provenance (R-B7): a scripted-lane origin
      chained under the applying op's root transaction. */
  private continuationOrigin(
    instanceId: BuffInstanceId,
    sourceId: CombatEntityId,
    ctx: CombatAuthorityExecutionContext,
  ): CombatOperationOrigin {
    return {
      kind: 'scripted',
      originId: `buff_convert.${instanceId}`,
      sourceId,
      rootActionId: ctx.origin.rootActionId,
      parentOperationId: ctx.operationId,
    }
  }
}
