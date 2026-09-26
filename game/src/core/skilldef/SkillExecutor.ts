// skilldef/SkillExecutor.ts -- R-S1/R-S9: drives ONE ResolvedSkillPlan
// through the scheduler. For each {kind:'operation'} step:
//   enqueueAuthored([op]) -> run() (full settle -- contract sec.55
//   barrier) -> evaluate the NEXT step's read/branch against
//   post-settlement state via the readonly query ports.
//
// Ownership boundaries:
// - the executor NEVER rolls hit/crit/armor -- contract-v1.6 policies
//   are DECLARED intent on the payload; DamageAuthority consumes
//   CombatRng at dispatch. Executor-side rolls stay limited to
//   multicast continuation (and the resolver's composite picks).
// - reads never route through CombatAuthorityPorts -- SkillQueryPorts
//   are narrow readonly surfaces (R-S3).
// - cooldown/charge commit rides SkillCastCommitPort -- the ONE command
//   surface (executor requests, the SkillCombatRuntimeState owner
//   writes); resource cost rides the canonical ConsumeResourceOperation.

import type { CombatOperationId } from '../battle/contracts/ids'
import type {
  CombatOperationResult,
  CombatOperationResultStatus,
} from '../battle/contracts/results'
import type {
  CombatOperation,
  ResolvedCombatOperation,
} from '../battle/contracts/operations'
import type { CombatRng } from '../battle/contracts/rng'
import type { CombatScheduler } from '../battle/runtime/scheduler/CombatScheduler'

import type { SkillCastCommitPort } from './SkillCastCommitPort'
import type { SkillExecutionHooks } from './SkillExecutionHooks'
import type { SkillQueryPorts } from './SkillQueryPorts'
import type {
  OpResultNumberField,
  ResolvedSkillPlan,
  ResolvedSkillPlanStep,
  ResolvedSkillReadContext,
} from './ResolvedSkillPlan'
import {
  evaluateResolvedCondition,
  evaluateResolvedScalar,
} from './ResolvedSkillPlan'
import type { SkillResolveInput } from './SkillResolver'
import { SkillResolver, SkillResolverError } from './SkillResolver'
import type { ActiveSkillDefinition } from './SkillDefinition'
import type { SkillDefinitionRegistry } from './SkillDefinitionRegistry'

/** TurnSkillAction.MAX_MULTICAST parity -- multicast chain depth cap. */
export const SKILL_MAX_MULTICAST = 3

// ---------------------------------------------------------------------------
// SkillCastOutcome
// ---------------------------------------------------------------------------

export interface SkillCastOutcome {
  /** R-S2 connection semantic (plan.landed): 'always' -> true;
      'any_damage_landed' -> a damage op connected; 'default' -> self
      scope lands, else any committed op connected. */
  landed: boolean
  /** every op whiffed/skipped -- the mirror of landed for
      non-'always' semantics. */
  whiffed: boolean
  /** interrupt lane (charge-cancel etc.) -- M4 wiring; the executor
      itself never produces it. */
  interrupted: boolean
  /** PRECHECK failed (insufficient cost) -- no commit, no ops. */
  blocked: boolean
  /** cast-scope flags surfacing through the read context. */
  critLanded: boolean
  anyTargetLanded: boolean
  /** a damage op connected (damage.landed !== false) -- composite
      extras fold this into the parent cast's grant gate so a landed
      extra counts like a landed primary hit (legacy targetIds parity). */
  anyDamageLanded: boolean
}

// ---------------------------------------------------------------------------
// Per-plan execution state
// ---------------------------------------------------------------------------

interface PlanExecutionState {
  vars: Map<string, number>
  /** any committed op connected (resolved; damage ops require
      damage.landed !== false). */
  anyLanded: boolean
  anyDamageLanded: boolean
  /** the plan minted at least one hit-channel (skill_hit) op -- the
      grant gate reads it to distinguish "damaging cast that whiffed"
      (targetIds stayed empty -- no grant) from "non-damaging cast
      that applied" (targetIds filled unconditionally -- grant). */
  hasHitOps: boolean
  critLanded: boolean
  opSeq: number
}

/** Resolve context for follow-up plans -- the shared subcast counter
    keeps op-ids unique and subcastIndex>0 gating commits across the
    whole cast's extras/repeats/multicast chain. */
interface FollowUpContext {
  input: SkillResolveInput
  nextSubcast: { value: number }
}

export class SkillExecutorError extends Error {}

// ---------------------------------------------------------------------------
// The executor.
// ---------------------------------------------------------------------------

export class SkillExecutor {
  constructor(
    private readonly scheduler: CombatScheduler,
    private readonly resolver: SkillResolver,
    private readonly skills: SkillDefinitionRegistry,
    private readonly queries: SkillQueryPorts,
    private readonly commitPort: SkillCastCommitPort,
    private readonly rng: CombatRng,
    private readonly hooks?: SkillExecutionHooks,
  ) {}

  /** Executes the plan; when `input` is supplied the executor also drives
      the cast's follow-up executions -- composite extra picks inline,
      then repeats + the multicast chain as sequential non-committing
      plans (Task 11 parity). Only the committing root cast spawns
      follow-ups; follow-up plans go through executePlan() which never
      recurses here. `input.driveFollowUps === false` parks the
      repeat/multicast lane (TBS drives them through its own
      queuedExecutions); composite extras still expand -- they are
      lanes of the executing plan, not follow-ups. */
  execute(plan: ResolvedSkillPlan, input?: SkillResolveInput): SkillCastOutcome {
    const followUps: FollowUpContext | undefined =
      input === undefined
        ? undefined
        : { input, nextSubcast: { value: plan.subcastIndex + 1 } }
    const outcome = this.executePlan(plan, followUps)
    if (
      followUps !== undefined &&
      input !== undefined &&
      input.driveFollowUps !== false &&
      // TBS parity (enqueueFollowUpExecutions): only a cast with a live
      // target set queues follow-ups -- a whiffed-into-empty cast
      // commits nothing; a charge-init declare queues nothing either.
      plan.snapshot.declaredTargetIds.length > 0 &&
      !(plan.subcastIndex === 0 && (plan.cadence.chargeTurns ?? 0) > 0) &&
      this.queries.vitals.alive(plan.sourceId)
    ) {
      this.driveFollowUps(plan, followUps)
    }
    return outcome
  }

  // -----------------------------------------------------------------------
  // Per-plan execution -- PRECHECK -> CAST_COMMIT -> steps -> detonate
  // -> composite extras (inline payload lanes of THIS execution --
  // they never drive their own follow-ups).
  // -----------------------------------------------------------------------

  private executePlan(
    plan: ResolvedSkillPlan,
    followUps: FollowUpContext | undefined,
    suppressGrants = false,
  ): SkillCastOutcome {
    const state: PlanExecutionState = {
      vars: new Map(),
      anyLanded: false,
      anyDamageLanded: false,
      hasHitOps: false,
      critLanded: false,
      opSeq: 0,
    }

    if (plan.commitsCast) {
      // PRECHECK (R-S9): insufficient cost blocks the cast -- no commit,
      // no ops, not a whiff.
      if (
        plan.cost !== undefined &&
        this.queries.resources.current(
          plan.sourceId,
          plan.cost.resourceType,
        ) < plan.cost.amount
      ) {
        return {
          landed: false,
          whiffed: false,
          interrupted: false,
          blocked: true,
          critLanded: false,
          anyTargetLanded: false,
          anyDamageLanded: false,
        }
      }
      // CAST_COMMIT (R-S9): cooldown/charge through the commit port,
      // cost as the FIRST scheduled op -- it settles before plan steps
      // (consume-then-execute; the snapshot already froze theBurned).
      this.commitPort.commit(plan)
      if (plan.cost !== undefined) {
        this.enqueueAndSettle(
          this.mintOp(plan, state, {
            type: 'consume_resource',
            payload: {
              targetId: plan.sourceId,
              resourceId: plan.cost.resourceType,
              amount: plan.cost.amount,
            },
          }),
          plan,
          state,
        )
      }
      // consumesAllThe (commitCast ordering parity: the pool burns to 0
      // AFTER the cost op; theBurned already froze pre-commit).
      if (plan.consumesAllThe === true) {
        this.enqueueAndSettle(
          this.mintOp(plan, state, {
            type: 'consume_resource',
            payload: {
              targetId: plan.sourceId,
              resourceId: 'the',
              amount: 'all',
            },
          }),
          plan,
          state,
        )
      }
    }

    // Composite extras resolve BEFORE the primary steps (TBS parity:
    // compositePickedSkills hit ahead of scaledDamage). They are
    // payload-only inline lanes -- verbatim defs, no commit, no grants,
    // never driving their own follow-ups; their landed/crit flags fold
    // into the root cast's outcome.
    if (followUps !== undefined && plan.compositeExtraIds !== undefined) {
      this.expandCompositeExtras(plan, followUps, state)
    }

    this.runSteps(plan.steps, plan, state)
    this.emitGrants(plan, state, suppressGrants)
    // Final flush point for the orchestration seam: a landed hit whose
    // authored gate never ran (or whose tail waits for plan end) gets
    // its consequence tail flushed here before the next plan begins.
    this.hooks?.onPlanCompleted?.(plan)
    return this.buildOutcome(plan, state)
  }

  // -----------------------------------------------------------------------
  // Step driving -- one barrier per operation step.
  // -----------------------------------------------------------------------

  private runSteps(
    steps: readonly ResolvedSkillPlanStep[],
    plan: ResolvedSkillPlan,
    state: PlanExecutionState,
  ): void {
    const ctx = this.readCtx(plan, state)
    for (const step of steps) {
      switch (step.kind) {
        case 'operation': {
          const operation = this.applyLateBindings(step, ctx)
          this.enqueueAndSettle(operation, plan, state)
          break
        }
        case 'read': {
          state.vars.set(step.into, this.evaluateRead(step.query, ctx))
          break
        }
        case 'branch': {
          const taken = evaluateResolvedCondition(step.condition, ctx)
          if (step.gate !== undefined && taken) {
            // Compiled target_hit_landed gate -- bracket the gated
            // consequence ops with the orchestration slots (TBS
            // resolveDeclaredHit: procs/reactive fire pre-ailment,
            // taken windows/refresh/sweep post-detonate).
            this.hooks?.onLandedGateEntered?.(step.gate, plan)
            this.runSteps(step.then, plan, state)
            this.hooks?.onLandedGateExited?.(step.gate, plan)
          } else {
            this.runSteps(taken ? step.then : (step.else ?? []), plan, state)
          }
          break
        }
        case 'for_each_instance': {
          this.runForEachInstance(step, plan, state)
          break
        }
        case 'on_apply_result': {
          this.runOnApplyResult(step, plan, state)
          break
        }
        case 'detonate': {
          this.expandDetonate(step, plan, state)
          break
        }
      }
    }
  }

  private evaluateRead(
    query: Extract<ResolvedSkillPlanStep, { kind: 'read' }>['query'],
    ctx: ResolvedSkillReadContext,
  ): number {
    switch (query.query) {
      case 'buff_stacks':
        return ctx.buffStacks(query.definitionId, query.targetId, query.sourceId)
      case 'resource_current':
        return ctx.resourceCurrent(query.targetId, query.resourceId)
      case 'hp_percent':
        return ctx.hpPercent(query.targetId)
      case 'op_result':
        return ctx.opResult(query.operationId, query.field)
      case 'ops_landed_any':
        return ctx.opsLandedAny(query.operationIds)
      case 'ops_result_sum':
        return ctx.opsResultSum(query.operationIds, query.field)
    }
  }

  /** EXECUTE-time expansion: enumerate matching instances in canonical
      sortedForTarget order and clone the template per instance --
      each clone settles before the next mints (post-settlement state
      visible to the next iteration). */
  private runForEachInstance(
    step: Extract<ResolvedSkillPlanStep, { kind: 'for_each_instance' }>,
    plan: ResolvedSkillPlan,
    state: PlanExecutionState,
  ): void {
    const filter = step.filter
    const matches = this.queries.buffs
      .listInstances(filter.targetId)
      .filter(
        (inst) =>
          (filter.definitionId === undefined ||
            inst.definitionId === filter.definitionId) &&
          (filter.sourceId === undefined || inst.sourceId === filter.sourceId) &&
          (filter.kind === undefined || inst.kind === filter.kind) &&
          (filter.periodicOnly !== true || inst.hasPeriodic),
      )
    let index = 0
    for (const inst of matches) {
      const cloned = this.cloneForInstance(step.operation, inst, index)
      this.enqueueAndSettle(cloned, plan, state)
      index += 1
    }
  }

  /** Hoa An spec sec.11/36 -- a gated continuation runs ONLY when its
      bound apply_buff resolved applied:true, with the selector rebound
      to the returned instanceId (an identity re-query could land on a
      stale same-identity instance after a resisted reapply). A
      resisted/skipped apply enqueues nothing -- the same observability
      class as an untaken branch arm. */
  private runOnApplyResult(
    step: Extract<ResolvedSkillPlanStep, { kind: 'on_apply_result' }>,
    plan: ResolvedSkillPlan,
    state: PlanExecutionState,
  ): void {
    const prior = this.queries.opResults.lastOpResult(step.resultOperationId)
    const instanceId =
      prior?.status === 'resolved' &&
      prior.type === 'apply_buff' &&
      prior.result?.applied === true
        ? prior.result.instanceId
        : undefined
    if (instanceId === undefined) return
    const ctx = this.readCtx(plan, state)
    const operation = this.applyLateBindings(
      {
        kind: 'operation',
        operation: step.operation,
        ...(step.late !== undefined ? { late: step.late } : {}),
      },
      ctx,
    )
    const materialized = {
      ...operation,
      payload: {
        ...(operation.payload as Record<string, unknown>),
        selector: { kind: 'instance', instanceId },
      },
    } as ResolvedCombatOperation
    this.enqueueAndSettle(materialized, plan, state)
  }

  private cloneForInstance(
    template: ResolvedCombatOperation,
    inst: { instanceId: string; definitionId: string },
    index: number,
  ): ResolvedCombatOperation {
    const payload = { ...template.payload } as Record<string, unknown>
    if ('selector' in payload) {
      payload.selector = { kind: 'instance', instanceId: inst.instanceId }
    }
    // re-seed lane: an apply_buff template binds the iterated
    // instance's own definition (detonate re-seeds each ailment).
    if (template.type === 'apply_buff') {
      payload.definitionId = inst.definitionId
    }
    return {
      ...template,
      payload,
      operationId:
        `${template.operationId}.i${index}` as CombatOperationId,
    } as ResolvedCombatOperation
  }

  /** Late bindings patch named payload fields just before enqueue --
      the ONLY unresolved numbers a resolved plan may carry. */
  private applyLateBindings(
    step: Extract<ResolvedSkillPlanStep, { kind: 'operation' }>,
    ctx: ResolvedSkillReadContext,
  ): ResolvedCombatOperation {
    if (step.late === undefined || step.late.length === 0) {
      return step.operation
    }
    const payload = { ...step.operation.payload } as Record<string, unknown>
    for (const binding of step.late) {
      payload[binding.field] = evaluateResolvedScalar(binding.expr, ctx)
    }
    return { ...step.operation, payload } as ResolvedCombatOperation
  }

  private mintOp(
    plan: ResolvedSkillPlan,
    state: PlanExecutionState,
    op: CombatOperation,
  ): ResolvedCombatOperation {
    const id =
      `op.${plan.castId}.${plan.subcastIndex}.x${state.opSeq}` as CombatOperationId
    state.opSeq += 1
    return {
      ...op,
      operationId: id,
      origin: {
        kind: 'skill',
        originId: plan.definitionId,
        sourceId: plan.sourceId,
        rootActionId: plan.rootActionId,
        castId: plan.castId,
        subcastIndex: plan.subcastIndex,
      },
    } as ResolvedCombatOperation
  }

  /** THE barrier: enqueue -> run() drains to quiescence -> collect the
      committed result into the cast-scope flags. Dead/invalid targets
      come back as skipped results (contract sec.49) -- the plan
      continues; nothing rolls back. */
  private enqueueAndSettle(
    operation: ResolvedCombatOperation,
    plan: ResolvedSkillPlan,
    state: PlanExecutionState,
  ): CombatOperationResult {
    this.hooks?.onOperationWillSettle?.(operation)
    this.scheduler.enqueueAuthored([operation])
    this.scheduler.run()
    if (
      operation.type === 'deal_damage' &&
      (operation.payload as { damageProfile?: string }).damageProfile ===
        'skill_hit'
    ) {
      state.hasHitOps = true
    }
    const result = this.queries.opResults.lastOpResult(operation.operationId)
    if (result === undefined) {
      throw new SkillExecutorError(
        `SkillExecutor: op '${operation.operationId}' produced no result -- op result port out of sync with the scheduler trace`,
      )
    }
    this.collectOutcome(result, state)
    this.hooks?.onOperationSettled?.(operation, result, plan)
    return result
  }

  private collectOutcome(
    result: CombatOperationResult,
    state: PlanExecutionState,
  ): void {
    if (!this.opLanded(result)) return
    state.anyLanded = true
    if (result.type === 'deal_damage') {
      state.anyDamageLanded = true
      if (result.damage?.crit === true) state.critLanded = true
    }
  }

  private opLanded(result: CombatOperationResult): boolean {
    if (result.status !== 'resolved') return false
    if (result.type === 'deal_damage') {
      // flat/dot/reaction channels never dodge -- absent = connected.
      return result.damage?.landed !== false
    }
    return true
  }

  // -----------------------------------------------------------------------
  // Detonate -- TBS applyDetonate parity. Every op mints from the
  // PRE-SETTLE read snapshot (the burst coefficients read live instance
  // stacks/remaining/channels), then the whole lane settles as ONE
  // batch: consume each periodic-carrying instance -> per damage-
  // periodic burst -> one re-seed per consumed DEFINITION (1 stack,
  // authored duration, suppressed eligibility -- the committed re-seed
  // fails the sec.23 eligibility gate so no reaction evaluation
  // occurs). Utility ailments (no damage periodics) are untouched;
  // re-seeded instances are never revisited (new instance ids mint at
  // settle, after the read snapshot was taken).
  // -----------------------------------------------------------------------

  private expandDetonate(
    step: Extract<ResolvedSkillPlanStep, { kind: 'detonate' }>,
    plan: ResolvedSkillPlan,
    state: PlanExecutionState,
  ): void {
    const ctx = this.readCtx(plan, state)
    const targetId = step.targetId
    if (!ctx.alive(targetId)) return

    const ops: ResolvedCombatOperation[] = []
    const consumedIds = new Set<string>()

    for (const inst of this.queries.buffs.listInstances(targetId)) {
      if (inst.damagePeriodics.length === 0) continue

      // Consume the exact instance; same-id duplicates still consume --
      // only the re-seed below dedupes by definition id.
      ops.push(
        this.mintOp(plan, state, {
          type: 'consume_buff_stacks',
          payload: {
            selector: { kind: 'instance', instanceId: inst.instanceId },
            stacks: 'all',
            removalReason: 'consumed',
          },
        }),
      )
      consumedIds.add(inst.definitionId)

      // Legacy burst: (resolved per-tick) x remainingTurns x stacks x
      // amp, summed across the def's damage periodics. Each periodic
      // keeps its own element (the profile resolves the matching
      // power/resistance channel); coefficient = authored ratio x
      // potency/periodic_damage channels x remaining x stacks x amp.
      for (const periodic of inst.damagePeriodics) {
        const burst =
          periodic.coefficient *
          inst.periodicDamageMult *
          inst.potencyMult *
          inst.remainingTurns *
          inst.stacks *
          step.amp
        if (burst <= 0) continue
        ops.push(
          this.mintOp(plan, state, {
            type: 'deal_damage',
            payload: {
              targetId,
              element: periodic.element,
              damageProfile: 'detonate_burst',
              coefficient: burst,
              hitCount: 1,
              canCrit: false,
              canMiss: false,
              tags: periodic.tags,
              // Legacy parity: the consumed per-tick resolved vs the
              // INSTANCE's source (a third party may have seeded the
              // DoT); origin.sourceId stays the caster for attribution.
              statSourceId: inst.sourceId,
            },
          }),
        )
      }
    }

    // Re-seed ONCE per consumed definition id -- a fixed 1 stack at the
    // ailment's authored duration; baseChance 1 = the legacy
    // unconditional re-seed (no chance roll existed on this path).
    for (const definitionId of consumedIds) {
      ops.push(
        this.mintOp(plan, state, {
          type: 'apply_buff',
          payload: {
            definitionId,
            targetId,
            stacks: 1,
            baseChance: 1,
            reactionEligibility: 'suppressed',
          },
        }),
      )
    }

    this.enqueueBatchAndSettle(ops, plan, state)
  }

  /** Batch variant of the barrier: one enqueue + one run() so every op
      mints against the same pre-settle snapshot (detonate parity --
      burst coefficients read instance state that the consumes then
      remove). Results still collect per op. */
  private enqueueBatchAndSettle(
    operations: readonly ResolvedCombatOperation[],
    plan: ResolvedSkillPlan,
    state: PlanExecutionState,
  ): void {
    if (operations.length === 0) return
    for (const operation of operations) {
      this.hooks?.onOperationWillSettle?.(operation)
    }
    this.scheduler.enqueueAuthored(operations)
    this.scheduler.run()
    for (const operation of operations) {
      const result = this.queries.opResults.lastOpResult(operation.operationId)
      if (result === undefined) {
        throw new SkillExecutorError(
          `SkillExecutor: op '${operation.operationId}' produced no result -- op result port out of sync with the scheduler trace`,
        )
      }
      this.collectOutcome(result, state)
      this.hooks?.onOperationSettled?.(operation, result, plan)
    }
  }

  // -----------------------------------------------------------------------
  // Composite extras + follow-up driving (Task 11 parity).
  //
  // Composite extra picks are INLINE payload lanes of the cast that
  // picked them (TBS resolveDeclaredHit extras lane) -- each resolves as
  // its own non-committing plan, and they never drive repeats/multicast
  // themselves. Repeats fire exactly rootSkill.repeatCasts times and
  // never recurse; multicast rolls once per eligible execution and the
  // chain continues at depth+1 bounded by MAX_MULTICAST -- repeat-sourced
  // executions never roll (they never reach this function), empowered
  // resolutions never roll (execution.source !== 'empowered' parity).
  // -----------------------------------------------------------------------

  private expandCompositeExtras(
    plan: ResolvedSkillPlan,
    followUps: FollowUpContext,
    state: PlanExecutionState,
  ): void {
    for (const extraId of plan.compositeExtraIds ?? []) {
      if (!this.queries.vitals.alive(plan.sourceId)) return
      const extraDef = this.skills.require(extraId)
      if (extraDef.kind !== 'active') {
        throw new SkillExecutorError(
          `SkillExecutor: composite extra '${extraId}' of '${plan.definitionId}' is not active`,
        )
      }
      const extraPlan = this.resolver.resolve({
        ...followUps.input,
        definition: extraDef,
        subcastIndex: followUps.nextSubcast.value++,
        // TBS parity: extras resolve VERBATIM -- the picked def never
        // re-rolls its own pool/empowerment, the root's declare-side
        // replay never applies, and an inline lane never re-commits
        // (cooldown/cost/sink belong to the root cast alone).
        preResolved: undefined,
        commitsCast: false,
        payloadOnly: true,
      })
      const extraOutcome = this.executePlan(extraPlan, followUps, true)
      // castCritLanded/targetIds parity: the cast's grant gate and
      // crit flag accumulate across extras + the primary lane.
      if (extraOutcome.anyTargetLanded || extraOutcome.landed) {
        state.anyLanded = true
      }
      if (extraOutcome.anyDamageLanded) {
        state.anyDamageLanded = true
      }
      if (extraOutcome.critLanded) {
        state.critLanded = true
      }
    }
  }

  /** theGainOnLandedCast parity -- The grants emit once
      per cast execution (root plans AND follow-up executions; composite
      extras suppress them -- they are lanes of the parent cast, not
      executions). Post-consume ordering rides the CAST_COMMIT consume
      op settling first; the cap lives in the resource authority.
      Phap Tu Reimagined: the crit channel (theGainOnCrit) is retired --
      The income is landed-basic only. */
  private emitGrants(
    plan: ResolvedSkillPlan,
    state: PlanExecutionState,
    suppress: boolean,
  ): void {
    if (suppress || plan.grants === undefined || plan.subcastIndex > 0) return
    // TBS grantTheFromCast parity -- targetIds.length > 0: a LANDED hit
    // for damaging casts (whiffed casts grant nothing even when side
    // ops connected); an alive-targeted application for non-damaging
    // casts (targetIds fill unconditionally on the legacy lane).
    const connected = state.hasHitOps ? state.anyDamageLanded : state.anyLanded
    const landed =
      (plan.landed ?? 'default') === 'always' ||
      plan.targetIntent === 'self' ||
      connected
    if (landed && plan.grants.theOnLandedCast !== undefined) {
      this.enqueueAndSettle(
        this.mintOp(plan, state, {
          type: 'gain_resource',
          payload: {
            targetId: plan.sourceId,
            resourceId: 'the',
            amount: plan.grants.theOnLandedCast,
          },
        }),
        plan,
        state,
      )
    }
  }

  private driveFollowUps(
    plan: ResolvedSkillPlan,
    followUps: FollowUpContext,
  ): void {
    // Repeats -- exactly count executions of the ROOT def (each
    // re-resolves the composite pool; empowerment never re-fires on
    // follow-ups -- subcastIndex!==0, TBS declareQueuedExecution
    // parity).
    const repeatCount = plan.subcasts?.count ?? 0
    for (let i = 0; i < repeatCount; i++) {
      if (!this.queries.vitals.alive(plan.sourceId)) return
      this.executePlan(this.resolveFollowUp(plan, followUps), followUps)
    }

    // Multicast chain -- one roll per spawned execution; the empowered
    // root never rolls (source 'empowered' exclusion parity).
    const multicast = plan.subcasts?.multicast
    if (multicast === undefined || plan.resolvedVariantId !== undefined) return
    const cap = Math.min(multicast.maxExtraCasts, SKILL_MAX_MULTICAST)
    let depth = 0
    while (depth < cap && this.rng.rollChance(multicast.chance)) {
      if (!this.queries.vitals.alive(plan.sourceId)) return
      this.executePlan(this.resolveFollowUp(plan, followUps), followUps)
      depth += 1
    }
  }

  /** Follow-up payload def = the plan's own definitionId -- the authored
      root for root plans (empowerment re-checks naturally: post-consume
      The won't refire) and composite pools re-roll per subcast (Task 11
      parity). */
  private resolveFollowUp(
    plan: ResolvedSkillPlan,
    followUps: FollowUpContext,
  ): ResolvedSkillPlan {
    const def = this.skills.require(plan.definitionId)
    if (def.kind !== 'active') {
      throw new SkillExecutorError(
        `SkillExecutor: follow-up def '${plan.definitionId}' is not active`,
      )
    }
    return this.resolver.resolve({
      ...followUps.input,
      definition: def,
      subcastIndex: followUps.nextSubcast.value++,
      // Follow-up plans re-resolve: the root cast's declare-side replay
      // never applies (declareQueuedExecution re-picks per execution),
      // and a follow-up never commits regardless of the root's flag.
      preResolved: undefined,
      commitsCast: false,
    })
  }

  // -----------------------------------------------------------------------
  // Outcome + read context.
  // -----------------------------------------------------------------------

  private buildOutcome(
    plan: ResolvedSkillPlan,
    state: PlanExecutionState,
  ): SkillCastOutcome {
    const semantics = plan.landed ?? 'default'
    const landed =
      semantics === 'always'
        ? true
        : semantics === 'any_damage_landed'
          ? state.anyDamageLanded
          : plan.targetIntent === 'self'
            ? true
            : state.anyLanded
    return {
      landed,
      whiffed: !landed,
      interrupted: false,
      blocked: false,
      critLanded: state.critLanded,
      anyTargetLanded: state.anyLanded,
      anyDamageLanded: state.anyDamageLanded,
    }
  }

  /** The EXECUTE-time read surface -- post-settlement state via the
      readonly query ports; snapshot reads serve the frozen
      CastSnapshot. */
  private readCtx(
    plan: ResolvedSkillPlan,
    state: PlanExecutionState,
  ): ResolvedSkillReadContext {
    const { queries } = this
    const resultField = (
      opId: CombatOperationId,
      field: OpResultNumberField,
    ): number => {
      const result = queries.opResults.lastOpResult(opId)
      return result === undefined ? 0 : this.resultField(result, field)
    }
    return {
      buffStacks: (definitionId, targetId, sourceId) =>
        targetId === undefined
          ? 0
          : queries.buffs.stacksOf(definitionId, sourceId, targetId),
      buffDuration: (definitionId, targetId) =>
        targetId === undefined ? 0 : queries.buffs.durationOf(definitionId, targetId),
      hpPercent: (targetId) =>
        targetId === undefined ? 0 : queries.vitals.hpPercent(targetId),
      hpMax: (targetId) =>
        targetId === undefined ? 0 : queries.vitals.hpMax(targetId),
      resourceCurrent: (targetId, resourceId) =>
        targetId === undefined
          ? 0
          : queries.resources.current(targetId, resourceId),
      resourceMax: (targetId, resourceId) =>
        targetId === undefined
          ? 0
          : queries.resources.max(targetId, resourceId),
      resourceSnapshot: (resourceId) =>
        plan.snapshot.resourcesConsumed[resourceId] ?? 0,
      statScalar: (key) => plan.snapshot.statScalars[key] ?? 0,
      skillLevel: () => plan.snapshot.statScalars.skill_level ?? 1,
      readVar: (name) => state.vars.get(name) ?? 0,
      alive: (targetId) =>
        targetId === undefined ? false : queries.vitals.alive(targetId),
      critLanded: () => state.critLanded,
      anyTargetLanded: () => state.anyLanded,
      opResult: resultField,
      opsLandedAny: (operationIds) =>
        operationIds.some((id) => {
          const result = queries.opResults.lastOpResult(id)
          return result !== undefined && this.opLanded(result)
        })
          ? 1
          : 0,
      opsResultSum: (operationIds, field) =>
        operationIds.reduce<number>(
          (sum, id) => sum + resultField(id, field),
          0,
        ),
    }
  }

  private resultField(
    result: CombatOperationResult,
    field: OpResultNumberField,
  ): number {
    if (result.status !== ('resolved' satisfies CombatOperationResultStatus)) {
      return 0
    }
    switch (field) {
      case 'rawDamage':
        return result.type === 'deal_damage' ? result.damage?.rawDamage ?? 0 : 0
      case 'hpDamage':
        return result.type === 'deal_damage' ? result.damage?.hpDamage ?? 0 : 0
      case 'killed':
        return result.type === 'deal_damage' && result.damage?.killed === true
          ? 1
          : 0
      case 'landed':
        return this.opLanded(result) ? 1 : 0
      case 'healed':
        return result.type === 'heal' ? result.result?.healed ?? 0 : 0
      case 'applied':
        if (result.type === 'apply_buff') {
          return result.result?.applied === true ? 1 : 0
        }
        if (result.type === 'gain_resource' || result.type === 'consume_resource') {
          return result.result?.applied ?? 0
        }
        if (result.type === 'apply_shield') {
          return result.result?.applied ?? 0
        }
        return 0
      case 'consumed':
        return result.type === 'consume_buff_stacks'
          ? result.result?.consumed ?? 0
          : 0
      case 'cleansed':
        return result.type === 'cleanse_buff'
          ? result.result?.cleansed.length ?? 0
          : 0
    }
  }
}

// Re-exported for callers wiring cast requests (resolver stays the
// plan producer; the executor drives it).
export { SkillResolverError }
export type { ActiveSkillDefinition }
