// skilldef/SkillResolver.ts -- R-S1: the PURE resolver. Authored
// SkillDefinition + snapshot inputs -> ResolvedSkillPlan. NO combat
// mutation, NO scheduler, NO Math.random() -- deterministic CombatRng
// only (composite picks; hit/crit/armor rolls belong to
// DamageAuthority at EXECUTE).
//
// Resolution order (spec sec.24-27):
//   1. empowerment variant swap (theThreshold check, consumesAllThe
//      captures resourcesConsumed BEFORE the consume op)
//   2. composite pool roll -- partial Fisher-Yates, ONE roll per pick,
//      re-rolled per resolve() call (per subcast)
//   3. stat scalar capture (attributeScaling/manaScaling/stat_scalar
//      leaves + realmIndex + skill_level)
//   4. authored intents -> concrete CombatEntityIds; for_each_target
//      unrolls binding loop_target; expressions fold where every leaf
//      reads the snapshot; live reads stay as `late` bindings /
//      resolved query leaves on plan steps.

import type {
  BuffDefinitionId,
  CombatEntityId,
  CombatOperationId,
  SkillId,
} from '../battle/contracts/ids'
import type {
  CleanseBuffOperation,
  CombatOperation,
  DealDamageOperation,
  ResolvedCombatOperation,
} from '../battle/contracts/operations'
import type { CombatOperationOrigin } from '../battle/contracts/origin'
import type { CombatRng } from '../battle/contracts/rng'
import type { BuffInstanceSelector } from '../battle/contracts/selectors'
import type { SkillDamageComponent } from '../skill/SkillDamageComponent'

import type {
  AuthoredBuffSelector,
  AuthoredSkillOperation,
  SkillCondition,
  SkillTargetIntent,
} from './AuthoredOperation'
import type {
  CastSnapshot,
  SkillResolveContextIds,
  SkillResolveEntityQuery,
  StatReadPort,
} from './CastSnapshot'
import type {
  ResolvedLateBinding,
  ResolvedScalarExpression,
  ResolvedSkillCondition,
  ResolvedSkillPlan,
  ResolvedSkillPlanStep,
  ResolvedSkillReadContext,
} from './ResolvedSkillPlan'
import { evaluateResolvedScalar } from './ResolvedSkillPlan'
import type { ScalarExpression } from './ScalarExpression'
import type {
  ActiveSkillDefinition,
  SkillInstances,
} from './SkillDefinition'
import type { SkillCombatRuntimeState } from './SkillCombatRuntimeState'
import type { SkillDefinitionRegistry } from './SkillDefinitionRegistry'
import type { SkillProgressionState } from './SkillProgressionState'

// ---------------------------------------------------------------------------
// Input / scope
// ---------------------------------------------------------------------------

export interface SkillResolveInput {
  /** the AUTHORED root def -- variant/composite resolution happens
      inside resolve(). */
  definition: ActiveSkillDefinition
  sourceId: CombatEntityId
  declaredTargetIds: readonly CombatEntityId[]
  /** read-only progression (level -> skill_level scalar). */
  progression: SkillProgressionState
  /** optional battle-scoped state -- the resolver reads it for nothing
      today; kept on the input for the documented RESOLVE signature. */
  combatState?: SkillCombatRuntimeState
  /** frozen-scalar capture port (stats, realmIndex, player scalars). */
  sourceStats: StatReadPort
  entityQuery: SkillResolveEntityQuery
  castId: string
  rootActionId: string
  subcastIndex: number
  /** reactive-context bindings ('attacker' intent). */
  contextIds?: SkillResolveContextIds
  /** caller-computed scale folded into every deal_damage coefficient
      (sudden-death multiplier parity). */
  coefficientScale?: number
  /** Composite-extra payload lane (TBS compositePickedSkills parity):
      the def resolves VERBATIM -- no empowerment swap, no composite
      re-pick, no subcast config; extras are payload-only inline lanes
      of the parent cast. */
  payloadOnly?: boolean
  /** Charge-init plan (TBS chargeTurns parity): the cast COMMITS now --
      cooldown through the commit port, cost + consume-all burn as the
      first scheduled ops -- and defers every authored step and grant to
      the charge-resolve follow-up. The plan carries no steps, no grants
      and no composite extras (the deferred resolution owns all of it). */
  chargeInit?: boolean
  /** Declare-side resolution replay (TBS parity): the caller already
      ran the empowerment swap / composite pick / theBurned capture at
      DECLARE to feed targeting; the plan must execute THAT resolution,
      never re-roll it. Honored whenever present -- follow-up plans
      built by resolveFollowUp strip it so repeats/multicast re-resolve
      (declareQueuedExecution re-picks per execution). */
  preResolved?: SkillPreResolution
  /** CAST_COMMIT override -- defaults to `subcastIndex === 0`. TBS
      queued executions (repeat/multicast) are fresh cast identities
      that must NOT re-commit (executionCommitsCast parity). */
  commitsCast?: boolean
  /** Follow-up driving override -- defaults to true. TBS drives
      repeats/multicast through its own queuedExecutions lane (drain
      ordering, intercept windows, target re-collection parity); the
      executor's internal driving stays OFF there. Composite extras
      still expand inline -- they are lanes of the executing plan. */
  driveFollowUps?: boolean
}

/** The caller's declare-side resolution, replayed verbatim. */
export interface SkillPreResolution {
  /** the RESOLVED payload def id (empowered/composite pick, or the
      root itself for 'original' casts). */
  effectiveSkillId: SkillId
  /** composite picks[1..] -- inline extra payload lanes. */
  extraSkillIds?: readonly SkillId[]
  /** stamped when the resolution swapped to a variant (empowered). */
  resolvedVariantId?: SkillId
  /** theBurned captured at declare (TBS execution.theBurned parity) --
      feeds theScaling via snapshot.resourcesConsumed. */
  theBurned?: number
}

interface ResolveScope {
  /** for_each_target binding -- the member id `loop_target` resolves to. */
  loopTargetId?: CombatEntityId
}

export class SkillResolverError extends Error {}

// ---------------------------------------------------------------------------
// The resolver.
// ---------------------------------------------------------------------------

export class SkillResolver {
  constructor(
    private readonly skills: SkillDefinitionRegistry,
    private readonly rng: CombatRng,
  ) {}

  resolve(input: SkillResolveInput): ResolvedSkillPlan {
    if (input.definition.kind !== 'active') {
      throw new SkillResolverError(
        `SkillResolver: definition '${input.definition.id}' is passive -- resolve() takes active definitions only`,
      )
    }

    // 1+2 -- resolution: either the caller's declare-side replay
    // (preResolved -- TBS already swapped/picked at DECLARE to feed
    // targeting) or the resolver's own empowerment swap + composite
    // roll. Empowerment only ever fires on the ROOT cast
    // (subcastIndex===0 -- TBS declareQueuedExecution parity: follow-up
    // executions never re-check empowerment); composite pools re-roll
    // per subcast. payloadOnly resolves stay verbatim either way.
    let effective = input.definition
    let resolvedVariantId: SkillId | undefined
    const empowerment = input.definition.variants?.empowerment
    const resourcesConsumed: Record<string, number> = {}
    let compositePicks: readonly SkillId[] | undefined
    let compositeExtraIds: readonly SkillId[] | undefined
    const rootSubcasts =
      input.payloadOnly === true ? undefined : input.definition.subcasts
    const pre = input.payloadOnly === true ? undefined : input.preResolved

    if (pre !== undefined) {
      const picked = this.skills.require(pre.effectiveSkillId)
      if (picked.kind !== 'active') {
        throw new SkillResolverError(
          `SkillResolver: preResolved effective '${pre.effectiveSkillId}' of '${effective.id}' is not active`,
        )
      }
      effective = picked
      resolvedVariantId = pre.resolvedVariantId
      compositeExtraIds = pre.extraSkillIds
      if (rootSubcasts?.compositePool !== undefined) {
        compositePicks = [pre.effectiveSkillId, ...(pre.extraSkillIds ?? [])]
      }
      if (pre.theBurned !== undefined) {
        // theBurned was captured at DECLARE (pre-commit, pre-burn).
        resourcesConsumed.the = pre.theBurned
      }
    } else {
      if (
        input.payloadOnly !== true &&
        input.subcastIndex === 0 &&
        empowerment !== undefined &&
        input.entityQuery.currentThe(input.sourceId) >= empowerment.theThreshold
      ) {
        const empowered = this.skills.require(empowerment.empoweredSkillId)
        if (empowered.kind !== 'active') {
          throw new SkillResolverError(
            `SkillResolver: empowerment target '${empowerment.empoweredSkillId}' of '${effective.id}' is not active`,
          )
        }
        effective = empowered
        resolvedVariantId = empowered.id
        if (empowered.consumesAllThe === true) {
          // theBurned captures BEFORE the consume op zeroes the pool.
          resourcesConsumed.the = input.entityQuery.currentThe(input.sourceId)
        }
      }

      if (rootSubcasts?.compositePool !== undefined) {
        const picks = this.pickComposite(
          rootSubcasts.compositePool,
          rootSubcasts.compositeCount ?? 1,
        )
        compositePicks = picks
        compositeExtraIds = picks.slice(1)
        const picked = this.skills.require(picks[0]!)
        if (picked.kind !== 'active') {
          throw new SkillResolverError(
            `SkillResolver: composite pick '${picks[0]}' of '${effective.id}' is not active`,
          )
        }
        effective = picked
      }
    }

    // 3 -- stat scalar capture (frozen inputs the def's formulas read).
    const statScalars = this.collectStatScalars(effective, input)

    // 4 -- snapshot.
    const snapshot: CastSnapshot = {
      castId: input.castId,
      rootActionId: input.rootActionId,
      sourceId: input.sourceId,
      definitionId: input.definition.id,
      ...(resolvedVariantId !== undefined ? { resolvedVariantId } : {}),
      ...(compositePicks !== undefined ? { compositePicks } : {}),
      resourcesConsumed,
      statScalars,
      declaredTargetIds: input.declaredTargetIds,
    }

    // 5 -- translate authored ops into the step IR.
    const ctx: TranslateContext = {
      input,
      effective,
      snapshot,
      opSeq: 0,
      readSeq: 0,
      lastDamageOpId: undefined,
      hitOpIdsByTarget: new Map(),
      applyOpIds: new Map(),
    }
    // Charge-init defers every authored step to the resolve follow-up:
    // the plan still commits (cadence/cost/consume-all ride the plan
    // fields below) but mints no operation steps.
    const steps = input.chargeInit === true
      ? []
      : this.translateOps(effective.operations, ctx, {})

    return {
      castId: input.castId,
      rootActionId: input.rootActionId,
      sourceId: input.sourceId,
      definitionId: input.definition.id,
      ...(resolvedVariantId !== undefined ? { resolvedVariantId } : {}),
      subcastIndex: input.subcastIndex,
      steps,
      snapshot,
      // Commit-scope fields ride the AUTHORED ROOT def (TBS parity:
      // commitAction/consumeResourceFor read action.skill -- the root
      // base -- never the empowered/composite payload; the empowered
      // def's own cadence/cost is inert in the root lane).
      cadence: input.definition.cadence,
      ...(input.definition.cost !== undefined
        ? { cost: input.definition.cost }
        : {}),
      commitsCast: input.commitsCast ?? input.subcastIndex === 0,
      // consumesAllThe rides the EFFECTIVE def (TBS payloadSkill parity:
      // the empowered form carries the burn; a root-level flag burns on
      // its own commit -- never on follow-ups, which never commit).
      ...(effective.consumesAllThe === true ? { consumesAllThe: true } : {}),
      // Charge-init grants nothing now -- theGainOnLandedCast/theGainOnCrit
      // fire on the deferred resolve execution, where hits actually land.
      ...(input.chargeInit !== true && effective.grants !== undefined
        ? { grants: effective.grants }
        : {}),
      ...(effective.theScaling !== undefined
        ? { theScaling: effective.theScaling }
        : {}),
      ...(effective.landed !== undefined ? { landed: effective.landed } : {}),
      // Follow-up config is ROOT-owned (TBS rootSkill.repeatCasts /
      // rootSkill.multicast parity -- a picked member's own subcasts
      // never drive).
      ...(rootSubcasts !== undefined ? { subcasts: rootSubcasts } : {}),
      ...(input.chargeInit !== true &&
      compositeExtraIds !== undefined &&
      compositeExtraIds.length > 0
        ? { compositeExtraIds }
        : {}),
      targetIntent: effective.targetIntent,
      ...(effective.actionTags !== undefined ? { actionTags: effective.actionTags } : {}),
      ...(effective.emblemOnly !== undefined ? { emblemOnly: effective.emblemOnly } : {}),
      ...(effective.counterable !== undefined ? { counterable: effective.counterable } : {}),
      ...(effective.counterSkillId !== undefined
        ? { counterSkillId: effective.counterSkillId }
        : {}),
    }
  }

  // -----------------------------------------------------------------------
  // Composite pick -- partial Fisher-Yates, ONE rng.roll() per pick
  // (TurnBattleSystem.pickCompositePool parity).
  // -----------------------------------------------------------------------

  private pickComposite(
    pool: readonly SkillId[],
    count: number,
  ): readonly SkillId[] {
    const remaining = [...pool]
    const picks: SkillId[] = []
    for (let i = 0; i < count && remaining.length > 0; i++) {
      const index = Math.floor(this.rng.roll() * remaining.length)
      picks.push(remaining.splice(index, 1)[0]!)
    }
    return picks
  }

  // -----------------------------------------------------------------------
  // Stat scalar capture -- walk the effective def's expressions for
  // stat_scalar/skill_level leaves + scaling attribute inputs; freeze
  // them into snapshot.statScalars.
  // -----------------------------------------------------------------------

  private collectStatScalars(
    def: ActiveSkillDefinition,
    input: SkillResolveInput,
  ): Record<string, number> {
    const statKeys = new Set<string>()
    let needsSkillLevel = false

    const collectFromExpr = (expr: ScalarExpression): void => {
      if (typeof expr === 'number') return
      if ('query' in expr) {
        if (expr.query === 'stat_scalar') statKeys.add(expr.key)
        if (expr.query === 'skill_level') needsSkillLevel = true
        return
      }
      switch (expr.op) {
        case 'add':
        case 'multiply':
        case 'min':
        case 'max':
          expr.values.forEach(collectFromExpr)
          return
        case 'subtract':
        case 'divide':
          collectFromExpr(expr.left)
          collectFromExpr(expr.right)
          return
        case 'clamp':
          collectFromExpr(expr.value)
          collectFromExpr(expr.min)
          collectFromExpr(expr.max)
          return
        case 'if':
          collectFromCondition(expr.condition)
          collectFromExpr(expr.then)
          collectFromExpr(expr.else)
          return
      }
    }

    const collectFromCondition = (cond: SkillCondition): void => {
      if (cond.kind === 'hp_percent_below') collectFromExpr(cond.threshold)
    }

    const collectFromOps = (ops: readonly AuthoredSkillOperation[]): void => {
      for (const op of ops) {
        switch (op.type) {
          case 'deal_damage':
            if (op.coefficient !== undefined) collectFromExpr(op.coefficient)
            if (op.consumeBuff !== undefined) {
              collectFromExpr(op.consumeBuff.damagePerStack)
            }
            if (op.scaleBuff !== undefined) {
              collectFromExpr(op.scaleBuff.damagePerStack)
            }
            if (op.consumeWard !== undefined) {
              collectFromExpr(op.consumeWard.damagePerWardPoint)
            }
            if (op.healPercentOfDamage !== undefined) {
              collectFromExpr(op.healPercentOfDamage)
            }
            for (const entry of op.scaling?.attributeScaling ?? []) {
              for (const attr of entry.attributes) statKeys.add(attr)
            }
            if (op.scaling?.manaScalingRatio !== undefined) statKeys.add('maxMp')
            break
          case 'heal':
            if (op.amount !== undefined) collectFromExpr(op.amount)
            break
          case 'apply_buff':
            if (op.stacks !== undefined) collectFromExpr(op.stacks)
            if (op.chance !== undefined) collectFromExpr(op.chance)
            if (op.durationOverride !== undefined) {
              collectFromExpr(op.durationOverride)
            }
            break
          case 'add_buff_stacks':
          case 'remove_buff_stacks':
          case 'consume_buff_stacks':
            if (op.stacks !== 'all') collectFromExpr(op.stacks)
            break
          case 'push_gauge':
            collectFromExpr(op.fractionOfMax)
            break
          case 'gain_resource':
          case 'consume_resource':
            if (op.amount !== 'all') collectFromExpr(op.amount)
            break
          case 'apply_shield':
            collectFromExpr(op.amount)
            break
          case 'if':
            collectFromCondition(op.condition)
            collectFromOps(op.then)
            if (op.else !== undefined) collectFromOps(op.else)
            break
          case 'for_each_target':
            collectFromOps(op.ops)
            break
          default:
            break
        }
      }
    }
    collectFromOps(def.operations)
    if (def.instances !== undefined) {
      collectFromExpr(def.instances.count)
      if (def.instances.each?.execute !== undefined) {
        collectFromExpr(def.instances.each.execute.hpPercentBelow)
      }
    }

    // Always-captured scalars: realmIndex (xp-derived, spec sec.26) and
    // skill_level (progression-owned -- every def may read it).
    statKeys.add('realmIndex')
    needsSkillLevel = true

    const statScalars: Record<string, number> = {}
    for (const key of statKeys) {
      statScalars[key] = input.sourceStats.scalar(input.sourceId, key)
    }
    if (needsSkillLevel) statScalars.skill_level = input.progression.level
    return statScalars
  }

  // -----------------------------------------------------------------------
  // Intent resolution -- authored selectors -> concrete ids.
  // -----------------------------------------------------------------------

  private resolveIntentSet(
    intent: SkillTargetIntent,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): readonly CombatEntityId[] {
    const { input } = ctx
    switch (intent) {
      case 'self':
        return [input.sourceId]
      case 'primary_target':
        return input.declaredTargetIds[0] !== undefined
          ? [input.declaredTargetIds[0]]
          : []
      case 'affected_targets':
        return input.declaredTargetIds
      case 'all_enemies':
        return input.entityQuery.enemiesOf(input.sourceId)
      case 'allies_except_self':
        return input.entityQuery
          .alliesOf(input.sourceId)
          .filter((id) => id !== input.sourceId)
      case 'all_allies':
        return input.entityQuery.alliesOf(input.sourceId)
      case 'attacker':
        return input.contextIds?.attackerId !== undefined
          ? [input.contextIds.attackerId]
          : []
      case 'loop_target':
        return scope.loopTargetId !== undefined ? [scope.loopTargetId] : []
    }
  }

  /** Single-id binding for condition/query targets: the first member of
      the resolved set (set-intents in single positions bind the primary
      member -- the headless-fold equivalent of "the current target"). */
  private resolveIntentSingle(
    intent: SkillTargetIntent,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): CombatEntityId | undefined {
    return this.resolveIntentSet(intent, ctx, scope)[0]
  }

  /** Selector TARGET keeps set cardinality: one resolved selector per
      member of the resolved target set. An identity SOURCE binds exactly
      one entity (validation rejects set-valued source intents) shared by
      every emitted selector. */
  private resolveSelectorSet(
    selector: AuthoredBuffSelector,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): readonly BuffInstanceSelector[] {
    switch (selector.kind) {
      case 'target_definition':
        return this.resolveIntentSet(selector.target, ctx, scope).map(
          (targetId) => ({
            kind: 'target_definition' as const,
            targetId,
            definitionId: selector.definitionId,
          }),
        )
      case 'identity': {
        const sourceId = this.resolveIntentSingle(selector.source, ctx, scope)
        if (sourceId === undefined) return []
        return this.resolveIntentSet(selector.target, ctx, scope).map(
          (targetId) => ({
            kind: 'identity' as const,
            definitionId: selector.definitionId,
            sourceId,
            targetId,
          }),
        )
      }
    }
  }

  // -----------------------------------------------------------------------
  // Expression resolution -- authored ScalarExpression ->
  // {folded:number} when every leaf reads the snapshot, else
  // {late:ResolvedScalarExpression} evaluated at EXECUTE.
  // -----------------------------------------------------------------------

  private toResolvedExpression(
    expr: ScalarExpression,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedScalarExpression {
    if (typeof expr === 'number') return expr
    if ('query' in expr) {
      switch (expr.query) {
        case 'buff_stacks':
          return {
            query: 'buff_stacks',
            targetId: this.resolveIntentSingle(expr.target, ctx, scope),
            definitionId: expr.definitionId,
            ...(expr.source !== undefined
              ? { sourceId: this.resolveIntentSingle(expr.source, ctx, scope) }
              : {}),
          }
        case 'buff_duration':
          return {
            query: 'buff_duration',
            targetId: this.resolveIntentSingle(expr.target, ctx, scope),
            definitionId: expr.definitionId,
          }
        case 'hp_percent':
          return {
            query: 'hp_percent',
            targetId: this.resolveIntentSingle(expr.target, ctx, scope),
          }
        case 'alive_count':
          return {
            query: 'alive_count',
            targetIds: this.resolveIntentSet(expr.target, ctx, scope),
          }
        case 'resource_current':
          return {
            query: 'resource_current',
            targetId: this.resolveIntentSingle(expr.target, ctx, scope),
            resourceId: expr.resourceId,
          }
        case 'resource_max':
          return {
            query: 'resource_max',
            targetId: this.resolveIntentSingle(expr.target, ctx, scope),
            resourceId: expr.resourceId,
          }
        case 'resource_snapshot':
          return { query: 'resource_snapshot', resourceId: expr.resourceId }
        case 'stat_scalar':
          return { query: 'stat_scalar', key: expr.key }
        case 'skill_level':
          return { query: 'skill_level' }
        case 'var':
          return { query: 'var', name: expr.name }
        case 'cast_outcome':
          return { query: 'cast_outcome', field: expr.field }
      }
    }
    switch (expr.op) {
      case 'add':
      case 'multiply':
      case 'min':
      case 'max':
        return {
          op: expr.op,
          values: expr.values.map((v) =>
            this.toResolvedExpression(v, ctx, scope),
          ),
        }
      case 'subtract':
      case 'divide':
        return {
          op: expr.op,
          left: this.toResolvedExpression(expr.left, ctx, scope),
          right: this.toResolvedExpression(expr.right, ctx, scope),
        }
      case 'clamp':
        return {
          op: 'clamp',
          value: this.toResolvedExpression(expr.value, ctx, scope),
          min: this.toResolvedExpression(expr.min, ctx, scope),
          max: this.toResolvedExpression(expr.max, ctx, scope),
        }
      case 'if':
        return {
          op: 'if',
          condition: this.resolveCondition(expr.condition, ctx, scope),
          then: this.toResolvedExpression(expr.then, ctx, scope),
          else: this.toResolvedExpression(expr.else, ctx, scope),
        }
    }
  }

  /** true when every leaf reads frozen snapshot state (stat_scalar /
      skill_level / resource_snapshot) -- foldable at RESOLVE. `if`
      nodes are always live (conditions read post-settlement state). */
  private isFoldable(expr: ResolvedScalarExpression): boolean {
    if (typeof expr === 'number') return true
    if ('query' in expr) {
      return (
        expr.query === 'stat_scalar' ||
        expr.query === 'skill_level' ||
        expr.query === 'resource_snapshot'
      )
    }
    switch (expr.op) {
      case 'add':
      case 'multiply':
      case 'min':
      case 'max':
        return expr.values.every((v) => this.isFoldable(v))
      case 'subtract':
      case 'divide':
        return this.isFoldable(expr.left) && this.isFoldable(expr.right)
      case 'clamp':
        return (
          this.isFoldable(expr.value) &&
          this.isFoldable(expr.min) &&
          this.isFoldable(expr.max)
        )
      case 'if':
        return false
    }
  }

  /** Snapshot-backed fold context -- live-read methods are unreachable
      (isFoldable gates them) and throw loudly if misused. */
  private foldContext(snapshot: CastSnapshot): ResolvedSkillReadContext {
    const live = (name: string): never => {
      throw new SkillResolverError(
        `SkillResolver: fold context reached live read '${name}' -- isFoldable gate broken`,
      )
    }
    return {
      buffStacks: () => live('buffStacks'),
      buffDuration: () => live('buffDuration'),
      hpPercent: () => live('hpPercent'),
      hpMax: () => live('hpMax'),
      resourceCurrent: () => live('resourceCurrent'),
      resourceMax: () => live('resourceMax'),
      resourceSnapshot: (id) => snapshot.resourcesConsumed[id] ?? 0,
      statScalar: (key) => snapshot.statScalars[key] ?? 0,
      skillLevel: () => snapshot.statScalars.skill_level ?? 1,
      readVar: () => live('readVar'),
      alive: () => live('alive'),
      critLanded: () => live('critLanded'),
      anyTargetLanded: () => live('anyTargetLanded'),
      opResult: () => live('opResult'),
      opsLandedAny: () => live('opsLandedAny'),
      opsResultSum: () => live('opsResultSum'),
    }
  }

  private fold(
    expr: ScalarExpression,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): { folded: number } | { late: ResolvedScalarExpression } {
    const resolved = this.toResolvedExpression(expr, ctx, scope)
    if (this.isFoldable(resolved)) {
      return {
        folded: evaluateResolvedScalar(resolved, this.foldContext(ctx.snapshot)),
      }
    }
    return { late: resolved }
  }

  /** Fold-or-throw -- fields whose semantics require a concrete number
      at RESOLVE (instance counts, execute thresholds). */
  private foldRequired(
    expr: ScalarExpression,
    ctx: TranslateContext,
    scope: ResolveScope,
    field: string,
  ): number {
    const result = this.fold(expr, ctx, scope)
    if ('late' in result) {
      throw new SkillResolverError(
        `SkillResolver: '${field}' on '${ctx.effective.id}' must fold at RESOLVE (live reads are not legal here)`,
      )
    }
    return result.folded
  }

  // -----------------------------------------------------------------------
  // Condition resolution -- authored SkillCondition ->
  // ResolvedSkillCondition (concrete targetIds, folded thresholds).
  // -----------------------------------------------------------------------

  private resolveCondition(
    condition: SkillCondition,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillCondition {
    switch (condition.kind) {
      case 'stacks_at_least': {
        const targetId = this.resolveIntentSingle(condition.target, ctx, scope)
        if (targetId === undefined) {
          throw new SkillResolverError(
            `SkillResolver: stacks_at_least target '${condition.target}' unresolved on '${ctx.effective.id}'`,
          )
        }
        return {
          kind: 'stacks_at_least',
          targetId,
          definitionId: condition.definitionId,
          stacks: condition.stacks,
        }
      }
      case 'hp_percent_below': {
        const targetId = this.resolveIntentSingle(condition.target, ctx, scope)
        if (targetId === undefined) {
          throw new SkillResolverError(
            `SkillResolver: hp_percent_below target '${condition.target}' unresolved on '${ctx.effective.id}'`,
          )
        }
        return {
          kind: 'hp_percent_below',
          targetId,
          threshold: this.foldRequired(
            condition.threshold,
            ctx,
            scope,
            'hp_percent_below.threshold',
          ),
        }
      }
      case 'resource_at_least':
        // self-scope: bound to sourceId at resolve.
        return {
          kind: 'resource_at_least',
          targetId: ctx.input.sourceId,
          resourceId: condition.resourceId,
          amount: condition.amount,
        }
      case 'target_alive': {
        const targetId = this.resolveIntentSingle(
          condition.target ?? 'primary_target',
          ctx,
          scope,
        )
        if (targetId === undefined) {
          throw new SkillResolverError(
            `SkillResolver: target_alive target '${condition.target ?? 'primary_target'}' unresolved on '${ctx.effective.id}'`,
          )
        }
        return { kind: 'target_alive', targetId }
      }
      case 'var':
        return {
          kind: 'var',
          name: condition.name,
          op: condition.op,
          value: condition.value,
        }
      case 'crit_landed':
        return { kind: 'crit_landed' }
      case 'any_target_landed':
        return { kind: 'any_target_landed' }
      case 'target_hit_landed':
        // Legal only as the condition of an authored `if` op (lowered
        // to ops_landed_any + var branch in translateOp); inside scalar
        // `if` leaves or other condition slots there is no step
        // emission point, so this position is a structural fault.
        throw new SkillResolverError(
          `SkillResolver: target_hit_landed on '${ctx.effective.id}' is only legal as an authored 'if' condition -- not inside expressions or nested condition positions`,
        )
    }
  }

  // -----------------------------------------------------------------------
  // Op minting -- deterministic operationIds + origin stamping.
  // -----------------------------------------------------------------------

  private mintOperationId(ctx: TranslateContext): CombatOperationId {
    const id = `op.${ctx.input.castId}.${ctx.input.subcastIndex}.${ctx.opSeq}`
    ctx.opSeq += 1
    return id
  }

  private origin(ctx: TranslateContext): CombatOperationOrigin {
    return {
      kind: 'skill',
      originId: ctx.effective.id,
      sourceId: ctx.input.sourceId,
      rootActionId: ctx.input.rootActionId,
      castId: ctx.input.castId,
      subcastIndex: ctx.input.subcastIndex,
    }
  }

  private operationStep(
    op: CombatOperation,
    ctx: TranslateContext,
    late?: readonly ResolvedLateBinding[],
  ): Extract<ResolvedSkillPlanStep, { kind: 'operation' }> {
    const resolved = {
      ...op,
      operationId: this.mintOperationId(ctx),
      origin: this.origin(ctx),
    } as ResolvedCombatOperation
    if (op.type === 'deal_damage') ctx.lastDamageOpId = resolved.operationId
    return {
      kind: 'operation',
      operation: resolved,
      ...(late !== undefined && late.length > 0 ? { late } : {}),
    }
  }

  private nextVar(prefix: string, ctx: TranslateContext): string {
    const name = `__${prefix}_${ctx.readSeq}`
    ctx.readSeq += 1
    return name
  }

  // -----------------------------------------------------------------------
  // Scalar field binding -- fold-or-late for payload numbers.
  // -----------------------------------------------------------------------

  private bindScalar(
    expr: ScalarExpression | undefined,
    fallback: number,
    ctx: TranslateContext,
    scope: ResolveScope,
    late: ResolvedLateBinding[],
    field: string,
  ): number {
    if (expr === undefined) return fallback
    const result = this.fold(expr, ctx, scope)
    if ('folded' in result) return result.folded
    late.push({ field, expr: result.late })
    return 0 // placeholder -- patched at EXECUTE by the late binding
  }

  // -----------------------------------------------------------------------
  // Operation translation.
  // -----------------------------------------------------------------------

  private translateOps(
    ops: readonly AuthoredSkillOperation[],
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    const steps: ResolvedSkillPlanStep[] = []
    for (const op of ops) {
      steps.push(...this.translateOp(op, ctx, scope))
    }
    return steps
  }

  private translateOp(
    op: AuthoredSkillOperation,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    switch (op.type) {
      case 'deal_damage':
        return this.translateDealDamage(op, ctx, scope)
      case 'heal':
        return this.translateHeal(op, ctx, scope)
      case 'apply_buff':
        return this.translateApplyBuff(op, ctx, scope)
      case 'add_buff_stacks':
      case 'remove_buff_stacks':
      case 'consume_buff_stacks':
        return this.translateStacksOp(op, ctx, scope)
      case 'add_buff_modifier':
      case 'remove_buff_modifier':
        return this.translateModifierOp(op, ctx, scope)
      case 'refresh_buff_duration':
      case 'extend_buff_duration':
        return this.translateDurationOp(op, ctx, scope)
      case 'trigger_buff_periodic':
        return this.translateTriggerPeriodic(op, ctx, scope)
      case 'remove_buff':
        return this.translateRemoveBuff(op, ctx, scope)
      case 'cleanse':
        return this.translateCleanse(op, ctx, scope)
      case 'push_gauge':
        return this.translatePushGauge(op, ctx, scope)
      case 'gain_resource':
      case 'consume_resource':
        return this.translateResourceOp(op, ctx, scope)
      case 'apply_shield':
        return this.translateApplyShield(op, ctx, scope)
      case 'read_stacks':
        return this.translateReadStacks(op, ctx, scope)
      case 'detonate':
        // per resolved target -- the executor expands the
        // consume->burst->re-seed sequence at this step position
        // (TBS per-hit detonate ordering).
        return this.resolveIntentSet(op.target, ctx, scope).map((targetId) => ({
          kind: 'detonate' as const,
          targetId,
          amp: op.amp,
        }))
      case 'if': {
        // target_hit_landed (M4) -- lowers to read{ops_landed_any over
        // the target's minted hit ops} + branch{var>=1}: the TBS
        // per-landed-hit consequence gate (ailments/detonate fire only
        // when the hit on THIS target connected).
        if (op.condition.kind === 'target_hit_landed') {
          const intent =
            op.condition.target ??
            (scope.loopTargetId !== undefined ? 'loop_target' : 'primary_target')
          const targetId = this.resolveIntentSingle(intent, ctx, scope)
          if (targetId === undefined) {
            throw new SkillResolverError(
              `SkillResolver: target_hit_landed on '${ctx.effective.id}' could not bind '${intent}'`,
            )
          }
          const hitOpIds = ctx.hitOpIdsByTarget.get(targetId) ?? []
          if (hitOpIds.length === 0) {
            throw new SkillResolverError(
              `SkillResolver: target_hit_landed on '${ctx.effective.id}' resolved zero hit ops for target '${targetId}' -- the gate must follow a deal_damage op on the same target`,
            )
          }
          const landedVar = this.nextVar('thl', ctx)
          return [
            {
              kind: 'read',
              query: { query: 'ops_landed_any', operationIds: hitOpIds },
              into: landedVar,
            },
            {
              kind: 'branch',
              condition: { kind: 'var', name: landedVar, op: 'gte', value: 1 },
              then: this.translateOps(op.then, ctx, scope),
              ...(op.else !== undefined
                ? { else: this.translateOps(op.else, ctx, scope) }
                : {}),
              gate: { hitOperationIds: hitOpIds, targetId },
            },
          ]
        }
        return [
          {
            kind: 'branch',
            condition: this.resolveCondition(op.condition, ctx, scope),
            then: this.translateOps(op.then, ctx, scope),
            ...(op.else !== undefined
              ? { else: this.translateOps(op.else, ctx, scope) }
              : {}),
          },
        ]
      }
      case 'for_each_target': {
        // RESOLVE-time unroll: each member copy binds loop_target in
        // ops AND conditions (the resolved plan holds zero loop_targets).
        const steps: ResolvedSkillPlanStep[] = []
        for (const targetId of this.resolveIntentSet(op.target, ctx, scope)) {
          steps.push(
            ...this.translateOps(op.ops, ctx, { ...scope, loopTargetId: targetId }),
          )
        }
        return steps
      }
    }
  }

  // -----------------------------------------------------------------------
  // deal_damage -- instances expansion, declared policies (contract
  // v1.6), execute-branch fold, and the landed-gated consume/leech lanes
  // (TurnBattleSystem.ts:2059-2135 parity).
  // -----------------------------------------------------------------------

  private translateDealDamage(
    op: Extract<AuthoredSkillOperation, { type: 'deal_damage' }>,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    const steps: ResolvedSkillPlanStep[] = []
    const targetIds = this.resolveIntentSet(op.target, ctx, scope)
    const instances = ctx.effective.instances
    const instanceCount =
      instances !== undefined
        ? Math.max(0, Math.floor(this.foldRequired(instances.count, ctx, scope, 'instances.count')))
        : 1

    for (const targetId of targetIds) {
      const targetSteps: ResolvedSkillPlanStep[] = []
      for (let i = 0; i < instanceCount; i++) {
        const instanceSteps: ResolvedSkillPlanStep[] = []
        // scaleBuff (Hoa An spec sec.62) -- live same-source stack read
        // BEFORE the hit, folded into the hit's coefficient by late
        // binding (no consume; the seal survives).
        let scaleBinding: { stacksVar: string; rateExpr: ResolvedScalarExpression } | undefined
        if (op.scaleBuff !== undefined) {
          const stacksVar = this.nextVar('sstacks', ctx)
          const scopeSourceId =
            op.scaleBuff.scope !== 'any' ? ctx.input.sourceId : undefined
          instanceSteps.push({
            kind: 'read',
            query: {
              query: 'buff_stacks',
              targetId,
              definitionId: op.scaleBuff.definitionId,
              ...(scopeSourceId !== undefined ? { sourceId: scopeSourceId } : {}),
            },
            into: stacksVar,
          })
          const rateResult = this.fold(op.scaleBuff.damagePerStack, ctx, scope)
          scaleBinding = {
            stacksVar,
            rateExpr: 'folded' in rateResult ? rateResult.folded : rateResult.late,
          }
        }
        const hit = this.buildHitStep(op, instances, targetId, ctx, scope, scaleBinding)
        instanceSteps.push(hit.step)
        // M4 -- register for target_hit_landed gates (per-target
        // landed-hit consequence parity).
        const registered = ctx.hitOpIdsByTarget.get(targetId) ?? []
        registered.push(...hit.hitOpIds)
        ctx.hitOpIdsByTarget.set(targetId, registered)

        // healPercentOfDamage -- per-hit leech, gated on hpDamage > 0.
        // ops_result_sum reads the fired arm's hpDamage (execute-branched
        // hits mint one op per arm; the un-taken arm contributes 0).
        if (op.healPercentOfDamage !== undefined) {
          const hpdVar = this.nextVar('hpd', ctx)
          instanceSteps.push({
            kind: 'read',
            query: {
              query: 'ops_result_sum',
              operationIds: hit.hitOpIds,
              field: 'hpDamage',
            },
            into: hpdVar,
          })
          const amountResult = this.fold(op.healPercentOfDamage, ctx, scope)
          const amountExpr: ResolvedScalarExpression =
            'folded' in amountResult
              ? { op: 'multiply', values: [{ query: 'var', name: hpdVar }, amountResult.folded] }
              : { op: 'multiply', values: [{ query: 'var', name: hpdVar }, amountResult.late] }
          instanceSteps.push({
            kind: 'branch',
            condition: { kind: 'var', name: hpdVar, op: 'gt', value: 0 },
            then: [
              this.operationStep(
                {
                  type: 'heal',
                  payload: { targetId: ctx.input.sourceId, amount: 0 },
                },
                ctx,
                [{ field: 'amount', expr: amountExpr }],
              ),
            ],
          })
        }

        // Landed-gated consume lanes -- PER LANDED HIT (TBS :2086-2134
        // parity: the consume sits inside the hit's landed branch, ahead
        // of procs/ailments; the first landed instance consumes
        // everything and later reads see 0).
        if (op.consumeBuff !== undefined || op.consumeWard !== undefined) {
          const consumeLandedVar = this.nextVar('clanded', ctx)
          instanceSteps.push({
            kind: 'read',
            query: { query: 'ops_landed_any', operationIds: hit.hitOpIds },
            into: consumeLandedVar,
          })
          const consumeThen: ResolvedSkillPlanStep[] = []
          if (op.consumeBuff !== undefined) {
            consumeThen.push(
              ...this.compileConsumeBuff(op.consumeBuff, targetId, ctx, scope),
            )
          }
          if (op.consumeWard !== undefined) {
            consumeThen.push(
              ...this.compileConsumeWard(op.consumeWard, targetId, ctx, scope),
            )
          }
          instanceSteps.push({
            kind: 'branch',
            condition: { kind: 'var', name: consumeLandedVar, op: 'gte', value: 1 },
            then: consumeThen,
          })
        }

        // Per-landed-hit consequence gate -- ALWAYS emitted (the stamped
        // gate is the executor's orchestration seam: procs/reactive
        // enter on gate-entered, taken windows/refresh/sweep on
        // gate-exited). onLanded ops compile bound to this hit's target.
        const consequenceVar = this.nextVar('clgate', ctx)
        instanceSteps.push({
          kind: 'read',
          query: { query: 'ops_landed_any', operationIds: hit.hitOpIds },
          into: consequenceVar,
        })
        const consequenceThen: ResolvedSkillPlanStep[] =
          op.onLanded !== undefined && op.onLanded.length > 0
            ? this.translateOps(op.onLanded, ctx, { loopTargetId: targetId })
            : []
        instanceSteps.push({
          kind: 'branch',
          condition: { kind: 'var', name: consequenceVar, op: 'gte', value: 1 },
          then: consequenceThen,
          gate: { hitOperationIds: hit.hitOpIds, targetId },
        })

        // T3-22b parity -- legacy breaks the instance loop on
        // `!actor.alive || !target.alive`: a kill mid-lane stops every
        // remaining instance (nested alive checks; the source check
        // also gates every later target's lane).
        targetSteps.push({
          kind: 'branch',
          condition: { kind: 'target_alive', targetId: ctx.input.sourceId },
          then: [
            {
              kind: 'branch',
              condition: { kind: 'target_alive', targetId },
              then: instanceSteps,
            },
          ],
        })
      }
      steps.push(...targetSteps)
    }
    return steps
  }

  /** One instance hit -- the execute modifier compiles to a
      branch{hp_percent_below} folding damageMultiplier into the
      coefficient (authored damage intent), policies ride the payload.
      Returns the step plus every candidate hit opId (execute-branched
      hits mint one op per arm; only the taken arm produces a result). */
  private buildHitStep(
    op: Extract<AuthoredSkillOperation, { type: 'deal_damage' }>,
    instances: SkillInstances | undefined,
    targetId: CombatEntityId,
    ctx: TranslateContext,
    scope: ResolveScope,
    scaleBinding?: { stacksVar: string; rateExpr: ResolvedScalarExpression },
  ): { step: ResolvedSkillPlanStep; hitOpIds: CombatOperationId[] } {
    const each = instances?.each

    const scale = ctx.input.coefficientScale ?? 1
    const theBurned = ctx.snapshot.resourcesConsumed.the ?? 0
    const theScale =
      ctx.effective.theScaling !== undefined
        ? 1 + (theBurned / 100) * ctx.effective.theScaling.coeff
        : 1
    const coefficientScale = scale * theScale

    const makePayload = (
      multiplier: number,
      late: ResolvedLateBinding[],
    ): DealDamageOperation['payload'] => {
      const coeffResult = this.fold(op.coefficient ?? 1, ctx, scope)
      let coefficient: number
      if (scaleBinding !== undefined) {
        // scaleBuff -- (authored coefficient + live stacks x rate) is
        // ALWAYS a late binding: the read var exists only at EXECUTE.
        const baseExpr: ResolvedScalarExpression =
          'folded' in coeffResult ? coeffResult.folded : coeffResult.late
        late.push({
          field: 'coefficient',
          expr: {
            op: 'multiply',
            values: [
              {
                op: 'add',
                values: [
                  baseExpr,
                  {
                    op: 'multiply',
                    values: [
                      { query: 'var', name: scaleBinding.stacksVar },
                      scaleBinding.rateExpr,
                    ],
                  },
                ],
              },
              coefficientScale * multiplier,
            ],
          },
        })
        coefficient = 0
      } else if ('folded' in coeffResult) {
        coefficient = coeffResult.folded * coefficientScale * multiplier
      } else {
        late.push({
          field: 'coefficient',
          expr: {
            op: 'multiply',
            values: [coeffResult.late, coefficientScale * multiplier],
          },
        })
        coefficient = 0
      }
      const hitPolicy = this.hitPolicyFor(op, each)
      const critPolicy = this.critPolicyFor(op, each)
      const armorPolicy = this.armorPolicyFor(op, each)
      const element = this.damageElement(op)
      const components = this.damageComponents(op)
      return {
        targetId,
        ...(element !== undefined ? { element } : {}),
        damageProfile: 'skill_hit',
        coefficient,
        hitCount: op.hitCount ?? 1,
        canCrit: op.canCrit ?? true,
        canMiss: op.canMiss ?? true,
        ...(hitPolicy !== undefined ? { hitPolicy } : {}),
        ...(critPolicy !== undefined ? { critPolicy } : {}),
        ...(armorPolicy !== undefined ? { armorPolicy } : {}),
        ...(components !== undefined ? { components } : {}),
        ...(op.scaling !== undefined ? { scaling: op.scaling } : {}),
        ...(op.missingHpBonusPerMissingPercent !== undefined
          ? { missingHpBonusPerMissingPercent: op.missingHpBonusPerMissingPercent }
          : {}),
        ...(op.missingHpBonusCap !== undefined
          ? { missingHpBonusCap: op.missingHpBonusCap }
          : {}),
        snapshot: ctx.snapshot.statScalars,
      }
    }

    if (each?.execute !== undefined) {
      const threshold = this.foldRequired(
        each.execute.hpPercentBelow,
        ctx,
        scope,
        'instances.each.execute.hpPercentBelow',
      )
      const thenLate: ResolvedLateBinding[] = []
      const elseLate: ResolvedLateBinding[] = []
      const thenStep = this.operationStep(
        { type: 'deal_damage', payload: makePayload(each.execute.damageMultiplier, thenLate) },
        ctx,
        thenLate,
      )
      const elseStep = this.operationStep(
        { type: 'deal_damage', payload: makePayload(1, elseLate) },
        ctx,
        elseLate,
      )
      return {
        step: {
          kind: 'branch',
          condition: { kind: 'hp_percent_below', targetId, threshold },
          then: [thenStep],
          else: [elseStep],
        },
        hitOpIds: [thenStep.operation.operationId, elseStep.operation.operationId],
      }
    }

    const late: ResolvedLateBinding[] = []
    const step = this.operationStep(
      { type: 'deal_damage', payload: makePayload(1, late) },
      ctx,
      late,
    )
    return {
      step,
      hitOpIds: [step.operation.operationId],
    }
  }

  private damageElement(
    op: Extract<AuthoredSkillOperation, { type: 'deal_damage' }>,
  ): DealDamageOperation['payload']['element'] | undefined {
    // `element` is the pure-physical shorthand only -- elemental and
    // primordial lanes always ride `components` (SkillDamageComponent
    // carries kind:'element'/'primordial'; the union stays adapter-total).
    if (op.components !== undefined && op.components.length > 0) {
      return undefined
    }
    if (op.damageType === 'physical') return 'physical'
    return undefined
  }

  /** damageType:'primordial' compiles to an all-primordial component lane;
      authored components carry verbatim. */
  private damageComponents(
    op: Extract<AuthoredSkillOperation, { type: 'deal_damage' }>,
  ): readonly SkillDamageComponent[] | undefined {
    if (op.components !== undefined && op.components.length > 0) {
      return op.components
    }
    if (op.damageType === 'primordial') {
      return [{ kind: 'primordial', ratio: 1 }]
    }
    return undefined
  }

  private hitPolicyFor(
    op: Extract<AuthoredSkillOperation, { type: 'deal_damage' }>,
    each: SkillInstances['each'],
  ): { guaranteedHit?: boolean } | undefined {
    const guaranteed = each?.guaranteedHit ?? op.hitPolicy?.guaranteedHit
    return guaranteed !== undefined ? { guaranteedHit: guaranteed } : op.hitPolicy
  }

  private critPolicyFor(
    op: Extract<AuthoredSkillOperation, { type: 'deal_damage' }>,
    each: SkillInstances['each'],
  ): { bonusChance?: number } | undefined {
    const bonusChance = each?.critChance ?? op.critPolicy?.bonusChance
    return bonusChance !== undefined ? { bonusChance } : op.critPolicy
  }

  private armorPolicyFor(
    op: Extract<AuthoredSkillOperation, { type: 'deal_damage' }>,
    each: SkillInstances['each'],
  ): { bypassChance?: number; pierceFractionOnFail?: number } | undefined {
    if (each?.armorPierce !== undefined) {
      return {
        bypassChance: each.armorPierce.bypassChance,
        pierceFractionOnFail: each.armorPierce.pierceFraction,
      }
    }
    return op.armorPolicy
  }

  /** consumeBuff -- read summed stacks -> legacy_flat damage scaled by
      stacks -> per-instance consume('all') (TBS :2086-2125 parity). */
  private compileConsumeBuff(
    consume: NonNullable<
      Extract<AuthoredSkillOperation, { type: 'deal_damage' }>['consumeBuff']
    >,
    targetId: CombatEntityId,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    const steps: ResolvedSkillPlanStep[] = []
    const stacksVar = this.nextVar('stacks', ctx)
    const scopeSourceId =
      consume.scope === 'own' || consume.scope === undefined
        ? ctx.input.sourceId
        : undefined
    steps.push({
      kind: 'read',
      query: {
        query: 'buff_stacks',
        targetId,
        definitionId: consume.definitionId,
        ...(scopeSourceId !== undefined ? { sourceId: scopeSourceId } : {}),
      },
      into: stacksVar,
    })

    const rateResult = this.fold(consume.damagePerStack, ctx, scope)
    const coefficientExpr: ResolvedScalarExpression =
      'folded' in rateResult
        ? {
            op: 'multiply',
            values: [{ query: 'var', name: stacksVar }, rateResult.folded],
          }
        : {
            op: 'multiply',
            values: [{ query: 'var', name: stacksVar }, rateResult.late],
          }

    const flatStep = this.operationStep(
      {
        type: 'deal_damage',
        payload: {
          targetId,
          damageProfile: 'legacy_flat',
          coefficient: 0,
          hitCount: 1,
          canCrit: false,
          canMiss: false,
        },
      },
      ctx,
      [{ field: 'coefficient', expr: coefficientExpr }],
    )
    const damageThen: ResolvedSkillPlanStep[] = [
      flatStep,
      {
        kind: 'for_each_instance',
        filter: {
          targetId,
          definitionId: consume.definitionId,
          ...(scopeSourceId !== undefined ? { sourceId: scopeSourceId } : {}),
        },
        operation: {
          type: 'consume_buff_stacks',
          payload: {
            // bound per-instance at EXECUTE
            selector: { kind: 'instance', instanceId: '' },
            stacks: 'all',
            removalReason: 'consumed',
          },
          operationId: this.mintOperationId(ctx),
          origin: this.origin(ctx),
        },
      },
    ]

    // consumeBuff.healPercentOfDamage -- caster leech on the consume
    // damage (read the flat op's hpDamage, heal self x pct).
    if (consume.healPercentOfDamage !== undefined) {
      const hpdVar = this.nextVar('chpd', ctx)
      damageThen.push(
        {
          kind: 'read',
          query: {
            query: 'op_result',
            operationId: flatStep.operation.operationId,
            field: 'hpDamage',
          },
          into: hpdVar,
        },
        {
          kind: 'branch',
          condition: { kind: 'var', name: hpdVar, op: 'gt', value: 0 },
          then: [
            this.operationStep(
              {
                type: 'heal',
                payload: { targetId: ctx.input.sourceId, amount: 0 },
              },
              ctx,
              [
                {
                  field: 'amount',
                  expr: {
                    op: 'multiply',
                    values: [
                      { query: 'var', name: hpdVar },
                      consume.healPercentOfDamage,
                    ],
                  },
                },
              ],
            ),
          ],
        },
      )
    }

    steps.push({
      kind: 'branch',
      condition: { kind: 'var', name: stacksVar, op: 'gt', value: 0 },
      then: damageThen,
    })
    return steps
  }

  /** consumeWard -- read ward -> legacy_flat damage -> spend all ward
      (TBS :2127-2135 parity: damage first, then spend). */
  private compileConsumeWard(
    consume: NonNullable<
      Extract<AuthoredSkillOperation, { type: 'deal_damage' }>['consumeWard']
    >,
    targetId: CombatEntityId,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    const steps: ResolvedSkillPlanStep[] = []
    const wardVar = this.nextVar('ward', ctx)
    steps.push({
      kind: 'read',
      query: {
        query: 'resource_current',
        targetId: ctx.input.sourceId,
        resourceId: 'ward',
      },
      into: wardVar,
    })

    const rateResult = this.fold(consume.damagePerWardPoint, ctx, scope)
    const coefficientExpr: ResolvedScalarExpression =
      'folded' in rateResult
        ? {
            op: 'multiply',
            values: [{ query: 'var', name: wardVar }, rateResult.folded],
          }
        : {
            op: 'multiply',
            values: [{ query: 'var', name: wardVar }, rateResult.late],
          }

    steps.push({
      kind: 'branch',
      condition: { kind: 'var', name: wardVar, op: 'gt', value: 0 },
      then: [
        this.operationStep(
          {
            type: 'deal_damage',
            payload: {
              targetId,
              damageProfile: 'legacy_flat',
              coefficient: 0,
              hitCount: 1,
              canCrit: false,
              canMiss: false,
            },
          },
          ctx,
          [{ field: 'coefficient', expr: coefficientExpr }],
        ),
        this.operationStep(
          {
            type: 'consume_resource',
            payload: {
              targetId: ctx.input.sourceId,
              resourceId: 'ward',
              amount: 'all',
            },
          },
          ctx,
        ),
      ],
    })
    return steps
  }

  // -----------------------------------------------------------------------
  // heal
  // -----------------------------------------------------------------------

  private translateHeal(
    op: Extract<AuthoredSkillOperation, { type: 'heal' }>,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    const steps: ResolvedSkillPlanStep[] = []
    for (const targetId of this.resolveIntentSet(op.target, ctx, scope)) {
      const late: ResolvedLateBinding[] = []
      let amount: number
      if (op.fractionOfPriorDamage !== undefined) {
        if (ctx.lastDamageOpId === undefined) {
          throw new SkillResolverError(
            `SkillResolver: heal.fractionOfPriorDamage on '${ctx.effective.id}' has no prior damage op`,
          )
        }
        const priorOpId = ctx.lastDamageOpId
        const dmgExpr: ResolvedScalarExpression = {
          query: 'op_result',
          operationId: priorOpId,
          field: 'hpDamage',
        }
        const scaled: ResolvedScalarExpression = {
          op: 'multiply',
          values: [dmgExpr, op.fractionOfPriorDamage.fraction],
        }
        const capped: ResolvedScalarExpression =
          op.fractionOfPriorDamage.capRatio !== undefined
            ? {
                op: 'min',
                values: [
                  scaled,
                  {
                    op: 'multiply',
                    values: [
                      { query: 'hp_max', targetId },
                      op.fractionOfPriorDamage.capRatio,
                    ],
                  },
                ],
              }
            : scaled
        late.push({ field: 'amount', expr: capped })
        amount = 0
      } else if (op.fractionOfMaxHp !== undefined) {
        late.push({
          field: 'amount',
          expr: {
            op: 'multiply',
            values: [
              { query: 'hp_max', targetId },
              op.fractionOfMaxHp,
            ],
          },
        })
        amount = 0
      } else {
        const result = this.fold(op.amount ?? 0, ctx, scope)
        if ('folded' in result) {
          amount = result.folded
        } else {
          late.push({ field: 'amount', expr: result.late })
          amount = 0
        }
      }
      steps.push(
        this.operationStep(
          { type: 'heal', payload: { targetId, amount } },
          ctx,
          late,
        ),
      )
    }
    return steps
  }

  // -----------------------------------------------------------------------
  // apply_buff
  // -----------------------------------------------------------------------

  private translateApplyBuff(
    op: Extract<AuthoredSkillOperation, { type: 'apply_buff' }>,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    const steps: ResolvedSkillPlanStep[] = []
    for (const targetId of this.resolveIntentSet(op.target, ctx, scope)) {
      const late: ResolvedLateBinding[] = []
      const stacks = this.bindScalar(op.stacks, 1, ctx, scope, late, 'stacks')
      const baseChance = this.bindScalar(
        op.chance,
        1,
        ctx,
        scope,
        late,
        'baseChance',
      )
      const durationOverride =
        op.durationOverride !== undefined
          ? this.bindScalar(
              op.durationOverride,
              0,
              ctx,
              scope,
              late,
              'durationOverride',
            )
          : undefined
      const step = this.operationStep(
        {
          type: 'apply_buff',
          payload: {
            definitionId: op.definitionId,
            targetId,
            stacks,
            baseChance,
            ...(durationOverride !== undefined ? { durationOverride } : {}),
            reactionEligibility: op.reactionEligibility ?? 'suppressed',
          },
          // Orchestration metadata rides the op (contract v1.6) --
          // the turn runtime replays the source-tagged externalWard
          // write at settle.
          ...(op.externalWardGrant !== undefined
            ? { externalWardGrant: op.externalWardGrant }
            : {}),
        },
        ctx,
        late,
      )
      ctx.applyOpIds.set(
        `${op.definitionId}::${targetId}`,
        step.operation.operationId,
      )
      steps.push(step)
    }
    return steps
  }

  /** Hoa An spec sec.11/36 -- an authored `gateOnApplyResult` op becomes
      an `on_apply_result` plan step per produced operation: bound to the
      most recent apply_buff for the SAME definition+target, materializing
      its selector to the returned instanceId only on applied:true. The
      gate needs a preceding apply in this resolve's translated
      sequence -- authoring one without it is a structural fault. */
  private gateOnApplyResult(
    op: AuthoredSkillOperation & { gateOnApplyResult?: boolean },
    steps: ResolvedSkillPlanStep[],
    ctx: TranslateContext,
  ): ResolvedSkillPlanStep[] {
    if (op.gateOnApplyResult !== true) return steps
    return steps.map((step) => {
      if (step.kind !== 'operation') return step
      const selector = (step.operation.payload as { selector?: BuffInstanceSelector })
        .selector
      const resultOperationId =
        selector !== undefined && selector.kind !== 'instance'
          ? ctx.applyOpIds.get(`${selector.definitionId}::${selector.targetId}`)
          : undefined
      if (resultOperationId === undefined) {
        throw new SkillResolverError(
          `SkillResolver: gateOnApplyResult on '${op.type}' has no preceding apply_buff for the same definition+target`,
        )
      }
      return {
        kind: 'on_apply_result' as const,
        resultOperationId,
        operation: step.operation,
        ...(step.late !== undefined ? { late: step.late } : {}),
      }
    })
  }

  // -----------------------------------------------------------------------
  // stacks / modifier / duration / periodic / remove / cleanse ops
  // -----------------------------------------------------------------------

  private translateStacksOp(
    op: Extract<
      AuthoredSkillOperation,
      { type: 'add_buff_stacks' | 'remove_buff_stacks' | 'consume_buff_stacks' }
    >,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    const steps: ResolvedSkillPlanStep[] = []
    for (const selector of this.resolveSelectorSet(op.selector, ctx, scope)) {
      const late: ResolvedLateBinding[] = []
      let stacks: number | 'all'
      if (op.stacks === 'all') {
        stacks = 'all'
      } else {
        const result = this.fold(op.stacks, ctx, scope)
        if ('folded' in result) {
          stacks = result.folded
        } else {
          late.push({ field: 'stacks', expr: result.late })
          stacks = 0
        }
      }
      const operation: CombatOperation =
        op.type === 'add_buff_stacks'
          ? { type: 'add_buff_stacks', payload: { selector, stacks: stacks as number } }
          : op.type === 'remove_buff_stacks'
            ? { type: 'remove_buff_stacks', payload: { selector, stacks: stacks as number } }
            : {
                type: 'consume_buff_stacks',
                payload: { selector, stacks, removalReason: 'consumed' },
              }
      steps.push(this.operationStep(operation, ctx, late))
    }
    return steps
  }

  private translateModifierOp(
    op: Extract<
      AuthoredSkillOperation,
      { type: 'add_buff_modifier' | 'remove_buff_modifier' }
    >,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    const steps: ResolvedSkillPlanStep[] = []
    for (const selector of this.resolveSelectorSet(op.selector, ctx, scope)) {
      const operation: CombatOperation =
        op.type === 'add_buff_modifier'
          ? {
              type: 'add_buff_modifier',
              payload: {
                selector,
                modifier: { ...op.modifier, appliedBy: ctx.input.sourceId },
              },
            }
          : {
              type: 'remove_buff_modifier',
              payload: { selector, modifierId: op.modifier.id },
            }
      steps.push(this.operationStep(operation, ctx))
    }
    return this.gateOnApplyResult(op, steps, ctx)
  }

  private translateDurationOp(
    op: Extract<
      AuthoredSkillOperation,
      { type: 'refresh_buff_duration' | 'extend_buff_duration' }
    >,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    const steps: ResolvedSkillPlanStep[] = []
    for (const selector of this.resolveSelectorSet(op.selector, ctx, scope)) {
      const operation: CombatOperation =
        op.type === 'refresh_buff_duration'
          ? {
              type: 'refresh_buff_duration',
              payload: {
                selector,
                ...(op.turns !== undefined ? { duration: op.turns } : {}),
              },
            }
          : {
              type: 'extend_buff_duration',
              payload: { selector, turns: op.turns ?? 1 },
            }
      steps.push(this.operationStep(operation, ctx))
    }
    return this.gateOnApplyResult(op, steps, ctx)
  }

  private translateTriggerPeriodic(
    op: Extract<AuthoredSkillOperation, { type: 'trigger_buff_periodic' }>,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    const steps: ResolvedSkillPlanStep[] = []
    for (const selector of this.resolveSelectorSet(op.selector, ctx, scope)) {
      steps.push(
        this.operationStep(
          {
            type: 'trigger_buff_periodic',
            payload: {
              selector,
              ...(op.periodicId !== undefined ? { periodicId: op.periodicId } : {}),
            },
          },
          ctx,
        ),
      )
    }
    return this.gateOnApplyResult(op, steps, ctx)
  }

  private translateRemoveBuff(
    op: Extract<AuthoredSkillOperation, { type: 'remove_buff' }>,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    const steps: ResolvedSkillPlanStep[] = []
    for (const selector of this.resolveSelectorSet(op.selector, ctx, scope)) {
      steps.push(
        this.operationStep(
          {
            type: 'remove_buff',
            payload: { selector, removalReason: op.reason ?? 'scripted' },
          },
          ctx,
        ),
      )
    }
    return steps
  }

  private translateCleanse(
    op: Extract<AuthoredSkillOperation, { type: 'cleanse' }>,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    const steps: ResolvedSkillPlanStep[] = []
    for (const targetId of this.resolveIntentSet(op.target, ctx, scope)) {
      const payload: CleanseBuffOperation['payload'] = {
        targetId,
        query: op.query,
        ...(op.limit !== undefined ? { limit: op.limit } : {}),
      }
      steps.push(
        this.operationStep({ type: 'cleanse_buff', payload }, ctx),
      )
    }
    return steps
  }

  // -----------------------------------------------------------------------
  // gauge / resource / shield / read ops
  // -----------------------------------------------------------------------

  private translatePushGauge(
    op: Extract<AuthoredSkillOperation, { type: 'push_gauge' }>,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    const steps: ResolvedSkillPlanStep[] = []
    for (const targetId of this.resolveIntentSet(op.target, ctx, scope)) {
      const late: ResolvedLateBinding[] = []
      const fractionOfMax = this.bindScalar(
        op.fractionOfMax,
        0,
        ctx,
        scope,
        late,
        'fractionOfMax',
      )
      steps.push(
        this.operationStep(
          { type: 'push_gauge', payload: { targetId, fractionOfMax } },
          ctx,
          late,
        ),
      )
    }
    return steps
  }

  private translateResourceOp(
    op: Extract<AuthoredSkillOperation, { type: 'gain_resource' | 'consume_resource' }>,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    const steps: ResolvedSkillPlanStep[] = []
    for (const targetId of this.resolveIntentSet(op.target, ctx, scope)) {
      const late: ResolvedLateBinding[] = []
      let operation: CombatOperation
      if (op.type === 'gain_resource') {
        // 'all' is consume-only in the contract (gain takes a concrete
        // number) -- a folded-or-late authored amount.
        if (op.amount === 'all') {
          throw new SkillResolverError(
            `SkillResolver: gain_resource amount 'all' is not a contract semantic on '${ctx.effective.id}'`,
          )
        }
        const result = this.fold(op.amount, ctx, scope)
        let amount = 0
        if ('folded' in result) {
          amount = result.folded
        } else {
          late.push({ field: 'amount', expr: result.late })
        }
        operation = {
          type: 'gain_resource',
          payload: { targetId, resourceId: op.resourceId, amount },
        }
      } else {
        let amount: number | 'all'
        if (op.amount === 'all') {
          amount = 'all'
        } else {
          const result = this.fold(op.amount, ctx, scope)
          if ('folded' in result) {
            amount = result.folded
          } else {
            late.push({ field: 'amount', expr: result.late })
            amount = 0
          }
        }
        operation = {
          type: 'consume_resource',
          payload: { targetId, resourceId: op.resourceId, amount },
        }
      }
      steps.push(this.operationStep(operation, ctx, late))
    }
    return steps
  }

  private translateApplyShield(
    op: Extract<AuthoredSkillOperation, { type: 'apply_shield' }>,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    const steps: ResolvedSkillPlanStep[] = []
    for (const targetId of this.resolveIntentSet(op.target, ctx, scope)) {
      const late: ResolvedLateBinding[] = []
      const amount = this.bindScalar(op.amount, 0, ctx, scope, late, 'amount')
      steps.push(
        this.operationStep(
          { type: 'apply_shield', payload: { targetId, amount } },
          ctx,
          late,
        ),
      )
    }
    return steps
  }

  private translateReadStacks(
    op: Extract<AuthoredSkillOperation, { type: 'read_stacks' }>,
    ctx: TranslateContext,
    scope: ResolveScope,
  ): ResolvedSkillPlanStep[] {
    const targetId = this.resolveIntentSingle(op.target, ctx, scope)
    return [
      {
        kind: 'read',
        query: {
          query: 'buff_stacks',
          targetId,
          definitionId: op.definitionId,
          ...(op.source !== undefined
            ? { sourceId: this.resolveIntentSingle(op.source, ctx, scope) }
            : {}),
        },
        into: op.into,
      },
    ]
  }
}

// ---------------------------------------------------------------------------
// TranslateContext -- per-resolve mutable translation state.
// ---------------------------------------------------------------------------

interface TranslateContext {
  input: SkillResolveInput
  effective: ActiveSkillDefinition
  snapshot: CastSnapshot
  opSeq: number
  readSeq: number
  lastDamageOpId: CombatOperationId | undefined
  /** hit-channel (skill_hit) opIds minted so far, grouped by targetId --
      the target_hit_landed gate's ops_landed_any binding (M4). */
  hitOpIdsByTarget: Map<CombatEntityId, CombatOperationId[]>
  /** Most recent apply_buff opId per 'definitionId::targetId' -- the
      on_apply_result gate's binding (Hoa An spec sec.11/36). */
  applyOpIds: Map<string, CombatOperationId>
}
