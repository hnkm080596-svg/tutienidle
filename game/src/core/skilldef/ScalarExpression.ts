// skilldef/ScalarExpression.ts -- spec sec.33-36: the ONLY authored
// scalar vocabulary. Pure AST + pure evaluator -- NO arbitrary callbacks
// (spec sec.64), no combat mutation, no Math.random().
//
// Evaluation contexts (two lawful owners):
//   RESOLVE -- SkillResolver folds snapshot/statScalars/rolled picks
//     (CastSnapshot inputs) into numbers.
//   EXECUTE -- SkillExecutor evaluates live reads between settlement
//     barriers via the readonly SkillQueryPorts (R-S3).
// The evaluator itself is context-agnostic: SkillReadContext is the
// single narrow read surface both owners implement.

import type { BuffDefinitionId, CombatEntityId } from '../battle/contracts/ids'

import type { SkillCondition, SkillTargetIntent } from './AuthoredOperation'

// ---------------------------------------------------------------------------
// SkillValueQuery -- spec sec.34 leaf reads. `target` intents resolve
// through SkillReadContext.resolveTarget BEFORE the read runs, so a query
// never sees an authored selector at read time.
// ---------------------------------------------------------------------------

export type SkillValueQuery =
  | {
      query: 'buff_stacks'
      target: SkillTargetIntent
      definitionId: BuffDefinitionId
      /** absent = the target's instance regardless of source
          (target_definition parity) */
      source?: SkillTargetIntent
    }
  | {
      query: 'buff_duration'
      target: SkillTargetIntent
      definitionId: BuffDefinitionId
    }
  | { query: 'hp_percent'; target: SkillTargetIntent }
  /** live count of still-ALIVE members of the resolved set
      (stacksPerAffectedTarget parity: Hau Tho Thanh Luy's stacks = alive
      action targets at apply time). */
  | { query: 'alive_count'; target: SkillTargetIntent }
  | { query: 'resource_current'; target: SkillTargetIntent; resourceId: string }
  | { query: 'resource_max'; target: SkillTargetIntent; resourceId: string }
  /** CastSnapshot.resourcesConsumed -- the frozen pre-consume capture
      (empowered The burn parity); never a live read. */
  | { query: 'resource_snapshot'; resourceId: string }
  /** CastSnapshot.statScalars -- frozen progression/stat inputs
      (kiemDaoCount, realmIndex, cast-leveled skill level, ...). */
  | { query: 'stat_scalar'; key: string }
  | { query: 'skill_level' }
  /** ctx.vars written by `read` plan steps (read_stacks ... into:name). */
  | { query: 'var'; name: string }
  | { query: 'cast_outcome'; field: 'landed' | 'any_crit' }

export type ScalarExpression =
  | number
  | { op: 'add'; values: readonly ScalarExpression[] }
  | { op: 'multiply'; values: readonly ScalarExpression[] }
  | { op: 'subtract'; left: ScalarExpression; right: ScalarExpression }
  // divide guards zero -- right === 0 evaluates to 0 (authored formulas
  // never fault on a zero denominator).
  | { op: 'divide'; left: ScalarExpression; right: ScalarExpression }
  | { op: 'min'; values: readonly ScalarExpression[] }
  | { op: 'max'; values: readonly ScalarExpression[] }
  | {
      op: 'clamp'
      value: ScalarExpression
      min: ScalarExpression
      max: ScalarExpression
    }
  | {
      op: 'if'
      condition: SkillCondition
      then: ScalarExpression
      else: ScalarExpression
    }
  | SkillValueQuery

// ---------------------------------------------------------------------------
// SkillReadContext -- the single narrow read surface a ScalarExpression or
// SkillCondition reaches combat state through (R-S3: readonly, synchronous,
// side-effect free). Every SkillValueQuery member and every SkillCondition
// primitive maps to exactly one method; implementations live with the
// resolver (RESOLVE fold) and executor (EXECUTE live reads).
// ---------------------------------------------------------------------------

export interface SkillReadContext {
  /** Authored-intent -> concrete entity id. The caller owns the binding
      (declared targets, live roster, loop binding). undefined = the
      intent could not resolve (dead/empty set) -- reads against an
      unresolved target return neutral values (0 / false). */
  resolveTarget(intent: SkillTargetIntent): CombatEntityId | undefined
  /** Set resolution for count leaves (alive_count over
      'affected_targets'/'all_enemies'/...). Optional -- callers that
      only model single bindings may omit it; count leaves then count
      over the single resolved id. */
  resolveTargetSet?(intent: SkillTargetIntent): readonly CombatEntityId[]

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
  resourceCurrent(targetId: CombatEntityId | undefined, resourceId: string): number
  resourceMax(targetId: CombatEntityId | undefined, resourceId: string): number
  resourceSnapshot(resourceId: string): number
  statScalar(key: string): number
  skillLevel(): number
  readVar(name: string): number
  alive(targetId: CombatEntityId | undefined): boolean
  critLanded(): boolean
  anyTargetLanded(): boolean
}

// ---------------------------------------------------------------------------
// Evaluators -- pure functions over the AST + read context. No caching, no
// memoization across calls: an EXECUTE context answers post-settlement
// state each invocation (contract sec.63).
// ---------------------------------------------------------------------------

export function evaluateScalarExpression(
  expr: ScalarExpression,
  ctx: SkillReadContext,
): number {
  if (typeof expr === 'number') return expr
  if ('query' in expr) return evaluateValueQuery(expr, ctx)
  switch (expr.op) {
    case 'add':
      return expr.values.reduce<number>((sum, v) => sum + evaluateScalarExpression(v, ctx), 0)
    case 'multiply':
      return expr.values.reduce<number>((product, v) => product * evaluateScalarExpression(v, ctx), 1)
    case 'subtract':
      return evaluateScalarExpression(expr.left, ctx) - evaluateScalarExpression(expr.right, ctx)
    case 'divide': {
      const right = evaluateScalarExpression(expr.right, ctx)
      return right === 0 ? 0 : evaluateScalarExpression(expr.left, ctx) / right
    }
    case 'min':
      return Math.min(...expr.values.map((v) => evaluateScalarExpression(v, ctx)))
    case 'max':
      return Math.max(...expr.values.map((v) => evaluateScalarExpression(v, ctx)))
    case 'clamp': {
      const value = evaluateScalarExpression(expr.value, ctx)
      const min = evaluateScalarExpression(expr.min, ctx)
      const max = evaluateScalarExpression(expr.max, ctx)
      return Math.min(Math.max(value, min), max)
    }
    case 'if':
      return evaluateSkillCondition(expr.condition, ctx)
        ? evaluateScalarExpression(expr.then, ctx)
        : evaluateScalarExpression(expr.else, ctx)
  }
}

function evaluateValueQuery(query: SkillValueQuery, ctx: SkillReadContext): number {
  switch (query.query) {
    case 'buff_stacks':
      return ctx.buffStacks(
        query.definitionId,
        ctx.resolveTarget(query.target),
        query.source === undefined ? undefined : ctx.resolveTarget(query.source),
      )
    case 'buff_duration':
      return ctx.buffDuration(query.definitionId, ctx.resolveTarget(query.target))
    case 'hp_percent':
      return ctx.hpPercent(ctx.resolveTarget(query.target))
    case 'alive_count': {
      const ids =
        ctx.resolveTargetSet !== undefined
          ? ctx.resolveTargetSet(query.target)
          : ([ctx.resolveTarget(query.target)].filter(
              (id): id is CombatEntityId => id !== undefined,
            ) as readonly CombatEntityId[])
      return ids.reduce<number>((count, id) => count + (ctx.alive(id) ? 1 : 0), 0)
    }
    case 'resource_current':
      return ctx.resourceCurrent(ctx.resolveTarget(query.target), query.resourceId)
    case 'resource_max':
      return ctx.resourceMax(ctx.resolveTarget(query.target), query.resourceId)
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
  }
}

export function evaluateSkillCondition(
  condition: SkillCondition,
  ctx: SkillReadContext,
): boolean {
  switch (condition.kind) {
    case 'stacks_at_least':
      return (
        ctx.buffStacks(
          condition.definitionId,
          ctx.resolveTarget(condition.target),
          undefined,
        ) >= condition.stacks
      )
    case 'hp_percent_below':
      return (
        ctx.hpPercent(ctx.resolveTarget(condition.target)) <
        evaluateScalarExpression(condition.threshold, ctx)
      )
    case 'resource_at_least':
      // self-scope: the resource owner is the caster (sourceId binding).
      return ctx.resourceCurrent(ctx.resolveTarget('self'), condition.resourceId) >= condition.amount
    case 'target_alive':
      return ctx.alive(ctx.resolveTarget(condition.target ?? 'primary_target'))
    case 'var': {
      const actual = ctx.readVar(condition.name)
      switch (condition.op) {
        case 'gte':
          return actual >= condition.value
        case 'lt':
          return actual < condition.value
        case 'eq':
          return actual === condition.value
      }
      break
    }
    case 'crit_landed':
      return ctx.critLanded()
    case 'any_target_landed':
      return ctx.anyTargetLanded()
    case 'target_hit_landed':
      throw new Error(
        'evaluateSkillCondition: target_hit_landed is a RESOLVE-time gate -- the resolver lowers it to ops_landed_any + var branch; it never evaluates directly',
      )
  }
}
