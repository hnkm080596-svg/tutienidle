// battle/turn/TurnSkillPlanRuntime.ts -- skilldef M4e: the plan
// pipeline's per-TBS runtime. Adapter-covered casts route
//   LegacySkillAdapter -> SkillResolver -> SkillExecutor -> scheduler
// and the resolveDeclaredHit consequence chain replays through
// SkillExecutionHooks slots:
//   hit op settled    -> defender income (+ landed: basic income;
//                        dodged: evade window + refresh + sweep)
//   landed gate in    -> on-hit procs + reactive follow-up trigger
//   gated ops         -> authored ailments/detonate (no events)
//   landed gate out   -> taken-side window + refresh + sweep
//
// Casts whose adaptation reports unsupported semantics cannot route
// (routeCast returns null): TBS reports them loudly once per cast and
// the cast resolves as a no-op on the plan lane -- nothing silently
// falls back to legacy. An insufficient-resource cast still routes and
// resolves blocked (R-S9 precheck: no commit, no ops). The
// `runtime === undefined` engine-unit lane is the only remaining
// legacy path -- a documented non-production test configuration.

import type {
  BuffDefinitionId,
  CombatEntityId,
  CombatOperationId,
  SkillId,
} from '../contracts/ids'
import type { CombatEntity } from '../../combat/CombatEntity'
import { MAX_THE } from '../../combat/CombatTypes'
import type { CombatOperationResult } from '../contracts/results'
import type { CombatRng } from '../contracts/rng'
import type { CombatScheduler } from '../runtime/scheduler/CombatScheduler'
import type { BuffDefinition, PeriodicDamageDefinition } from '../../buff2/BuffDefinition'
import type { BuffInstanceSnapshot } from '../../buff2/BuffInstance'
import type { BuffSystem } from '../../buff2/BuffSystem'
import { resolveChannel } from '../../buff2/BuffModifierEngine'

import type { AdaptedSkillCatalog } from '../../skilldef/LegacySkillAdapter'
import { adaptTurnSkillDefinition, mergeAdaptedCatalogs } from '../../skilldef/LegacySkillAdapter'
import type { ResolvedSkillPlan } from '../../skilldef/ResolvedSkillPlan'
import type { SkillCastCommitPort } from '../../skilldef/SkillCastCommitPort'
import type { SkillDefinitionRegistry as SkillDefinitionRegistryType } from '../../skilldef/SkillDefinitionRegistry'
import { SkillDefinitionRegistry } from '../../skilldef/SkillDefinitionRegistry'
import type { SkillExecutionHooks } from '../../skilldef/SkillExecutionHooks'
import type { SkillCastOutcome } from '../../skilldef/SkillExecutor'
import { SkillExecutor } from '../../skilldef/SkillExecutor'
import type { StatReadPort, SkillResolveEntityQuery } from '../../skilldef/CastSnapshot'
import type { SkillBuffInstanceSummary, SkillDetonatePeriodic, SkillQueryPorts } from '../../skilldef/SkillQueryPorts'
import type { SkillPreResolution, SkillResolveInput } from '../../skilldef/SkillResolver'
import { SkillResolver } from '../../skilldef/SkillResolver'

import type {
  TurnBattle,
  TurnBattleParticipant,
  TurnDeclaredAction,
} from './TurnBattleSystem'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { executionCommitsCast } from './TurnSkillAction'

// ---------------------------------------------------------------------------
// Orchestration surface -- TBS implements these over its private helpers.
// Every method that needs roster access takes `battle` explicitly (the
// system has no this.battle field -- battles flow through as arguments).
// ---------------------------------------------------------------------------

export interface TurnSkillPlanOrchestration {
  participant(battle: TurnBattle, id: string): TurnBattleParticipant | undefined
  /** opposing side for the source -- declared.affected was collected at
      declare; intent resolution re-reads the roster at execute. */
  enemiesOf(battle: TurnBattle, sourceId: string): readonly TurnBattleParticipant[]
  alliesOf(battle: TurnBattle, sourceId: string): readonly TurnBattleParticipant[]
  /** commitAction minus the resource consume + consume-all burn (both
      ride consume_resource ops): slot cooldown + the cast sink only. */
  commitShell(actor: TurnBattleParticipant, declared: TurnDeclaredAction): void
  /** Defender income -- fires for landed AND dodged hits. */
  grantHitOutcomeIncome(
    battle: TurnBattle,
    target: TurnBattleParticipant,
    hit: { dodged: boolean; hpDamage: number },
  ): void
  /** Actor's own basic landed income (ung_the marker field). */
  grantBasicLandedIncome(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    skillId: string | undefined,
  ): void
  /** procs.onHitLanded + the target's onImpactLanded reactive trigger
      (hpDamage>0 gate lives inside) + the queuedFollowUps push. */
  runLandedHitProcs(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    target: TurnBattleParticipant,
    hpDamage: number,
  ): void
  /** Taken-side reactive window -- gated inside on hpDamage>0 and a
      natural actionSource (INV-9). */
  resolveTakenWindow(
    battle: TurnBattle,
    target: TurnBattleParticipant,
    actor: TurnBattleParticipant,
    declared: TurnDeclaredAction,
    hpDamage: number,
  ): void
  resolveEvadeWindow(
    battle: TurnBattle,
    target: TurnBattleParticipant,
    actor: TurnBattleParticipant,
    declared: TurnDeclaredAction,
  ): void
  /** son_nhac externalWard grant -- the source-tagged REPLACE write the
      retired applyDeclaredBuff owned (`target.externalWard =
      {sourceId, amount: max(0, source.stats.maxHp * ratio)}`; exempt
      from wardMax, existence-bound to the applied marker instance). */
  grantExternalWard(
    battle: TurnBattle,
    sourceId: string,
    targetId: string,
    sourceMaxHpRatio: number,
  ): void
  refreshStats(participant: TurnBattleParticipant): void
  sweepBuffDeaths(battle: TurnBattle): void
  /** TBS occurrence ordinal -- mints inside castId/rootActionId so the
      scheduler's global operationId uniqueness never collides with
      other lanes. */
  mintOccurrence(): number
}

export interface TurnSkillPlanRoutedCast {
  outcome: SkillCastOutcome
  /** Deduped first-landed order -- the legacy targetIds/landedTargets
      bookkeeping for the Tro window + the return value. */
  landedTargetIds: readonly string[]
  landedTargets: readonly TurnBattleParticipant[]
  /** apply_buff ops that resolved on affected targets -- the
      non-damaging lane's unconditional push (deduped, settle order). */
  appliedTargetIds: readonly string[]
}

export class TurnSkillPlanRuntimeError extends Error {}

// ---------------------------------------------------------------------------
// Per-cast session state -- the hook impl accumulates the bookkeeping the
// applyActionImpact return value + ally window need.
// ---------------------------------------------------------------------------

interface PlanCastSession {
  landedTargetIds: string[]
  landedTargets: TurnBattleParticipant[]
  /** apply_buff targets whose op resolved -- the non-damaging lane's
      unconditional alive-target push (a dead target's apply op skips;
      a resolved one means the target was alive at settle). */
  appliedTargetIds: string[]
  /** Settled hit-channel ops (landed OR dodged) -- the extras lane's
      `hitCount` (one resolveDeclaredHit call per instance iteration). */
  hitCount: number
  seenTargets: Set<string>
  seenApplied: Set<string>
  affectedIds: Set<string>
  /** Every resolved op's targetId -- hits (landed or dodged), buffs,
      consumes, detonates, cleanses, heals. Feeds the plan-boundary stat
      refresh: legacy refreshes only participants the action touched,
      never a suppressed/never-ran lane's target. */
  touchedTargetIds: Set<string>
}

export class TurnSkillPlanRuntime {
  /** legacy def OBJECT -> adapted catalog. Keyed on identity, not def
      id: same-id defs with different fields exist (applyAnKitToBasic
      attaches compositePicks/multicast to one participant's copy), and
      an id-keyed cache would silently run the wrong adapted shape. */
  private readonly adapted = new WeakMap<TurnSkillDefinition, AdaptedSkillCatalog>()
  /** Registry-rebuild input -- WeakMap has no iteration. */
  private readonly catalogs: AdaptedSkillCatalog[] = []
  private registry: SkillDefinitionRegistryType
  private resolver: SkillResolver

  constructor(
    private readonly deps: {
      rng: CombatRng
      buffs: BuffSystem
      scheduler: CombatScheduler
      isBuffDefinitionId(id: BuffDefinitionId): boolean
      buffDefinition(id: BuffDefinitionId): BuffDefinition | undefined
      orchestration: TurnSkillPlanOrchestration
    },
  ) {
    this.registry = new SkillDefinitionRegistry([], {
      isBuffDefinitionId: deps.isBuffDefinitionId,
    })
    this.resolver = new SkillResolver(this.registry, deps.rng)
  }

  /** Executes the cast through the plan pipeline, or returns null when
      the cast cannot route (null skill or unsupported adaptation
      semantics -- TBS reports the unrouted cast loudly; see header). */
  routeCast(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    declared: TurnDeclaredAction,
  ): TurnSkillPlanRoutedCast | null {
    // Charge-resolve turn (isCharging && chargeResolved): the deferred
    // cast resolves NOW from the slot's charged def -- verbatim (legacy
    // used the slot root, never the init's payload resolution) and
    // non-committing (the cast committed at charge-init).
    const chargeResolveDef =
      declared.isCharging && declared.chargeResolved
        ? declared.chargedSkill
        : undefined
    const rootDef = chargeResolveDef ?? declared.action?.skill
    if (rootDef == null) return null

    const catalog = this.catalogFor(rootDef)
    if (catalog.unsupported.length > 0) return null

    const commitsCast =
      chargeResolveDef === undefined && executionCommitsCast(declared.execution)

    const tbs = this.deps.orchestration
    const execution = declared.execution
    const payloadDef = execution?.resolvedSkill ?? rootDef

    // Declare-side replay: TBS already swapped the empowered payload /
    // rolled the composite pool to feed targeting; the plan executes
    // THAT resolution (never re-rolls). 'original' casts carry no
    // resolution -- the resolver runs its own.
    const preResolved: SkillPreResolution | undefined =
      payloadDef.id !== rootDef.id
        ? {
            effectiveSkillId: payloadDef.id as SkillId,
            ...(declared.compositePickedSkills != null &&
            declared.compositePickedSkills.length > 0
              ? {
                  extraSkillIds: declared.compositePickedSkills.map(
                    (def) => def.id as SkillId,
                  ),
                }
              : {}),
            ...(execution?.source === 'empowered'
              ? { resolvedVariantId: payloadDef.id as SkillId }
              : {}),
            ...(execution?.theBurned !== undefined
              ? { theBurned: execution.theBurned }
              : {}),
          }
        : undefined

    // Charge-init: the cast COMMITS through the plan seam and defers
    // every step + grant to the charge-resolve execution (TBS 9.5 #9
    // parity -- the commit lands at init, never re-commits at resolve).
    // A non-committing charge execution (repeat/multicast follow-up)
    // resolves immediately like any non-committing cast.
    const chargeInit =
      commitsCast && (rootDef.chargeTurns ?? 0) > 0

    const session = this.newSession(declared)
    const executor = this.buildExecutor(battle, actor, declared, session)

    const input: SkillResolveInput = {
      definition: catalog.root,
      sourceId: actor.entity.id as CombatEntityId,
      declaredTargetIds: declared.affected.map(
        (p) => p.entity.id as CombatEntityId,
      ),
      progression: this.progressionStub(actor, rootDef.progressionOwnerId ?? rootDef.id, catalog.root.id),
      sourceStats: this.statPort(battle),
      entityQuery: this.entityQuery(battle),
      castId: `cast.${battle.totalTurnsElapsed}.${actor.id}.${tbs.mintOccurrence()}`,
      rootActionId: `action.${battle.totalTurnsElapsed}.${actor.id}.${tbs.mintOccurrence()}`,
      subcastIndex: 0,
      ...(declared.suddenDeathMultiplier !== 1
        ? { coefficientScale: declared.suddenDeathMultiplier }
        : {}),
      ...(chargeResolveDef !== undefined ? { payloadOnly: true } : {}),
      ...(chargeInit ? { chargeInit: true } : {}),
      commitsCast,
      // TBS drives repeats/multicast through its own queuedExecutions
      // lane (target re-collection, intercept windows, drain order);
      // composite extras still expand inline inside the plan.
      driveFollowUps: false,
      ...(preResolved !== undefined ? { preResolved } : {}),
    }

    const plan = this.resolver.resolve(input)
    const outcome = executor.execute(plan, input)

    return {
      outcome,
      landedTargetIds: session.landedTargetIds,
      landedTargets: session.landedTargets,
      appliedTargetIds: session.appliedTargetIds,
    }
  }

  /** Provider-returned extra impact (dynamicBasic onCastResolved --
      Kiem Tu combo payloads / Ngu Kiem Dao cascade extras). The def
      resolves VERBATIM as a non-committing plan: extras are inline
      lanes of the parent cast -- no commit, no cost, no cooldown --
      and TBS owns their target collection (taunt/opposingSide reads
      live at execute). Returns the extras-lane bookkeeping (deduped
      landed ids + per-instance hitCount), or null when the def is
      adapter-unsupported so the caller reports it and skips the
      extra -- a loud no-op on runtime battles, never a silent
      legacy fallback. */
  routeExtraCast(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    declared: TurnDeclaredAction,
    extraDef: TurnSkillDefinition,
    extraTargets: readonly TurnBattleParticipant[],
  ): { landedTargetIds: readonly string[]; hitCount: number } | null {
    const catalog = this.catalogFor(extraDef)
    if (catalog.unsupported.length > 0) return null

    const tbs = this.deps.orchestration
    const session = this.newSession(declared, extraTargets)
    const executor = this.buildExecutor(battle, actor, declared, session)

    const input: SkillResolveInput = {
      definition: catalog.root,
      sourceId: actor.entity.id as CombatEntityId,
      declaredTargetIds: extraTargets.map(
        (p) => p.entity.id as CombatEntityId,
      ),
      progression: this.progressionStub(actor, extraDef.progressionOwnerId ?? extraDef.id, catalog.root.id),
      sourceStats: this.statPort(battle),
      entityQuery: this.entityQuery(battle),
      castId: `cast.extra.${battle.totalTurnsElapsed}.${actor.id}.${tbs.mintOccurrence()}`,
      rootActionId: `action.extra.${battle.totalTurnsElapsed}.${actor.id}.${tbs.mintOccurrence()}`,
      subcastIndex: 0,
      ...(declared.suddenDeathMultiplier !== 1
        ? { coefficientScale: declared.suddenDeathMultiplier }
        : {}),
      // Verbatim like the legacy extras lane -- the def's own fields,
      // no empowerment swap / composite re-roll / subcast driving.
      payloadOnly: true,
      commitsCast: false,
      driveFollowUps: false,
    }

    const plan = this.resolver.resolve(input)
    executor.execute(plan, input)

    return {
      landedTargetIds: session.landedTargetIds,
      hitCount: session.hitCount,
    }
  }

  /** The adapter's unsupported-semantics report for a def -- feeds the
      caller's loud no-op when a runtime-present cast cannot route
      (empty list for adapter-covered defs). */
  unsupportedFor(def: TurnSkillDefinition): readonly string[] {
    return this.catalogFor(def).unsupported
  }

  private newSession(
    declared: TurnDeclaredAction,
    affected: readonly TurnBattleParticipant[] = declared.affected,
  ): PlanCastSession {
    return {
      landedTargetIds: [],
      landedTargets: [],
      appliedTargetIds: [],
      hitCount: 0,
      seenTargets: new Set(),
      seenApplied: new Set(),
      affectedIds: new Set(affected.map((p) => p.id)),
      touchedTargetIds: new Set(),
    }
  }

  /** Battle-snapshotted progression stub -- CombatEntity.skillLevels is
      the only progression read (`level`), projected from the canonical
      Core Node authority (M-QI-05). Internal/generated actions pass
      `progressionOwnerId` as levelKey so they inherit the parent Core
      level rather than falling back to 1 on their own id. */
  private progressionStub(
    actor: TurnBattleParticipant,
    levelKey: string,
    skillId: SkillId,
  ): SkillResolveInput['progression'] {
    return {
      skillId,
      level: actor.entity.skillLevels?.[levelKey] ?? 1,
      experience: 0,
      totalExperience: 0,
    }
  }

  private buildExecutor(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    declared: TurnDeclaredAction,
    session: PlanCastSession,
  ): SkillExecutor {
    const tbs = this.deps.orchestration
    const queries = this.buildQueries(battle)
    const hooks = this.buildHooks(battle, declared, session, queries)
    const commitPort: SkillCastCommitPort = {
      commit: () => tbs.commitShell(actor, declared),
    }
    return new SkillExecutor(
      this.deps.scheduler,
      this.resolver,
      this.registry,
      queries,
      commitPort,
      this.deps.rng,
      hooks,
    )
  }

  // -----------------------------------------------------------------------
  // Adaptation -- cached per legacy def id; auxiliaries (composite pool
  // members, empowered forms) register with the root. A registry-build
  // fault (e.g. a drifted buff id the legacy lane used to skip per-op)
  // reports unsupported so the cast is declined -- TBS reports it
  // loudly and the cast no-ops; nothing fails silently.
  // -----------------------------------------------------------------------

  private catalogFor(def: TurnSkillDefinition): AdaptedSkillCatalog {
    const cached = this.adapted.get(def)
    if (cached !== undefined) return cached

    let catalog = adaptTurnSkillDefinition(def)
    if (catalog.unsupported.length === 0) {
      try {
        const registry = new SkillDefinitionRegistry(
          mergeAdaptedCatalogs([...this.catalogs, catalog]),
          { isBuffDefinitionId: this.deps.isBuffDefinitionId },
        )
        this.registry = registry
        this.resolver = new SkillResolver(registry, this.deps.rng)
        // Only registry-admitted catalogs participate in later rebuilds
        // -- an unsupported catalog's defs never validated and could
        // fault the next construction for an unrelated def.
        this.catalogs.push(catalog)
      } catch {
        catalog = {
          ...catalog,
          unsupported: [
            ...catalog.unsupported,
            `skilldef registry rejected '${def.id}' (a referenced buff/resource id is not resolvable)`,
          ],
        }
      }
    }
    this.adapted.set(def, catalog)
    return catalog
  }

  // -----------------------------------------------------------------------
  // Execution hooks -- the resolveDeclaredHit consequence replay. Op
  // results distinguish hit-channel ops (skill_hit reports landed/crit)
  // from flat/dot lanes (landed stays undefined).
  // -----------------------------------------------------------------------

  private buildHooks(
    battle: TurnBattle,
    declared: TurnDeclaredAction,
    session: PlanCastSession,
    queries: SkillQueryPorts,
  ): SkillExecutionHooks {
    const tbs = this.deps.orchestration
    const sumHpDamage = (ids: readonly CombatOperationId[]): number =>
      ids.reduce((sum, id) => {
        const result = queries.opResults.lastOpResult(id)
        return (
          sum +
          (result?.type === 'deal_damage' ? (result.damage?.hpDamage ?? 0) : 0)
        )
      }, 0)

    return {
      onOperationSettled: (operation, result, plan) => {
        if (result.status === 'resolved') {
          const opTarget = (operation.payload as { targetId?: string })
            .targetId
          if (opTarget !== undefined) {
            session.touchedTargetIds.add(opTarget)
            // Non-damaging lane parity (the else-branch in
            // applyActionImpact): every affected target that was ALIVE
            // when its op settled is pushed unconditionally -- any op
            // type counts (buffs, ailments, detonates, cleanses); a
            // skipped op means the target was dead at settle.
            if (
              session.affectedIds.has(opTarget) &&
              !session.seenApplied.has(opTarget)
            ) {
              session.seenApplied.add(opTarget)
              session.appliedTargetIds.push(opTarget)
            }
            // son_nhac externalWard (applyDeclaredBuff parity): the
            // marker settled -- replay the source-tagged REPLACE write.
            // The pool is existence-bound to that marker instance via
            // reconcileExternalWard at the refresh seam.
            if (
              operation.type === 'apply_buff' &&
              operation.externalWardGrant !== undefined
            ) {
              tbs.grantExternalWard(
                battle,
                plan.sourceId,
                opTarget,
                operation.externalWardGrant.sourceMaxHpRatio,
              )
            }
          }
        }
        if (result.type !== 'deal_damage' ||
          result.damage?.landed === undefined
        ) {
          return
        }
        // Hit-channel op resolved (landed or dodged) -- the extras
        // lane's per-instance hitCount.
        session.hitCount += 1
        const targetId = (operation.payload as { targetId?: string })
          .targetId
        const target =
          targetId === undefined
            ? undefined
            : tbs.participant(battle, targetId)
        const source = tbs.participant(battle, plan.sourceId)
        if (target === undefined || source === undefined) return

        const dodged = result.damage.landed === false
        // Defender income lands BEFORE any window the hit opens (spec
        // 4.1 ordering lock) -- dodged hits included.
        tbs.grantHitOutcomeIncome(battle, target, {
          dodged,
          hpDamage: result.damage.hpDamage,
        })

        if (dodged) {
          // Legacy dodge branch + the shared tail (refresh, sweep).
          tbs.resolveEvadeWindow(battle, target, source, declared)
          tbs.refreshStats(target)
          tbs.refreshStats(source)
          tbs.sweepBuffDeaths(battle)
          return
        }

        // Landed -- basic income; leech/consume ride authored ops
        // before the gate; procs/reactive wait for gate-entered.
        tbs.grantBasicLandedIncome(battle, source, this.payloadId(plan))
        if (!session.seenTargets.has(target.id)) {
          session.seenTargets.add(target.id)
          session.landedTargetIds.push(target.id)
          session.landedTargets.push(target)
        }
      },

      onLandedGateEntered: (gate, plan) => {
        const source = tbs.participant(battle, plan.sourceId)
        const target = tbs.participant(battle, gate.targetId)
        if (source === undefined || target === undefined) return
        // Legacy slot: after consume ops, before authored ailments.
        tbs.runLandedHitProcs(
          battle,
          source,
          target,
          sumHpDamage(gate.hitOperationIds),
        )
      },

      onLandedGateExited: (gate, plan) => {
        const source = tbs.participant(battle, plan.sourceId)
        const target = tbs.participant(battle, gate.targetId)
        if (source === undefined || target === undefined) return
        // Legacy tail: taken-side window -> refresh -> death sweep.
        tbs.resolveTakenWindow(
          battle,
          target,
          source,
          declared,
          sumHpDamage(gate.hitOperationIds),
        )
        tbs.refreshStats(target)
        tbs.refreshStats(source)
        tbs.sweepBuffDeaths(battle)
      },

      onPlanCompleted: (plan) => {
        // Legacy refresh boundary (ARCH-002 parity): applyDeclaredBuff
        // refreshes each applied target and the non-damaging lane
        // refreshes affected + actor, so routed ops must leave stats
        // live before the next read -- a buff-only cast has no landed
        // gate to carry the tail. Refresh only participants a settled
        // op touched (hits/buffs/consumes/detonates/cleanses): legacy
        // never refreshes a suppressed lane's target, and the refresh
        // clamps vitals to the effective maxHp, so touching an
        // untouched participant is an observable mutation. Composite
        // extras complete their own plan before the primary lane, so
        // an extra's buffs are visible to the primary's stat reads.
        const source = tbs.participant(battle, plan.sourceId)
        for (const id of session.touchedTargetIds) {
          const participant = tbs.participant(battle, id)
          if (participant !== undefined) tbs.refreshStats(participant)
        }
        if (source !== undefined) tbs.refreshStats(source)
        tbs.sweepBuffDeaths(battle)
      },
    }
  }

  /** The payload def the legacy lane would pass as `skill` (payloadSkill
      parity): composite primary pick, else empowered variant, else
      root. Composite extras resolve the pick itself as their root. */
  private payloadId(plan: ResolvedSkillPlan): string {
    return (
      plan.snapshot.compositePicks?.[0] ??
      plan.resolvedVariantId ??
      plan.definitionId
    )
  }

  // -----------------------------------------------------------------------
  // Query ports -- readonly, entityId-scoped.
  // -----------------------------------------------------------------------

  private buildQueries(battle: TurnBattle): SkillQueryPorts {
    const tbs = this.deps.orchestration
    const entity = (id: string): CombatEntity | undefined =>
      tbs.participant(battle, id)?.entity
    const buffs = this.deps.buffs
    const scheduler = this.deps.scheduler

    return {
      buffs: {
        stacksOf: (definitionId, sourceId, targetId) =>
          buffs
            .getForTarget(targetId)
            .filter(
              (inst) =>
                inst.definitionId === definitionId &&
                (sourceId === undefined || inst.sourceId === sourceId),
            )
            .reduce((sum, inst) => sum + inst.stacks, 0),
        durationOf: (definitionId, targetId) =>
          buffs
            .getForTarget(targetId)
            .find((inst) => inst.definitionId === definitionId)
            ?.remaining ?? 0,
        has: (selector) => buffs.getInstance(selector) !== undefined,
        listInstances: (targetId) =>
          buffs
            .getForTarget(targetId)
            .map((inst) => this.buffSummary(inst)),
      },
      vitals: {
        alive: (id) => entity(id)?.alive === true,
        hp: (id) => entity(id)?.currentHp ?? 0,
        hpMax: (id) => entity(id)?.maxHp ?? 0,
        hpPercent: (id) => {
          const e = entity(id)
          return e === undefined || e.maxHp === 0 ? 0 : e.currentHp / e.maxHp
        },
      },
      resources: {
        current: (id, resourceId) =>
          this.resourceCurrent(entity(id), resourceId),
        max: (id, resourceId) => this.resourceMax(entity(id), resourceId),
      },
      opResults: {
        // Same trace surface the executor testkit uses -- records are
        // append-only; the latest record for the id is the result.
        lastOpResult: (operationId) =>
          [...scheduler.trace.records]
            .reverse()
            .find((record) => record.operation.operationId === operationId)
            ?.result,
      },
    }
  }

  private buffSummary(inst: BuffInstanceSnapshot): SkillBuffInstanceSummary {
    const def = this.deps.buffDefinition(inst.definitionId)
    const damagePeriodics: SkillDetonatePeriodic[] = (def?.periodic ?? [])
      .filter(
        (periodic): periodic is PeriodicDamageDefinition =>
          periodic.type === 'damage',
      )
      .map((periodic) => ({
        periodicId: periodic.id,
        coefficient: periodic.coefficient,
        element: periodic.element,
        ...(periodic.tags !== undefined ? { tags: periodic.tags } : {}),
      }))
    return {
      instanceId: inst.instanceId,
      definitionId: inst.definitionId,
      sourceId: inst.sourceId,
      kind: def?.kind ?? 'buff',
      stacks: inst.stacks,
      hasPeriodic: damagePeriodics.length > 0,
      remainingTurns: inst.remaining ?? 0,
      periodicDamageMult: resolveChannel(inst.modifiers, 'periodic_damage', 1),
      potencyMult: resolveChannel(inst.modifiers, 'potency', 1),
      damagePeriodics,
    }
  }

  private resourceCurrent(
    entity: CombatEntity | undefined,
    resourceId: string,
  ): number {
    if (entity === undefined) return 0
    switch (resourceId) {
      case 'the':
        return entity.currentThe ?? 0
      case 'mana':
        return entity.currentMp
      case 'ward':
        return entity.currentWard
      default:
        throw new TurnSkillPlanRuntimeError(
          `TurnSkillPlanRuntime: unknown resource '${resourceId}'`,
        )
    }
  }

  private resourceMax(
    entity: CombatEntity | undefined,
    resourceId: string,
  ): number {
    if (entity === undefined) return 0
    switch (resourceId) {
      case 'the':
        return entity.maxThe ?? MAX_THE
      case 'mana':
        return entity.stats.maxMp
      case 'ward':
        return entity.stats.wardMax
      default:
        throw new TurnSkillPlanRuntimeError(
          `TurnSkillPlanRuntime: unknown resource '${resourceId}'`,
        )
    }
  }

  private entityQuery(battle: TurnBattle): SkillResolveEntityQuery {
    const tbs = this.deps.orchestration
    const entity = (id: string): CombatEntity | undefined =>
      tbs.participant(battle, id)?.entity
    return {
      currentThe: (id) => entity(id)?.currentThe ?? 0,
      currentMp: (id) => entity(id)?.currentMp ?? 0,
      alive: (id) => entity(id)?.alive === true,
      // resolveBuffApplicationTargets parity -- scope resolution reads
      // LIVING members only (the legacy filter lives at application
      // time; resolve-time exclusion mints no dead-target ops at all).
      enemiesOf: (sourceId) =>
        tbs
          .enemiesOf(battle, sourceId)
          .filter((p) => p.entity.alive)
          .map((p) => p.entity.id as CombatEntityId),
      alliesOf: (sourceId) =>
        tbs
          .alliesOf(battle, sourceId)
          .filter((p) => p.entity.alive)
          .map((p) => p.entity.id as CombatEntityId),
    }
  }

  /** Frozen-scalar capture -- entity.stats is the refreshed effective
      set (realmIndex lives on the entity, not the stat block). */
  private statPort(battle: TurnBattle): StatReadPort {
    const tbs = this.deps.orchestration
    return {
      scalar: (sourceId, key) => {
        const entity = tbs.participant(battle, sourceId)?.entity
        if (entity === undefined) return 0
        if (key === 'realmIndex') return entity.realmIndex
        const value = (entity.stats as Record<string, number>)[key]
        return typeof value === 'number' ? value : 0
      },
    }
  }
}
