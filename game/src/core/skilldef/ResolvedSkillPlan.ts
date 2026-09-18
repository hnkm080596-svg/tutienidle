// skilldef/ResolvedSkillPlan.ts -- R-S1: the plan is a STEP IR, not an op
// list. Combat mutations stay ResolvedCombatOperations; plan control-flow
// (mid-plan reads, conditionals, per-instance expansion) stays
// SkillExecutor-owned IR -- never widened into the CombatOperation union.
//
// RESOLVED means resolved: plan steps carry concrete CombatEntityIds,
// never authored SkillTargetIntent selectors. `for_each_target` unrolls
// at RESOLVE -- each copy binds `loop_target` in ops AND conditions to
// that member's id (the resolved plan contains zero `loop_target`s).

import type {
  BuffDefinitionId,
  CombatEntityId,
  CombatOperationId,
  SkillId,
} from '../battle/contracts/ids'
import type { ResolvedCombatOperation } from '../battle/contracts/operations'

import type {
  LandedSemantics,
  SkillTargetIntent,
} from './AuthoredOperation'
import type { CastSnapshot } from './CastSnapshot'
import type {
  SkillCastCost,
  SkillGrants,
  SkillSubcasts,
} from './SkillDefinition'

// ---------------------------------------------------------------------------
// ResolvedSkillCondition -- authored SkillCondition with concrete
// targetIds (v2.1 HIGH fix: zero authored selectors survive resolution).
// ---------------------------------------------------------------------------

export type ResolvedSkillCondition =
  | {
      kind: 'stacks_at_least'
      targetId: CombatEntityId
      definitionId: BuffDefinitionId
      stacks: number
    }
  // threshold already folded to a number at RESOLVE (a non-foldable
  // threshold is a structural fault at resolve time).
  | { kind: 'hp_percent_below'; targetId: CombatEntityId; threshold: number }
  // authored self-scope -> bound to sourceId.
  | {
      kind: 'resource_at_least'
      targetId: CombatEntityId
      resourceId: string
      amount: number
    }
  | { kind: 'target_alive'; targetId: CombatEntityId }
  // plan-scoped -- no entity (ctx.vars written by `read` steps).
  | { kind: 'var'; name: string; op: 'gte' | 'lt' | 'eq' | 'gt' | 'lte'; value: number }
  // cast-scope -- no entity.
  | { kind: 'crit_landed' }
  | { kind: 'any_target_landed' }

// ---------------------------------------------------------------------------
// Resolved value queries -- SkillValueQuery leaves with intents bound to
// concrete ids (targetId may be undefined when an optional context target
// like 'attacker' had no binding -- reads evaluate to neutral values).
// ---------------------------------------------------------------------------

export type OpResultNumberField =
  | 'rawDamage'
  | 'hpDamage'
  | 'healed'
  | 'applied'
  | 'consumed'
  | 'cleansed'
  | 'landed'
  | 'killed'

export type ResolvedSkillValueQuery =
  | {
      query: 'buff_stacks'
      targetId: CombatEntityId | undefined
      definitionId: BuffDefinitionId
      /** summed across matching instances; absent = any source
          (target_definition parity). */
      sourceId?: CombatEntityId
    }
  | {
      query: 'buff_duration'
      targetId: CombatEntityId | undefined
      definitionId: BuffDefinitionId
    }
  | { query: 'hp_percent'; targetId: CombatEntityId | undefined }
  | { query: 'hp_max'; targetId: CombatEntityId | undefined }
  | {
      query: 'resource_current'
      targetId: CombatEntityId | undefined
      resourceId: string
    }
  | {
      query: 'resource_max'
      targetId: CombatEntityId | undefined
      resourceId: string
    }
  | { query: 'resource_snapshot'; resourceId: string }
  | { query: 'stat_scalar'; key: string }
  | { query: 'skill_level' }
  | { query: 'var'; name: string }
  | { query: 'cast_outcome'; field: 'landed' | 'any_crit' }
  | {
      query: 'op_result'
      operationId: CombatOperationId
      field: OpResultNumberField
    }

/** ScalarExpression's resolved sibling -- identical shape with resolved
    query leaves. Expressions containing live reads (buff/hp/resource/
    var/cast_outcome/op_result) can't fold at RESOLVE: they stay as
    ResolvedScalarExpression on the plan step and evaluate at EXECUTE
    between settlement barriers. */
export type ResolvedScalarExpression =
  | number
  | {
      op: 'add' | 'multiply' | 'min' | 'max'
      values: readonly ResolvedScalarExpression[]
    }
  | {
      op: 'subtract' | 'divide'
      left: ResolvedScalarExpression
      right: ResolvedScalarExpression
    }
  | {
      op: 'clamp'
      value: ResolvedScalarExpression
      min: ResolvedScalarExpression
      max: ResolvedScalarExpression
    }
  | {
      op: 'if'
      condition: ResolvedSkillCondition
      then: ResolvedScalarExpression
      else: ResolvedScalarExpression
    }
  | ResolvedSkillValueQuery

/** A payload field the executor patches just before enqueue: the
    expression evaluates via the query ports at EXECUTE (post-settlement
    state) and writes into payload[field]. Top-level payload keys only. */
export interface ResolvedLateBinding {
  field: string
  expr: ResolvedScalarExpression
}

// ---------------------------------------------------------------------------
// ResolvedSkillRead -- the `read` plan step's resolved query descriptor.
// ---------------------------------------------------------------------------

export type ResolvedSkillRead =
  | {
      query: 'buff_stacks'
      targetId: CombatEntityId | undefined
      definitionId: BuffDefinitionId
      sourceId?: CombatEntityId
    }
  | {
      query: 'resource_current'
      targetId: CombatEntityId | undefined
      resourceId: string
    }
  | { query: 'hp_percent'; targetId: CombatEntityId | undefined }
  | {
      query: 'op_result'
      operationId: CombatOperationId
      field: OpResultNumberField
    }
  /** compound landed check -- 1 when ANY listed op result landed
      (consume-for-damage per-target gate: fires once on the first
      landed instance hit). */
  | { query: 'ops_landed_any'; operationIds: readonly CombatOperationId[] }
  /** sums a numeric result field across ops -- execute-branched hits
      mint one op per arm and only the taken arm produces a result, so
      the sum equals the fired arm's value. */
  | {
      query: 'ops_result_sum'
      operationIds: readonly CombatOperationId[]
      field: OpResultNumberField
    }

// ---------------------------------------------------------------------------
// ResolvedSkillPlanStep -- the four-member IR.
// ---------------------------------------------------------------------------

export type ResolvedSkillPlanStep =
  | {
      kind: 'operation'
      /** fully resolved payload (contract sec.4): concrete targetId,
          selectors, and origin. `late` bindings patch named payload
          fields at EXECUTE -- the ONLY unresolved numbers a plan step
          may carry. */
      operation: ResolvedCombatOperation
      late?: readonly ResolvedLateBinding[]
    }
  | {
      kind: 'read'
      /** executor evaluates via the query ports BETWEEN barriers and
          writes ctx.vars[into]. */
      query: ResolvedSkillRead
      into: string
    }
  | {
      kind: 'branch'
      /** authored `if` -> executor evaluates the condition live at
          EXECUTE (post-settlement state). */
      condition: ResolvedSkillCondition
      then: readonly ResolvedSkillPlanStep[]
      else?: readonly ResolvedSkillPlanStep[]
    }
  | {
      kind: 'for_each_instance'
      /** instance filter evaluated at EXECUTE in canonical
          sortedForTarget order (instances are runtime -- they cannot be
          enumerated at RESOLVE). */
      filter: {
        targetId: CombatEntityId
        definitionId?: BuffDefinitionId
        kind?: 'buff' | 'debuff' | 'ailment' | 'marker'
        /** detonate lane: only instances whose def carries periodic
            effects (utility ailments untouched). */
        periodicOnly?: boolean
      }
      /** op template cloned per matching instance: a `selector` payload
          field binds {kind:'instance', instanceId}; an apply_buff
          template's definitionId binds the iterated instance's def
          (the re-seed lane). */
      operation: ResolvedCombatOperation
    }

// ---------------------------------------------------------------------------
// ResolvedSkillPlan
// ---------------------------------------------------------------------------

export interface ResolvedSkillPlan {
  castId: string
  rootActionId: string
  sourceId: CombatEntityId
  /** the AUTHORED root def id (the cast's identity) */
  definitionId: SkillId
  /** empowered def id when the variant swap fired */
  resolvedVariantId?: SkillId
  subcastIndex: number
  steps: readonly ResolvedSkillPlanStep[]
  snapshot: CastSnapshot

  // Executor-consumed def-level semantics (copied from the EFFECTIVE def
  // after variant/composite resolution).
  cadence: { cooldownTurns: number; chargeTurns?: number }
  cost?: SkillCastCost
  grants?: SkillGrants
  theScaling?: { coeff: number }
  /** detonate sugar -- the executor expands read -> consume('all') ->
      deal_damage -> suppressed re-seed per dot ailment at EXECUTE. */
  detonate?: { amp: number }
  /** follow-up driving (multicast/repeat/extra picks) */
  subcasts?: SkillSubcasts
  /** composite picks[1..] -- follow-up payload defs (Task 11 parity). */
  compositeExtraIds?: readonly SkillId[]
  landed?: LandedSemantics
  /** R-S2 self-scope check needs the authored intent. */
  targetIntent: SkillTargetIntent
  actionTags?: readonly string[]
  emblemOnly?: boolean
  counterable?: boolean
  counterSkillId?: SkillId | null
}

// ---------------------------------------------------------------------------
// ResolvedSkillReadContext -- the EXECUTE-time read surface. The resolver
// uses a snapshot-backed subset for folding (foldable leaves only); the
// executor backs the full surface with the readonly SkillQueryPorts.
// targetId undefined = an optional-context target had no binding -- reads
// return neutral values (0 / false).
// ---------------------------------------------------------------------------

export interface ResolvedSkillReadContext {
  buffStacks(
    definitionId: BuffDefinitionId,
    targetId: CombatEntityId | undefined,
    sourceId: CombatEntityId | undefined,
  ): number
  buffDuration(
    definitionId: BuffDefinitionId,
    targetId: CombatEntityId | undefined,
  ): number
  hpPercent(targetId: CombatEntityId | undefined): number
  hpMax(targetId: CombatEntityId | undefined): number
  resourceCurrent(targetId: CombatEntityId | undefined, resourceId: string): number
  resourceMax(targetId: CombatEntityId | undefined, resourceId: string): number
  resourceSnapshot(resourceId: string): number
  statScalar(key: string): number
  skillLevel(): number
  readVar(name: string): number
  alive(targetId: CombatEntityId | undefined): boolean
  critLanded(): boolean
  anyTargetLanded(): boolean
  opResult(operationId: CombatOperationId, field: OpResultNumberField): number
  opsLandedAny(operationIds: readonly CombatOperationId[]): number
  opsResultSum(
    operationIds: readonly CombatOperationId[],
    field: OpResultNumberField,
  ): number
}

export function evaluateResolvedScalar(
  expr: ResolvedScalarExpression,
  ctx: ResolvedSkillReadContext,
): number {
  if (typeof expr === 'number') return expr
  if ('query' in expr) return evaluateResolvedQuery(expr, ctx)
  switch (expr.op) {
    case 'add':
      return expr.values.reduce<number>(
        (sum, v) => sum + evaluateResolvedScalar(v, ctx),
        0,
      )
    case 'multiply':
      return expr.values.reduce<number>(
        (product, v) => product * evaluateResolvedScalar(v, ctx),
        1,
      )
    case 'subtract':
      return evaluateResolvedScalar(expr.left, ctx) - evaluateResolvedScalar(expr.right, ctx)
    case 'divide': {
      const right = evaluateResolvedScalar(expr.right, ctx)
      return right === 0 ? 0 : evaluateResolvedScalar(expr.left, ctx) / right
    }
    case 'min':
      return Math.min(...expr.values.map((v) => evaluateResolvedScalar(v, ctx)))
    case 'max':
      return Math.max(...expr.values.map((v) => evaluateResolvedScalar(v, ctx)))
    case 'clamp': {
      const value = evaluateResolvedScalar(expr.value, ctx)
      const min = evaluateResolvedScalar(expr.min, ctx)
      const max = evaluateResolvedScalar(expr.max, ctx)
      return Math.min(Math.max(value, min), max)
    }
    case 'if':
      return evaluateResolvedCondition(expr.condition, ctx)
        ? evaluateResolvedScalar(expr.then, ctx)
        : evaluateResolvedScalar(expr.else, ctx)
  }
}

function evaluateResolvedQuery(
  query: ResolvedSkillValueQuery,
  ctx: ResolvedSkillReadContext,
): number {
  switch (query.query) {
    case 'buff_stacks':
      return ctx.buffStacks(query.definitionId, query.targetId, query.sourceId)
    case 'buff_duration':
      return ctx.buffDuration(query.definitionId, query.targetId)
    case 'hp_percent':
      return ctx.hpPercent(query.targetId)
    case 'hp_max':
      return ctx.hpMax(query.targetId)
    case 'resource_current':
      return ctx.resourceCurrent(query.targetId, query.resourceId)
    case 'resource_max':
      return ctx.resourceMax(query.targetId, query.resourceId)
    case 'resource_snapshot':
      return ctx.resourceSnapshot(query.resourceId)
    case 'stat_scalar':
      return ctx.statScalar(query.key)
    case 'skill_level':
      return ctx.skillLevel()
    case 'var':
      return ctx.readVar(query.name)
    case 'cast_outcome':
      return (query.field === 'landed' ? ctx.anyTargetLanded() : ctx.critLanded())
        ? 1
        : 0
    case 'op_result':
      return ctx.opResult(query.operationId, query.field)
  }
}

export function evaluateResolvedCondition(
  condition: ResolvedSkillCondition,
  ctx: ResolvedSkillReadContext,
): boolean {
  switch (condition.kind) {
    case 'stacks_at_least':
      return (
        ctx.buffStacks(condition.definitionId, condition.targetId, undefined) >=
        condition.stacks
      )
    case 'hp_percent_below':
      return ctx.hpPercent(condition.targetId) < condition.threshold
    case 'resource_at_least':
      return (
        ctx.resourceCurrent(condition.targetId, condition.resourceId) >=
        condition.amount
      )
    case 'target_alive':
      return ctx.alive(condition.targetId)
    case 'var': {
      const actual = ctx.readVar(condition.name)
      switch (condition.op) {
        case 'gte':
          return actual >= condition.value
        case 'lt':
          return actual < condition.value
        case 'eq':
          return actual === condition.value
        case 'gt':
          return actual > condition.value
        case 'lte':
          return actual <= condition.value
      }
      break
    }
    case 'crit_landed':
      return ctx.critLanded()
    case 'any_target_landed':
      return ctx.anyTargetLanded()
  }
}
