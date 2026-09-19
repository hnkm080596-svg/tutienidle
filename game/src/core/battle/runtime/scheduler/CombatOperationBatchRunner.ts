// runtime/scheduler/CombatOperationBatchRunner.ts -- batch-frame support
// (contract sec.40-51).
//
// A CombatOperationBatch is an atomic, ordered, non-interleaved command
// list (reaction payoffs, consume+consequence chains). The SCHEDULER
// drives the frame (structural validation -> atomic id reservation ->
// runtime preflight -> per-op settle); this runner owns:
//   - validateBatchStructure -- r4 BLOCKER 3: a malformed command graph is
//     a STRUCTURAL fault independent of combat state, checked BEFORE any
//     mutation (a dead target can't hide a duplicate id).
//   - preflight -- sec.40-42 atomic stale-skip: ALL preconditions evaluated
//     before ANY op runs; any fail -> zero ops.
//   - materialize -- deferred ops are materialized at their position from
//     the typed BatchResultContext, never upfront (r2/r3/r4); the
//     producer-minted operationId is preserved (R-C2).

import type {
  BuffInstanceId,
  CombatEntityId,
  CombatOperationId,
} from '../../contracts/ids'
import type { ResolvedCombatOperation } from '../../contracts/operations'
import type { CombatOperationResult } from '../../contracts/results'
import {
  assertValidSelector,
  type BuffInstanceSelector,
} from '../../contracts/selectors'
import type {
  BatchResultContext,
  CombatOperationBatch,
  DeferredOperation,
} from '../../contracts/settlement'

import { CombatSettlementFault } from './CombatSettlementFault'

/** Narrow injected read-port (review r3: buff_participant + entity_alive
    only -- add more kinds when a real atomic batch needs them). */
export interface PreconditionChecker {
  isAlive(entityId: CombatEntityId): boolean
  getBuffInstance?(
    instanceId: BuffInstanceId,
  ): { sourceId: CombatEntityId; targetId: CombatEntityId; stacks: number } | undefined
  /** sec.49 selector probe -- resolves any BuffInstanceSelector kind
      (instance/identity/target_definition), unlike getBuffInstance which
      preflights 'instance'-keyed participants only. Absent = selector
      ops are unverifiable and the per-op gate skips nothing for them
      (fail-open on the probe, matching the optional getBuffInstance). */
  getBuffInstanceBySelector?(
    selector: BuffInstanceSelector,
  ): { targetId: CombatEntityId } | undefined
}

export function isDeferredOperation(
  entry: ResolvedCombatOperation | DeferredOperation,
): entry is DeferredOperation {
  return 'kind' in entry && entry.kind === 'heal_from_damage_result'
}

/** The CombatOperationResult `type` a batch entry would produce -- used
    for skip records on entries that never execute. */
export function resultTypeOfBatchEntry(
  entry: ResolvedCombatOperation | DeferredOperation,
): CombatOperationResult['type'] {
  return isDeferredOperation(entry) ? 'heal' : entry.type
}

/** Typed store backing BatchResultContext -- also retains the executed op
    so deferred materialization can resolve `healTarget` against the real
    operation (the context interface alone exposes only results). */
export class BatchResultStore implements BatchResultContext {
  private readonly entries = new Map<
    CombatOperationId,
    { op?: ResolvedCombatOperation; result: CombatOperationResult }
  >()

  record(op: ResolvedCombatOperation, result: CombatOperationResult): void {
    this.entries.set(op.operationId, { op, result })
  }

  /** Result-only entries (e.g. a deferred entry skipped before
      materialization) -- no ResolvedCombatOperation ever existed. */
  recordResult(result: CombatOperationResult): void {
    this.entries.set(result.operationId, { result })
  }

  get(operationId: CombatOperationId): CombatOperationResult | undefined {
    return this.entries.get(operationId)?.result
  }

  getOperation(
    operationId: CombatOperationId,
  ): ResolvedCombatOperation | undefined {
    return this.entries.get(operationId)?.op
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

export class CombatOperationBatchRunner {
  constructor(private readonly preconditions: PreconditionChecker) {}

  /** sec.40-42 -- ALL preconditions evaluated before ANY op runs.
      An unknown kind is a broken command graph (structural fault), never
      a fail-closed stale-skip; structural validation normally catches it
      first -- this is the standalone-call defense. */
  preflight(batch: CombatOperationBatch): boolean {
    if (
      typeof batch !== 'object' ||
      batch === null ||
      !Array.isArray(batch.preconditions)
    ) {
      throw new CombatSettlementFault(
        'batch preflight: preconditions must be an array',
      )
    }
    for (const p of batch.preconditions) {
      if (typeof p !== 'object' || p === null) {
        throw new CombatSettlementFault(
          'batch preflight: precondition must be a non-null object',
        )
      }
      if (p.kind === 'entity_alive') {
        if (!this.preconditions.isAlive(p.entityId)) return false
      } else if (p.kind === 'buff_participant') {
        // An unverifiable/missing instance is stale.
        const instance = this.preconditions.getBuffInstance?.(p.instanceId)
        if (instance === undefined) return false
        if (
          instance.sourceId !== p.expectedSourceId ||
          instance.targetId !== p.expectedTargetId ||
          instance.stacks !== p.expectedStacks
        ) {
          return false
        }
      } else {
        throw new CombatSettlementFault(
          `batch preflight: unknown precondition kind '${String((p as { kind?: unknown }).kind)}'`,
        )
      }
    }
    return true
  }

  /** contract sec.49 -- per-op validity gate: an op whose payload target
      is dead, or whose buff selector no longer resolves (or resolves to
      an instance on a dead holder), earns a typed 'invalid_target_state'
      result and the batch continues. Ops on instances consumed earlier
      in THIS batch legitimately skip -- consumption is the batch's own
      doing. Selector ops are unverifiable without the selector probe ->
      no skip (the probe is optional; a composition that wires it gets
      the full gate). Single authority: the production scheduler frame
      and the headless ReactionBatchRunner both consult this method. */
  opTargetSkipReason(
    op: ResolvedCombatOperation,
  ): 'invalid_target_state' | undefined {
    const payload = op.payload as Record<string, unknown>
    if ('targetId' in payload && typeof payload.targetId === 'string') {
      return this.preconditions.isAlive(payload.targetId as CombatEntityId)
        ? undefined
        : 'invalid_target_state'
    }
    if ('selector' in payload) {
      const probe = this.preconditions.getBuffInstanceBySelector
      if (probe === undefined) return undefined
      const instance = probe(payload.selector as BuffInstanceSelector)
      if (instance === undefined) return 'invalid_target_state'
      return this.preconditions.isAlive(instance.targetId)
        ? undefined
        : 'invalid_target_state'
    }
    return undefined
  }

  /** r4 BLOCKER 3 -- structural validation BEFORE any mutation:
      - every entry id is a non-empty string, unique in-batch
      - every deferred resultOperationId references an EARLIER entry whose
        resolved type is 'deal_damage'
      - payload shapes are well-formed
      Any violation -> CombatSettlementFault (broken command graph).
      Global uniqueness is the scheduler's reservation step -- this method
      checks in-batch structure only. */
  /** Single-op shape validation for handler-PRODUCED ops (Lens B8): the
      produced-group lane used to check ids only -- malformed payloads
      reached ports as raw TypeErrors instead of structural faults. */
  validateProducedOperation(op: unknown, context: string): void {
    if (typeof op !== 'object' || op === null) {
      throw new CombatSettlementFault(`${context}: produced entry must be a non-null object`)
    }
    this.assertResolvedOperationShape(op as ResolvedCombatOperation, context, -1)
  }

  validateBatchStructure(batch: CombatOperationBatch): void {
    if (typeof batch !== 'object' || batch === null) {
      throw new CombatSettlementFault('batch must be a non-null object')
    }
    if (!isNonEmptyString(batch.batchId)) {
      throw new CombatSettlementFault('batch requires a non-empty batchId')
    }
    const entries = batch.operations
    if (!Array.isArray(entries)) {
      throw new CombatSettlementFault(
        `batch '${batch.batchId}': operations must be an array`,
      )
    }
    if (!Array.isArray(batch.preconditions)) {
      throw new CombatSettlementFault(
        `batch '${batch.batchId}': preconditions must be an array`,
      )
    }
    for (const p of batch.preconditions) {
      this.assertPrecondition(p, batch.batchId)
    }

    const seen = new Set<CombatOperationId>()
    for (let i = 0; i < entries.length; i++) {
      const entry: unknown = entries[i]
      if (typeof entry !== 'object' || entry === null) {
        this.fail(batch.batchId, i, 'entry must be a non-null object')
      }
      const operationId = (entry as { operationId?: unknown }).operationId
      if (!isNonEmptyString(operationId)) {
        this.fail(batch.batchId, i, 'blank operationId')
      }
      // `periodic.*` ids are scheduler-minted bridge ops (Lens C6): a
      // producer forging one inside a batch would execute with no
      // PeriodicOperationSettled and no correlation -- a uses-mark
      // consumer would hang silently. Reject the namespace in batches.
      if (typeof operationId === 'string' && operationId.startsWith('periodic.')) {
        this.fail(
          batch.batchId,
          i,
          `operationId '${operationId}': 'periodic.*' namespace is scheduler-reserved`,
        )
      }
      if (seen.has(operationId)) {
        this.fail(batch.batchId, i, `duplicate operationId '${operationId}'`)
      }
      seen.add(operationId)
      if (isDeferredOperation(entry as ResolvedCombatOperation | DeferredOperation)) {
        this.validateDeferred(
          entry as DeferredOperation,
          entries as readonly (ResolvedCombatOperation | DeferredOperation)[],
          i,
          batch.batchId,
        )
      } else {
        this.assertResolvedOperationShape(
          entry as ResolvedCombatOperation,
          batch.batchId,
          i,
        )
      }
    }
  }

  /** Structural check on one precondition -- a malformed kind or missing
      field is a broken command graph, not a runtime staleness signal. */
  private assertPrecondition(p: unknown, batchId: string): void {
    if (typeof p !== 'object' || p === null) {
      throw new CombatSettlementFault(
        `batch '${batchId}': precondition must be a non-null object`,
      )
    }
    const kind = (p as { kind?: unknown }).kind
    if (kind === 'entity_alive') {
      if (!isNonEmptyString((p as { entityId?: unknown }).entityId)) {
        throw new CombatSettlementFault(
          `batch '${batchId}': entity_alive precondition requires entityId`,
        )
      }
      return
    }
    if (kind === 'buff_participant') {
      const bp = p as {
        instanceId?: unknown
        expectedSourceId?: unknown
        expectedTargetId?: unknown
        expectedStacks?: unknown
      }
      if (
        !isNonEmptyString(bp.instanceId) ||
        !isNonEmptyString(bp.expectedSourceId) ||
        !isNonEmptyString(bp.expectedTargetId) ||
        !isFiniteNumber(bp.expectedStacks)
      ) {
        throw new CombatSettlementFault(
          `batch '${batchId}': malformed buff_participant precondition`,
        )
      }
      return
    }
    throw new CombatSettlementFault(
      `batch '${batchId}': unknown precondition kind '${String(kind)}'`,
    )
  }

  private validateDeferred(
    entry: DeferredOperation,
    entries: readonly (ResolvedCombatOperation | DeferredOperation)[],
    index: number,
    batchId: string,
  ): void {
    if (entry.kind !== 'heal_from_damage_result') {
      this.fail(batchId, index, `unknown deferred kind`)
    }
    if (!isNonEmptyString(entry.resultOperationId)) {
      this.fail(batchId, index, `deferred '${entry.operationId}': blank resultOperationId`)
    }
    if (entry.healTarget !== 'source' && entry.healTarget !== 'target') {
      this.fail(batchId, index, `deferred '${entry.operationId}': bad healTarget`)
    }
    // Lens C5: fraction must be finite AND non-negative -- a negative
    // fraction materializes a negative heal, bypassing the literal-heal
    // `amount >= 0` validation.
    if (!isFiniteNumber(entry.fraction) || entry.fraction < 0) {
      this.fail(batchId, index, `deferred '${entry.operationId}': bad fraction`)
    }
    this.assertOrigin(entry.origin, batchId, index)
    // Scan defensively -- later entries have not been shape-checked yet
    // and could be non-objects (a raw TypeError is not a structural fault).
    const refIndex = entries.findIndex(
      (e) =>
        typeof e === 'object' &&
        e !== null &&
        (e as { operationId?: unknown }).operationId ===
          entry.resultOperationId,
    )
    if (refIndex === -1) {
      this.fail(
        batchId,
        index,
        `deferred '${entry.operationId}' references unknown resultOperationId '${entry.resultOperationId}'`,
      )
    }
    if (refIndex >= index) {
      this.fail(
        batchId,
        index,
        `deferred '${entry.operationId}' references a later entry '${entry.resultOperationId}'`,
      )
    }
    const ref = entries[refIndex]
    if (ref === undefined || isDeferredOperation(ref) || ref.type !== 'deal_damage') {
      this.fail(
        batchId,
        index,
        `deferred '${entry.operationId}' must reference an earlier deal_damage entry`,
      )
    }
  }

  private assertOrigin(
    origin: unknown,
    batchId: string,
    index: number,
  ): void {
    if (typeof origin !== 'object' || origin === null) {
      this.fail(batchId, index, 'missing origin')
    }
    const o = origin as {
      sourceId?: unknown
      rootActionId?: unknown
      originId?: unknown
    }
    if (
      !isNonEmptyString(o.sourceId) ||
      !isNonEmptyString(o.rootActionId) ||
      !isNonEmptyString(o.originId)
    ) {
      this.fail(batchId, index, 'malformed origin')
    }
  }

  private assertSelector(
    selector: unknown,
    batchId: string,
    index: number,
  ): asserts selector is BuffInstanceSelector {
    try {
      assertValidSelector(selector)
    } catch (error) {
      this.fail(
        batchId,
        index,
        `invalid selector: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private assertResolvedOperationShape(
    entry: ResolvedCombatOperation,
    batchId: string,
    index: number,
  ): void {
    if (!isNonEmptyString(entry.type)) {
      this.fail(batchId, index, `op '${entry.operationId}': missing type`)
    }
    const payload = entry.payload as unknown
    if (typeof payload !== 'object' || payload === null) {
      this.fail(batchId, index, `op '${entry.operationId}' (${entry.type}): missing payload`)
    }
    this.assertOrigin(entry.origin, batchId, index)

    const bad = (field: string): never =>
      this.fail(batchId, index, `op '${entry.operationId}' (${entry.type}): bad ${field}`)

    switch (entry.type) {
      case 'deal_damage': {
        const p = entry.payload
        if (!isNonEmptyString(p.targetId)) bad('targetId')
        if (!isNonEmptyString(p.damageProfile)) bad('damageProfile')
        if (!isFiniteNumber(p.coefficient)) bad('coefficient')
        if (!isFiniteNumber(p.hitCount)) bad('hitCount')
        if (typeof p.canCrit !== 'boolean') bad('canCrit')
        if (typeof p.canMiss !== 'boolean') bad('canMiss')
        return
      }
      case 'heal': {
        const p = entry.payload
        if (!isNonEmptyString(p.targetId)) bad('targetId')
        if (!isFiniteNumber(p.amount) || p.amount < 0) bad('amount')
        return
      }
      case 'apply_buff': {
        const p = entry.payload
        if (!isNonEmptyString(p.definitionId)) bad('definitionId')
        if (!isNonEmptyString(p.targetId)) bad('targetId')
        if (!isFiniteNumber(p.stacks)) bad('stacks')
        if (!isFiniteNumber(p.baseChance)) bad('baseChance')
        if (
          p.reactionEligibility !== 'eligible' &&
          p.reactionEligibility !== 'suppressed'
        ) {
          bad('reactionEligibility')
        }
        return
      }
      case 'add_buff_stacks':
      case 'remove_buff_stacks': {
        const p = entry.payload
        this.assertSelector(p.selector, batchId, index)
        if (!isFiniteNumber(p.stacks)) bad('stacks')
        return
      }
      case 'consume_buff_stacks': {
        const p = entry.payload
        this.assertSelector(p.selector, batchId, index)
        if (!(isFiniteNumber(p.stacks) || p.stacks === 'all')) bad('stacks')
        if (p.removalReason !== 'consumed' && p.removalReason !== 'reaction') {
          bad('removalReason')
        }
        return
      }
      case 'add_buff_modifier': {
        const p = entry.payload
        this.assertSelector(p.selector, batchId, index)
        const mod: unknown = p.modifier
        if (typeof mod !== 'object' || mod === null || !isNonEmptyString((mod as { id?: unknown }).id)) {
          bad('modifier')
        }
        return
      }
      case 'remove_buff_modifier': {
        const p = entry.payload
        this.assertSelector(p.selector, batchId, index)
        if (!isNonEmptyString(p.modifierId)) bad('modifierId')
        return
      }
      case 'refresh_buff_duration': {
        const p = entry.payload
        this.assertSelector(p.selector, batchId, index)
        if (p.duration !== undefined && !isFiniteNumber(p.duration)) {
          bad('duration')
        }
        return
      }
      case 'extend_buff_duration': {
        const p = entry.payload
        this.assertSelector(p.selector, batchId, index)
        if (!isFiniteNumber(p.turns)) bad('turns')
        return
      }
      case 'trigger_buff_periodic': {
        this.assertSelector(entry.payload.selector, batchId, index)
        return
      }
      case 'remove_buff': {
        const p = entry.payload
        this.assertSelector(p.selector, batchId, index)
        if (!isNonEmptyString(p.removalReason)) bad('removalReason')
        return
      }
      case 'set_buff_stacks': {
        const p = entry.payload
        this.assertSelector(p.selector, batchId, index)
        if (!isFiniteNumber(p.stacks)) bad('stacks')
        return
      }
      case 'set_buff_duration': {
        const p = entry.payload
        this.assertSelector(p.selector, batchId, index)
        if (!isFiniteNumber(p.duration)) bad('duration')
        return
      }
      case 'cleanse_buff': {
        const p = entry.payload
        if (!isNonEmptyString(p.targetId)) bad('targetId')
        if (typeof p.query !== 'object' || p.query === null) bad('query')
        return
      }
      case 'push_gauge': {
        const p = entry.payload
        if (!isNonEmptyString(p.targetId)) bad('targetId')
        if (!isFiniteNumber(p.fractionOfMax)) bad('fractionOfMax')
        return
      }
      case 'gain_resource': {
        const p = entry.payload
        if (!isNonEmptyString(p.targetId)) bad('targetId')
        if (!isNonEmptyString(p.resourceId)) bad('resourceId')
        if (!isFiniteNumber(p.amount)) bad('amount')
        return
      }
      case 'consume_resource': {
        const p = entry.payload
        if (!isNonEmptyString(p.targetId)) bad('targetId')
        if (!isNonEmptyString(p.resourceId)) bad('resourceId')
        if (!(isFiniteNumber(p.amount) || p.amount === 'all')) bad('amount')
        if (
          p.valueSource !== undefined &&
          p.valueSource !== 'current' &&
          p.valueSource !== 'cast_snapshot'
        ) {
          bad('valueSource')
        }
        return
      }
      case 'apply_shield': {
        const p = entry.payload
        if (!isNonEmptyString(p.targetId)) bad('targetId')
        if (!isFiniteNumber(p.amount) || p.amount < 0) bad('amount')
        return
      }
      default: {
        // `entry` narrows to never -- the discriminator itself is broken.
        const loose = entry as { operationId?: unknown; type?: unknown }
        this.fail(
          batchId,
          index,
          `op '${String(loose.operationId)}': unknown type '${String(loose.type)}'`,
        )
      }
    }
  }

  /** Materialize a deferred op at its position (R-C7). The referenced
      result must be a RESOLVED deal_damage record -- the scheduler
      pre-checks status and records dependency_not_resolved skips, so a
      non-resolved result reaching here is a structural fault. The
      producer-minted operationId is preserved (R-C2). */
  materialize(
    deferred: DeferredOperation,
    results: BatchResultContext,
  ): ResolvedCombatOperation {
    const prior = results.get(deferred.resultOperationId)
    const priorOp = results.getOperation(deferred.resultOperationId)
    if (
      prior === undefined ||
      prior.status !== 'resolved' ||
      prior.type !== 'deal_damage' ||
      prior.damage === undefined ||
      priorOp === undefined ||
      priorOp.type !== 'deal_damage'
    ) {
      throw new CombatSettlementFault(
        `deferred op '${deferred.operationId}' cannot materialize: '${deferred.resultOperationId}' is not a resolved deal_damage result`,
      )
    }
    const amount = prior.damage.hpDamage * deferred.fraction
    const targetId =
      deferred.healTarget === 'source'
        ? priorOp.origin.sourceId
        : priorOp.payload.targetId
    return {
      operationId: deferred.operationId,
      type: 'heal',
      origin: deferred.origin,
      payload: { targetId, amount },
    }
  }

  private fail(batchId: string, index: number, message: string): never {
    throw new CombatSettlementFault(`batch '${batchId}' entry ${index}: ${message}`)
  }
}
