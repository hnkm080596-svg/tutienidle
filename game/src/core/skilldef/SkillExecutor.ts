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

import type {
  CombatEntityId,
  CombatOperationId,
} from '../battle/contracts/ids'
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
import type { SkillQueryPorts } from './SkillQueryPorts'
import type {
  OpResultNumberField,
  ResolvedScalarExpression,
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
  ) {}

  /** Executes the plan; when `input` is supplied the executor also drives
      the cast's follow-up executions -- composite extra picks inline,
      then repeats + the multicast chain as sequential non-committing
      plans (Task 11 parity). Only the committing root cast spawns
      follow-ups; follow-up plans go through executePlan() which never
      recurses here. */
  execute(plan: ResolvedSkillPlan, input?: SkillResolveInput): SkillCastOutcome {
    const followUps: FollowUpContext | undefined =
      input === undefined
        ? undefined
        : { input, nextSubcast: { value: plan.subcastIndex + 1 } }
    const outcome = this.executePlan(plan, followUps)
    if (
      followUps !== undefined &&
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
  ): SkillCastOutcome {
    const state: PlanExecutionState = {
      vars: new Map(),
      anyLanded: false,
      anyDamageLanded: false,
      critLanded: false,
      opSeq: 0,
    }

    if (plan.subcastIndex === 0) {
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
    }

    this.runSteps(plan.steps, plan, state)
    if (plan.detonate !== undefined) this.expandDetonate(plan, state)
    if (followUps !== undefined) this.expandCompositeExtras(plan, followUps)
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
          this.runSteps(taken ? step.then : (step.else ?? []), plan, state)
          break
        }
        case 'for_each_instance': {
          this.runForEachInstance(step, plan, state)
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
    this.scheduler.enqueueAuthored([operation])
    this.scheduler.run()
    const result = this.queries.opResults.lastOpResult(operation.operationId)
    if (result === undefined) {
      throw new SkillExecutorError(
        `SkillExecutor: op '${operation.operationId}' produced no result -- op result port out of sync with the scheduler trace`,
      )
    }
    this.collectOutcome(result, state)
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
  // Detonate -- executor-expanded sugar (Task 13): consume every
  // dot/periodic ailment instance -> deal_damage scaled by consumed
  // stacks -> re-seed each at stacks:1 with suppressed eligibility
  // (utility ailments untouched; the committed re-seed fails the
  // sec.23 eligibility gate so no reaction evaluation occurs).
  // -----------------------------------------------------------------------

  private expandDetonate(plan: ResolvedSkillPlan, state: PlanExecutionState): void {
    const amp = plan.detonate!.amp
    const ctx = this.readCtx(plan, state)
    for (const targetId of plan.snapshot.declaredTargetIds) {
      if (!ctx.alive(targetId)) continue
      const dots = this.queries.buffs
        .listInstances(targetId)
        .filter((inst) => inst.kind === 'ailment' && inst.hasPeriodic)
      if (dots.length === 0) continue
      let consumedTotal = 0
      const reseeds: { definitionId: string; instanceId: string }[] = []
      for (const inst of dots) {
        const result = this.enqueueAndSettle(
          this.mintOp(plan, state, {
            type: 'consume_buff_stacks',
            payload: {
              selector: { kind: 'instance', instanceId: inst.instanceId },
              stacks: 'all',
              removalReason: 'consumed',
            },
          }),
          plan,
          state,
        )
        if (result.type === 'consume_buff_stacks' && result.status === 'resolved') {
          const consumed = result.result?.consumed ?? 0
          if (consumed > 0) {
            consumedTotal += consumed
            reseeds.push({
              definitionId: inst.definitionId,
              instanceId: inst.instanceId,
            })
          }
        }
      }
      if (consumedTotal <= 0) continue
      this.enqueueAndSettle(
        this.mintOp(plan, state, {
          type: 'deal_damage',
          payload: {
            targetId,
            damageProfile: 'detonate_burst',
            coefficient: consumedTotal * amp,
            hitCount: 1,
            canCrit: false,
            canMiss: false,
          },
        }),
        plan,
        state,
      )
      for (const reseed of reseeds) {
        this.enqueueAndSettle(
          this.mintOp(plan, state, {
            type: 'apply_buff',
            payload: {
              definitionId: reseed.definitionId,
              targetId,
              stacks: 1,
              baseChance: 1,
              reactionEligibility: 'suppressed',
            },
          }),
          plan,
          state,
        )
      }
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
      })
      this.executePlan(extraPlan, followUps)
    }
  }

  private driveFollowUps(
    plan: ResolvedSkillPlan,
    followUps: FollowUpContext,
  ): void {
    // Repeats -- exactly count executions of the ROOT def (each
    // re-resolves: composite pool re-rolls, empowerment re-checks).
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
