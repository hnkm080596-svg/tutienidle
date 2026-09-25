// TurnBattleSystem Slice 1 (spec 2026-09-04) -- engine turn-based độc lập,
// headless, KHÔNG nối vào BattleSystem.ts/GameManager. Chứng minh ATB
// gauge (TurnQueue) + targeting + CombatSystem.resolveActionHit chạy
// đúng end-to-end trước khi lớp thêm skill/buff/reaction/hazard zone ở
// slice sau.
import type { CombatEntity } from '../../combat/CombatEntity'
import type { CombatSystem } from '../../combat/CombatSystem'
import type { CombatRng } from '../contracts/rng'
import { FunctionCombatRng } from '../runtime/rng/FunctionCombatRng'
import type { CombatScheduler } from '../runtime/scheduler/CombatScheduler'
import { entityGridPosition, getChebyshevDistance } from '../BattleGrid'
import { actionTagsOfSkill, Buff2ActionValidator, type ActionValidator } from './ActionValidator'
import { consumeGaugeAfterAction, advanceGauge, isGaugeReady } from './ActionGauge'
import { resolveNextTurn } from './TurnQueue'
import { tickCooldowns, selectAction, selectForcedAction, commitAction, collectTurnTargets, executionCommitsCast, pickCompositePool, MAX_MULTICAST, NULL_ACTION, type TurnSkillExecution, type TurnQueuedExecution } from './TurnSkillAction'
import type { TurnSkillDefinition, TurnSkillSlot, SelectedAction, DynamicBasicProvider, ForcedTurnChoice, TurnSkillBuffApplication } from './TurnSkillAction'
import type { ActionDamageInfo, HitResolveOptions } from '../ActionImpactSystem'
import type { BuffSystem } from '../../buff2/BuffSystem'
import type { BuffRegistry } from '../../buff2/BuffRegistry'
import type { BuffLifecycleContext } from '../../buff2/BuffLifecycleContext'
import type { CombatProcSystem } from '../../proc/CombatProcSystem'
import type { GaugeDeltaHandler } from './GaugeDeltaHandler'
import { TurnSkillPlanRuntime, type TurnSkillPlanOrchestration } from './TurnSkillPlanRuntime'
import type { BuffDefinitionId, CombatEntityId, CombatOperationId, SkillId } from '../contracts/ids'
import type { SkillCombatRuntimeState } from '../../skilldef/SkillCombatRuntimeState'
import type { ResolvedCombatOperation } from '../contracts/operations'
import type { CombatOperationOrigin } from '../contracts/origin'
import type { StatModifier } from '../../stats/StatCalculator'
import type { StatDomain } from '../../stats/StatDomain'
import { applyTurnStartDeltas } from './ResourceTurnHook'
import type { TurnResourceDelta } from './ResourceTurnHook'
import { isTurnTriggerReady } from './BossTurnTriggers'
import { shouldStartNextWave, isStageComplete } from './WaveSpawnTrigger'
import { scaleActionDamage } from '../ActionImpactSystem'
import { recomputeEffectiveStats } from './TurnStatsRecompute'
import type { BattleLogEntry } from './TurnOrderPreview'

import { MAX_THE } from '../../combat/CombatTypes'
import type { DamageResult } from '../../combat/CombatTypes'
import {
  DAN_THE_INCOME_MULT,
  REACTION_DEBT_CAP,
  UNG_TRE_GAUGE_PENALTY,
  isUngTheCombatant,
  theGainOnBasicHit,
  theGainOnObservedAction,
} from '../../the-tu/TheEconomy'
import { SurviveLethalGuard } from '../../talent/SurviveLethalGuard'
import { reconcileExternalWard } from '../../the-tu/TheTuExternalWard'
import {
  asReactiveProc,
  isNaturalActionSource,
  type ReactiveActionSource,
  type ReactiveTriggerName,
} from '../../proc/ProcCapabilities'
import type { ReactiveProcAttempt } from '../../proc/CombatProcSystem'
import type { BuffDefinition } from '../../buff2/BuffDefinition'

export interface TurnResourcePool {
  values: Record<string, number>
  deltasPerTurn: TurnResourceDelta[]
}

export interface TurnBossTrigger {
  afterTurns: number
  buffDefinitionId: string
  firedAlready: boolean
}

export interface PendingEnemySpawn {
  /** Đã build đầy đủ (roll template/elite/boss xong) -- chỉ chờ hết telegraph. */
  participant: TurnBattleParticipant
  ticksRemaining: number
  totalTicks: number
}

// Turn-Based Wave Redesign (2026-09-06) -- quy đổi TRỰC TIẾP từ
// SPAWN_TELEGRAPH_SECONDS của legacy/BattleSystem.ts (0.75s/1.0s/1.4s)
// sang tick (0.1s/tick, khớp BATTLE_FIXED_STEP mà GameManager gọi
// tickPacing() mỗi lần) để giữ đúng cảm giác thời gian người chơi đã quen.
const SPAWN_TELEGRAPH_TICKS = {
  normal: 8,
  elite: 10,
  boss: 14,
} as const

function spawnTelegraphTicks(entity: Pick<CombatEntity, 'isBoss' | 'isElite'>): number {
  if (entity.isBoss) {
    return SPAWN_TELEGRAPH_TICKS.boss
  }

  if (entity.isElite) {
    return SPAWN_TELEGRAPH_TICKS.elite
  }

  return SPAWN_TELEGRAPH_TICKS.normal
}

export type TurnBattleState = 'intro' | 'countdown' | 'fighting' | 'victory' | 'defeat'

export interface TurnBattleParticipant {
  id: string
  entity: CombatEntity
  speed: number
  priority: number
  actionGauge: number
  alive: boolean
  consecutiveHardCcTurns: number
  baTheTriggeredAtTurn?: number
  basic?: TurnSkillDefinition
  special?: TurnSkillSlot
  ultimate?: TurnSkillSlot
  resources?: TurnResourcePool
  bossTrigger?: TurnBossTrigger
  /**
   * stat-system-reimagined review fix (2026-09-15) -- stat domains this
   * participant owns (player path -> its domain). Domain deltaDerivers
   * in calculateEffectiveStats run only for these, so e.g. a sword
   * entity gaining attunement mid-battle never emits spell MP deltas.
   */
  activeDomains?: ReadonlySet<StatDomain>
  /** Future Systems Task 7 -- charge state (Thế→Trảm). CỐ Ý tách biệt counter CC Bá Thể. */
  chargingTurnsRemaining?: number
  pendingChargedSkillId?: string
  /**
   * Phase A3 (2026-09-07) -- 1-based counter of this enemy's own actions,
   * ported from the retired grid-battle specialAttackCounter with the same
   * everyNth semantics as legacy EnemyAttackSystem.fireEnemyAttack()
   * (module retired M13 -- semantics ported here):
   * when counter % everyNth === 0, the special attack's damageMultiplier
   * replaces the basic attack's for that action. Runtime-only, never
   * resets mid-battle. undefined coerces to 0.
   */
  specialAttackCounter?: number
  /**
   * Kiem Tu Reimagined Task 2 -- path-specific basic owner (Kiem Pho orb
   * preset / Ngu Kiem Dao). When present it owns the basic slot and the
   * post-resolution hook; the engine stays content-agnostic.
   */
  dynamicBasic?: DynamicBasicProvider
  /**
   * The Tu Reimagined (spec 6.2, plan Task 16) -- participant-local
   * reactive payload defs keyed by skill id (phan_kich/tro_kich clones,
   * node-adjusted at battle build). QueuedFollowUp.payloadSkillId
   * resolves through this map -- never through a shared registry, so a
   * node's payload upgrade reaches this participant's copy only.
   */
  reactivePayloads?: Record<string, TurnSkillDefinition>
  /**
   * Ung The beta -- Tham An (design Part IV): the participant id of this
   * reactor's single observed target, planted by a Tham The cast BEFORE
   * the hit resolves (a miss/dodge still marks). Recast overwrites; the
   * marked target's death lazy-clears the focus at read -- NEVER
   * auto-transfers. Quan The needs no mark: its live marker instance
   * makes every enemy satisfy isObserved.
   */
  thamTargetId?: string
  /**
   * Ung The beta -- Ung Tre reaction debt (design Part III): +1 per
   * committed reaction, battle-scoped on the participant (not a buff,
   * not dispellable, no node reduces it). Debt >= REACTION_DEBT_CAP is
   * Qua The -- new reaction windows close while observation income
   * continues; the holder's next NATURAL action resets it (a queued
   * reactive entry is not a natural action). The pool is untouched.
   */
  reactionDebt?: number
}

export interface TurnBattle {
  /**
   * Future Systems Task 9 (2026-09-04) -- party: mảng player-side units,
   * chung 1 ATB queue với enemy (TurnQueue tái dùng nguyên vẹn); thua khi
   * TOÀN BỘ party chết (đối xứng điều kiện thắng -- spec §6).
   */
  players: TurnBattleParticipant[]
  enemies: TurnBattleParticipant[]
  state: TurnBattleState
  totalTurnsElapsed?: number
  /** Completed ATB rounds. A round completes when every participant that is
   * alive at that moment has declared at least one action since the previous
   * round boundary; newly spawned enemies join the current round. */
  roundsElapsed?: number
  /** Participant ids that have acted in the current (incomplete) round. */
  actedThisRound?: string[]
  /**
   * Countdown phase (flow: Countdown → Spawn → Gauge combat → Wave →
   * Result) -- số lượt-pacing còn lại trước khi state chuyển 'fighting'.
   * GameManager pacing loop tick giảm; engine `resolveNextStep()` KHÔNG
   * resolve combat trong pha này (chỉ tick countdown khi được gọi qua
   * `tickCountdown()`), enemies đã spawn đứng yên chờ.
   */
  countdownTurnsRemaining?: number
  /**
   * Intro phase (2026-09-07 plan Task 4) - curtain/zone-reveal transition
   * BEFORE the countdown. Number of pacing ticks remaining before state
   * flips to 'countdown'. GameManager's pacing loop decrements it via
   * tickIntro(); no combat logic (gauge, pacing, targeting) may run while
   * this phase is active - identical contract to countdownTurnsRemaining.
   */
  introTurnsRemaining?: number
  wave?: {
    totalEnemyCount: number
    spawnedCount: number
    /** effectiveWaves(stage) snapshot, taken once at battle start. */
    waves: number[]
    /** 0-based index into `waves` -- which wave is currently spawning/active. */
    waveIndex: number
    /** Quái đã spawn (dạng pending) nhưng CHƯA vào trận thật (battle.enemies). */
    pendingEnemySpawns: PendingEnemySpawn[]
  }
  /**
   * Slice 7 extension (Completion Task 11) -- battle log: 1 entry mỗi lượt
   * resolveActorTurn (append-only, ephemeral -- không persist vào save,
   * combat ephemeral theo nguyên tắc rework).
   */
  log?: BattleLogEntry[]
  /**
   * Action Playback (2026-09-05) -- counter/follow-up (§6 spec): actors queued
   * here jump straight to 'ready' after the current turn's standby, bypassing
   * gauge. FIFO queue (not a single id) so an AOE hit that triggers multiple
   * counters doesn't drop all but the last one. Defect-fix Task 1: đổi từ
   * singular -- tickPacing (production loop) giờ đọc queue này.
   * The Tu Reimagined (Task 16) -- entries are typed QueuedFollowUp
   * records carrying provenance (actionSource/triggerContext) and the
   * queued payload descriptor, not bare actor ids.
   */
  queuedFollowUps?: QueuedFollowUp[]
  /** Defect-fix Task 1 -- reciprocity guard: đếm consecutive bypass turns qua
   * queue, reset khi 1 normal gauge turn resolve; cap trong dequeueFollowUpActor()
   * để 2 entity counter-buff không bounce follow-up lẫn nhau vô hạn. */
  followUpChainDepth?: number
  /**
   * Phap Tu An (Task 11) -- prepared follow-up EXECUTIONS (repeat /
   * multicast) of an already-committed cast. Unlike the actor queue
   * above, an entry carries its own payload root -- the drained actor
   * does NOT run normal action selection (the descriptor IS the action)
   * and skips per-turn machinery (buff tick, regen, CC): these are the
   * remainder of one cast, not a new turn.
   */
  queuedExecutions?: TurnQueuedExecution[]
}

/**
 * Luật targeting §4: cùng hàng thì chọn gần nhất theo cột (không thể
 * nhắm xuyên qua entity đứng gần hơn cùng hàng); không có ai cùng hàng
 * thì chọn gần nhất toàn bàn cờ theo Chebyshev.
 *
 * The Tu Reimagined (plan Task 10, D6/INV-11) -- Khiem Khich Taunt reads
 * the ACTOR's own debuffs BEFORE positional rules: an active khiem_khich
 * instance forces the pick onto its sourceId (the taunter) when that
 * participant is alive in the opposing side. per_target instanceScope on
 * the def means a newer taunt already evicted older instances -- the last
 * instance is the newest by construction. Dead/missing taunter falls
 * through to positional. opts.ignoreTaunt exempts scripted
 * specialAttacks (their positional pick is part of the authored script).
 *
 * buff2 M4 -- the actor no longer owns a pool; the caller supplies the
 * taunt read via `getTauntSource` (the battle's BuffSystem query:
 * newest khiem_khich instance's sourceId on the actor, or undefined).
 */
export function selectTarget(
  actor: TurnBattleParticipant,
  opposingSide: TurnBattleParticipant[],
  opts?: { ignoreTaunt?: boolean },
  getTauntSource?: (actorEntityId: string) => string | undefined,
): TurnBattleParticipant | undefined {
  const living = opposingSide.filter((participant) => participant.entity.alive)

  if (living.length === 0) {
    return undefined
  }

  if (!opts?.ignoreTaunt) {
    const taunterId = getTauntSource?.(actor.entity.id)

    if (taunterId !== undefined) {
      const taunter = living.find((participant) => participant.entity.id === taunterId)

      if (taunter) {
        return taunter
      }
    }
  }

  const actorPosition = entityGridPosition(actor.entity)

  const sameRow = living.filter(
    (participant) => entityGridPosition(participant.entity).row === actorPosition.row,
  )

  const pool = sameRow.length > 0 ? sameRow : living

  return pool.reduce((nearest, candidate) => {
    const nearestDistance = getChebyshevDistance(actorPosition, entityGridPosition(nearest.entity))
    const candidateDistance = getChebyshevDistance(actorPosition, entityGridPosition(candidate.entity))

    return candidateDistance < nearestDistance ? candidate : nearest
  })
}

const DEFAULT_MAX_TURNS = 10_000

/** Defect-fix Task 1 (2026-09-05) -- reciprocity cap: 2 entity cùng holding
 * counter buff không được bounce follow-up lẫn nhau quá 4 nhịp liên tiếp
 * (không có normal turn xen vào) -- chặn chain vô hạn starving turn order. */
const MAX_FOLLOW_UP_CHAIN_DEPTH = 4

/**
 * M8 (ARCH-003) -- Ward delayed-regen gate in TURN units. Legacy
 * BattleSystem measured WARD_REGEN_DELAY_SECONDS = 3 on the wall clock;
 * the turn engine preserves the same numeric intent against the actor's
 * own turn cadence: `turnsSinceLastHitLanded` counts the holder's turns
 * (incremented once per declare, reset to 0 by CombatSystem on every
 * landed hit) and Ward regen resumes once 3 turns pass unhit. `Infinity`
 * (never hit) regenerates from the first turn, matching legacy.
 */
const WARD_REGEN_DELAY_TURNS = 3

export interface TurnStepResult {
  state: TurnBattleState
  actorId: string
  skillId: string
  targetIds: string[]
  ccBlocked: boolean
  /** Task 9 -- the cast's execution identity (root vs resolved payload). */
  execution?: TurnSkillExecution
}

/**
 * Action Playback Task 3 (2026-09-05) -- kết quả PHA declare: mọi thứ đã
 * quyết định cho lượt của actor (skill, target set, damage đã scale, charge
 * state) NHƯNG chưa áp damage -- applyActionImpact() đọc các field này.
 */
export interface TurnDeclaredAction {
  actorId: string

  skillId: string

  ccBlocked: boolean

  isCharging: boolean

  chargeResolved: boolean

  /** Charge-resolve: targetIds capture tại declare (hits áp tại apply). */
  chargeTargetIds: string[]

  /** Charge-resolve: skill definition capture tại declare (apply đọc từ đây -- pendingChargedSkillId đã clear). */
  chargedSkill: TurnSkillDefinition | null

  action: SelectedAction | null

  opposingSide: TurnBattleParticipant[]

  affected: TurnBattleParticipant[]

  scaledDamage: ActionDamageInfo | null

  /** Sudden-death multiplier capture tại declare (Reaction Path picks scale riêng per-pick). */
  suddenDeathMultiplier: number

  /**
   * Task 11 -- composite picks resolving as EXTRA payloads beyond the
   * primary resolvedSkill (element_basic extras when count > 1). Each
   * picked def applies its own damage + ailments through the shared
   * picks lane. Empty/null for normal casts.
   */
  compositePickedSkills: readonly TurnSkillDefinition[] | null

  /** Defect-fix Task 1 -- turn này được grant qua follow-up/counter bypass
   * queue thay vì normal gauge readiness -- completeAction bỏ consume gauge
   * cho các turn này (bypass không tốn progress của lượt kế tiếp). */
  isFollowUpBypass: boolean

  /**
   * Task 9 -- execution identity: rootSkillId owns cast count/cooldown/
   * slot identity; resolvedSkill owns the payload. Absent on charge-
   * resolve/CC-blocked/empty turns (no cast happens there).
   */
  execution?: TurnSkillExecution

  /**
   * The Tu Reimagined (spec 7.1, plan Task 16) -- the action's provenance.
   * Natural declares are 'normal' (basic) or 'skill' (a slotted cast);
   * queued reactive entries carry 'counter' | 'follow_up' | 'intercept'.
   * Reactive sources never open new reactive windows by default (INV-9)
   * -- the Ho/Phan/Tro windows gate on this field.
   */
  actionSource?: ReactiveActionSource

  /** Composite trigger context captured at queue time -- node payload
   *  variants (e.g. post-evasion heavy counter) read this. */
  triggerContext?: ReactiveTriggerContext

  /** The Tu Reimagined (plan Task 17) -- set when a Ho intercept
   *  substituted this action's target; flows into queued entries'
   *  composite triggerContext.intercepted. */
  intercepted?: boolean

  /** The protector participant that absorbed this action via Ho. */
  interceptedBy?: string
}

/**
 * Composite trigger context (spec 6.2.2, plan Task 16) -- each axis is
 * read independently by node payload variants: a Ho->EVA->Counter chain
 * produces {origin:'enemy_hit', intercepted:true, outcome:'evaded'}.
 */
export interface ReactiveTriggerContext {
  origin: 'enemy_hit' | 'ally_action'
  /** The hit reached this reactor through a Ho substitution. */
  intercepted?: boolean
  /** The hit outcome on the reactor ('taken' | 'evaded'). */
  outcome?: 'taken' | 'evaded'
}

/** One queued reactive/bypass action (spec 7.1). */
export interface QueuedFollowUp {
  actorId: string
  /**
   * 'reactive_bypass' declares via declareReactiveBypass (no natural-turn
   * lifecycle); 'natural_turn' is reserved for future interrupt entries —
   * no current producer emits it.
   */
  executionKind: 'natural_turn' | 'reactive_bypass'
  actionSource: Exclude<ReactiveActionSource, 'normal' | 'skill'>
  triggerContext?: ReactiveTriggerContext
  payloadSkillId?: string
  targetIds?: string[]
}

/**
 * Kiem Tu Reimagined Task 2 -- one extra declared impact produced by a
 * dynamicBasic provider's onCastResolved (combo payload). Presentation
 * emits each entry separately; each carries its own preset so distinct
 * combos stay visually distinguishable.
 */
export interface TurnActionExtraImpact {
  presetId?: TurnSkillDefinition['presetId']
  targeting?: TurnSkillDefinition['targeting']
  targetIds: string[]
  landedTargetIds: string[]
  hitCount: number
}

/** buff2 M4 -- the battle-scoped combat runtime bundle: the single buff
    authority (BuffSystem over one BuffStore), the narrow proc owner
    (CombatProcSystem), and the operation scheduler every buff/resource
    mutation routes through. Minted per cycle by the composition root
    (GameManagerTurnBattleOps.mintCycleScheduler). Absent in engine-unit
    tests that exercise non-buff lanes only -- buff/proc/op lanes are
    unreachable without it and fault loudly on use. */
export interface TurnCombatRuntime {
  buffs: BuffSystem
  procs: CombatProcSystem
  scheduler: CombatScheduler
  /** The gauge_delta push-decision owner -- TBS drains its staged
      PushGaugeOperations at completeAction AFTER gauge consume (legacy
      one-shot ordering: pushes land on top of the reset). */
  gaugeHandler: GaugeDeltaHandler
}

/** Stable machine-readable codes on the engine's loud reports -- tests
    and journey oracles match THESE, never English prose. */
export const UNROUTED_CAST_WARNING = '[TurnBattleSystem][UNROUTED_CAST]'
export const ENGINE_LANE_BUFF_WARNING = '[TurnBattleSystem][ENGINE_LANE_BUFF]'

export class TurnBattleSystem {
  constructor(
    private readonly combat: CombatSystem,
    private readonly maxTurns: number = DEFAULT_MAX_TURNS,
    private readonly registry?: BuffRegistry,
    private readonly spawnEnemy?: (occupiedSlots?: Set<string>) => TurnBattleParticipant,
    // buff2 M4 -- the combat runtime bundle (occupies the retired
    // reactionManager slot): buff/proc/op mutation lanes route through
    // it; absent -> those lanes fault loudly rather than silently no-op.
    private readonly runtime?: TurnCombatRuntime,
    // 9.5 #9 -- committed-cast notification. Fires once per action that
    // actually commits (same point as commitAction): normal casts and
    // charge-initiation count; charge ticks/resolve and CC-blocked turns
    // do not. Generic over actors -- consumers filter to the participants
    // they care about.
    private readonly onSkillCast?: (actor: TurnBattleParticipant, skillId: string) => void,
    /**
     * ARCH-002 (M7) -- battle-scoped live-modifier provider. Supplies the
     * runtime modifier set that cannot bake into the resolved base
     * (passive stacks, persistent buff pool, timed/socket effects).
     * Returns StatModifier[] only -- the assembly stays in
     * recomputeEffectiveStats, so this engine never owns a second stat
     * path and stays headless (the ops layer injects the closure).
     */
    private readonly liveStatModifiers?: (entity: CombatEntity) => StatModifier[],
    /**
     * Combat-contract M4 -- the battle-wide CombatRng for ALL engine
     * rolls (reactive triggers, composite picks, multicast, proc
     * chances, ailment application; first introduced as the An-kit
     * roll source in Phap Tu Reimagined Task 11). Tests inject a
     * scripted/seeded CombatRng for determinism. The
     * default wraps a LAZY Math.random closure so vi.spyOn(Math,
     * 'random') interception keeps working for callers that construct
     * the system before installing the spy. Downstream helpers that
     * still take `() => number` receive `() => this.rng.roll()` —
     * identical consumption order.
     */
    private readonly rng: CombatRng = new FunctionCombatRng(() => Math.random()),
  ) {
    // Reaction M4 (contract sec.70-72) -- the action-tag restriction
    // channel (Cam Cong). Bound to the same catalog the buff lanes use;
    // absent registry -> no restrictions (unsealed selection is
    // byte-identical to today).
    this.actionValidator =
      this.registry !== undefined
        ? new Buff2ActionValidator(
            this.registry,
            // Lazy read port -- an unwired battle (no runtime) sees no
            // instances and thus no seals (unsealed path byte-identical).
            (entityId) => this.runtime?.buffs.getForTarget(entityId as CombatEntityId) ?? [],
          )
        : undefined
  }

  private readonly actionValidator: ActionValidator | undefined

  /** The battle-scoped operation scheduler (diagnostic surface, P5 T2) --
      delegates to the runtime bundle minted by the composition root. */
  get combatScheduler(): CombatScheduler | undefined {
    return this.runtime?.scheduler
  }

  // Defect-fix Task 1 (2026-09-05) -- bridge dequeueFollowUpActor() →
  // declareActorAction(): set ngay trước khi trả bypass actor, đọc 1 lần
  // trong declare để populate TurnDeclaredAction.isFollowUpBypass rồi clear.
  // The Tu Reimagined (Task 16) -- the bridge carries the whole typed
  // entry (provenance + payload descriptor), not just the actor id.
  private pendingReactiveEntry: QueuedFollowUp | null = null

  /**
   * Task 11 -- same bridge pattern as pendingFollowUpBypassActorId, but
   * the entry IS the action: dequeueQueuedExecution() sets it,
   * declareActorAction() consumes it once and builds the declared action
   * from the descriptor (no selectAction, no turn machinery).
   */
  private pendingQueuedExecution: TurnQueuedExecution | null = null

  /**
   * R1 (AR-01) test seam -- production wiring goes through
   * GameManager.setSurviveLethalSession on the shared CombatSystem; this
   * delegation lets engine-level tests exercise the survive-lethal
   * interception without touching the private combat collaborator.
   */
  setSurviveLethalSessionForTest(
    session: { playerEntityId: string; guard: SurviveLethalGuard } | null,
  ): void {
    this.combat.setSurviveLethalSession(session)
  }

  // ---------------------------------------------------------------------
  // buff2 M4 -- runtime accessors + the op-settlement primitives.
  // Every buff/resource mutation routes through the scheduler; the buff
  // authority and proc owner live in the runtime bundle. Absent runtime
  // faults loudly (unwired lane = broken wiring, never a silent no-op).
  // ---------------------------------------------------------------------

  private get buffs(): BuffSystem {
    if (this.runtime === undefined) {
      throw new Error('TurnBattleSystem: buff lane reached without a TurnCombatRuntime (unwired battle)')
    }
    return this.runtime.buffs
  }

  private get procs(): CombatProcSystem {
    if (this.runtime === undefined) {
      throw new Error('TurnBattleSystem: proc lane reached without a TurnCombatRuntime (unwired battle)')
    }
    return this.runtime.procs
  }

  private get scheduler(): CombatScheduler {
    if (this.runtime === undefined) {
      throw new Error('TurnBattleSystem: op lane reached without a TurnCombatRuntime (unwired battle)')
    }
    return this.runtime.scheduler
  }

  // ---------------------------------------------------------------------
  // skilldef M4e -- the plan pipeline. Built lazily on the first routed
  // cast; the orchestration surface delegates to the same private
  // helpers resolveDeclaredHit uses (income/procs/windows/refresh/sweep)
  // so routed casts replay the consequence chain verbatim between
  // scheduler barriers.
  // ---------------------------------------------------------------------

  private planPipelineCache?: TurnSkillPlanRuntime

  private get planPipeline(): TurnSkillPlanRuntime {
    if (this.runtime === undefined) {
      throw new Error('TurnBattleSystem: skill plan lane reached without a TurnCombatRuntime (unwired battle)')
    }
    this.planPipelineCache ??= new TurnSkillPlanRuntime({
      rng: this.rng,
      buffs: this.runtime.buffs,
      scheduler: this.runtime.scheduler,
      isBuffDefinitionId: (id) => this.registry?.has(id) ?? false,
      buffDefinition: (id) =>
        this.registry !== undefined && this.registry.has(id)
          ? this.registry.get(id)
          : undefined,
      orchestration: this.skillPlanOrchestration(),
    })
    return this.planPipelineCache
  }

  private skillPlanOrchestration(): TurnSkillPlanOrchestration {
    return {
      participant: (battle, id) =>
        battle.players.find((member) => member.id === id) ??
        battle.enemies.find((enemy) => enemy.id === id),
      enemiesOf: (battle, sourceId) =>
        battle.players.some((member) => member.id === sourceId)
          ? battle.enemies
          : battle.players,
      alliesOf: (battle, sourceId) =>
        battle.players.some((member) => member.id === sourceId)
          ? battle.players
          : battle.enemies,
      // commitAction minus the resource consume + consume-all burn --
      // both ride consume_resource ops inside the plan (spec sec.14
      // commit-first ordering; theBurned froze at declare).
      commitShell: (actor, declared) => {
        const action = declared.action!
        if (action.slot) {
          action.slot.remainingCooldownTurns = action.slot.skill.cooldownTurns
        }
        this.onSkillCast?.(
          actor,
          declared.execution?.rootSkillId ?? action.skillId,
        )
      },
      recordHitOutcome: (battle, target, hit) =>
        this.recordHitOutcome(battle, target, hit),
      // resolveDeclaredHit :2136-2166 parity -- on-hit procs, then the
      // target's onImpactLanded reactive roll gated on hpDamage > 0,
      // then the queuedFollowUps FIFO push.
      runLandedHitProcs: (battle, actor, target, hpDamage, reflectsEligible) => {
        if (this.runtime === undefined) return
        const procRoot = `hit.proc.${battle.totalTurnsElapsed}.${actor.id}.${target.id}.${this.nextOccurrence()}`
        this.procs.onHitLanded(actor.entity.id, target.entity.id, procRoot)
        const { firedFollowUp } =
          hpDamage > 0
            ? this.procs.rollReactiveTrigger(
                target.entity.id,
                'onImpactLanded',
                { attacker: actor.entity, hpDamage, reflectsEligible },
                procRoot,
              )
            : { firedFollowUp: false }
        if (firedFollowUp) {
          battle.queuedFollowUps = battle.queuedFollowUps ?? []
          battle.queuedFollowUps.push({
            actorId: target.id,
            executionKind: 'reactive_bypass',
            actionSource: 'follow_up',
          })
        }
      },
      // The Tu Task 11 (D3/INV-12) -- the applyDeclaredBuff externalWard
      // write: source-tagged REPLACE (recast refreshes to full; a lower
      // recast lowers the pool). sourceMaxHpRatio reads the GRANTING
      // tank's live maxHp. The pool stays existence-bound to the marker
      // instance through reconcileExternalWard at the refresh seam.
      grantExternalWard: (battle, sourceId, targetId, sourceMaxHpRatio) => {
        const source =
          battle.players.find((member) => member.id === sourceId) ??
          battle.enemies.find((member) => member.id === sourceId)
        const target =
          battle.players.find((member) => member.id === targetId) ??
          battle.enemies.find((member) => member.id === targetId)
        if (source === undefined || target === undefined) return
        this.writeExternalWardGrant(source.entity, target.entity, sourceMaxHpRatio)
      },
      refreshStats: (participant) => this.refreshParticipantStats(participant),
      sweepBuffDeaths: (battle) => this.sweepBuffDeaths(battle),
      mintOccurrence: () => this.nextOccurrence(),
    }
  }

  /**
   * The ONE externalWard grant write (M7 closure -- son_nhac_ho_the,
   * provider resolveBuff extras, and the Ho intercept ward all funnel
   * here): source-tagged REPLACE -- a recast refreshes the pool to full
   * and a lower recast lowers it (never stacks); exempt from wardMax;
   * existence-bound to the granting marker instance --
   * reconcileExternalWard owns expiry at the refresh seam and
   * CombatSystem owns the absorb decrement inside damage resolution.
   */
  private writeExternalWardGrant(
    source: CombatEntity,
    target: CombatEntity,
    sourceMaxHpRatio: number,
  ): void {
    target.externalWard = {
      sourceId: source.id,
      amount: Math.max(0, source.stats.maxHp * sourceMaxHpRatio),
    }
  }

  /** M4e routing probe -- adapter-covered casts go through the plan
      pipeline; adapter-unsupported casts are reported loudly and
      resolve as a no-op on the plan lane (never a silent legacy
      fallback). Charge turns route through their own probes: the init
      commit (pre-block) and the deferred resolve (charge branch) -- a
      charge def routed HERE would execute its deferred steps early and
      double-commit. */
  private tryPlanCast(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    declared: TurnDeclaredAction,
  ) {
    const skill = declared.action?.skill
    if (
      this.runtime === undefined ||
      declared.isCharging ||
      skill == null ||
      (skill.chargeTurns ?? 0) > 0
    ) {
      return null
    }
    return this.planPipeline.routeCast(battle, actor, declared)
  }

  /** skilldef M5d -- a runtime-present cast that cannot route is a LOUD
      no-op, never a silent legacy fallback: the report fires once per
      cast identity per battle with the reason (adapter-unsupported
      semantics, a def-less declared action, or a covered def the plan
      runtime declined -- the last is an internal defect signal). */
  private readonly unroutedCastReported = new Set<string>()

  /** M7 closure -- the engine-unit lane (runtime === undefined) owns no
     buff authority: authored appliesBuff(s) applications report once per
     definition and skip. Dedup key is the buff definition id. */
  private readonly engineLaneBuffReported = new Set<string>()

  private reportUnroutedCast(
    actor: TurnBattleParticipant,
    def: TurnSkillDefinition | null | undefined,
    label?: string,
    /** true only at call sites that already ran routeCast and got null --
        distinguishes "declined a covered def" (defect signal) from a
        plain coverage probe, which stays silent for routable defs. */
    declined = false,
  ): void {
    if (this.runtime === undefined) return
    const key = def?.id ?? label
    if (key === undefined || this.unroutedCastReported.has(key)) return
    const reasons = def == null ? [] : this.planPipeline.unsupportedFor(def)
    // A covered def is not a reportable event unless the caller knows the
    // route itself declined (coverage probes stay silent for them).
    if (def != null && reasons.length === 0 && !declined) return
    this.unroutedCastReported.add(key)
    const cause =
      def == null
        ? 'the declared action carries no skill definition'
        : reasons.length > 0
          ? `adapter-unsupported semantics: ${reasons.join('; ')}`
          : 'the plan runtime declined an adapter-covered def'
    console.warn(
      `${UNROUTED_CAST_WARNING} cast '${key}' (${actor.id}) did not route -- ${cause}; ` +
        'the cast resolves to a no-op on the plan lane',
    )
  }

  /** skilldef M5f (R6) -- battle-scoped cast state projected into the
      canonical SkillCombatRuntimeState shape at its owner: the slot's
      cooldown plus the participant's charge progress for one skill
      identity. Readonly view -- writes stay on the slot/participant
      fields (today's remainingCooldownTurns/chargingTurnsRemaining
      homes) until the skill data is redesigned on SkillDefinition. */
  combatRuntimeStateOf(
    participant: TurnBattleParticipant,
    skillId: string,
  ): SkillCombatRuntimeState | undefined {
    const slot = [participant.special, participant.ultimate].find(
      (candidate) => candidate?.skill.id === skillId,
    )
    const chargeProgress =
      participant.pendingChargedSkillId === skillId
        ? participant.chargingTurnsRemaining
        : undefined
    if (slot === undefined && chargeProgress === undefined) return undefined
    return {
      skillId: skillId as SkillId,
      cooldownRemainingTurns: slot?.remainingCooldownTurns ?? 0,
      ...(chargeProgress !== undefined ? { chargeProgress } : {}),
    }
  }

  /** Enqueue authored ops + settle IMMEDIATELY at the calling seam --
      the legacy synchronous mutation order is preserved (a buff applied
      here is visible to every later read in the same action). The
      post-drain quiescent point is the spec sec.40-41 death boundary. */
  private emitAndSettle(ops: readonly ResolvedCombatOperation[], battle: TurnBattle): void {
    if (ops.length === 0) return
    this.scheduler.enqueueAuthored(ops)
    this.scheduler.run()
    this.sweepBuffDeaths(battle)
  }

  /** A lifecycle root for buff hooks (status.turn.<n>.<actorId>) --
      the sink carries lifecycle-scoped events; settle() is the per-unit
      barrier the BuffSystem drives internally. */
  private lifecycleRoot(rootActionId: string): BuffLifecycleContext {
    const { sink, sequence, settle } = this.scheduler.createLifecycleSink(rootActionId)
    return { rootActionId, sequence, events: sink, settle }
  }

  /** Run one buff lifecycle boundary as a scheduler root transaction;
      the boundary's own quiescent point sweeps deaths afterward. An
      unwired battle owns no instances -- the boundary is legitimately
      empty (same as read lanes; mutation lanes still fault loudly). */
  private runBuffLifecycle(
    rootActionId: string,
    battle: TurnBattle,
    run: (lctx: BuffLifecycleContext) => void,
  ): void {
    if (this.runtime === undefined) return
    run(this.lifecycleRoot(rootActionId))
    this.sweepBuffDeaths(battle)
  }

  /**
   * spec sec.40-41 -- the death boundary, invoked at every quiescent
   * point this system creates (post-drain, post-lifecycle, post-hit).
   * onEntityDeath is unconditional + idempotent: a repeat call on the
   * same entity finds no instances and settles nothing.
   */
  private sweepBuffDeaths(battle: TurnBattle): void {
    if (this.runtime === undefined) return
    for (const participant of [...battle.players, ...battle.enemies]) {
      if (participant.entity.alive) continue
      const lctx = this.lifecycleRoot(`status.death.${battle.totalTurnsElapsed}.${participant.id}`)
      this.buffs.onEntityDeath(participant.entity.id, lctx)
    }
  }

  private opOrigin(
    sourceId: string,
    rootActionId: string,
    originId: string,
  ): CombatOperationOrigin {
    return { kind: 'skill', originId, sourceId: sourceId as CombatEntityId, rootActionId }
  }

  // buff2 M4 -- authored-root occurrence ordinal. Lanes that can recur
  // within one turn (repeated hits in a composite/multicast cast, extra
  // executions, intercept windows) must mint DISTINCT rootActionIds:
  // the scheduler reserves operationIds globally and faults on any
  // repeat. Monotonic per system instance -- deterministic because the
  // mint order is the deterministic call order.
  private occurrenceSeq = 0
  private nextOccurrence(): number {
    this.occurrenceSeq += 1
    return this.occurrenceSeq
  }

  private applyBuffOp(
    definitionId: string,
    sourceId: string,
    targetId: string,
    stacks: number,
    baseChance: number,
    reactionEligibility: 'eligible' | 'suppressed',
    rootActionId: string,
    label: string,
    durationOverride?: number,
  ): ResolvedCombatOperation {
    return {
      type: 'apply_buff',
      operationId: `buff.${rootActionId}.${label}` as CombatOperationId,
      payload: {
        definitionId: definitionId as BuffDefinitionId,
        targetId: targetId as CombatEntityId,
        stacks,
        baseChance,
        durationOverride,
        reactionEligibility,
      },
      origin: this.opOrigin(sourceId, rootActionId, label),
    }
  }

  /**
   * buff2 M4 -- battle-entry apply seam (composition root only): Tran
   * Phap formation buff + kit-clone grantsBuffsAtBuild land through the
   * same authored-op lane as in-combat applies (one settle root). Called
   * post-construction while the battle is quiescent, before the first
   * refreshEffectiveStats fold.
   */
  public applyBuildBuffs(
    battle: TurnBattle,
    entries: readonly {
      definitionId: string
      sourceId: string
      targetId: string
      durationOverride?: number
    }[],
    // Canonical-seals S3: post-entry callers (the aura re-grant seam)
    // must mint their own rootActionId namespace -- the default
    // 'entry' scheme re-reserves the build-time operationIds when it
    // fires again inside the same turn.
    rootActionId = `battle.entry.${battle.totalTurnsElapsed}`,
  ): void {
    if (entries.length === 0) return
    const ops = entries.map((entry, index) =>
      this.applyBuffOp(
        entry.definitionId,
        entry.sourceId,
        entry.targetId,
        1,
        1,
        'eligible',
        rootActionId,
        `entry.${index}.${entry.definitionId}`,
        entry.durationOverride,
      ),
    )
    this.emitAndSettle(ops, battle)
  }

  // buff2 M4 -- Khiem Khich Taunt read (selectTarget's getTauntSource):
  // newest live khiem_khich instance on the actor yields its sourceId;
  // per_target+latest eviction keeps at most one, so the last canonical
  // entry is the taunter. Returns CombatEntityId for the entity-id
  // comparison inside selectTarget.
  private tauntSourceId(entityId: CombatEntityId): string | undefined {
    if (this.runtime === undefined) return undefined

    const instance = this.buffs
      .getForTarget(entityId)
      .filter((i) => i.definitionId === 'khiem_khich')
      .at(-1)

    return instance?.sourceId
  }

  /**
   * Legacy clearCcEffects semantics -- removes every live control
   * instance on the holder (stun/freeze/root-control defs) through
   * remove_buff ops. Distinct from `cleanse` (dispellable gate) and
   * clearsCcOnApply (which the resolver runs inside apply).
   */
  private clearHardCc(participant: TurnBattleParticipant, battle: TurnBattle, rootActionId: string): void {
    const ops: ResolvedCombatOperation[] = []
    for (const instance of this.buffs.getForTarget(participant.entity.id)) {
      const controls = this.registry?.tryGet(instance.definitionId)?.controls
      if (controls === undefined || controls.length === 0) continue
      ops.push({
        type: 'remove_buff',
        operationId: `cc.${rootActionId}.${instance.instanceId}` as CombatOperationId,
        payload: {
          selector: { kind: 'instance', instanceId: instance.instanceId },
          removalReason: 'expired',
        },
        origin: this.opOrigin(participant.entity.id, rootActionId, `cc_clear.${instance.definitionId}`),
      })
    }
    this.emitAndSettle(ops, battle)
  }

  /**
   * ARCH-002 (M7) -- entity.stats is the LIVE effective view, not a
   * build-time constant: recompute it from the immutable resolved base +
   * the participant's active buff modifiers + the provider's live runtime
   * modifiers, then mirror speed into the participant cache (R2/AR-05:
   * participant.speed is a read-only cache of entity.stats.speed).
   */
  private refreshParticipantStats(participant: TurnBattleParticipant): void {
    const entity = participant.entity

    // The Tu Reimagined (plan Task 11, review P1.1) -- externalWard is
    // existence-bound to its source's marker instance; every buff
    // mutation seam (apply/lifecycle/remove/clear) already funnels into
    // this refresh, so reconcile lives here as the single choke point.
    // Read lanes are null-safe: an unwired battle owns no instances, so
    // the modifier set is legitimately empty (mutation lanes still fault
    // loudly through this.buffs/this.scheduler).
    reconcileExternalWard(
      entity,
      this.runtime?.buffs.getForTarget(entity.id) ?? [],
      this.registry,
    )

    entity.stats = recomputeEffectiveStats(
      entity.baseStats,
      this.runtime?.buffs.getStatModifiers(entity.id) ?? [],
      this.liveStatModifiers?.(entity) ?? [],
      participant.activeDomains,
    )
    participant.speed = entity.stats.speed

    // ARCH-002 (M7) -- entity.maxHp is the REAL vitals ceiling (heal clamp,
    // regen gate, entity_vitals_changed.maxHp, snapshot maxHp) and is
    // frozen at build; entity.stats.maxHp is the live effective view.
    // Reconcile here so a live maxHp modifier moves the heal ceiling the
    // same step it lands: shrink clamps currentHp through the vitals
    // authority (emits entity_vitals_changed carrying the new ceiling),
    // growth keeps currentHp -- no free heal.
    if (entity.stats.maxHp !== entity.maxHp) {
      entity.maxHp = entity.stats.maxHp
      this.combat.vitals.clampToMaxHp(entity, 'stat_refresh')
    }
  }

  /**
   * ARCH-002 (M7) -- refresh every participant's effective stats. Pacing
   * and actor-peek call this before any gauge/speed read so buff
   * apply/remove/expire and live runtime modifiers are already folded;
   * the battle builder also calls it once after construction so
   * formation buffs are effective before the first tick.
   */
  refreshEffectiveStats(battle: TurnBattle): void {
    for (const participant of [...battle.players, ...battle.enemies]) {
      this.refreshParticipantStats(participant)
    }
  }

  /**
   * Defect-fix Task 1 -- shared bởi tickPacing() và peekNextActor():
   * dequeue follow-up actor kế tiếp từ queue (nếu có, còn sống, dưới
   * reciprocity cap). Bỏ qua id của actor chết không tốn chain-depth.
   */
  private dequeueFollowUpActor(battle: TurnBattle): TurnBattleParticipant | null {
    // Task 11 -- prepared executions (repeat/multicast) drain FIRST: they
    // are the remainder of an already-committed cast and must resolve
    // before counter follow-ups and before any new gauge turn. Entries
    // for dead actors drop silently. Structurally bounded (repeatCasts
    // count / multicast depth cap) -- no reciprocity counter needed.
    const execQueue = battle.queuedExecutions

    if (execQueue && execQueue.length > 0) {
      const entry = execQueue.shift()!

      if (execQueue.length === 0) {
        battle.queuedExecutions = undefined
      }

      const execActor =
        battle.players.find((member) => member.id === entry.actorId) ??
        battle.enemies.find((enemy) => enemy.id === entry.actorId)

      if (execActor?.entity.alive) {
        this.pendingQueuedExecution = entry
        return execActor
      }

      return this.dequeueFollowUpActor(battle)
    }

    const queue = battle.queuedFollowUps

    if (!queue || queue.length === 0) {
      return null
    }

    if ((battle.followUpChainDepth ?? 0) >= MAX_FOLLOW_UP_CHAIN_DEPTH) {
      // Reciprocity guard tripped -- drop phần còn lại của queue, quay về
      // normal gauge order thay vì bounce vô hạn.
      battle.queuedFollowUps = undefined
      battle.followUpChainDepth = 0
      return null
    }

    const entry = queue.shift()

    if (!entry) {
      return null
    }

    if (queue.length === 0) {
      battle.queuedFollowUps = undefined
    }

    const queued =
      battle.players.find((member) => member.id === entry.actorId) ??
      battle.enemies.find((enemy) => enemy.id === entry.actorId)

    if (!queued || !queued.entity.alive) {
      // A dead queued actor is skipped without consuming chain-depth —
      // dead attackers must not receive queued payloads (spec 7.1).
      // Reads entity.alive: participant.alive is a cache synced only
      // inside the pacing loop, AFTER this dequeue.
      return this.dequeueFollowUpActor(battle)
    }

    battle.followUpChainDepth = (battle.followUpChainDepth ?? 0) + 1
    this.pendingReactiveEntry = entry

    return queued
  }

  /**
   * Intro phase pacing (2026-09-07 plan Task 4, flow: Intro -> Countdown ->
   * Spawn -> Gauge combat -> Wave -> Result): decrement introTurnsRemaining
   * by 1 per call. Reaching 0 flips state to 'countdown'. Called from
   * GameManager's pacing loop on the fixed step; NO combat logic runs
   * during the intro phase (gauges frozen, resolveNextStep untouched) -
   * same wait-phase contract as tickCountdown() below.
   */
  tickIntro(battle: TurnBattle): TurnBattleState {
    if (battle.state !== 'intro') {
      return battle.state
    }

    const remaining = (battle.introTurnsRemaining ?? 0) - 1

    if (remaining <= 0) {
      battle.introTurnsRemaining = 0
      battle.state = 'countdown'
    } else {
      battle.introTurnsRemaining = remaining
    }

    return battle.state
  }

  /**
   * Countdown phase pacing (flow: Countdown → Spawn → Gauge combat →
   * Wave → Result): giảm countdownTurnsRemaining 1 đơn vị/call. Đến 0 →
   * state chuyển 'fighting' (gauge bắt đầu chạy; enemies đã spawn đứng
   * sẵn). Gọi từ GameManager pacing loop theo fixed-step, KHÔNG gọi
   * resolveNextStep trong pha countdown.
   */
  tickCountdown(battle: TurnBattle): TurnBattleState {
    if (battle.state !== 'countdown') {
      return battle.state
    }

    const remaining = (battle.countdownTurnsRemaining ?? 0) - 1

    if (remaining <= 0) {
      battle.countdownTurnsRemaining = 0
      battle.state = 'fighting'
    } else {
      battle.countdownTurnsRemaining = remaining
    }

    return battle.state
  }

  /**
   * Gameplay fixes (2026-09-05) -- wall-clock pacing: mỗi pacing tick (0.1s
   * hệ sống) chỉ advance gauge MỘT step cho mọi actor; actor resolve CHỈ
   * khi gauge đầy. Trước đây updateBattleFixedStep gọi resolveNextStep()
   * mỗi tick -- inner-loop advance tới ready trong CÙNG call khiến 1 turn
   * = 1 tick (trận chớp mắt, không còn ai kịp thấy gì).
   *
   * Trả về actor ready (hoặc vừa resolve). `resolve` = true: turn đã chạy
   * hoàn tất headless (default path); `resolve` = false: CHỈ advance gauge
   * và trả ready actor -- GameManager presentation path sẽ điều phối
   * declare/impact/complete qua 3 acknowledge (Action Playback Task 6).
   */
  tickPacing(battle: TurnBattle, resolve = true): TurnBattleParticipant | null {
    if (battle.state !== 'fighting') {
      return null
    }

    // Turn-Based Wave Redesign (2026-09-06) -- wave-batch spawn/telegraph
    // chạy MỖI tick (không gate sau completeAction như cơ chế 1-quái-lần
    // trước đây): pending telegraph đếm ngược → materialize khi hết; sân
    // trống + hết pending + còn wave → queue cả wave mới đồng loạt.
    // Pending telegraph decrement KHÔNG phụ thuộc spawnEnemy factory —
    // materialize là việc hệ thống (đã build xong participant), chỉ wave-
    // start MỚI cần factory. Test 2 của plan chạy tickPacing không factory
    // mà vẫn kỳ vọng pending đếm ngược -- đúng ngữ nghĩa này.
    if (battle.wave) {
      const stillPending: PendingEnemySpawn[] = []

      for (const pending of battle.wave.pendingEnemySpawns) {
        const ticksRemaining = pending.ticksRemaining - 1

        if (ticksRemaining <= 0) {
          battle.enemies.push(pending.participant)
        } else {
          stillPending.push({ ...pending, ticksRemaining })
        }
      }

      battle.wave.pendingEnemySpawns = stillPending

      const aliveEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length

      if (
        this.spawnEnemy &&
        shouldStartNextWave(
          aliveEnemyCount,
          battle.wave.pendingEnemySpawns.length,
          battle.wave.waveIndex,
          battle.wave.waves.length,
        )
      ) {
        const waveSize = battle.wave.waves[battle.wave.waveIndex]!
        // Within-wave standing-slot dedupe (2026-09-07 bugfix) -- one set
        // shared across this wave-batch's spawns so enemies spawned in the
        // same wave claim distinct slots when the wave fits within the
        // 9-slot pool (see EnemySpawnPlacement.ts). A later wave starts a
        // fresh set, so it may reuse a slot vacated by an earlier wave's
        // dead enemy -- that is intended, not a bug.
        const occupiedSlots = new Set<string>()

        for (let index = 0; index < waveSize; index++) {
          const participant = this.spawnEnemy(occupiedSlots)
          const totalTicks = spawnTelegraphTicks(participant.entity)

          battle.wave.pendingEnemySpawns.push({ participant, ticksRemaining: totalTicks, totalTicks })
          battle.wave.spawnedCount += 1
        }

        battle.wave.waveIndex += 1
      }
    }

    // ARCH-002 (M7) -- fold every live stat source into entity.stats BEFORE
    // any gauge/speed read this step AND before the empty-field early
    // return below: during spawn/telegraph windows (no living enemies yet)
    // the refresh must still run so live modifiers (passive stacks,
    // persistent pool, timed effects) are effective for UI/stat reads and
    // for the first turn after materialization.
    this.refreshEffectiveStats(battle)

    const livingEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length

    if (livingEnemyCount === 0) {
      const pendingCount = battle.wave?.pendingEnemySpawns.length ?? 0
      const waveIndex = battle.wave?.waveIndex ?? 0
      const waveCount = battle.wave?.waves.length ?? 0
      const spawnedCount = battle.wave?.spawnedCount ?? 0
      const totalEnemyCount = battle.wave?.totalEnemyCount ?? 0

      const moreComing = pendingCount > 0 || waveIndex < waveCount

      if (moreComing) {
        for (const participant of [...battle.players, ...battle.enemies]) {
          participant.actionGauge = 0
        }

        return null
      }

      if (isStageComplete(spawnedCount, totalEnemyCount, livingEnemyCount, pendingCount)) {
        battle.state = 'victory'

        return null
      }
    }

    // Defect-fix Task 1 -- follow-up/counter queue TRƯỚC gauge order: queue
    // là production path duy nhất đọc (peekNextActor không chạy trong loop).
    const followUpActor = this.dequeueFollowUpActor(battle)

    if (followUpActor) {
      if (!resolve) {
        return followUpActor
      }

      this.resolveActorTurn(battle, followUpActor)

      return followUpActor
    }

    const allParticipants = [...battle.players, ...battle.enemies]

    for (const participant of allParticipants) {
      participant.alive = participant.entity.alive
    }

    const living = allParticipants.filter((actor) => actor.alive)

    if (living.length === 0) {
      return null
    }

    // MỘT gauge-step duy nhất cho mọi actor trong tick này.
    for (const actor of living) {
      advanceGauge(actor, 1)
    }

    const ready = living.filter(isGaugeReady).sort((a, b) => {
      if (a.speed !== b.speed) {
        return b.speed - a.speed
      }
      return a.priority - b.priority
    })

    const actor = ready[0]

    if (!actor) {
      return null
    }

    // Normal gauge-ready turn reset reciprocity chain (Defect-fix Task 1).
    battle.followUpChainDepth = 0

    if (!resolve) {
      return actor
    }

    this.resolveActorTurn(battle, actor)

    return actor
  }

  /**
   * Slice 7 (Completion Task 10) -- tìm actor kế tiếp SẴN SÀNG hành động
   * mà KHÔNG resolve gì cả. Gauge advancement chạy thật (mutation để
   * tìm ai tới lượt là thật và GIỮ NGUYÊN), nhưng dừng trước buff tick /
   * action resolution / turn-counter increment. GameManager manual mode
   * gọi method này trước để biết có cần pause chờ input player không;
   * resume sau đó bằng resolveActorTurn(battle, actor, chosenSlot).
   */
  peekNextActor(battle: TurnBattle): TurnBattleParticipant | null {
    // Countdown phase: combat chưa bắt đầu -- không ai tới lượt.
    if (battle.state !== 'fighting') {
      return null
    }

    // Defect-fix Task 1 -- dùng chung dequeue helper với tickPacing (queue
    // FIFO + reciprocity guard thay vì single-id overwrite cũ).
    const followUpActor = this.dequeueFollowUpActor(battle)

    if (followUpActor) {
      return followUpActor
    }

    const allParticipants = [...battle.players, ...battle.enemies]

    for (const participant of allParticipants) {
      participant.alive = participant.entity.alive
    }

    // ARCH-002 (M7) -- same effective-stat refresh as tickPacing so the
    // previewed actor order reflects live speeds.
    this.refreshEffectiveStats(battle)

    const resolved = resolveNextTurn(allParticipants)

    return resolved?.actor ?? null
  }

  /**
   * Action Playback Task 3 (2026-09-05) -- PHA 1/3: declare action (chọn
   * skill, tính target set, charge tick, CC check, buff/resource/boss
   * tick) NHƯNG KHÔNG áp damage. 3 call site resolveActionHit cũ được
   * hoãn sang applyActionImpact() (Task 3 spec §Task 3).
   */
  declareActorAction(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    forcedAction?: ForcedTurnChoice,
  ): TurnDeclaredAction {
    // Task 11 -- a queued repeat/multicast execution resolves HERE, ahead
    // of ALL turn machinery: no round/turn counting, no buff tick, no
    // regen, no CC check, no cooldown tick, no action selection. The
    // descriptor IS the remainder of an already-committed cast -- it only
    // re-resolves the payload (composite picks re-roll per execution).
    const queuedExec = this.pendingQueuedExecution
    this.pendingQueuedExecution = null

    if (queuedExec && queuedExec.actorId === actor.id) {
      return this.declareQueuedExecution(battle, actor, queuedExec)
    }

    // The Tu Reimagined (spec 7.1, plan v2.4 P0.1) -- a queued reactive
    // entry branches at the TOP: real action through declare -> impact,
    // but none of the natural-turn lifecycle below runs for it.
    if (this.pendingReactiveEntry?.actorId === actor.id) {
      const entry = this.pendingReactiveEntry
      this.pendingReactiveEntry = null

      if (!actor.entity.alive) {
        // Spec 7.1 -- dead attackers must not receive queued payloads; the
        // entry is consumed and resolves to nothing.
        return {
          actorId: actor.id,
          skillId: '',
          ccBlocked: false,
          isCharging: false,
          chargeResolved: false,
          chargeTargetIds: [],
          chargedSkill: null,
          action: null,
          opposingSide: [],
          affected: [],
          scaledDamage: null,
          suddenDeathMultiplier: 1,
          compositePickedSkills: null,
          isFollowUpBypass: true,
          actionSource: entry.actionSource,
          triggerContext: entry.triggerContext,
        }
      }

      return this.declareReactiveBypass(battle, actor, entry)
    }

    battle.totalTurnsElapsed = (battle.totalTurnsElapsed ?? 0) + 1

    // Round tracking (spec v3 D1 revision, 2026-09-12): a round completes
    // when every participant alive AT THIS MOMENT has declared an action
    // since the last boundary. Reads entity.alive - the participant.alive
    // cache is only synced inside the pacing loop, not here. A mid-round
    // spawn joins the current round (it is in alive and must act before
    // the boundary). totalTurnsElapsed stays a raw actor-action counter.
    const acted = (battle.actedThisRound ??= [])
    if (!acted.includes(actor.id)) {
      acted.push(actor.id)
    }
    const aliveNow = [...battle.players, ...battle.enemies].filter(
      (participant) => participant.entity.alive,
    )
    if (aliveNow.length > 0 && aliveNow.every((participant) => acted.includes(participant.id))) {
      battle.roundsElapsed = (battle.roundsElapsed ?? 0) + 1
      battle.actedThisRound = []

      // buff2 M4 -- round boundary: rounds-clocked buffs/modifiers tick
      // here (Phase B sweeps expirations inside the lifecycle drain).
      this.runBuffLifecycle(`status.round.${battle.roundsElapsed}.end`, battle, (lctx) =>
        this.buffs.onRoundEnd(lctx),
      )
    }

    // buff2 M4 -- holder-turn-start boundary at the action-declaration
    // entry (holder_turn_start periodics + Phase-B sweeps; no authored
    // defs use this timing yet but the hook is structurally live).
    this.runBuffLifecycle(`status.turn.${battle.totalTurnsElapsed}.${actor.id}.start`, battle, (lctx) =>
      this.buffs.onHolderTurnStart(actor.entity.id, lctx),
    )

    // Future Systems Task 7 -- charge state (Thế→Trảm). Charging takes
    // precedence: KHÔNG đụng CC counter Bá Thể (đã bất động tự nhiên,
    // không double penalty); buff tick/hpRegen/resource vẫn chạy (actor
    // vẫn sống); action resolution bị thay thế bởi charge tick/resolve;
    // wave-spawn + win-condition tail CHUNG ở cuối (không return sớm).
    const isCharging = (actor.chargingTurnsRemaining ?? 0) > 0
    let chargedSkillId = ''
    let chargeResolved = false
    let chargeTargetIds: string[] = []
    let chargedSkillCaptured: TurnSkillDefinition | null = null
    // Review fix (HIGH-2) -- `affected` is the single consumed target list:
    // a charge-resolve materializes its targets HERE too (the old shadowing
    // local kept `affected` empty, giving the Ho window a parallel lane it
    // could not substitute). chargeTargetIds stays as the hit-lane id copy.
    let affected: TurnBattleParticipant[] = []

    if (isCharging) {
      actor.chargingTurnsRemaining = (actor.chargingTurnsRemaining ?? 0) - 1

      if (actor.chargingTurnsRemaining === 0) {
        const chargedId = actor.pendingChargedSkillId
        const chargedSkill =
          chargedId !== undefined && actor.special?.skill.id === chargedId
            ? actor.special.skill
            : chargedId !== undefined && actor.ultimate?.skill.id === chargedId
              ? actor.ultimate.skill
              : undefined

        actor.pendingChargedSkillId = undefined

        if (chargedId) {
          chargedSkillId = chargedId
        }

        if (chargedSkill) {
          const opposingSide = battle.players.includes(actor) ? battle.enemies : battle.players
          const primaryTarget = selectTarget(actor, opposingSide, undefined, (entityId) => this.tauntSourceId(entityId as CombatEntityId))

          if (primaryTarget) {
            affected = collectTurnTargets(primaryTarget, opposingSide, chargedSkill.targeting)

            // Defect Task 8 (2026-09-05): damage tính lại ở applyActionImpact()
            // (đọc declared.chargedSkill + roundsElapsed độc lập) -- không
            // cần tính trùng ở đây.
            chargeTargetIds = affected.filter((target) => target.entity.alive).map((target) => target.id)
            chargedSkillCaptured = chargedSkill
          }
        }

        actor.chargingTurnsRemaining = undefined
        chargeResolved = true
      }
    }

    // Action Playback Task 5 -- onCastBegin reactive trigger TRƯỚC CC-check:
    // punish-on-cast áp hard-CC buff lên actor, CC-check kế tiếp đọc state
    // mới → ccBlocked đúng theo spec §4.2 ordering.
    if (this.registry && this.runtime !== undefined) {
      this.procs.rollReactiveTrigger(
        actor.entity.id,
        'onCastBegin',
        undefined,
        `action.turn.${battle.totalTurnsElapsed}.${actor.id}.castbegin`,
      )
    }

    // CC check TRƯỚC tick: buff stun/freeze duration=N phải block đúng N
    // lượt của holder (áp ở lượt N-1, block lượt N..N+1, hết sau khi block
    // lượt cuối). Tick trước sẽ làm duration-1 expire trước khi kịp block.
    // Bá Thể: bị hard-CC liên tục >= 3 lượt thì lượt thứ 4 tự gỡ CC và
    // hành động (fairness guard -- không ai bị khóa vĩnh viễn).
    //
    // isCharging skip hoàn toàn khối này (Defect-fix Task 2, 2026-09-05):
    // charging đã có hành động thay thế riêng (charge tick/resolve, xem
    // khối phía trên) -- actor không hề bị "chặn" bởi CC trong lượt này,
    // nên KHÔNG tính vào consecutiveHardCcTurns (tránh Bá Thể clear sớm
    // sai) và ccBlocked phải là false (tránh log mâu thuẫn: ccBlocked=true
    // kèm skillId/damage thật của charge resolve).
    let ccBlocked: boolean

    if (isCharging) {
      ccBlocked = false
    } else if (this.runtime !== undefined && this.buffs.getForTarget(actor.entity.id).some((i) => i.definitionId === 'bat_tu_ba_the')) {
      // Bat Tu Ba The (The Tu Reimagined plan Task 9, D10): while the
      // buff is active, hard CC cannot block the holder. The counter is
      // SUPPRESSED, not reset -- consecutiveHardCcTurns is left untouched
      // so accumulation resumes where it left off after the buff expires.
      ccBlocked = false
    } else {
      const hardCcActive =
        this.runtime !== undefined &&
        (this.buffs.hasControl(actor.entity.id, 'stun') ||
          this.buffs.hasControl(actor.entity.id, 'freeze'))

      if (hardCcActive && actor.consecutiveHardCcTurns >= 3) {
        this.clearHardCc(actor, battle, `status.cc_clear.${battle.totalTurnsElapsed}.${actor.id}`)
        actor.consecutiveHardCcTurns = 0
        actor.baTheTriggeredAtTurn = battle.totalTurnsElapsed
        ccBlocked = false
      } else if (hardCcActive) {
        actor.consecutiveHardCcTurns += 1
        ccBlocked = true
      } else {
        actor.consecutiveHardCcTurns = 0
        ccBlocked = false
      }
    }

    // Cooldown snapshot BEFORE the status phase: a lethal DoT tick inside
    // the holder-turn-end lifecycle can make a survive-lethal source spend
    // a slot's cooldown (Bat Tu Ba The, spec 5.1 -- the commit lands
    // mid-phase). tickCooldowns below skips any slot whose cooldown rose
    // above this snapshot; a mid-phase commit counts own-turns from the
    // NEXT turn, never losing a turn to the tick that immediately follows
    // the phase that set it.
    const cooldownsBeforeStatusPhase = new Map<TurnSkillSlot, number>()
    if (actor.special) {
      cooldownsBeforeStatusPhase.set(actor.special, actor.special.remainingCooldownTurns)
    }
    if (actor.ultimate) {
      cooldownsBeforeStatusPhase.set(actor.ultimate, actor.ultimate.remainingCooldownTurns)
    }

    // buff2 M4 -- the legacy BuffSystem.update() status phase maps to the
    // holder_turn_end boundary: holder_turn_end periodics (DoTs) emit
    // typed requests through the lifecycle sink, holder_turns clocks
    // decrement, Phase B sweeps expirations. Same position = same
    // ordering as the legacy update() call.
    this.runBuffLifecycle(`status.turn.${battle.totalTurnsElapsed}.${actor.id}.end`, battle, (lctx) =>
      this.buffs.onHolderTurnEnd(actor.entity.id, lctx),
    )

    // ARCH-002 (M7) -- refresh immediately after the buff tick so an
    // expiry inside update() is reflected before the very next stat read
    // (hpRegenPerTurn below must not fire one extra turn off an expired
    // buff). The refresh after bossTrigger below still covers
    // trigger-granted buffs for action selection.
    this.refreshParticipantStats(actor)

    // M8 (ARCH-010) -- post-status liveness boundary: a status/DoT tick
    // that killed the actor ends the turn HERE -- no regeneration, no
    // resource deltas, no boss trigger, no action selection, and no
    // charged-hit resolution downstream (chargeResolved is forced off so
    // applyActionImpact's early charge branch cannot fire post-death
    // hits). Follow-up bypass bookkeeping still drains so the flag can
    // never leak into a later turn.
    if (!actor.entity.alive) {
      return {
        actorId: actor.id,
        skillId: '',
        ccBlocked,
        isCharging,
        chargeResolved: false,
        chargeTargetIds: [],
        chargedSkill: null,
        action: null,
        opposingSide: [],
        affected: [],
        scaledDamage: null,
        suddenDeathMultiplier: 1,
        compositePickedSkills: null,
        isFollowUpBypass: false,
      }
    }

    // M8 (ARCH-003) -- per-turn HP/MP/Ward regeneration through the vitals
    // authority, AFTER the status tick and liveness boundary above (a
    // lethal DoT leaves no regen). The *RegenPerTurn stats tick once per
    // entity turn -- the same cadence family as hpRegenPerTurn (R1/AR-01
    // already routed HP regen through the vitals authority). Ward keeps
    // its delayed-regen intent: turnsSinceLastHitLanded advances on the
    // holder's own turn cadence and CombatSystem resets it to 0 on every
    // landed hit.
    actor.entity.turnsSinceLastHitLanded += 1

    this.combat.applyTurnRegen(
      actor.entity,
      {
        hp: actor.entity.stats.hpRegenPerTurn,
        mp: actor.entity.stats.manaRegenPerTurn,
        ward:
          actor.entity.turnsSinceLastHitLanded >= WARD_REGEN_DELAY_TURNS
            ? actor.entity.stats.wardRegenPerTurn
            : 0,
      },
      actor.entity.id,
    )

    if (actor.resources) {
      actor.resources.values = applyTurnStartDeltas(actor.resources.values, actor.resources.deltasPerTurn)
    }

    if (
      actor.bossTrigger &&
      !actor.bossTrigger.firedAlready &&
      this.registry &&
      this.runtime !== undefined &&
      isTurnTriggerReady({ afterTurns: actor.bossTrigger.afterTurns }, battle.roundsElapsed ?? 0)
    ) {
      // Phase A2 (2026-09-07) -- BuffDefinitionCatalog.get() THROWS on an
      // unknown id, and bossTrigger data is now populated for real
      // enemies (content drift / renamed buff id would crash the whole
      // battle tick). Skip the buff gracefully instead -- same
      // try/catch skip pattern as GameManager's formation-buff lookup.
      // firedAlready stays false so a corrected id can still fire later.
      let definition: BuffDefinition | undefined

      try {
        definition = this.registry.get(actor.bossTrigger.buffDefinitionId)
      } catch {
        definition = undefined
      }

      if (definition) {
        this.emitAndSettle([
          this.applyBuffOp(
            definition.id,
            actor.entity.id,
            actor.entity.id,
            1,
            1,
            'suppressed',
            `status.bosstrigger.${battle.totalTurnsElapsed}.${actor.id}`,
            `bosstrigger.${definition.id}`,
          ),
        ], battle)

        actor.bossTrigger.firedAlready = true
      }
    }

    // ARCH-002 (M7) -- unconditional effective-stat refresh at every
    // declare: buff expiry (BuffSystem.update above), duration-1 buffs,
    // boss-trigger applications, Ba The CC clears and the live runtime
    // modifiers all land here -- including for CC-blocked and charging
    // actors, whose stat view must not freeze while locked.
    this.refreshParticipantStats(actor)

    let action: SelectedAction | null = null
    let opposingSide: TurnBattleParticipant[] = []
    let scaledDamage: ActionDamageInfo | null = null
    let suddenDeathMultiplierCaptured = 1
    let compositePickedSkills: readonly TurnSkillDefinition[] | null = null
    let execution: TurnSkillExecution | undefined
    let payloadSkill: TurnSkillDefinition | null = null

    // Charging turn (tick hoặc resolve): action resolution BỊ THAY THẾ
    // hoàn toàn bởi charge block (tick → không hit; resolve → hits đã push
    // ở charge block). Cooldown của special đã commit ở charge-init lượt
    // trước, không commit lại ở đây.
    // Ung The beta -- the holder's next NATURAL action resets Ung Tre /
    // Qua The (design Part III). 'Performs' means an action actually
    // executes this turn: a ccBlocked or charge-tick turn performs none
    // (the charge RESOLVE turn does), matching the income gate's reading
    // of the same boundary. A queued reactive entry above is not a
    // natural action and never resets. The The pool is untouched.
    if (!ccBlocked && (!isCharging || chargeResolved)) {
      actor.reactionDebt = 0
    }

    if (actor.entity.alive && !ccBlocked && !isCharging) {
      // Slots whose cooldown was (re)committed during this turn's status
      // phase -- value above its pre-update snapshot, or a slot object
      // that did not exist then -- do not tick again in the same turn.
      const cooldownsCommittedInStatusPhase = new Set<TurnSkillSlot>()

      for (const slot of [actor.special, actor.ultimate]) {
        if (!slot) {
          continue
        }

        const turnsBeforeStatusPhase = cooldownsBeforeStatusPhase.get(slot)

        if (turnsBeforeStatusPhase === undefined || slot.remainingCooldownTurns > turnsBeforeStatusPhase) {
          cooldownsCommittedInStatusPhase.add(slot)
        }
      }

      tickCooldowns(actor, cooldownsCommittedInStatusPhase)

      // ARCH-002 (M7) -- the effective-stat refresh moved above the gate
      // (covers expiry/CC/charge too); action selection reads the fresh
      // entity.stats.
      // Reaction M4 (contract sec.71) -- the actor's action-tag
      // restriction set is computed ONCE per declaration here and passed
      // into both selection channels (Cam Cong). No registry -> no
      // validator -> undefined -> unsealed selection identical to today.
      const forbiddenActionTags = this.actionValidator?.forbiddenActionTags(actor.entity.id)

      action = forcedAction
        ? selectForcedAction(actor, forcedAction, forbiddenActionTags)
        : selectAction(actor, forbiddenActionTags)

      // R-E -- skillId '' marks the sealed NULL_ACTION (Cam Cong): it
      // flows harmlessly through the pipeline below (skill null skips
      // empowerment/composite/charge; targeting is gated) and maps to
      // the existing empty-turn shape (action: null) in the return --
      // never a forbidden pick, never a stun flag.

      // Phase A3 (2026-09-07) -- enemy specialAttacks reader, ported from
      // legacy EnemyAttackSystem.fireEnemyAttack()'s everyNth semantics
      // (module retired M13 -- ported here):
      // 1-based counter on the actor's OWN actions; when
      // counter % everyNth === 0 the matching special attack's
      // damageMultiplier replaces the basic attack's damage (presetId
      // carries for presentation). Only applies to plain basic attacks
      // (slot null) -- explicit skills (special/ultimate slots) are never
      // replaced. Counter never resets mid-battle; undefined coerces to 0.
      // The Tu Reimagined (plan Task 10, D6) -- scripted specials are
      // TAUNT-EXEMPT: their positional pick is part of the authored
      // script, so the selectTarget call below passes ignoreTaunt.
      let scriptedSpecial = false

      if (action.skillId !== '' && !action.slot && actor.entity.specialAttacks?.length) {
        const attackCount = (actor.specialAttackCounter ?? 0) + 1

        actor.specialAttackCounter = attackCount

        const specialAttack = actor.entity.specialAttacks.find(
          (candidate) => attackCount % candidate.everyNth === 0,
        )

        if (specialAttack) {
          scriptedSpecial = true
          action = {
            ...action,
            damage: { kind: 'physical', multiplier: specialAttack.damageMultiplier },
          }
        }
      }

      // Task 9 -- execution record: rootSkillId owns cast/cooldown/slot
      // identity; resolvedSkill owns the payload. All casts today are
      // 'original' (resolvedSkill === action.skill); Tasks 10-13 diverge
      // them for empowered/composite/repeat/multicast executions.
      execution = {
        rootSkillId: action.skillId,
        resolvedSkill: action.skill,
        source: 'original' as const,
      }

      // Task 10 -- ultimate empowerment: enough The swaps the RESOLVED
      // payload to the empowered form. The ROOT identity (cooldown,
      // cast count, charge state) stays the root skill; the pool
      // itself burns at commit time via consumesAllThe.
      const empowerment = action.skill?.empowerment

      if (empowerment && (actor.entity.currentThe ?? 0) >= empowerment.theThreshold) {
        execution = {
          rootSkillId: action.skillId,
          resolvedSkill: empowerment.empowered,
          source: 'empowered',
        }
        action = {
          ...action,
          damage: empowerment.empowered.damage,
          targeting: empowerment.empowered.targeting,
        }
      }

      // Task 11 -- element_basic composite pick: the root skill authored a
      // uniform pick among a def-carried pool; picks[0] becomes THE
      // resolved payload (the cast executes AS it), extras resolve
      // damage-only through the shared picks lane. Identity stays on the
      // root (source 'composite' still commits the root's cast).
      const composite = action.skill?.compositePicks

      if (composite?.poolType === 'element_basic' && composite.pool.length > 0) {
        const picks = pickCompositePool(composite.pool, composite.count, () => this.rng.roll())

        if (picks.length > 0) {
          execution = {
            rootSkillId: action.skillId,
            resolvedSkill: picks[0]!,
            source: 'composite',
          }
          action = {
            ...action,
            damage: picks[0]!.damage,
            targeting: picks[0]!.targeting,
          }
          compositePickedSkills = picks.length > 1 ? picks.slice(1) : null
        }
      }

      payloadSkill = execution.resolvedSkill

      // Cam Cong -- the RESOLVED payload is the action's real
      // classification: an empowerment/composite swap can surface an
      // attack payload from a non-attack root def (the seal was checked
      // at selection on the root). If the resolved payload carries a
      // forbidden tag the action has no legal outcome -- it collapses
      // to the sealed empty turn (R-E).
      if (
        payloadSkill !== null &&
        forbiddenActionTags !== undefined &&
        actionTagsOfSkill(payloadSkill).some((tag) =>
          forbiddenActionTags.has(tag),
        )
      ) {
        action = NULL_ACTION
      }

      // Task 13 -- capture the PRE-BURN pool when the resolved payload is
      // a consume-all form: the pool only zeroes at commitCast (after
      // hits resolve), so theScaling must read the value captured here.
      if (payloadSkill?.consumesAllThe) {
        execution.theBurned = actor.entity.currentThe ?? 0
      }

      const isChargeInit = (action.skill?.chargeTurns ?? 0) > 0

      if (isChargeInit) {
        // Future Systems Task 7 -- charge INITIATION (Thế): KHÔNG resolve
        // ngay -- ghi charge state, đòn tự resolve khi charge xong (Trảm).
        // Cooldown/resource vẫn commit như cast thường (commitAction).
        actor.chargingTurnsRemaining = action.skill!.chargeTurns
        actor.pendingChargedSkillId = action.skillId
      }

      const targetScope = payloadSkill?.targetScope ?? 'enemy'

      if (targetScope === 'self') {
        affected = [actor]
        scaledDamage = null
      } else {
        opposingSide = battle.players.includes(actor) ? battle.enemies : battle.players
        // R-E -- a sealed NULL_ACTION collects no targets: the turn is
        // EMPTY (affected stays [], scaledDamage stays null).
        const primaryTarget = action.skillId !== ''
          ? selectTarget(actor, opposingSide, { ignoreTaunt: scriptedSpecial }, (entityId) => this.tauntSourceId(entityId as CombatEntityId))
          : null

        if (primaryTarget && !isChargeInit) {
          affected = collectTurnTargets(primaryTarget, opposingSide, payloadSkill?.targeting ?? action.targeting)

          if (action.damage) {
            const suddenDeathMultiplier = this.suddenDeathDamageMultiplier(battle.roundsElapsed ?? 0)
            suddenDeathMultiplierCaptured = suddenDeathMultiplier
            let resolvedDamage = suddenDeathMultiplier === 1 ? action.damage : scaleActionDamage(action.damage, suddenDeathMultiplier)

            // Task 13 -- theScaling (nuke variant): final damage x
            // (1 + theBurned/100 x coeff) folded into the damage packet
            // once; every target's hit resolves through it uniformly.
            const theScaling = payloadSkill?.theScaling
            if (theScaling && execution.theBurned) {
              resolvedDamage = scaleActionDamage(resolvedDamage, 1 + (execution.theBurned / 100) * theScaling.coeff)
            }

            scaledDamage = resolvedDamage
          }
        }
      }
    }

    // skillId phản ánh charge state (tick → pending id; resolve → charged
    // id; normal → action.skillId; CC-blocked → '').
    const skillId = chargeResolved
      ? chargedSkillId
      : isCharging
        ? actor.pendingChargedSkillId ?? chargedSkillId
        : (action?.skillId ?? '')

    return {
      actorId: actor.id,
      skillId,
      ccBlocked,
      isCharging,
      chargeResolved,
      chargeTargetIds,
      chargedSkill: chargedSkillCaptured,
      // R-E -- the sealed NULL_ACTION (skillId '') maps to the existing
      // empty-turn shape: action null, no provenance, no execution
      // record (same as CC-blocked/charge-resolve turns).
      action: action?.skillId === '' ? null : action,
      opposingSide,
      affected,
      scaledDamage,
      // Charge-resolve re-derives the multiplier at resolve time (the
      // action-selection capture above never ran for a charging actor) --
      // the declared record carries it so both lanes read one source.
      suddenDeathMultiplier: chargeResolved
        ? this.suddenDeathDamageMultiplier(battle.roundsElapsed ?? 0)
        : suddenDeathMultiplierCaptured,
      compositePickedSkills,
      isFollowUpBypass: false,
      // Provenance follows the committed action, not the `action`
      // capture: a charge-RESOLVED declare executes the charged skill
      // (a natural cast) while ccBlocked / charge tick / the sealed
      // NULL_ACTION commit nothing and carry undefined.
      actionSource:
        action != null && action.skillId !== ''
          ? action.slot
            ? 'skill'
            : 'normal'
          : chargeResolved
            ? 'normal'
            : undefined,
      // Task 9 -- every real cast records its execution identity here:
      // 'original' for now (empowered/composite/repeat/multicast arrive
      // with Tasks 10-13). Charge-resolve/CC-blocked turns carry none.
      execution: action?.skillId === '' ? undefined : execution,
    }
  }

  /**
   * Action Playback Task 3 (2026-09-05) -- PHA 2/3: áp damage của declared
   * action (3 call site resolveActionHit cũ -- charge-resolve, normal,
   * Reaction Path) + commitAction + appliesBuff application. Trả về
   * targetIds hit thành công.
   */
  applyActionImpact(
    battle: TurnBattle,
    declared: TurnDeclaredAction,
  ): { targetIds: string[]; extraImpacts: TurnActionExtraImpact[] } {
    const targetIds: string[] = []
    const extraImpacts: TurnActionExtraImpact[] = []
    // The Tu Reimagined (spec 6.2.3, plan Task 18) -- participants that
    // took a LANDED damaging hit this action; feeds the Tro window's
    // triggering_targets set.
    const landedTargets: TurnBattleParticipant[] = []
    const actor =
      battle.players.find((member) => member.id === declared.actorId) ??
      battle.enemies.find((enemy) => enemy.id === declared.actorId)

    if (!actor) {
      return { targetIds, extraImpacts }
    }

    // Phan Chan queue is action-scoped -- drop leftovers from an aborted
    // action before this action queues its own (defensive; a mid-action
    // throw already failed loudly upstream).
    if (this.runtime !== undefined) {
      this.procs.discardPendingReflects()
    }

    // buff2 M-INT -- the legacy per-participant wuxing-initiation flag is
    // gone: reaction eligibility is instance metadata on the apply_buff
    // ops (every application marks 'eligible'; the elemental registry
    // owns which definitionIds map to canonical states). The reaction
    // GATE moved to the 'elemental_reaction_enabled' capability grant --
    // granted party-wide in production by the Van Phap Than Hoa aura
    // (battle entry, ReactionStatusBuffs.ts), and the registered
    // dispatcher consumes the committed events this lane emits.

    // Ung The beta -- per-action hit-outcome scratch: every damage op
    // (either lane) records its target's outcome; the post-action Phan
    // window reads the aggregate (multi-hit = one check, design Part VI).
    this.hitOutcomeScratch.clear()

    // Spec 6.2.1 -- the Ho window sits between declaration and impact:
    // a successful protectChance roll rewrites declared.affected before
    // the hit loop, so the substituted hit resolves fully vs the
    // protector. Presentation reads the post-substitution targetIds.
    this.resolveInterceptWindow(battle, declared, actor)

    // Ung The beta -- Tham An (design Part IV): casting Tham The marks
    // the target as observed BEFORE the hit resolves (a miss/dodge still
    // plants the mark -- observation is not damage). One focus: the set
    // overwrites any previous mark; death lazy-clears with no transfer.
    this.applyThamMark(battle, actor, declared)

    // Charge-resolve turn: hits apply từ chargedSkill capture tại declare
    // (pendingChargedSkillId đã clear ở declare -- đọc declared.chargedSkill).
    if (declared.isCharging && declared.chargeResolved) {
      // skilldef M5b -- the deferred resolve routes the charged def
      // through the plan pipeline verbatim (payloadOnly: the slot root,
      // never the init's payload resolution), non-committing (the cast
      // committed at charge-init). Unsupported defs keep the legacy
      // lane below with their loud catalog report.
      const routed =
        this.runtime !== undefined && declared.chargedSkill != null
          ? this.planPipeline.routeCast(battle, actor, declared)
          : null

      if (routed !== null) {
        targetIds.push(...routed.landedTargetIds)
        landedTargets.push(...routed.landedTargets)
        // Fall through -- the shared Tro window at the tail fires once,
        // same as the legacy lane's own call below.
      } else if (this.runtime !== undefined) {
        // M5d -- adapter-unsupported charged def on a live battle: the
        // deferred resolve reports loudly and fizzles (the charge state
        // was already consumed at declare).
        this.reportUnroutedCast(
          actor,
          declared.chargedSkill,
          actor.pendingChargedSkillId ?? declared.action?.skillId,
          true,
        )
      } else {
        const chargedSkill = declared.chargedSkill
        let chargedCrit = false

        if (chargedSkill && chargedSkill.damage) {
          const opposingSide = battle.players.includes(actor) ? battle.enemies : battle.players

          const suddenDeathMultiplier = declared.suddenDeathMultiplier
          const chargedDamage = suddenDeathMultiplier === 1
            ? chargedSkill.damage
            : scaleActionDamage(chargedSkill.damage, suddenDeathMultiplier)

          for (const target of declared.chargeTargetIds) {
            // Mid-impact death: a reflect/proc kill on the actor stops the
            // rest of the action -- the dead cannot finish their swing.
            if (!actor.entity.alive) break

            const targetParticipant = opposingSide.find((p) => p.id === target)

            if (!targetParticipant || !targetParticipant.entity.alive) continue

            // Same per-hit authority as the normal lane (resolveDeclaredHit):
            // defender income, leech, consume effects, on-hit procs, the
            // Reflection queue, ailments, detonate, the taken-side Phan /
            // evade windows and both stat refreshes are all owned there -
            // a charged hit must not bypass them. The missing-HP scalar
            // resolves inside against the actor's live hp, so the scaled
            // damage packet passes through raw.
            const hitResult = this.resolveDeclaredHit(
              battle,
              actor,
              targetParticipant,
              chargedDamage,
              chargedSkill,
              declared,
            )

            if (!hitResult.dodged) {
              targetIds.push(target)
              landedTargets.push(targetParticipant)

              if (hitResult.critical) {
                chargedCrit = true
              }
            }
          }
        }

        // M8 (ARCH-010) -- the shared per-action The gain below lives past
        // this branch's early return, so a charged completion fires it
        // HERE, exactly once. Task 8 -- the gain is the SKILL's authored
        // field, not slot inference: the charged def carries
        // theGainOnLandedCast/theGainOnCrit itself. Ordering parity with
        // the normal path is preserved: the cast resource/cooldown was
        // already committed at charge-init, so the gain lands on the
        // post-consume pool -- Bat Kiem Thuat accrues currentThe at hit
        // completion and Tru Tien Kiem Tran stays reachable. Gated on
        // LANDED targets like the normal path's targetIds requirement.
        if (chargedSkill && targetIds.length > 0) {
          this.grantTheFromCast(actor, chargedSkill, chargedCrit)
        }

        this.resolvePostActionWindows(battle, actor, declared, landedTargets)

        return { targetIds, extraImpacts }
      }
    }

    // 9.5 #9 -- charge-init commits its cast HERE, not in the
    // affected-gated block below: enemy-targeted charge skills collect
    // targets only at resolve time, so `affected` stays empty at declare
    // and the block below never ran for them -- their cooldown/resource
    // were never committed (dead isChargeInit branch). The charge-resolve
    // turn returns early above and never reaches this point.
    // skilldef M5b/M5d -- the commit rides the plan pipeline when the
    // def is adapter-covered (commitShell + consume ops through the
    // scheduler); an adapter-unsupported charge def on a live battle
    // reports loudly and never commits; the engine-unit lane keeps
    // commitCast (no scheduler exists there to route through).
    if (
      declared.action &&
      (declared.action.skill?.chargeTurns ?? 0) > 0 &&
      executionCommitsCast(declared.execution)
    ) {
      const routed =
        this.runtime !== undefined
          ? this.planPipeline.routeCast(battle, actor, declared)
          : null
      if (routed === null) {
        if (this.runtime === undefined) {
          this.commitCast(actor, declared)
        } else {
          this.reportUnroutedCast(actor, declared.action.skill, declared.action.skillId, true)
        }
      }
    }

    // M5d -- the coverage signal must not depend on target luck: an
    // adapter-unsupported non-charge cast reports even when `affected`
    // collected empty (the gate below would otherwise skip it). The
    // ROUTE itself stays inside the gate -- committing a zero-target
    // cast is a commit legacy never performed.
    if (
      declared.action &&
      (declared.action.skill?.chargeTurns ?? 0) === 0
    ) {
      this.reportUnroutedCast(actor, declared.action.skill, declared.action.skillId)
    }

    if (declared.action && declared.affected.length > 0) {
      const action = declared.action

      // Task 9 -- payload reads go through the execution's resolvedSkill
      // (== action.skill for 'original' casts today; diverges for
      // empowered/composite payloads in Tasks 10-13). Identity reads
      // (cooldown, cast sink, charge state) stay on the ROOT action.
      const payloadSkill = declared.execution?.resolvedSkill ?? action.skill

      // Task 8 -- theGainOnCrit fires once per CAST when any direct hit
      // crits (INV-15): collect the flag across the hit loops, grant
      // once below -- never per target.
      let castCritLanded = false

      // R5 (AR-14) -- Emit authoritative gameplay 'attack' event on action commit,
      // ensuring passive listeners receive events identically in headless and presentation modes.
      this.combat.eventBus.emit('attack', {
        type: 'attack',
        sourceId: actor.id,
        targetId: declared.affected[0]?.id ?? actor.id,
        skillId: declared.skillId,
      })

      // skilldef M4e/M5d -- the plan pipeline: adapter-covered casts
      // route LegacySkillAdapter -> SkillResolver -> SkillExecutor ->
      // scheduler while the resolveDeclaredHit consequence chain
      // replays through execution hooks (income/procs/windows/refresh/
      // sweep fire at the same slots). The legacy lanes below now serve
      // ONLY the engine-unit configuration (runtime === undefined --
      // no scheduler exists to route through); a runtime-present cast
      // the adapter cannot express reports loudly and resolves to a
      // no-op -- one ACTIVE pipeline, nothing falls back silently.
      const routed = this.tryPlanCast(battle, actor, declared)
      const engineUnitLane = this.runtime === undefined
      if (routed === null && !engineUnitLane) {
        this.reportUnroutedCast(actor, action.skill, action.skillId, true)
      }

      if (routed !== null) {
        targetIds.push(...routed.landedTargetIds)
        landedTargets.push(...routed.landedTargets)
        // Non-damaging lane parity (the else-branch below): every
        // affected target that was ALIVE when its apply op settled is
        // pushed unconditionally -- the roll's own outcome never gates.
        if (
          !declared.scaledDamage &&
          !declared.compositePickedSkills?.length &&
          payloadSkill?.targetScope !== 'self'
        ) {
          for (const appliedId of routed.appliedTargetIds) {
            if (!targetIds.includes(appliedId)) {
              targetIds.push(appliedId)
            }
          }
        }
      }

      if (engineUnitLane && declared.compositePickedSkills?.length) {
        for (const pickedSkill of declared.compositePickedSkills) {
          if (!pickedSkill.damage) continue

          const pickedDamage = declared.suddenDeathMultiplier === 1
            ? pickedSkill.damage
            : scaleActionDamage(pickedSkill.damage, declared.suddenDeathMultiplier)

          for (const target of declared.affected) {
            if (!actor.entity.alive) break // mid-impact death (T3-22b)
            if (!target.entity.alive) continue

            const hitResult = this.resolveDeclaredHit(
              battle,
              actor,
              target,
              pickedDamage,
              pickedSkill,
              declared,
            )

            if (!hitResult.dodged) {
              targetIds.push(target.id)
              landedTargets.push(target)

              if (hitResult.critical) {
                castCritLanded = true
              }
            }
          }
        }
      }

      if (engineUnitLane && declared.scaledDamage) {
        for (const target of declared.affected) {
          if (!actor.entity.alive) break // mid-impact death (T3-22b)
          // Kiem Tu Reimagined Task 2 -- multi-instance defs (Ngu phi kiem):
          // each instance runs the FULL landed-hit pipeline independently
          // and stops early when the target dies.
          const instanceCount = action.skill?.instances?.count ?? 1
          let targetLanded = false

          for (let instanceIndex = 0; instanceIndex < instanceCount; instanceIndex++) {
            // Mid-impact death (T3-22b): a reflect/proc kill on the actor
            // between instances stops the rest — a dead caster's
            // remaining phi kiem never swing (mission C audit regression).
            if (!actor.entity.alive || !target.entity.alive) break

            const hitOptions = action.skill?.instances?.perInstanceOptions?.(instanceIndex, target.entity)
            const hitResult = this.resolveDeclaredHit(
              battle,
              actor,
              target,
              declared.scaledDamage,
              payloadSkill ?? null,
              declared,
              hitOptions,
            )

            if (!hitResult.dodged) {
              targetLanded = true

              if (hitResult.critical) {
                castCritLanded = true
              }
            }
          }

          if (targetLanded) {
            targetIds.push(target.id)
            landedTargets.push(target)
          }
        }
    } else if (
      engineUnitLane &&
      !declared.compositePickedSkills?.length &&
      payloadSkill?.targetScope !== 'self'
    ) {
      // Non-damaging action targeting enemies (e.g. pure debuff skill
      // like doc_chuong). Skipped when the composite-picks lane ran —
      // this else is the THIRD branch of the original picks/scaledDamage/
      // non-damaging chain; with picks in flight it must stay silent.
      for (const target of declared.affected) {
        if (!actor.entity.alive) break // mid-impact death (T3-22b)
        if (!target.entity.alive) continue
        targetIds.push(target.id)

        // ARCH-002 (M7) -- refresh both sides (same as the damaging
        // path). Ailment/detonate mechanics do not exist on the
        // engine-unit lane -- no buff authority is wired there.
        this.refreshParticipantStats(target)
        this.refreshParticipantStats(actor)
      }
    }

      // Charge-init is committed in the pre-block above (it cannot rely
      // on `affected` -- empty for enemy-targeted charge skills). Only
      // non-charge casts commit here.
      if ((action.skill?.chargeTurns ?? 0) === 0) {
        if (engineUnitLane) {
          // Task 9 -- repeat/multicast follow-up executions resolve the
          // payload WITHOUT re-committing the root's cast: no second
          // cooldown, no second cast-count (INV-18 structural).
          if (executionCommitsCast(declared.execution)) {
            this.commitCast(actor, declared)
          }

          // Task 8 -- The gain is skill-authored (theGainOnLandedCast /
          // theGainOnCrit), once per cast that landed >=1 valid target --
          // slot position is no longer a gain rule and target/hit count
          // never multiplies it (INV-15). A self-scoped cast always lands
          // on the caster (its targetIds entry is pushed by the buff
          // block below -- too late to serve as the landed signal here).
          // Runs AFTER commitAction so an ultimate's pool consumption
          // (100 -> 0) is already reflected -- the gain lands on the
          // post-cast pool, preserving legacy's gain-after-consume
          // ordering. Deliberately NOT inside the registry gate: The gain
          // is engine-native resource accrual, not buff-registry content.
          if (payloadSkill && (targetIds.length > 0 || payloadSkill.targetScope === 'self')) {
            this.grantTheFromCast(actor, payloadSkill, castCritLanded)
          }

          for (const buffSpec of payloadSkill?.appliesBuffs ??
            (payloadSkill?.appliesBuff ? [payloadSkill.appliesBuff] : [])) {
            this.applyDeclaredBuff(battle, actor, buffSpec, declared.affected)
          }
        }
        // Routed casts: the plan owns commit (commitShell), the cost
        // (consume_resource op), the consume-all burn, the grants and
        // the appliesBuffs ops -- none of it re-runs here.

        if (payloadSkill?.targetScope === 'self') {
          targetIds.push(actor.id)
        }

        // Kiem Tu Reimagined Task 2 -- dynamicBasic post-resolution hook.
        // The provider owns path rules (Kiem Y gain, combo tail-match);
        // extra defs it returns execute as additive declared impacts
        // through the SAME landed-hit pipeline (resolveDeclaredHit).
        if (actor.dynamicBasic?.onCastResolved) {
          const extraDefs = actor.dynamicBasic.onCastResolved({
            battle,
            actor,
            resolvedSkillId: action.skillId,
            landedTargetIds: [...targetIds],
            resolveBuff: (buffTarget, buff) => {
              this.applyDeclaredBuff(
                battle,
                actor,
                {
                  definitionId: buff.definitionId,
                  target: 'target',
                  duration: buff.duration,
                  stacks: buff.stacks,
                },
                [buffTarget],
              )
            },
          })

          for (const extraDef of extraDefs) {
            extraImpacts.push(this.applyExtraImpact(battle, actor, declared, extraDef))
          }
        }
      }
    }

    // The Tu beta (Phan Chan) -- once-per-hostile-action reflect settle:
    // hits of this action queued ONE pending entry per reflect-holder;
    // the action is fully settled here (primary cast, extras, dynamic
    // basics), so each entry emits its single reflection op now. The
    // reflect is a flat 'reflection' op -- it never rolls hit/crit and
    // cannot recurse (a landed channel never opens for it).
    if (this.runtime !== undefined) {
      this.procs.flushReflects()
    }

    this.resolvePostActionWindows(battle, actor, declared, landedTargets)

    return { targetIds, extraImpacts }
  }

  /**
   * Kiem Tu Reimagined Task 2 -- the FULL landed-hit consequence chain for
   * ONE declared hit: resolveActionHit + (on landed) leech / consume-for-
   * damage / on-hit procs / reactive follow-up trigger / ailment appli-
   * cation + stat refresh on both sides. Multi-instance casts (Ngu phi
   * kiem) and provider-returned combo impacts loop THIS helper -- never
   * bare CombatSystem.resolveActionHit, which lacks the consequences.
   */
  private resolveDeclaredHit(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    target: TurnBattleParticipant,
    damage: ActionDamageInfo,
    skill: TurnSkillDefinition | null,
    declared: TurnDeclaredAction,
    hitOptions?: Partial<HitResolveOptions>,
  ): DamageResult {
    // The Tu Reimagined (spec section 3.4, plan Task 7) -- the missing-HP
    // scalar resolves PER HIT against the actor's LIVE hp: a
    // Reflection/leech landing between AOE impacts changes the next
    // hit's bonus.
    const hitResult = this.combat.resolveActionHit(
      actor.entity,
      target.entity,
      this.applyMissingHpScalar(damage, actor.entity),
      hitOptions,
    )

    // Ung The beta -- record the outcome for the post-action Phan
    // window; the per-hit windows + per-hit income are gone (INV-10:
    // observation income lands at action end, after the windows close).
    this.recordHitOutcome(battle, target, hitResult)

    // AR-04: downstream on-hit effects, debuffs and consume triggers
    // require a landed hit -- dodged attacks bypass all of them.
    if (!hitResult.dodged) {

      // R3 (AR-03) + Task 5 (D11) -- Leech healing: % of the HP the
      // target THẬT SỰ lost post-absorb -- a fully-warded hit feeds
      // nothing (damage-proportional = taken-only trigger).
      if (skill?.healPercentOfDamage && hitResult.hpDamage > 0) {
        this.combat.applyHealing(
          actor.entity,
          hitResult.hpDamage * skill.healPercentOfDamage,
          actor.entity.id,
          'leech',
        )
      }

      // consume-for-ward (Tho Tu ward burst) -- the only consume
      // mechanic the engine-unit lane can express: vitals calls only,
      // no buff authority required. Ailment consume/detonate semantics
      // live exclusively in the plan pipeline's ops (buff2/runtime
      // lanes); they never resolved on this lane.
      if (skill?.consumesWardForDamage && skill.damagePerWardPoint) {
        const ward = actor.entity.currentWard

        if (ward > 0) {
          this.combat.applyDirectDamage(target.entity, ward * skill.damagePerWardPoint, actor.entity.id)
          this.combat.spendWard(actor.entity, ward, 'ward_spend', actor.entity.id)
        }
      }

    }
    // Ung The beta -- the taken/evade Phan windows moved to the action
    // tail (resolvePhanWindow reads hitOutcomeScratch): a hit opens NO
    // per-hit window anymore, and this action's own reactions are funded
    // only by prior income.

    // ARCH-002 (M7) -- every buff mutation above (consume-removal ops
    // settle OUTSIDE the registry gate -- on-hit procs on the actor,
    // reactive triggers and ailments on the target, survive-lethal
    // grants inside resolveActionHit) must be effective before the
    // next hit/read in this loop, so the refresh is deliberately not
    // registry-gated either -- and runs for dodged hits too (same as
    // the pre-extraction loop).
    this.refreshParticipantStats(target)
    this.refreshParticipantStats(actor)
    // spec sec.40 -- direct-hit kills never pass through an op settle:
    // sweep the death boundary here so a corpse's instances are removed
    // before the next hit/read in this loop.
    this.sweepBuffDeaths(battle)

    return hitResult
  }

  /**
   * Kiem Tu Reimagined Task 2 -- appliesBuff machinery shared by the
   * action's own appliesBuff and provider extra-impact defs / the
   * resolveBuff ctx channel. Gauge-delta pushes are staged by
   * GaugeDeltaHandler during the apply barrier and drained in
   * completeAction AFTER consumeGaugeAfterAction (a push inside the
   * barrier would be erased by the action's own gauge consume).
   */
  private applyDeclaredBuff(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    buffSpec: TurnSkillBuffApplication,
    actionTargets: TurnBattleParticipant[],
  ): void {
    // M7 closure -- the engine-unit lane (runtime === undefined) does
    // NOT support buff semantics: appliesBuff(s) authored on a skill are
    // reported once per definition and skipped, never reaching the
    // runtime-owned scheduler (whose getter faults by design here).
    if (this.runtime === undefined) {
      if (!this.engineLaneBuffReported.has(buffSpec.definitionId)) {
        this.engineLaneBuffReported.add(buffSpec.definitionId)
        console.warn(
          `${ENGINE_LANE_BUFF_WARNING} buff '${buffSpec.definitionId}' declared by ${actor.id} ` +
            'skipped -- the engine-unit lane (runtime === undefined) owns no buff authority',
        )
      }
      return
    }
    if (!this.registry) return

    // Skip an unresolvable buff id gracefully (renamed/drifted content
    // must not crash the tick) -- same try/catch pattern as the
    // bossTrigger lookup above.
    let definition: BuffDefinition | undefined

    try {
      definition = this.registry.get(buffSpec.definitionId)
    } catch {
      definition = undefined
    }

    if (!definition) return

    // Kiem Tu Reimagined Task 11 -- combo capstones may declare N stacks;
    // each apply() call adds one stack under 'stack' stackMode and is
    // idempotent under 'refresh'. Default 1 = previous behavior.
    // Mission C Task 10a -- stacksPerAffectedTarget ports the authored
    // SkillEffect clause: stacks = still-alive action targets (a dead
    // target is not "imprisoned"). Math.max(1, ...) intentionally
    // supersedes the authored "0 target -> no buff" clause -- a whiffed-
    // into-corpse edge still grants the base stack (stacks ?? 1 parity).
    const stacks = buffSpec.stacksPerAffectedTarget
      ? Math.max(1, actionTargets.filter((t) => t.entity.alive).length)
      : Math.max(1, buffSpec.stacks ?? 1)
    const duration = buffSpec.durationOverride ?? buffSpec.duration

    // The Tu Reimagined (plan Task 6/11) -- the application resolves its
    // own target set: 'self'/'target'/'action_targets' read the
    // declared action; the ally/enemy scopes read the battle sides.
    const targets = this.resolveBuffApplicationTargets(battle, actor, buffSpec.target, actionTargets)

    // buff2 M4 -- one apply_buff op per resolved target (stacks ride the
    // payload atomically; clearsCcOnApply is the def's own apply-time
    // behavior inside the resolver). gaugeDelta pushes are event-driven:
    // the committed buff_applied -> GaugeDeltaHandler stages the push and
    // completeAction drains it post-consume.
    const ops: ResolvedCombatOperation[] = []
    const rootActionId = `skill.applybuff.${battle.totalTurnsElapsed}.${actor.id}.${buffSpec.definitionId}.${this.nextOccurrence()}`

    for (const target of targets) {
      ops.push(
        this.applyBuffOp(
          definition.id,
          actor.entity.id,
          target.entity.id,
          stacks,
          1,
          'suppressed',
          rootActionId,
          `apply.${target.id}`,
          duration,
        ),
      )
    }
    this.emitAndSettle(ops, battle)

    for (const target of targets) {
      // The Tu Reimagined (plan Task 11, D3/INV-12) -- the grant lands a
      // source-tagged externalWard pool on the target: REPLACE, never
      // stack (recast refreshes to full; a lower recast lowers the
      // pool). sourceMaxHpRatio reads the GRANTING tank's live maxHp.
      if (buffSpec.externalWardGrant) {
        this.writeExternalWardGrant(
          actor.entity,
          target.entity,
          buffSpec.externalWardGrant.sourceMaxHpRatio,
        )
      }

      // ARCH-002 (M7) -- statModifier buffs are effective NOW, not at the
      // holder's next turn (kim_giap counter-read class).
      this.refreshParticipantStats(target)
    }
  }

  /**
   * The Tu Reimagined (plan Task 6) -- resolve a TurnSkillBuffApplication's
   * target set. 'action_targets' reads the declared action's affected
   * (pre-resolved by the caller); 'self' the actor; the side scopes the
   * battle arrays. Legacy 'target' is an alias of 'action_targets'.
   */
  private resolveBuffApplicationTargets(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    scope: TurnSkillBuffApplication['target'],
    actionTargets: TurnBattleParticipant[],
  ): TurnBattleParticipant[] {
    switch (scope) {
      case 'self':
        return [actor]
      case 'target':
      case 'action_targets':
        return actionTargets
      case 'allies_except_self': {
        const allies = battle.players.includes(actor) ? battle.players : battle.enemies
        return allies.filter(
          (participant) => participant !== actor && participant.entity.alive,
        )
      }
      case 'all_enemies': {
        const enemies = battle.players.includes(actor) ? battle.enemies : battle.players
        return enemies.filter((participant) => participant.entity.alive)
      }
    }
  }

  /**
   * Kiem Tu Reimagined Task 2 -- execute ONE provider-returned extra
   * impact def: fresh target collection from the def's own targeting,
   * per-target instance loop through resolveDeclaredHit, optional
   * appliesBuff. Returns the presentation payload.
   */
  private applyExtraImpact(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    declared: TurnDeclaredAction,
    extraDef: TurnSkillDefinition,
  ): TurnActionExtraImpact {
    const extraScope = extraDef.targetScope ?? 'enemy'

    const extraTargets: TurnBattleParticipant[] =
      extraScope === 'self'
        ? [actor]
        : (() => {
            const primary = selectTarget(actor, declared.opposingSide, undefined, (entityId) => this.tauntSourceId(entityId as CombatEntityId))

            return primary ? collectTurnTargets(primary, declared.opposingSide, extraDef.targeting) : []
          })()

    const landedIds: string[] = []
    let hitCount = 0

    // skilldef M5c -- the extra resolves as a non-committing verbatim
    // plan (extras never commit -- they are inline lanes of the parent
    // cast); the consequence chain replays through the same hooks as
    // routed casts. Adapter-unsupported defs keep the legacy lane.
    const routed =
      this.runtime !== undefined
        ? this.planPipeline.routeExtraCast(battle, actor, declared, extraDef, extraTargets)
        : null

    if (routed !== null) {
      landedIds.push(...routed.landedTargetIds)
      hitCount = routed.hitCount
    } else if (this.runtime !== undefined) {
      // M5d -- adapter-unsupported extra def on a live battle: loud
      // no-op (the parent cast already routed or reported).
      this.reportUnroutedCast(actor, extraDef, extraDef.id, true)
    } else {
      if (extraDef.damage) {
        const scaled = declared.suddenDeathMultiplier === 1
          ? extraDef.damage
          : scaleActionDamage(extraDef.damage, declared.suddenDeathMultiplier)

        for (const target of extraTargets) {
          if (!actor.entity.alive) break // mid-impact death (T3-22b)
          const count = extraDef.instances?.count ?? 1

          for (let i = 0; i < count; i++) {
            if (!target.entity.alive || !actor.entity.alive) break

            const opts = extraDef.instances?.perInstanceOptions?.(i, target.entity)
            const result = this.resolveDeclaredHit(battle, actor, target, scaled, extraDef, declared, opts)
            hitCount += 1

            if (!result.dodged && !landedIds.includes(target.id)) {
              landedIds.push(target.id)
            }
          }
        }
      }

      for (const buffSpec of extraDef.appliesBuffs ??
        (extraDef.appliesBuff ? [extraDef.appliesBuff] : [])) {
        this.applyDeclaredBuff(battle, actor, buffSpec, extraTargets)
      }
    }

    if (extraScope === 'self' && !landedIds.includes(actor.id)) {
      landedIds.push(actor.id)
    }

    return {
      presetId: extraDef.presetId,
      // Authored targeting rides the payload so presentation reports the
      // same area the gameplay resolution used (A8 -- no silent
      // single-cell downgrade when a combo declares AOE).
      targeting: extraDef.targeting,
      targetIds: extraTargets.map((target) => target.id),
      landedTargetIds: landedIds,
      hitCount,
    }
  }

  /**
   * Phap Tu An (Task 11) -- declare phase for a queued repeat/multicast
   * execution: the descriptor IS the action (no selectAction, no charge,
   * no CC). The payload re-resolves -- an element_basic composite root
   * re-rolls its pick per execution, per spec ("each fire independently
   * re-rolled"). The execution carries its source so commit/cast-sink
   * stay silent and multicast re-roll gating sees the depth.
   */
  private declareQueuedExecution(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    exec: TurnQueuedExecution,
  ): TurnDeclaredAction {
    const rootSkill = exec.rootSkill
    let payloadSkill: TurnSkillDefinition = rootSkill
    let compositePickedSkills: readonly TurnSkillDefinition[] | null = null

    const composite = rootSkill.compositePicks

    if (composite?.poolType === 'element_basic' && composite.pool.length > 0) {
      const picks = pickCompositePool(composite.pool, composite.count, () => this.rng.roll())

      if (picks.length > 0) {
        payloadSkill = picks[0]!
        compositePickedSkills = picks.length > 1 ? picks.slice(1) : null
      }
    }

    const execution: TurnSkillExecution = {
      rootSkillId: rootSkill.id,
      resolvedSkill: payloadSkill,
      source: exec.source,
      multicastDepth: exec.multicastDepth,
    }

    // Task 13 -- same pre-burn capture as the normal declare path: a
    // queued execution of a consume-all payload burns at its own commit.
    if (payloadSkill.consumesAllThe) {
      execution.theBurned = actor.entity.currentThe ?? 0
    }

    const action: SelectedAction = {
      skillId: rootSkill.id,
      skill: rootSkill,
      damage: payloadSkill.damage,
      targeting: payloadSkill.targeting,
      slot: null,
    }

    const targetScope = payloadSkill.targetScope ?? 'enemy'
    let opposingSide: TurnBattleParticipant[] = []
    let affected: TurnBattleParticipant[] = []
    let scaledDamage: ActionDamageInfo | null = null
    let suddenDeathMultiplier = 1

    if (actor.entity.alive) {
      if (targetScope === 'self') {
        affected = [actor]
      } else {
        opposingSide = battle.players.includes(actor) ? battle.enemies : battle.players
        const primaryTarget = selectTarget(actor, opposingSide, undefined, (entityId) => this.tauntSourceId(entityId as CombatEntityId))

        if (primaryTarget) {
          affected = collectTurnTargets(primaryTarget, opposingSide, payloadSkill.targeting)

          if (payloadSkill.damage) {
            suddenDeathMultiplier = this.suddenDeathDamageMultiplier(battle.roundsElapsed ?? 0)
            scaledDamage =
              suddenDeathMultiplier === 1
                ? payloadSkill.damage
                : scaleActionDamage(payloadSkill.damage, suddenDeathMultiplier)

            // Task 13 -- theScaling fold (same as declareActorAction).
            if (payloadSkill.theScaling && execution.theBurned) {
              scaledDamage = scaleActionDamage(
                scaledDamage,
                1 + (execution.theBurned / 100) * payloadSkill.theScaling.coeff,
              )
            }
          }
        }
      }
    }

    return {
      actorId: actor.id,
      skillId: rootSkill.id,
      ccBlocked: false,
      isCharging: false,
      chargeResolved: false,
      chargeTargetIds: [],
      chargedSkill: null,
      action,
      opposingSide,
      affected,
      scaledDamage,
      suddenDeathMultiplier,
      compositePickedSkills,
      isFollowUpBypass: true,
      execution,
    }
  }

  /**
   * Phap Tu An (Task 11) -- enqueue the cast's own follow-up executions:
   *
   * - `repeatCasts` on the root skill: each committed cast queues that
   *   many 'repeat' entries (depth 0). Only casts that COMMIT (source
   *   'original'/'composite'/'empowered' -- never a repeat/multicast
   *   itself) spawn repeats, so repeats can never recurse.
   * - `multicast` on the root skill: original/composite and
   *   multicast-sourced executions roll `chance`; success queues one
   *   'multicast' entry at depth+1, bounded by
   *   min(maxExtraCasts, MAX_MULTICAST) (P15: the special's repeat fires
   *   never roll -- source 'repeat' is excluded; 'empowered' is too).
   */
  private enqueueFollowUpExecutions(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    declared: TurnDeclaredAction,
  ): void {
    const execution = declared.execution
    const rootSkill = declared.action?.skill

    if (!execution || !rootSkill || declared.isCharging) {
      return
    }

    // Only a cast that actually resolved (had a live target set) queues
    // follow-ups -- a whiffed-into-empty cast commits nothing.
    if (declared.affected.length === 0) {
      return
    }

    if (executionCommitsCast(execution) && (rootSkill.repeatCasts ?? 0) > 0) {
      const queue = (battle.queuedExecutions ??= [])

      for (let i = 0; i < rootSkill.repeatCasts!; i++) {
        queue.push({ actorId: actor.id, rootSkill, source: 'repeat', multicastDepth: 0 })
      }
    }

    const multicast = rootSkill.multicast

    if (
      multicast &&
      execution.source !== 'repeat' &&
      execution.source !== 'empowered'
    ) {
      const depth = execution.multicastDepth ?? 0
      const cap = Math.min(multicast.maxExtraCasts, MAX_MULTICAST)

      if (depth < cap && this.rng.rollChance(multicast.chance)) {
        const queue = (battle.queuedExecutions ??= [])
        queue.push({
          actorId: actor.id,
          rootSkill,
          source: 'multicast',
          multicastDepth: depth + 1,
        })
      }
    }
  }

  /**
   * Task 11 -- presentation/orchestration seam: is the actor's pending
   * turn a queued EXECUTION rather than a real turn? Manual mode must
   * NOT await player input for these -- the cast was already committed;
   * the follow-up resolves automatically. Covers prepared executions
   * (repeat/multicast) AND committed reactive follow-ups (Phan/Tro
   * counters drain through pendingReactiveEntry with a forced bypass
   * declare -- any submitted choice would be silently discarded).
   */
  isPendingQueuedExecution(actorId: string): boolean {
    return (
      this.pendingQueuedExecution?.actorId === actorId ||
      this.pendingReactiveEntry?.actorId === actorId
    )
  }

  /**
   * Phap Tu Reimagined Task 10 -- the ONE cast-commit sink: slot
   * cooldown + resource consume (root identity), the cast-count sink
   * (always rootSkillId), and the empowered form's consume-all-The
   * burn. `theBurned` was already captured at DECLARE (Task 13 -- the
   * pre-burn pool feeds theScaling, which resolves before this commit);
   * here the pool only zeroes.
   */
  private commitCast(actor: TurnBattleParticipant, declared: TurnDeclaredAction): void {
    const action = declared.action!

    commitAction(actor.entity, action)
    this.onSkillCast?.(actor, declared.execution?.rootSkillId ?? action.skillId)

    const payload = declared.execution?.resolvedSkill ?? action.skill

    if (payload?.consumesAllThe) {
      actor.entity.currentThe = 0
    }
  }

  /**
   * Phap Tu Reimagined Task 8 -- the single The-gain hook. Values are
   * authored on the resolving TurnSkillDefinition: theGainOnLandedCast
   * applies once per landed cast; theGainOnCrit once more when any
   * direct hit of the cast crited. The cap reads the battle-snapshotted
   * entity.maxThe (Truong The nodes, 'no' route) with MAX_THE as the
   * default -- never a hard-coded constant.
   */
  private grantTheFromCast(
    actor: TurnBattleParticipant,
    skill: TurnSkillDefinition,
    castCritLanded: boolean,
  ): void {
    const cap = actor.entity.maxThe ?? MAX_THE

    if (skill.theGainOnLandedCast) {
      actor.entity.currentThe = Math.min(cap, (actor.entity.currentThe ?? 0) + skill.theGainOnLandedCast)
    }

    if (castCritLanded && skill.theGainOnCrit) {
      actor.entity.currentThe = Math.min(cap, (actor.entity.currentThe ?? 0) + skill.theGainOnCrit)
    }
  }

  /**
   * Ung The beta -- per-action hit-outcome scratch: every damage op
   * (either lane) records its target's outcome; the post-action Phan
   * window reads the aggregate (multi-hit = one check, design Part VI).
   */
  private readonly hitOutcomeScratch = new Map<string, 'taken' | 'evaded'>()

  /** Ung The beta -- aggregate this hit into the scratch (landed wins). */
  private recordHitOutcome(
    battle: TurnBattle,
    target: TurnBattleParticipant,
    hitResult: { dodged: boolean; hpDamage: number },
  ): void {
    void battle
    const prior = this.hitOutcomeScratch.get(target.id)
    if (prior === 'taken') return
    this.hitOutcomeScratch.set(target.id, hitResult.dodged ? 'evaded' : 'taken')
  }

  /**
   * Tham An (design Part IV): the cast plants the mark on the declared
   * primary target BEFORE the hits resolve -- a whiff/dodge still marks
   * (observation is not damage). Exactly one focus: a new set overwrites;
   * the mark's death is lazy-cleared at read with no transfer.
   */
  private applyThamMark(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    declared: TurnDeclaredAction,
  ): void {
    if (this.runtime === undefined || !isNaturalActionSource(declared.actionSource)) return
    const skillId = declared.execution?.rootSkillId ?? declared.action?.skillId
    if (skillId === undefined || skillId !== actor.basic?.id) return
    if (!isUngTheCombatant(this.buffs.getCapabilities(actor.entity.id))) return
    // The mark only lives on the actor's opposing side -- a self-scoped
    // basic (affected=[actor]) must not mark the caster itself.
    const opposing = battle.players.includes(actor) ? battle.enemies : battle.players
    const mark = declared.affected[0]
    if (mark === undefined || !opposing.includes(mark)) return
    actor.thamTargetId = mark.id
  }

  /**
   * isObserved(reactor, enemy) -- the single observation predicate
   * (design Parts IV-V): the enemy matches the reactor's live Tham An
   * mark (lazy-cleared when dead -- no transfer), or the reactor's
   * quan_the marker is live (Quan The: every enemy satisfies it,
   * incl. later spawns).
   */
  private isObserved(
    battle: TurnBattle,
    observer: TurnBattleParticipant,
    enemy: TurnBattleParticipant,
  ): boolean {
    if (this.runtime === undefined) return false
    if (!observer.entity.alive || !enemy.entity.alive) return false
    if (observer.thamTargetId !== undefined) {
      // Lazy-clear: the mark dies with its target -- focus is lost, and
      // NOTHING re-marks automatically (no transfer, design Part IV).
      const mark =
        battle.players.find((member) => member.id === observer.thamTargetId) ??
        battle.enemies.find((member) => member.id === observer.thamTargetId)
      if (mark === undefined || !mark.entity.alive) {
        observer.thamTargetId = undefined
      } else if (mark.id === enemy.id) {
        return true
      }
    }
    return this.buffs
      .getForTarget(observer.entity.id)
      .some((inst) => inst.definitionId === 'quan_the')
  }

  /**
   * Ung The beta gate -- hard incapacitating CC (stun/freeze) blocks
   * every reactive window; slow/taunt/root do NOT. Mirrors the
   * ccBlocked suppression (bat_tu_ba_the means the CC cannot block).
   */
  private isHardCcBlocked(participant: TurnBattleParticipant): boolean {
    if (this.runtime === undefined) return false
    const ccActive =
      this.buffs.hasControl(participant.entity.id, 'stun') ||
      this.buffs.hasControl(participant.entity.id, 'freeze')
    if (!ccActive) return false
    return !this.buffs
      .getForTarget(participant.entity.id)
      .some((inst) => inst.definitionId === 'bat_tu_ba_the')
  }

  /** Qua The predicate: debt at cap -> no NEW windows (income continues). */
  private isQuaThe(participant: TurnBattleParticipant): boolean {
    return (participant.reactionDebt ?? 0) >= REACTION_DEBT_CAP
  }

  /**
   * Ung Tre commit (design Part III): one uniform debt per committed
   * reaction + the authored gauge penalty pushing the holder's next
   * natural action later. Commit is never rolled back -- focus changes,
   * Quan The expiry, or the holder dying later cannot refund it.
   */
  private commitReaction(holder: TurnBattleParticipant): void {
    holder.reactionDebt = (holder.reactionDebt ?? 0) + 1
    holder.actionGauge -= UNG_TRE_GAUGE_PENALTY
  }

  /**
   * buff2 M4 -- reactive_proc windows delegate to CombatProcSystem: the
   * holder's reactive_proc grants roll via the shared rng, success-only
   * cost pays inside, and queued follow-up descriptors return here for
   * the TBS-owned bypass queue. A committed reaction also commits the
   * holder's Ung Tre debt (uniform +1 + gauge penalty per success).
   */
  private resolveReactiveProcs(
    battle: TurnBattle,
    holder: TurnBattleParticipant,
    trigger: ReactiveTriggerName,
    context: {
      attacker?: TurnBattleParticipant
      outcome?: 'taken' | 'evaded'
      intercepted?: boolean
      triggeringTargets?: TurnBattleParticipant[]
    },
    opts?: { once?: boolean },
  ): ReactiveProcAttempt[] {
    if (this.runtime === undefined) return []

    const result = this.procs.resolveReactiveProcs(
      holder.entity.id,
      trigger,
      {
        attacker:
          context.attacker === undefined
            ? undefined
            : { id: context.attacker.id, entity: context.attacker.entity },
        outcome: context.outcome,
        intercepted: context.intercepted,
        triggeringTargets: context.triggeringTargets?.map((participant) => ({
          id: participant.id,
          entity: participant.entity,
        })),
      },
      {
        once: opts?.once,
        rootActionId: `reactive.${battle.totalTurnsElapsed}.${holder.id}.${trigger}.${this.nextOccurrence()}`,
      },
    )

    for (const attempt of result.attempts) {
      if (attempt.success && attempt.paid) {
        this.commitReaction(holder)
      }
    }

    if (result.queuedFollowUps.length > 0) {
      battle.queuedFollowUps = battle.queuedFollowUps ?? []
      battle.queuedFollowUps.push(...result.queuedFollowUps)
    }

    return result.attempts
  }

  /**
   * Ung The beta tail seam (design Part II ordering lock): the
   * post-action windows close BEFORE the action's observation income
   * lands -- an action can never fund its own reactions (INV-10).
   */
  private resolvePostActionWindows(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    declared: TurnDeclaredAction,
    landedTargets: TurnBattleParticipant[],
  ): void {
    this.resolvePhanWindow(battle, actor, declared)
    this.resolveAllyActionWindow(battle, actor, declared, landedTargets)
    this.grantObservationIncome(battle, actor, declared, landedTargets)
  }

  /**
   * The Phan window (design Part VI): ONE post-action window per
   * affected ung_the reactor observing the attacker -- hit, blocked,
   * absorbed, missed or evaded all qualify (the action resolved ON
   * them). Outcome picks the marker's onImpactLanded ('taken') or
   * onEvade ('evaded') grant; the evade branch resolves Trong Phan
   * Kich when the node owned the payload swap. Success is FORCED.
   * Natural actions only (reactive/queued actions never open windows).
   */
  private resolvePhanWindow(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    declared: TurnDeclaredAction,
  ): void {
    if (this.runtime === undefined || !isNaturalActionSource(declared.actionSource)) {
      return
    }

    // The Phan payload's sole target is the attacker (targetMode
    // 'attacker'): a dead attacker leaves nothing queueable, so the
    // window never opens - matching the Tro channel's alive-canonical
    // pre-check rather than paying commit cost for an empty queue.
    if (!actor.entity.alive) {
      return
    }

    const opposing = battle.players.includes(actor) ? battle.enemies : battle.players
    const seen = new Set<string>()

    for (const reactor of opposing) {
      if (reactor === actor || seen.has(reactor.id)) continue
      seen.add(reactor.id)
      if (!declared.affected.includes(reactor)) continue
      if (!reactor.entity.alive) continue
      if (!this.isObserved(battle, reactor, actor)) continue
      if (this.isHardCcBlocked(reactor) || this.isQuaThe(reactor)) continue

      const outcome = this.hitOutcomeScratch.get(reactor.id) ?? 'taken'
      this.resolveReactiveProcs(
        battle,
        reactor,
        outcome === 'evaded' ? 'onEvade' : 'onImpactLanded',
        {
          attacker: actor,
          outcome,
          intercepted: declared.intercepted === true,
        },
      )
    }
  }

  /**
   * The Tro window (design Part VIII): an ALLY's authored-DAMAGING
   * natural action completing into an enemy the reactor observes opens
   * ONE window per other ung_the player; on success the payload queues
   * at the canonical target -- the first landed (else affected)
   * participant that is alive AND observed by THAT reactor. Never fires
   * on the actor's own window, reactive actions, or non-damaging
   * authored actions.
   */
  private resolveAllyActionWindow(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    declared: TurnDeclaredAction,
    landedTargets: TurnBattleParticipant[],
  ): void {
    if (
      !battle.players.includes(actor) ||
      !isNaturalActionSource(declared.actionSource) ||
      this.runtime === undefined
    ) {
      return
    }

    const authoredDamaging =
      declared.scaledDamage !== null ||
      declared.chargedSkill?.damage != null ||
      (declared.compositePickedSkills?.some((picked) => picked.damage != null) ?? false)

    if (!authoredDamaging) {
      return
    }

    // Canonical candidates live on the reactors' opposing side: a
    // teammate's self-hit or the acting ally itself can land in
    // `affected` (self scopes, AoE) and must never be countered.
    const candidates = [...landedTargets, ...declared.affected].filter(
      (candidate) => !battle.players.includes(candidate),
    )

    for (const ally of battle.players) {
      if (ally === actor || !ally.entity.alive) {
        continue
      }
      if (this.isHardCcBlocked(ally) || this.isQuaThe(ally)) {
        continue
      }

      // Per-ally dedup: each reactor scans the candidate list itself;
      // candidates consumed by an earlier ally stay visible to later ones.
      const seen = new Set<string>()
      let canonical: TurnBattleParticipant | undefined
      for (const candidate of candidates) {
        if (seen.has(candidate.id) || !candidate.entity.alive) continue
        seen.add(candidate.id)
        if (this.isObserved(battle, ally, candidate)) {
          canonical = candidate
          break
        }
      }

      if (canonical === undefined) {
        continue
      }

      this.resolveReactiveProcs(battle, ally, 'onAllyActionComplete', {
        attacker: actor,
        triggeringTargets: [canonical],
      })
    }
  }

  /**
   * Observation income (design Part II) -- LAST in the action tail:
   * (a) the acting ung_the combatant's Tham The landed -> the marker's
   * authored gainOnBasicHit, once per action;
   * (b) an observed enemy completing a natural action -> every player
   * ung_the reactor observing it gains the marker's gainOnObservedAction
   * (dan_the one-shot multiplies it and is consumed on use).
   */
  private grantObservationIncome(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    declared: TurnDeclaredAction,
    landedTargets: TurnBattleParticipant[],
  ): void {
    // ccBlocked: the enemy's turn was consumed by hard CC -- it never
    // completed an action, matching the sealed NULL_ACTION (undefined
    // source) which also yields no income.
    if (
      this.runtime === undefined ||
      declared.ccBlocked ||
      !isNaturalActionSource(declared.actionSource)
    ) {
      return
    }

    const ops: ResolvedCombatOperation[] = []

    // (a) Tham The landed -- gated on the action being the actor's own
    // basic and at least one landed hit (multi-hit still grants once).
    const actorGrants = this.buffs.getCapabilities(actor.entity.id)
    const rootSkillId = declared.execution?.rootSkillId ?? declared.action?.skillId
    if (
      actor.entity.alive &&
      rootSkillId !== undefined &&
      rootSkillId === actor.basic?.id &&
      landedTargets.length > 0 &&
      isUngTheCombatant(actorGrants)
    ) {
      const amount = theGainOnBasicHit(actorGrants)
      if (amount > 0) {
        ops.push({
          type: 'gain_resource',
          operationId: `the.basic.${battle.totalTurnsElapsed}.${actor.id}.${this.nextOccurrence()}` as CombatOperationId,
          payload: { targetId: actor.entity.id, resourceId: 'the', amount },
          origin: this.opOrigin(actor.entity.id, `hit.basic_income.${battle.totalTurnsElapsed}.${actor.id}`, 'the_basic_income'),
        })
      }
    }

    // (b) Observed enemy completed a natural action -- income to every
    // OBSERVING player reactor. dan_the on the actor multiplies this
    // action's yield and is consumed on use (dies with the target).
    if (battle.enemies.includes(actor)) {
      const danThe = this.buffs
        .getForTarget(actor.entity.id)
        .find((inst) => inst.definitionId === 'dan_the')
      const mult = danThe !== undefined ? DAN_THE_INCOME_MULT : 1
      let consumed = false

      for (const reactor of battle.players) {
        if (!reactor.entity.alive || !this.isObserved(battle, reactor, actor)) continue
        const grants = this.buffs.getCapabilities(reactor.entity.id)
        const amount = theGainOnObservedAction(grants) * mult
        if (amount <= 0) continue
        ops.push({
          type: 'gain_resource',
          operationId: `the.observed.${battle.totalTurnsElapsed}.${actor.id}.${reactor.id}.${this.nextOccurrence()}` as CombatOperationId,
          payload: { targetId: reactor.entity.id, resourceId: 'the', amount },
          origin: this.opOrigin(reactor.entity.id, `hit.observed_income.${battle.totalTurnsElapsed}.${actor.id}`, 'the_observed_income'),
        })
        consumed = true
      }

      if (consumed && danThe !== undefined) {
        ops.push({
          type: 'remove_buff',
          operationId: `dan_the.consume.${battle.totalTurnsElapsed}.${actor.id}.${this.nextOccurrence()}` as CombatOperationId,
          payload: {
            selector: { kind: 'instance', instanceId: danThe.instanceId },
            removalReason: 'consumed',
          },
          origin: this.opOrigin(actor.entity.id, `hit.dan_the_consume.${battle.totalTurnsElapsed}.${actor.id}`, 'dan_the_consume'),
        })
      }
    }

    if (ops.length > 0) {
      this.emitAndSettle(ops, battle)
    }
  }

  /**
   * The Ho intercept window (spec 6.2.1, plan Task 17) -- runs at the top
   * of applyActionImpact, post-declare/pre-impact: on success the
   * declared target is substituted and the hit resolves fully vs the
   * protector (dodge/ward/block/procs all live downstream).
   * Preconditions: actor is enemy-side, the action is a NATURAL
   * (normal/skill -- INV-9, same gate as the Phan/Tro windows) single-
   * target action by AUTHORED targeting shape (an all_lanes AoE whose
   * other targets died stays AoE), and the target is a LIVING player-
   * side participant. Candidates are player-side participants carrying
   * an onAllyTargeted/intercept reactiveProc (the ho_mon marker),
   * excluding the original target, OBSERVING the attacker (Ung The
   * beta: isObserved), and open for reaction (alive, not hard-CC, not
   * Qua The). Exactly ONE roll: the nearest protector to the attacker
   * by Chebyshev attempts; no fallback to further candidates (D5).
   */
  private resolveInterceptWindow(
    battle: TurnBattle,
    declared: TurnDeclaredAction,
    actor: TurnBattleParticipant,
  ): void {
    if (!battle.enemies.includes(actor)) {
      return
    }

    // INV-9 -- reactive/replayed actions (counter/follow_up/intercept and
    // queued executions) never open new reactive windows.
    if (!isNaturalActionSource(declared.actionSource)) {
      return
    }

    // Semantic single-target: the AUTHORED targeting shape decides, not
    // the runtime affected count. A charge-resolve action reads the
    // charged payload's shape; its targets materialize into `affected`
    // at declare so this window shares one target authority.
    const interceptedTargeting = declared.chargeResolved
      ? declared.chargedSkill?.targeting
      : declared.action?.targeting

    if (interceptedTargeting?.shape !== 'single' || declared.affected.length !== 1) {
      return
    }

    const original = declared.affected[0]!

    if (!battle.players.includes(original) || !original.entity.alive) {
      return
    }

    const candidates =
      this.runtime === undefined
        ? []
        : battle.players.filter(
            (participant) =>
              participant !== original &&
              participant.entity.alive &&
              this.isObserved(battle, participant, actor) &&
              !this.isHardCcBlocked(participant) &&
              !this.isQuaThe(participant) &&
              this.buffs
                .getCapabilities(participant.entity.id)
                .some((grant) => {
                  const proc = asReactiveProc(grant)
                  return (
                    proc !== undefined &&
                    proc.trigger === 'onAllyTargeted' &&
                    proc.mechanic === 'intercept'
                  )
                }),
          )

    if (candidates.length === 0) {
      return
    }

    const attackerPosition = entityGridPosition(actor.entity)
    const nearest = candidates.reduce((best, candidate) =>
      getChebyshevDistance(attackerPosition, entityGridPosition(candidate.entity)) <
      getChebyshevDistance(attackerPosition, entityGridPosition(best.entity))
        ? candidate
        : best,
    )

    const attempts = this.resolveReactiveProcs(
      battle,
      nearest,
      'onAllyTargeted',
      { attacker: actor, intercepted: true },
      { once: true },
    )

    // Substitution requires the same success+paid pair commitReaction
    // uses -- a rolled-but-unpaid attempt must never rewire the target
    // for free.
    const winning = attempts.find((attempt) => attempt.success && attempt.paid)

    if (!winning) {
      return
    }

    declared.affected = [nearest]
    declared.intercepted = true
    declared.interceptedBy = nearest.id

    // A charge-resolve action's hit lane reads chargeTargetIds -- keep it
    // the id-mirror of `affected` so the substitution lands on the
    // protector there too.
    if (declared.chargeResolved) {
      declared.chargeTargetIds = [nearest.id]
    }

    // Task 20 (spec 8.2 "intercept->ally ward") -- the node-baked marker
    // rider: the rescued ally gains a grantsExternalWard marker sourced
    // by the protector plus the ward pool itself. Same existence-bound
    // contract as son_nhac_ho_the -- reconcileExternalWard owns expiry.
    const wardGrant = winning.effect?.grantsWardToOriginalTarget

    if (wardGrant !== undefined && this.registry !== undefined) {
      let definition: BuffDefinition | undefined

      try {
        definition = this.registry.get(wardGrant.buffDefinitionId)
      } catch {
        definition = undefined
      }

      if (definition !== undefined) {
        // The marker lands on the rescued ally SOURCED BY the protector --
        // sourceId must match the ward's sourceId or the existence-bound
        // reconcile clears the pool at the next refresh.
        this.emitAndSettle([
          this.applyBuffOp(
            definition.id,
            nearest.entity.id,
            original.entity.id,
            1,
            1,
            'suppressed',
            `intercept.ward.${battle.totalTurnsElapsed}.${nearest.id}.${original.id}.${this.nextOccurrence()}`,
            `intercept_ward.${definition.id}`,
          ),
        ], battle)
        this.writeExternalWardGrant(
          nearest.entity,
          original.entity,
          wardGrant.sourceMaxHpRatio,
        )
      }
    }
  }

  /**
   * The Tu Reimagined (spec 7.1, plan Task 16/v2.4 P0.1) -- a queued
   * reactive entry declares as a REAL TurnDeclaredAction (targets,
   * payload skill, scaledDamage) while skipping the entire natural-turn
   * lifecycle: no turn/round counters, no buff/DoT ticks, no CC check,
   * no regen/resource deltas, no charge advance, no cooldown ticks. The
   * impact still flows through applyActionImpact -- bypass != a second
   * damage path.
   */
  private declareReactiveBypass(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    entry: QueuedFollowUp,
  ): TurnDeclaredAction {
    const payload = entry.payloadSkillId
      ? actor.reactivePayloads?.[entry.payloadSkillId]
      : undefined
    const skill = payload ?? actor.basic ?? null

    // Ung The beta -- the bach_ung payloadAilments rider merge is gone
    // (Bach Ung is parked future content; the participant-local payload
    // clone from buildTheTuAnKit is the only payload source now).

    const opposingSide = battle.players.includes(actor) ? battle.enemies : battle.players

    let affected: TurnBattleParticipant[] = []

    if (entry.targetIds && entry.targetIds.length > 0) {
      // Queue-time captured targets (spec 6.2 -- counter hits the attacker
      // that provoked it); dead targets filter out at resolve.
      const byId = new Map(
        [...battle.players, ...battle.enemies].map((participant) => [participant.id, participant]),
      )
      affected = entry.targetIds
        .map((id) => byId.get(id))
        .filter((participant): participant is TurnBattleParticipant =>
          participant !== undefined && participant.entity.alive,
        )
    } else if (skill) {
      // No captured targets -- positional fallback keeps the action legal.
      const primary = selectTarget(actor, opposingSide, undefined, (entityId) => this.tauntSourceId(entityId as CombatEntityId))

      if (primary) {
        affected = collectTurnTargets(primary, opposingSide, skill.targeting)
      }
    }

    const action: SelectedAction | null = skill
      ? {
          skillId: skill.id,
          skill,
          damage: skill.damage,
          targeting: skill.targeting,
          slot: null, // slotless -- no cooldown/resource commit (spec 7.1)
        }
      : null

    return {
      actorId: actor.id,
      skillId: skill?.id ?? '',
      ccBlocked: false,
      isCharging: false,
      chargeResolved: false,
      chargeTargetIds: [],
      chargedSkill: null,
      action,
      opposingSide,
      affected,
      scaledDamage: skill?.damage ?? null,
      suddenDeathMultiplier: this.suddenDeathDamageMultiplier(battle.roundsElapsed ?? 0),
      compositePickedSkills: null,
      isFollowUpBypass: true,
      actionSource: entry.actionSource,
      triggerContext: entry.triggerContext,
    }
  }

  /**
   * The Tu Reimagined (spec section 3.4, plan Task 7) -- Cuong Chien's
   * signature scalar: skills authored with scalesWithMissingHp multiply
   * their damage by (1 + missingHpRatio * coefficient), re-read against
   * the actor's LIVE hp at each hit. Non-body damage passes through.
   */
  private applyMissingHpScalar(damage: ActionDamageInfo, actor: CombatEntity): ActionDamageInfo {
    const perPercent = damage.missingHpBonusPerMissingPercent

    if (perPercent === undefined || actor.maxHp <= 0) {
      return damage
    }

    const missingFraction = Math.max(0, 1 - actor.currentHp / actor.maxHp)
    const bonus = Math.min(damage.missingHpBonusCap ?? Infinity, missingFraction * perPercent * 100)

    if (bonus <= 0) {
      return damage
    }

    return { ...damage, multiplier: damage.multiplier * (1 + bonus) }
  }

  /**
   * Action Playback Task 3 (2026-09-05) -- PHA 3/3: turn cleanup (gauge
   * consume, gauge-delta push, wave spawn, win/loss check, battle log).
   */
  completeAction(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    declared: TurnDeclaredAction,
    targetIds: string[],
  ): TurnStepResult {
    // Defect-fix Task 1 -- bypass turn KHÔNG consume gauge (counter-reactor
    // không mất progress của lượt kế tiếp vì side effect của phản ứng).
    consumeGaugeAfterAction(actor, declared.isFollowUpBypass ? 0 : 1)

    // Task 11 -- the cast's own follow-up executions queue at action end:
    // repeatCasts spawn 'repeat' entries; a multicast-capable root skill
    // rolls `chance` for one 'multicast' entry (re-rolling per execution
    // until the depth cap). Repeat/empowered sources never roll.
    this.enqueueFollowUpExecutions(battle, actor, declared)

    // Future Systems Task 6 -- gauge-delta one-shot push SAU consume
    // (consume đặt gauge về 0; delta cộng lên trên, không bị ghi đè).
    // buff2 M4 -- the pushes staged by GaugeDeltaHandler off committed
    // buff_applied events drain here: same post-consume boundary, same
    // push-on-top-of-reset ordering as the legacy pending list.
    if (this.runtime !== undefined) {
      this.emitAndSettle(this.runtime.gaugeHandler.drainPending(), battle)
    }

    const currentAliveEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length
    const currentPendingCount = battle.wave?.pendingEnemySpawns.length ?? 0

    if (battle.players.every((member) => !member.entity.alive)) {
      battle.state = 'defeat'
    } else if (
      battle.wave
        ? isStageComplete(battle.wave.spawnedCount, battle.wave.totalEnemyCount, currentAliveEnemyCount, currentPendingCount)
        : battle.enemies.every((enemy) => !enemy.entity.alive)
    ) {
      battle.state = 'victory'
    }

    // Slice 7 extension -- battle log: 1 entry/lượt, append-only.
    const logEntry: BattleLogEntry = {
      turn: battle.totalTurnsElapsed ?? 0,
      actorId: actor.id,
      skillId: declared.skillId,
      targetIds,
      ccBlocked: declared.ccBlocked,
    }

    battle.log = battle.log ?? []
    battle.log.push(logEntry)

    return {
      state: battle.state,
      actorId: actor.id,
      skillId: declared.skillId,
      targetIds,
      ccBlocked: declared.ccBlocked,
      execution: declared.execution,
    }
  }

  /**
   * Slice 7 (Completion Task 10) -- resolve lượt của MỘT actor ĐÃ peek:
   * thin wrapper gọi 3 phase Action Playback back-to-back (signature/
   * hành vi KHÔNG ĐỔI -- mọi caller/test cũ giữ nguyên).
   */
  resolveActorTurn(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    forcedAction?: ForcedTurnChoice,
  ): TurnStepResult {
    const declared = this.declareActorAction(battle, actor, forcedAction)
    const { targetIds } = this.applyActionImpact(battle, declared)
    return this.completeAction(battle, actor, declared, targetIds)
  }

  /**
   * Thin wrapper (Slice 7): peekNextActor() + resolveActorTurn() không
   * forced slot -- giữ nguyên signature/hành vi cho mọi caller Slice 1-6
   * (auto mode, runToCompletion(), mọi test cũ).
   */
  resolveNextStep(battle: TurnBattle): TurnStepResult {
    // Intro phase (2026-09-07 plan Task 4): combat has not started - safe
    // no-op, same wait-phase contract as the countdown branch below.
    if (battle.state === 'intro') {
      return { state: 'intro', actorId: '', skillId: '', targetIds: [], ccBlocked: false }
    }

    // Countdown phase: combat chưa bắt đầu -- no-op an toàn (gauge không
    // chạy, không ai hành động; GameManager tick countdown qua
    // tickCountdown() thay vì gọi method này).
    if (battle.state === 'countdown') {
      return { state: 'countdown', actorId: '', skillId: '', targetIds: [], ccBlocked: false }
    }

    // Trận đã kết thúc (victory/defeat) -- KHÔNG ghi đè state thành defeat
    // (code-review fix: peekNextActor trả null cho state != fighting, nhánh
    // dưới chỉ được phép set defeat khi trận thực sự không còn ai sống).
    if (battle.state !== 'fighting') {
      return { state: battle.state, actorId: '', skillId: '', targetIds: [], ccBlocked: false }
    }

    const actor = this.peekNextActor(battle)

    if (!actor) {
      battle.state = 'defeat'
      return { state: 'defeat', actorId: '', skillId: '', targetIds: [], ccBlocked: false }
    }

    return this.resolveActorTurn(battle, actor)
  }

  /** Thin wrapper for tests/dev tooling -- loops resolveNextStep() to completion. */
  runToCompletion(battle: TurnBattle): TurnBattleState {
    for (let turn = 0; turn < this.maxTurns; turn++) {
      const step = this.resolveNextStep(battle)

      if (step.state !== 'fighting') {
        return step.state
      }
    }

    battle.state = 'defeat'
    return battle.state
  }

  // Sudden Death (roadmap 9.5 Combat Fairness Guards): damage +30%/turn
  // from turn 11. The unit is ATB ROUNDS -- the same contract the
  // 2026-09-12 D2 revision gave perfectClearTurnLimit. Reading the raw
  // totalTurnsElapsed actor-action counter made escalation arrive
  // participant-count times early (a 1v3 stage hit the grace boundary in
  // ~3 rounds) and compound ~0.3 x actors per round -- the reported
  // abnormal damage ramp.
  private suddenDeathDamageMultiplier(roundsElapsed: number): number {
    const roundsPastGrace = roundsElapsed - 9

    return roundsPastGrace > 0 ? 1 + 0.3 * roundsPastGrace : 1
  }
}
