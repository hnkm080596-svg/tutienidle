// TurnBattleSystem Slice 1 (spec 2026-09-04) — engine turn-based độc lập,
// headless, KHÔNG nối vào BattleSystem.ts/GameManager. Chứng minh ATB
// gauge (TurnQueue) + targeting + CombatSystem.resolveActionHit chạy
// đúng end-to-end trước khi lớp thêm skill/buff/reaction/hazard zone ở
// slice sau.
import type { CombatEntity } from '../../combat/CombatEntity'
import type { CombatSystem } from '../../combat/CombatSystem'
import { entityGridPosition, getChebyshevDistance } from '../BattleGrid'
import { consumeGaugeAfterAction, advanceGauge, isGaugeReady } from './ActionGauge'
import { resolveNextTurn } from './TurnQueue'
import { tickCooldowns, selectAction, selectForcedAction, commitAction, collectTurnTargets, executionCommitsCast, pickCompositePool, MAX_MULTICAST, type TurnSkillExecution, type TurnQueuedExecution } from './TurnSkillAction'
import type { TurnSkillDefinition, TurnSkillSlot, SelectedAction, DynamicBasicProvider, ForcedTurnChoice, TurnSkillBuffApplication } from './TurnSkillAction'
import type { ActionDamageInfo, HitResolveOptions } from '../ActionImpactSystem'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import type { Buff, BuffDefinitionCatalog } from '../../buff/BuffTypes'
import type { StatModifier } from '../../stats/StatCalculator'
import type { StatDomain } from '../../stats/StatDomain'
import { applyTurnStartDeltas } from './ResourceTurnHook'
import type { TurnResourceDelta } from './ResourceTurnHook'
import { isTurnTriggerReady } from './BossTurnTriggers'
import { shouldStartNextWave, isStageComplete } from './WaveSpawnTrigger'
import { scaleActionDamage } from '../ActionImpactSystem'
import { recomputeEffectiveStats } from './TurnStatsRecompute'
import type { BattleLogEntry } from './TurnOrderPreview'

import { refundGauge, GAUGE_MAX } from './ActionGauge'
import { TurnReactionManager } from './TurnReactionManager'
import { MAX_THE } from '../../combat/CombatTypes'
import type { DamageResult } from '../../combat/CombatTypes'
import {
  theGainOnEvade,
  theGainOnHitTaken,
  theGainPerRound,
  THE_PROC_COST,
  grantThe,
  isUngTheCombatant,
  onProcSuccess,
  resolveProcCost,
  theGainOnBasicHit,
  tryPayProcCost,
} from '../../the-tu/TheEconomy'
import { SurviveLethalGuard } from '../../talent/SurviveLethalGuard'
import { reconcileExternalWard } from '../../the-tu/TheTuExternalWard'
import { clampStatValue } from '../../stats/StatMetadata'
import type { BuffDefinition, ReactiveProcEffect, ReactiveTriggerName } from '../../buff/BuffTypes'

/**
 * Future Systems Task 6 — gauge-delta effect: bắn 1 LẦN ngay khi buff
 * được áp, đẩy % GAUGE_MAX vào actionGauge của participant nhận buff
 * (refundGauge đã clamp [0, GAUGE_MAX]). Không phải tick liên tục.
 */
function applyGaugeDeltaEffects(
  definition: BuffDefinition,
  participant: TurnBattleParticipant,
): void {
  for (const effect of definition.effects) {
    if (effect.type === 'gaugeDelta') {
      refundGauge(participant, GAUGE_MAX * (effect.percentOfMax / 100))
    }
  }
}

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
  /** Đã build đầy đủ (roll template/elite/boss xong) — chỉ chờ hết telegraph. */
  participant: TurnBattleParticipant
  ticksRemaining: number
  totalTicks: number
}

// Turn-Based Wave Redesign (2026-09-06) — quy đổi TRỰC TIẾP từ
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
  buffs: BuffPool
  consecutiveHardCcTurns: number
  baTheTriggeredAtTurn?: number
  basic?: TurnSkillDefinition
  special?: TurnSkillSlot
  ultimate?: TurnSkillSlot
  resources?: TurnResourcePool
  bossTrigger?: TurnBossTrigger
  /**
   * stat-system-reimagined review fix (2026-09-15) — stat domains this
   * participant owns (player path -> its domain). Domain deltaDerivers
   * in calculateEffectiveStats run only for these, so e.g. a kiem_tu
   * entity gaining attunement mid-battle never emits phap_tu MP deltas.
   */
  activeDomains?: ReadonlySet<StatDomain>
  /**
   * Review fix (MED-3) — wuxing reaction INITIATION is an explicit
   * capability, not player-side membership: stamped by the adapter for
   * participants owning the phap_tu stat domain (spec §6/D21 — the
   * domain gate is what permits a future mixed-element hien route).
   * Companions/enemies/non-phap_tu players never carry it; their
   * ailments still participate as incumbents.
   */
  canInitiateWuxingReactions?: boolean
  /** Future Systems Task 7 — charge state (Thế→Trảm). CỐ Ý tách biệt counter CC Bá Thể. */
  chargingTurnsRemaining?: number
  pendingChargedSkillId?: string
  /**
   * Phase A3 (2026-09-07) — 1-based counter of this enemy's own actions,
   * ported from BattleEnemy.specialAttackCounter (Battle.ts) with the same
   * everyNth semantics as legacy EnemyAttackSystem.fireEnemyAttack()
   * (module retired M13 — semantics ported here):
   * when counter % everyNth === 0, the special attack's damageMultiplier
   * replaces the basic attack's for that action. Runtime-only, never
   * resets mid-battle. undefined coerces to 0.
   */
  specialAttackCounter?: number
  /**
   * Kiem Tu Reimagined Task 2 — path-specific basic owner (Kiem Pho orb
   * preset / Ngu Kiem Dao). When present it owns the basic slot and the
   * post-resolution hook; the engine stays content-agnostic.
   */
  dynamicBasic?: DynamicBasicProvider
  /**
   * The Tu Reimagined (spec 6.2, plan Task 16) — participant-local
   * reactive payload defs keyed by skill id (phan_kich/tro_kich clones,
   * node-adjusted at battle build). QueuedFollowUp.payloadSkillId
   * resolves through this map — never through a shared registry, so a
   * node's payload upgrade reaches this participant's copy only.
   */
  reactivePayloads?: Record<string, TurnSkillDefinition>
}

export interface TurnBattle {
  /**
   * Future Systems Task 9 (2026-09-04) — party: mảng player-side units,
   * chung 1 ATB queue với enemy (TurnQueue tái dùng nguyên vẹn); thua khi
   * TOÀN BỘ party chết (đối xứng điều kiện thắng — spec §6).
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
   * Result) — số lượt-pacing còn lại trước khi state chuyển 'fighting'.
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
    /** 0-based index into `waves` — which wave is currently spawning/active. */
    waveIndex: number
    /** Quái đã spawn (dạng pending) nhưng CHƯA vào trận thật (battle.enemies). */
    pendingEnemySpawns: PendingEnemySpawn[]
  }
  /**
   * Slice 7 extension (Completion Task 11) — battle log: 1 entry mỗi lượt
   * resolveActorTurn (append-only, ephemeral — không persist vào save,
   * combat ephemeral theo nguyên tắc rework).
   */
  log?: BattleLogEntry[]
  /**
   * Action Playback (2026-09-05) — counter/follow-up (§6 spec): actors queued
   * here jump straight to 'ready' after the current turn's standby, bypassing
   * gauge. FIFO queue (not a single id) so an AOE hit that triggers multiple
   * counters doesn't drop all but the last one. Defect-fix Task 1: đổi từ
   * singular — tickPacing (production loop) giờ đọc queue này.
   * The Tu Reimagined (Task 16) — entries are typed QueuedFollowUp
   * records carrying provenance (actionSource/triggerContext) and the
   * queued payload descriptor, not bare actor ids.
   */
  queuedFollowUps?: QueuedFollowUp[]
  /** Defect-fix Task 1 — reciprocity guard: đếm consecutive bypass turns qua
   * queue, reset khi 1 normal gauge turn resolve; cap trong dequeueFollowUpActor()
   * để 2 entity counter-buff không bounce follow-up lẫn nhau vô hạn. */
  followUpChainDepth?: number
  /**
   * Phap Tu An (Task 11) — prepared follow-up EXECUTIONS (repeat /
   * multicast) of an already-committed cast. Unlike the actor queue
   * above, an entry carries its own payload root — the drained actor
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
 * The Tu Reimagined (plan Task 10, D6/INV-11) — Khiem Khich Taunt reads
 * the ACTOR's own pool BEFORE positional rules: an active khiem_khich
 * debuff forces the pick onto its sourceId (the taunter) when that
 * participant is alive in the opposing side. uniquePerTarget on the def
 * means a newer taunt already evicted older instances — the last
 * instance is the newest by construction. Dead/missing taunter falls
 * through to positional. opts.ignoreTaunt exempts scripted
 * specialAttacks (their positional pick is part of the authored script).
 */
export function selectTarget(
  actor: TurnBattleParticipant,
  opposingSide: TurnBattleParticipant[],
  opts?: { ignoreTaunt?: boolean },
): TurnBattleParticipant | undefined {
  const living = opposingSide.filter((participant) => participant.entity.alive)

  if (living.length === 0) {
    return undefined
  }

  if (!opts?.ignoreTaunt) {
    const taunts = actor.buffs.getAllById('khiem_khich')
    const taunterId = taunts[taunts.length - 1]?.sourceId

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

/** Defect-fix Task 1 (2026-09-05) — reciprocity cap: 2 entity cùng holding
 * counter buff không được bounce follow-up lẫn nhau quá 4 nhịp liên tiếp
 * (không có normal turn xen vào) — chặn chain vô hạn starving turn order. */
const MAX_FOLLOW_UP_CHAIN_DEPTH = 4

/**
 * M8 (ARCH-003) — Ward delayed-regen gate in TURN units. Legacy
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
  /** Task 9 — the cast's execution identity (root vs resolved payload). */
  execution?: TurnSkillExecution
}

/**
 * Action Playback Task 3 (2026-09-05) — kết quả PHA declare: mọi thứ đã
 * quyết định cho lượt của actor (skill, target set, damage đã scale, charge
 * state) NHƯNG chưa áp damage — applyActionImpact() đọc các field này.
 */
export interface TurnDeclaredAction {
  actorId: string

  skillId: string

  ccBlocked: boolean

  isCharging: boolean

  chargeResolved: boolean

  /** Charge-resolve: targetIds capture tại declare (hits áp tại apply). */
  chargeTargetIds: string[]

  /** Charge-resolve: skill definition capture tại declare (apply đọc từ đây — pendingChargedSkillId đã clear). */
  chargedSkill: TurnSkillDefinition | null

  action: SelectedAction | null

  opposingSide: TurnBattleParticipant[]

  affected: TurnBattleParticipant[]

  scaledDamage: ActionDamageInfo | null

  /** Sudden-death multiplier capture tại declare (Reaction Path picks scale riêng per-pick). */
  suddenDeathMultiplier: number

  /**
   * Task 11 — composite picks resolving as EXTRA payloads beyond the
   * primary resolvedSkill (element_basic extras when count > 1). Each
   * picked def applies its own damage + ailments through the shared
   * picks lane. Empty/null for normal casts.
   */
  compositePickedSkills: readonly TurnSkillDefinition[] | null

  /** Defect-fix Task 1 — turn này được grant qua follow-up/counter bypass
   * queue thay vì normal gauge readiness — completeAction bỏ consume gauge
   * cho các turn này (bypass không tốn progress của lượt kế tiếp). */
  isFollowUpBypass: boolean

  /**
   * Task 9 — execution identity: rootSkillId owns cast count/cooldown/
   * slot identity; resolvedSkill owns the payload. Absent on charge-
   * resolve/CC-blocked/empty turns (no cast happens there).
   */
  execution?: TurnSkillExecution

  /**
   * The Tu Reimagined (spec 7.1, plan Task 16) — the action's provenance.
   * Natural declares are 'normal' (basic) or 'skill' (a slotted cast);
   * queued reactive entries carry 'counter' | 'follow_up' | 'intercept'.
   * Reactive sources never open new reactive windows by default (INV-9)
   * — the Ho/Phan/Tro windows gate on this field.
   */
  actionSource?: ReactiveActionSource

  /** Composite trigger context captured at queue time — node payload
   *  variants (e.g. post-evasion heavy counter) read this. */
  triggerContext?: ReactiveTriggerContext

  /** The Tu Reimagined (plan Task 17) — set when a Ho intercept
   *  substituted this action's target; flows into queued entries'
   *  composite triggerContext.intercepted. */
  intercepted?: boolean

  /** The protector participant that absorbed this action via Ho. */
  interceptedBy?: string
}

/**
 * The Tu Reimagined (spec 7.1, plan Task 16) — provenance axis for the
 * reactive queue. 'normal'/'skill' describe natural turns; the reactive
 * sources describe bypass actions queued by a proc window.
 */
export type ReactiveActionSource = 'normal' | 'skill' | 'counter' | 'follow_up' | 'intercept'

/**
 * Composite trigger context (spec 6.2.2, plan Task 16) — each axis is
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
 * Kiem Tu Reimagined Task 2 — one extra declared impact produced by a
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

export class TurnBattleSystem {
  constructor(
    private readonly combat: CombatSystem,
    private readonly maxTurns: number = DEFAULT_MAX_TURNS,
    private readonly registry?: BuffDefinitionCatalog,
    private readonly spawnEnemy?: (occupiedSlots?: Set<string>) => TurnBattleParticipant,
    // Phase A1 (2026-09-07) — optional collaborator, same pattern as
    // registry/spawnEnemy above; consumers no-op safely when absent.
    private readonly reactionManager?: TurnReactionManager,
    // 9.5 #9 — committed-cast notification. Fires once per action that
    // actually commits (same point as commitAction): normal casts and
    // charge-initiation count; charge ticks/resolve and CC-blocked turns
    // do not. Generic over actors — consumers filter to the participants
    // they care about.
    private readonly onSkillCast?: (actor: TurnBattleParticipant, skillId: string) => void,
    /**
     * ARCH-002 (M7) — battle-scoped live-modifier provider. Supplies the
     * runtime modifier set that cannot bake into the resolved base
     * (passive stacks, persistent buff pool, timed/socket effects).
     * Returns StatModifier[] only — the assembly stays in
     * recomputeEffectiveStats, so this engine never owns a second stat
     * path and stays headless (the ops layer injects the closure).
     */
    private readonly liveStatModifiers?: (entity: CombatEntity) => StatModifier[],
    /**
     * Phap Tu Reimagined Task 11 — the ONE randomness source for all
     * new An-kit rolls (composite picks, multicast rolls, ailment
     * application). Tests inject a scripted rng for determinism.
     * The default is a LAZY closure — reading Math.random at each call
     * keeps vi.spyOn(Math, 'random') interception working for callers
     * that construct the system before installing the spy.
     */
    private readonly rng: () => number = () => Math.random(),
  ) {}

  // Action Playback Task 3 — gauge-delta deferral chuyển từ local vars
  // của resolveActorTurn cũ thành class fields (applyActionImpact ghi,
  // completeAction tiêu thụ — 2 phase tách nhau qua GameManager khi
  // presentationActive, nên state phải sống trên instance).
  private pendingGaugeDeltaTargets: TurnBattleParticipant[] = []
  private pendingGaugeDeltaDefinition: BuffDefinition | undefined

  // Defect-fix Task 1 (2026-09-05) — bridge dequeueFollowUpActor() →
  // declareActorAction(): set ngay trước khi trả bypass actor, đọc 1 lần
  // trong declare để populate TurnDeclaredAction.isFollowUpBypass rồi clear.
  // The Tu Reimagined (Task 16) — the bridge carries the whole typed
  // entry (provenance + payload descriptor), not just the actor id.
  private pendingReactiveEntry: QueuedFollowUp | null = null

  /**
   * Task 11 — same bridge pattern as pendingFollowUpBypassActorId, but
   * the entry IS the action: dequeueQueuedExecution() sets it,
   * declareActorAction() consumes it once and builds the declared action
   * from the descriptor (no selectAction, no turn machinery).
   */
  private pendingQueuedExecution: TurnQueuedExecution | null = null

  /**
   * R1 (AR-01) test seam — production wiring goes through
   * GameManager.setSurviveLethalSession on the shared CombatSystem; this
   * delegation lets engine-level tests exercise the survive-lethal
   * interception without touching the private combat collaborator.
   */
  setSurviveLethalSessionForTest(
    session: { playerEntityId: string; guard: SurviveLethalGuard } | null,
  ): void {
    this.combat.setSurviveLethalSession(session)
  }

  /**
   * ARCH-002 (M7) — entity.stats is the LIVE effective view, not a
   * build-time constant: recompute it from the immutable resolved base +
   * the participant's active buff modifiers + the provider's live runtime
   * modifiers, then mirror speed into the participant cache (R2/AR-05:
   * participant.speed is a read-only cache of entity.stats.speed).
   */
  private refreshParticipantStats(participant: TurnBattleParticipant): void {
    const entity = participant.entity

    // The Tu Reimagined (plan Task 11, review P1.1) — externalWard is
    // existence-bound to its source's marker instance; every pool
    // mutation seam (apply/update/remove/clear) already funnels into
    // this refresh, so reconcile lives here as the single choke point.
    reconcileExternalWard(entity, participant.buffs, this.registry)

    entity.stats = recomputeEffectiveStats(
      entity.baseStats,
      participant.buffs,
      this.liveStatModifiers?.(entity) ?? [],
      participant.activeDomains,
    )
    participant.speed = entity.stats.speed

    // ARCH-002 (M7) — entity.maxHp is the REAL vitals ceiling (heal clamp,
    // regen gate, entity_vitals_changed.maxHp, snapshot maxHp) and is
    // frozen at build; entity.stats.maxHp is the live effective view.
    // Reconcile here so a live maxHp modifier moves the heal ceiling the
    // same step it lands: shrink clamps currentHp through the vitals
    // authority (emits entity_vitals_changed carrying the new ceiling),
    // growth keeps currentHp — no free heal.
    if (entity.stats.maxHp !== entity.maxHp) {
      entity.maxHp = entity.stats.maxHp
      this.combat.vitals.clampToMaxHp(entity, 'stat_refresh')
    }
  }

  /**
   * ARCH-002 (M7) — refresh every participant's effective stats. Pacing
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
   * Defect-fix Task 1 — shared bởi tickPacing() và peekNextActor():
   * dequeue follow-up actor kế tiếp từ queue (nếu có, còn sống, dưới
   * reciprocity cap). Bỏ qua id của actor chết không tốn chain-depth.
   */
  private dequeueFollowUpActor(battle: TurnBattle): TurnBattleParticipant | null {
    // Task 11 — prepared executions (repeat/multicast) drain FIRST: they
    // are the remainder of an already-committed cast and must resolve
    // before counter follow-ups and before any new gauge turn. Entries
    // for dead actors drop silently. Structurally bounded (repeatCasts
    // count / multicast depth cap) — no reciprocity counter needed.
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
      // Reciprocity guard tripped — drop phần còn lại của queue, quay về
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
   * Gameplay fixes (2026-09-05) — wall-clock pacing: mỗi pacing tick (0.1s
   * hệ sống) chỉ advance gauge MỘT step cho mọi actor; actor resolve CHỈ
   * khi gauge đầy. Trước đây updateBattleFixedStep gọi resolveNextStep()
   * mỗi tick — inner-loop advance tới ready trong CÙNG call khiến 1 turn
   * = 1 tick (trận chớp mắt, không còn ai kịp thấy gì).
   *
   * Trả về actor ready (hoặc vừa resolve). `resolve` = true: turn đã chạy
   * hoàn tất headless (default path); `resolve` = false: CHỈ advance gauge
   * và trả ready actor — GameManager presentation path sẽ điều phối
   * declare/impact/complete qua 3 acknowledge (Action Playback Task 6).
   */
  tickPacing(battle: TurnBattle, resolve = true): TurnBattleParticipant | null {
    if (battle.state !== 'fighting') {
      return null
    }

    // Turn-Based Wave Redesign (2026-09-06) — wave-batch spawn/telegraph
    // chạy MỖI tick (không gate sau completeAction như cơ chế 1-quái-lần
    // trước đây): pending telegraph đếm ngược → materialize khi hết; sân
    // trống + hết pending + còn wave → queue cả wave mới đồng loạt.
    // Pending telegraph decrement KHÔNG phụ thuộc spawnEnemy factory —
    // materialize là việc hệ thống (đã build xong participant), chỉ wave-
    // start MỚI cần factory. Test 2 của plan chạy tickPacing không factory
    // mà vẫn kỳ vọng pending đếm ngược — đúng ngữ nghĩa này.
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

    // ARCH-002 (M7) — fold every live stat source into entity.stats BEFORE
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

    // Defect-fix Task 1 — follow-up/counter queue TRƯỚC gauge order: queue
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
   * Slice 7 (Completion Task 10) — tìm actor kế tiếp SẴN SÀNG hành động
   * mà KHÔNG resolve gì cả. Gauge advancement chạy thật (mutation để
   * tìm ai tới lượt là thật và GIỮ NGUYÊN), nhưng dừng trước buff tick /
   * action resolution / turn-counter increment. GameManager manual mode
   * gọi method này trước để biết có cần pause chờ input player không;
   * resume sau đó bằng resolveActorTurn(battle, actor, chosenSlot).
   */
  peekNextActor(battle: TurnBattle): TurnBattleParticipant | null {
    // Countdown phase: combat chưa bắt đầu — không ai tới lượt.
    if (battle.state !== 'fighting') {
      return null
    }

    // Defect-fix Task 1 — dùng chung dequeue helper với tickPacing (queue
    // FIFO + reciprocity guard thay vì single-id overwrite cũ).
    const followUpActor = this.dequeueFollowUpActor(battle)

    if (followUpActor) {
      return followUpActor
    }

    const allParticipants = [...battle.players, ...battle.enemies]

    for (const participant of allParticipants) {
      participant.alive = participant.entity.alive
    }

    // ARCH-002 (M7) — same effective-stat refresh as tickPacing so the
    // previewed actor order reflects live speeds.
    this.refreshEffectiveStats(battle)

    const resolved = resolveNextTurn(allParticipants)

    return resolved?.actor ?? null
  }

  /**
   * Action Playback Task 3 (2026-09-05) — PHA 1/3: declare action (chọn
   * skill, tính target set, charge tick, CC check, buff/resource/boss
   * tick) NHƯNG KHÔNG áp damage. 3 call site resolveActionHit cũ được
   * hoãn sang applyActionImpact() (Task 3 spec §Task 3).
   */
  declareActorAction(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    forcedAction?: ForcedTurnChoice,
  ): TurnDeclaredAction {
    // Task 11 — a queued repeat/multicast execution resolves HERE, ahead
    // of ALL turn machinery: no round/turn counting, no buff tick, no
    // regen, no CC check, no cooldown tick, no action selection. The
    // descriptor IS the remainder of an already-committed cast — it only
    // re-resolves the payload (composite picks re-roll per execution).
    const queuedExec = this.pendingQueuedExecution
    this.pendingQueuedExecution = null

    if (queuedExec && queuedExec.actorId === actor.id) {
      return this.declareQueuedExecution(battle, actor, queuedExec)
    }

    // The Tu Reimagined (spec 7.1, plan v2.4 P0.1) — a queued reactive
    // entry branches at the TOP: real action through declare -> impact,
    // but none of the natural-turn lifecycle below runs for it.
    if (this.pendingReactiveEntry?.actorId === actor.id) {
      const entry = this.pendingReactiveEntry
      this.pendingReactiveEntry = null

      if (!actor.entity.alive) {
        // Spec 7.1 — dead attackers must not receive queued payloads; the
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

      // The Tu Reimagined (spec 4.1) — anti-starvation bootstrap: each
      // ung_the participant collects its marker's authored gainPerRound
      // per boundary (node-adjusted at participant build, Task 20).
      for (const participant of aliveNow) {
        if (isUngTheCombatant(participant.buffs)) {
          grantThe(participant.entity, theGainPerRound(participant.buffs))
        }
      }
    }

    const actorBuffSystem = new BuffSystem(actor.buffs)

    // Future Systems Task 7 — charge state (Thế→Trảm). Charging takes
    // precedence: KHÔNG đụng CC counter Bá Thể (đã bất động tự nhiên,
    // không double penalty); buff tick/hpRegen/resource vẫn chạy (actor
    // vẫn sống); action resolution bị thay thế bởi charge tick/resolve;
    // wave-spawn + win-condition tail CHUNG ở cuối (không return sớm).
    const isCharging = (actor.chargingTurnsRemaining ?? 0) > 0
    let chargedSkillId = ''
    let chargeResolved = false
    let chargeTargetIds: string[] = []
    let chargedSkillCaptured: TurnSkillDefinition | null = null
    // Review fix (HIGH-2) — `affected` is the single consumed target list:
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
          const primaryTarget = selectTarget(actor, opposingSide)

          if (primaryTarget) {
            affected = collectTurnTargets(primaryTarget, opposingSide, chargedSkill.targeting)

            // Defect Task 8 (2026-09-05): damage tính lại ở applyActionImpact()
            // (đọc declared.chargedSkill + roundsElapsed độc lập) — không
            // cần tính trùng ở đây.
            chargeTargetIds = affected.filter((target) => target.entity.alive).map((target) => target.id)
            chargedSkillCaptured = chargedSkill
          }
        }

        actor.chargingTurnsRemaining = undefined
        chargeResolved = true
      }
    }

    // Action Playback Task 5 — onCastBegin reactive trigger TRƯỚC CC-check:
    // punish-on-cast áp hard-CC buff lên actor, CC-check kế tiếp đọc state
    // mới → ccBlocked đúng theo spec §4.2 ordering.
    if (this.registry) {
      actorBuffSystem.rollReactiveTrigger(actor.entity, 'onCastBegin', this.registry)
    }

    // CC check TRƯỚC tick: buff stun/freeze duration=N phải block đúng N
    // lượt của holder (áp ở lượt N-1, block lượt N..N+1, hết sau khi block
    // lượt cuối). Tick trước sẽ làm duration-1 expire trước khi kịp block.
    // Bá Thể: bị hard-CC liên tục >= 3 lượt thì lượt thứ 4 tự gỡ CC và
    // hành động (fairness guard — không ai bị khóa vĩnh viễn).
    //
    // isCharging skip hoàn toàn khối này (Defect-fix Task 2, 2026-09-05):
    // charging đã có hành động thay thế riêng (charge tick/resolve, xem
    // khối phía trên) — actor không hề bị "chặn" bởi CC trong lượt này,
    // nên KHÔNG tính vào consecutiveHardCcTurns (tránh Bá Thể clear sớm
    // sai) và ccBlocked phải là false (tránh log mâu thuẫn: ccBlocked=true
    // kèm skillId/damage thật của charge resolve).
    let ccBlocked: boolean

    if (isCharging) {
      ccBlocked = false
    } else if (actor.buffs.getAllById('bat_tu_ba_the').length > 0) {
      // Bat Tu Ba The (The Tu Reimagined plan Task 9, D10): while the
      // buff is active, hard CC cannot block the holder. The counter is
      // SUPPRESSED, not reset — consecutiveHardCcTurns is left untouched
      // so accumulation resumes where it left off after the buff expires.
      ccBlocked = false
    } else {
      const hardCcActive =
        actorBuffSystem.isStunned(actor.entity.id) || actorBuffSystem.isFrozen(actor.entity.id)

      if (hardCcActive && actor.consecutiveHardCcTurns >= 3) {
        actor.buffs.clearCcEffects()
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

    // R3 (AR-06) — provide source entity resolver so elemental penetration
    // and Mộc Tu poison recovery operate with authoritative source context.
    const resolveSource = (sourceId: string): CombatEntity | undefined => {
      const participant =
        battle.players.find((p) => p.id === sourceId) ??
        battle.enemies.find((e) => e.id === sourceId)
      return participant?.entity
    }

    // stat-system-reimagined Task 4 (D18) — the source's OWN buff pool is
    // a separate ownership boundary from its entity (Doc Can sits on the
    // caster while its DoT ticks on the target). Resolve it here so
    // authored dotRecovery triggers read the live pool at tick time.
    const resolveSourceBuffs = (sourceId: string): readonly Buff[] | undefined => {
      const participant =
        battle.players.find((p) => p.id === sourceId) ??
        battle.enemies.find((e) => e.id === sourceId)
      return participant?.buffs.getAll()
    }

    actorBuffSystem.update(actor.entity, this.combat, this.registry, resolveSource, resolveSourceBuffs)

    // ARCH-002 (M7) — refresh immediately after the buff tick so an
    // expiry inside update() is reflected before the very next stat read
    // (hpRegenPerTurn below must not fire one extra turn off an expired
    // buff). The refresh after bossTrigger below still covers
    // trigger-granted buffs for action selection.
    this.refreshParticipantStats(actor)

    // M8 (ARCH-010) — post-status liveness boundary: a status/DoT tick
    // that killed the actor ends the turn HERE — no regeneration, no
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

    // M8 (ARCH-003) — per-turn HP/MP/Ward regeneration through the vitals
    // authority, AFTER the status tick and liveness boundary above (a
    // lethal DoT leaves no regen). The *RegenPerTurn stats tick once per
    // entity turn — the same cadence family as hpRegenPerTurn (R1/AR-01
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
      isTurnTriggerReady({ afterTurns: actor.bossTrigger.afterTurns }, battle.roundsElapsed ?? 0)
    ) {
      // Phase A2 (2026-09-07) — BuffDefinitionCatalog.get() THROWS on an
      // unknown id, and bossTrigger data is now populated for real
      // enemies (content drift / renamed buff id would crash the whole
      // battle tick). Skip the buff gracefully instead — same
      // try/catch skip pattern as GameManager's formation-buff lookup.
      // firedAlready stays false so a corrected id can still fire later.
      let definition: BuffDefinition | undefined

      try {
        definition = this.registry.get(actor.bossTrigger.buffDefinitionId)
      } catch {
        definition = undefined
      }

      if (definition) {
        new BuffSystem(actor.buffs).apply(definition, actor.entity, actor.entity, this.registry)

        actor.bossTrigger.firedAlready = true
      }
    }

    // ARCH-002 (M7) — unconditional effective-stat refresh at every
    // declare: buff expiry (BuffSystem.update above), duration-1 buffs,
    // boss-trigger applications, Ba The CC clears and the live runtime
    // modifiers all land here — including for CC-blocked and charging
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
    if (actor.entity.alive && !ccBlocked && !isCharging) {
      tickCooldowns(actor)

      // ARCH-002 (M7) — the effective-stat refresh moved above the gate
      // (covers expiry/CC/charge too); action selection reads the fresh
      // entity.stats.
      action = forcedAction
        ? selectForcedAction(actor, forcedAction)
        : selectAction(actor)

      // Phase A3 (2026-09-07) — enemy specialAttacks reader, ported from
      // legacy EnemyAttackSystem.fireEnemyAttack()'s everyNth semantics
      // (module retired M13 — ported here):
      // 1-based counter on the actor's OWN actions; when
      // counter % everyNth === 0 the matching special attack's
      // damageMultiplier replaces the basic attack's damage (presetId
      // carries for presentation). Only applies to plain basic attacks
      // (slot null) — explicit skills (special/ultimate slots) are never
      // replaced. Counter never resets mid-battle; undefined coerces to 0.
      // The Tu Reimagined (plan Task 10, D6) — scripted specials are
      // TAUNT-EXEMPT: their positional pick is part of the authored
      // script, so the selectTarget call below passes ignoreTaunt.
      let scriptedSpecial = false

      if (!action.slot && actor.entity.specialAttacks?.length) {
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

      // Task 9 — execution record: rootSkillId owns cast/cooldown/slot
      // identity; resolvedSkill owns the payload. All casts today are
      // 'original' (resolvedSkill === action.skill); Tasks 10-13 diverge
      // them for empowered/composite/repeat/multicast executions.
      execution = {
        rootSkillId: action.skillId,
        resolvedSkill: action.skill,
        source: 'original' as const,
      }

      // Task 10 — ultimate empowerment: enough The swaps the RESOLVED
      // payload to the empowered form. The ROOT identity (cooldown,
      // cast count, charge state) stays the equipped skill; the pool
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

      // Task 11 — element_basic composite pick: the root skill authored a
      // uniform pick among a def-carried pool; picks[0] becomes THE
      // resolved payload (the cast executes AS it), extras resolve
      // damage-only through the shared picks lane. Identity stays on the
      // root (source 'composite' still commits the root's cast).
      const composite = action.skill?.compositePicks

      if (composite?.poolType === 'element_basic' && composite.pool.length > 0) {
        const picks = pickCompositePool(composite.pool, composite.count, this.rng)

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

      // Task 13 — capture the PRE-BURN pool when the resolved payload is
      // a consume-all form: the pool only zeroes at commitCast (after
      // hits resolve), so theScaling must read the value captured here.
      if (payloadSkill?.consumesAllThe) {
        execution.theBurned = actor.entity.currentThe ?? 0
      }

      const isChargeInit = (action.skill?.chargeTurns ?? 0) > 0

      if (isChargeInit) {
        // Future Systems Task 7 — charge INITIATION (Thế): KHÔNG resolve
        // ngay — ghi charge state, đòn tự resolve khi charge xong (Trảm).
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
        const primaryTarget = selectTarget(actor, opposingSide, { ignoreTaunt: scriptedSpecial })

        if (primaryTarget && !isChargeInit) {
          affected = collectTurnTargets(primaryTarget, opposingSide, payloadSkill?.targeting ?? action.targeting)

          if (action.damage) {
            const suddenDeathMultiplier = this.suddenDeathDamageMultiplier(battle.roundsElapsed ?? 0)
            suddenDeathMultiplierCaptured = suddenDeathMultiplier
            let resolvedDamage = suddenDeathMultiplier === 1 ? action.damage : scaleActionDamage(action.damage, suddenDeathMultiplier)

            // Task 13 — theScaling (nuke variant): final damage x
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
      action,
      opposingSide,
      affected,
      scaledDamage,
      suddenDeathMultiplier: suddenDeathMultiplierCaptured,
      compositePickedSkills,
      isFollowUpBypass: false,
      actionSource: action?.slot ? 'skill' : 'normal',
      // Task 9 — every real cast records its execution identity here:
      // 'original' for now (empowered/composite/repeat/multicast arrive
      // with Tasks 10-13). Charge-resolve/CC-blocked turns carry none.
      execution,
    }
  }

  /**
   * Action Playback Task 3 (2026-09-05) — PHA 2/3: áp damage của declared
   * action (3 call site resolveActionHit cũ — charge-resolve, normal,
   * Reaction Path) + commitAction + appliesBuff application. Trả về
   * targetIds hit thành công.
   */
  applyActionImpact(
    battle: TurnBattle,
    declared: TurnDeclaredAction,
  ): { targetIds: string[]; extraImpacts: TurnActionExtraImpact[] } {
    const targetIds: string[] = []
    const extraImpacts: TurnActionExtraImpact[] = []
    // The Tu Reimagined (spec 6.2.3, plan Task 18) — participants that
    // took a LANDED damaging hit this action; feeds the Tro window's
    // triggering_targets set.
    const landedTargets: TurnBattleParticipant[] = []
    const actor =
      battle.players.find((member) => member.id === declared.actorId) ??
      battle.enemies.find((enemy) => enemy.id === declared.actorId)

    if (!actor) {
      return { targetIds, extraImpacts }
    }

    // Task 12 (spec §6, INV-8/D21) + review fix (MED-3) — only
    // phap_tu-domain participants may INITIATE reaction resolution.
    // Player-side membership is NOT the authority: companions and
    // non-phap_tu players share the players array but cannot trigger;
    // enemy ailments participate as incumbents but never initiate.
    const actorInitiatesReactions = actor.canInitiateWuxingReactions === true

    // Spec 6.2.1 — the Ho window sits between declaration and impact:
    // a successful protectChance roll rewrites declared.affected before
    // the hit loop, so the substituted hit resolves fully vs the
    // protector. Presentation reads the post-substitution targetIds.
    this.resolveInterceptWindow(battle, declared, actor)

    // Charge-resolve turn: hits apply từ chargedSkill capture tại declare
    // (pendingChargedSkillId đã clear ở declare — đọc declared.chargedSkill).
    if (declared.isCharging && declared.chargeResolved) {
      const chargedSkill = declared.chargedSkill
      let chargedCrit = false

      if (chargedSkill && chargedSkill.damage) {
        const opposingSide = battle.players.includes(actor) ? battle.enemies : battle.players

        const suddenDeathMultiplier = this.suddenDeathDamageMultiplier(battle.roundsElapsed ?? 0)
        const chargedDamage = suddenDeathMultiplier === 1
          ? chargedSkill.damage
          : scaleActionDamage(chargedSkill.damage, suddenDeathMultiplier)

        for (const target of declared.chargeTargetIds) {
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
            actorInitiatesReactions,
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

      // M8 (ARCH-010) — the shared per-action The gain below lives past
      // this branch's early return, so a charged completion fires it
      // HERE, exactly once. Task 8 — the gain is the SKILL's authored
      // field, not slot inference: the charged def carries
      // theGainOnLandedCast/theGainOnCrit itself. Ordering parity with
      // the normal path is preserved: the cast resource/cooldown was
      // already committed at charge-init, so the gain lands on the
      // post-consume pool — Bat Kiem Thuat accrues currentThe at hit
      // completion and Tru Tien Kiem Tran stays reachable. Gated on
      // LANDED targets like the normal path's targetIds requirement.
      if (chargedSkill && targetIds.length > 0) {
        this.grantTheFromCast(actor, chargedSkill, chargedCrit)
      }

      this.resolveAllyActionWindow(battle, actor, declared, landedTargets)

      return { targetIds, extraImpacts }
    }

    // 9.5 #9 — charge-init commits its cast HERE, not in the
    // affected-gated block below: enemy-targeted charge skills collect
    // targets only at resolve time, so `affected` stays empty at declare
    // and the block below never ran for them — their cooldown/resource
    // were never committed (dead isChargeInit branch). The charge-resolve
    // turn returns early above and never reaches this point.
    if (
      declared.action &&
      (declared.action.skill?.chargeTurns ?? 0) > 0 &&
      executionCommitsCast(declared.execution)
    ) {
      this.commitCast(actor, declared)
    }

    if (declared.action && declared.affected.length > 0) {
      const action = declared.action

      // Task 9 — payload reads go through the execution's resolvedSkill
      // (== action.skill for 'original' casts today; diverges for
      // empowered/composite payloads in Tasks 10-13). Identity reads
      // (cooldown, cast sink, charge state) stay on the ROOT action.
      const payloadSkill = declared.execution?.resolvedSkill ?? action.skill

      // Task 8 — theGainOnCrit fires once per CAST when any direct hit
      // crits (INV-15): collect the flag across the hit loops, grant
      // once below — never per target.
      let castCritLanded = false

      // R5 (AR-14) — Emit authoritative gameplay 'attack' event on action commit,
      // ensuring passive listeners receive events identically in headless and presentation modes.
      this.combat.eventBus.emit('attack', {
        type: 'attack',
        sourceId: actor.id,
        targetId: declared.affected[0]?.id ?? actor.id,
        skillId: declared.skillId,
      })

      // Composite-picks lane — extra picked payloads (element_basic
      // extras when count > 1) apply their own
      // damage + ailments here. The PRIMARY payload still resolves via
      // scaledDamage below, so both lanes may run on one action.
      // Review fix (MED-3) — extras go through resolveDeclaredHit, the
      // same per-hit authority as the primary lane: income, leech,
      // consume effects, on-hit procs, Reflection queue, ailments,
      // detonate, the taken/evade windows and the stat refresh are all
      // owned there — this lane only collects landing bookkeeping.
      if (declared.compositePickedSkills?.length) {
        for (const pickedSkill of declared.compositePickedSkills) {
          if (!pickedSkill.damage) continue

          const pickedDamage = declared.suddenDeathMultiplier === 1
            ? pickedSkill.damage
            : scaleActionDamage(pickedSkill.damage, declared.suddenDeathMultiplier)

          for (const target of declared.affected) {
            if (!target.entity.alive) continue

            const hitResult = this.resolveDeclaredHit(
              battle,
              actor,
              target,
              pickedDamage,
              pickedSkill,
              actorInitiatesReactions,
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

      if (declared.scaledDamage) {
        for (const target of declared.affected) {
          // Kiem Tu Reimagined Task 2 — multi-instance defs (Ngu phi kiem):
          // each instance runs the FULL landed-hit pipeline independently
          // and stops early when the target dies.
          const instanceCount = action.skill?.instances?.count ?? 1
          let targetLanded = false

          for (let instanceIndex = 0; instanceIndex < instanceCount; instanceIndex++) {
            if (!target.entity.alive) break

            const hitOptions = action.skill?.instances?.perInstanceOptions?.(instanceIndex, target.entity)
            const hitResult = this.resolveDeclaredHit(
              battle,
              actor,
              target,
              declared.scaledDamage,
              payloadSkill ?? null,
              actorInitiatesReactions,
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
      !declared.compositePickedSkills?.length &&
      payloadSkill?.targetScope !== 'self'
    ) {
      // Non-damaging action targeting enemies (e.g. pure debuff skill
      // like doc_chuong). Skipped when the composite-picks lane ran —
      // this else is the THIRD branch of the original picks/scaledDamage/
      // non-damaging chain; with picks in flight it must stay silent.
      for (const target of declared.affected) {
        if (!target.entity.alive) continue
        targetIds.push(target.id)

        if (payloadSkill) {
          this.applySkillAilments(actor, target, payloadSkill, actorInitiatesReactions)
        }

        // Task 13 — same detonate contract on the non-damaging lane.
        if (this.registry && payloadSkill?.detonateDoT && target.entity.alive) {
          this.applyDetonate(actor, target, payloadSkill.detonateDoT.amp)
        }
        // ARCH-002 (M7) — reactions off the applied ailment can grant the
        // SOURCE a buff; refresh both sides (same as the damaging path).
        this.refreshParticipantStats(target)
        this.refreshParticipantStats(actor)
      }
    }

      // Charge-init is committed in the pre-block above (it cannot rely
      // on `affected` — empty for enemy-targeted charge skills). Only
      // non-charge casts commit here.
      if ((action.skill?.chargeTurns ?? 0) === 0) {
        // Task 9 — repeat/multicast follow-up executions resolve the
        // payload WITHOUT re-committing the root's cast: no second
        // cooldown, no second cast-count (INV-18 structural).
        if (executionCommitsCast(declared.execution)) {
          this.commitCast(actor, declared)
        }

        // Task 8 — The gain is skill-authored (theGainOnLandedCast /
        // theGainOnCrit), once per cast that landed >=1 valid target —
        // slot position is no longer a gain rule and target/hit count
        // never multiplies it (INV-15). A self-scoped cast always lands
        // on the caster (its targetIds entry is pushed by the buff
        // block below — too late to serve as the landed signal here).
        // Runs AFTER commitAction so an ultimate's pool consumption
        // (100 -> 0) is already reflected — the gain lands on the
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

        if (payloadSkill?.targetScope === 'self') {
          targetIds.push(actor.id)
        }

        // Kiem Tu Reimagined Task 2 — dynamicBasic post-resolution hook.
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

    // Spec 6.2.3 — the Tro window: after a player-side action completes
    // (damaging or non-damaging), other player-side tro_mon carriers
    // roll their onAllyActionComplete procs.
    this.resolveAllyActionWindow(battle, actor, declared, landedTargets)

    return { targetIds, extraImpacts }
  }

  /**
   * Kiem Tu Reimagined Task 2 — the FULL landed-hit consequence chain for
   * ONE declared hit: resolveActionHit + (on landed) leech / consume-for-
   * damage / on-hit procs / reactive follow-up trigger / ailment appli-
   * cation + stat refresh on both sides. Multi-instance casts (Ngu phi
   * kiem) and provider-returned combo impacts loop THIS helper — never
   * bare CombatSystem.resolveActionHit, which lacks the consequences.
   */
  private resolveDeclaredHit(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    target: TurnBattleParticipant,
    damage: ActionDamageInfo,
    skill: TurnSkillDefinition | null,
    actorInitiatesReactions: boolean,
    declared: TurnDeclaredAction,
    hitOptions?: Partial<HitResolveOptions>,
  ): DamageResult {
    // The Tu Reimagined (spec section 3.4, plan Task 7) — the missing-HP
    // scalar resolves PER HIT against the actor's LIVE hp: a
    // Reflection/leech landing between AOE impacts changes the next
    // hit's bonus.
    const hitResult = this.combat.resolveActionHit(
      actor.entity,
      target.entity,
      this.applyMissingHpScalar(damage, actor.entity),
      hitOptions,
    )

    // The Tu Reimagined (spec 4.1 ordering lock) — defender income
    // lands before any window this hit opens (evade/taken).
    this.grantHitOutcomeIncome(target, hitResult)

    // AR-04: downstream on-hit effects, debuffs and consume triggers
    // require a landed hit — dodged attacks bypass all of them.
    if (!hitResult.dodged) {
      // Spec 4.1 — the acting the_tu_an's own basic landed: free income
      // through the marker's authored field.
      this.grantBasicLandedIncome(actor, skill?.id)

      // R3 (AR-03) + Task 5 (D11) — Leech healing: % of the HP the
      // target THẬT SỰ lost post-absorb — a fully-warded hit feeds
      // nothing (damage-proportional = taken-only trigger).
      if (skill?.healPercentOfDamage && hitResult.hpDamage > 0) {
        this.combat.applyHealing(
          actor.entity,
          hitResult.hpDamage * skill.healPercentOfDamage,
          actor.entity.id,
          'leech',
        )
      }

      // Phase A3 — consume-for-damage (Pháp Tu Detonate / Thổ Tu ward
      // burst). Orchestration only: reads/clears state through
      // BuffSystem's own API (getAllById/removeAllById); the HP and
      // Ward mutations go through the authoritative damage/vitals
      // pipeline (R1 / AR-01) so death, survive-lethal and vitals
      // events stay exactly-once and uniform. True damage = direct
      // HP damage via the authority, matching the reaction pipeline's
      // applyModifiedDirectDamage bypass semantics at this resolution
      // layer. Deliberately NOT registry-gated: these consume the
      // skill's OWN authored fields, no registry content involved.
      if (skill?.consumesAilmentId && skill.damagePerStack) {
        const stacks = new BuffSystem(target.buffs).getStacks(skill.consumesAilmentId)

        if (stacks > 0) {
          this.combat.applyDirectDamage(target.entity, stacks * skill.damagePerStack, actor.entity.id)
          new BuffSystem(target.buffs).removeAllById(skill.consumesAilmentId)
        }
      }

      if (skill?.consumesWardForDamage && skill.damagePerWardPoint) {
        const ward = actor.entity.currentWard

        if (ward > 0) {
          this.combat.applyDirectDamage(target.entity, ward * skill.damagePerWardPoint, actor.entity.id)
          this.combat.spendWard(actor.entity, ward, 'ward_spend', actor.entity.id)
        }
      }

      if (this.registry) {
        // ARCH-009 (M9) — proc definitions are read from the ACTOR's
        // pool, but the resulting buff belongs to the HIT VICTIM's
        // pool (sourceId = actor, targetId = victim).
        new BuffSystem(actor.buffs).rollOnHitEffects(actor.entity, target.entity, target.buffs, this.registry)

        // Action Playback Task 5 + stat-system-reimagined Task 5 (D5)
        // — onImpactLanded counter trigger trên TARGET bị hit, gated
        // on `taken` (hpDamage > 0): a fully ward/MP-shielded hit is
        // not "taken", so no defender on-hit-taken proc fires.
        // queuesFollowUp → battle.queuedFollowUps (typed entries).
        // The Tu Reimagined (Task 8) — the context carries the landed
        // hit's facts so phan_chinh Reflection can resolve its amount.
        const { firedFollowUp, reflectRequests } = hitResult.hpDamage > 0
          ? new BuffSystem(target.buffs).rollReactiveTrigger(target.entity, 'onImpactLanded', this.registry, {
              attacker: actor.entity,
              hpDamage: hitResult.hpDamage,
            })
          : { firedFollowUp: false, reflectRequests: [] }

        if (firedFollowUp) {
          // Defect-fix Task 1 — FIFO queue: AOE hit trigger counter trên
          // nhiều target không drop tất cả trừ cái cuối.
          battle.queuedFollowUps = battle.queuedFollowUps ?? []
          battle.queuedFollowUps.push({
            actorId: target.id,
            executionKind: 'reactive_bypass',
            actionSource: 'follow_up',
          })
        }

        // The Tu Reimagined (Task 8, D4/INV-8) — Reflection is a
        // TERMINAL damage event through the vitals authority: it can
        // kill the attacker but opens no reactive windows back (a
        // reflected hit never triggers the attacker's own triggers).
        for (const request of reflectRequests) {
          if (!request.attackerEntity.alive) continue
          this.combat.applyModifiedDirectDamage(request.attackerEntity, request.amount, target.entity, 'reflection')
        }

        // Phase A1 (2026-09-07) / R3 (AR-03) — chance-gated ailment application,
        // then reaction check against the just-applied id.
        if (skill) {
          this.applySkillAilments(actor, target, skill, actorInitiatesReactions)
        }

        // Task 13 — detonate (dot-route empowered ult, spec §4):
        // AFTER the normal application lands, consume every live
        // DoT ailment for remaining-tick x stacks x amp and re-seed
        // a fixed 1 stack at authored duration. Reaction-silent by
        // contract — re-seeds never reach TurnReactionManager.
        if (skill?.detonateDoT && target.entity.alive) {
          this.applyDetonate(actor, target, skill.detonateDoT.amp)
        }
      }

      // Spec 6.2.2 — the taken-side Phan window: a LANDED hit with
      // hpDamage > 0 (fully absorbed is not "taken", same gate as
      // Reflection) rolls the defender's onImpactLanded reactiveProc
      // effects. Natural actions only (INV-9); income already landed
      // above, so this hit's +6 can fund the check.
      if (
        hitResult.hpDamage > 0 &&
        (declared.actionSource === 'normal' || declared.actionSource === 'skill')
      ) {
        this.resolveReactiveProcs(battle, target, 'onImpactLanded', {
          attacker: actor,
          outcome: 'taken',
          intercepted: declared.intercepted === true,
        })
      }
    } else {
      // Spec 6.2.2 — the dodge branch opens the defender's onEvade
      // window (income already landed above).
      this.resolveEvadeWindow(battle, target, actor, declared)
    }

    // ARCH-002 (M7) — every pool mutation above (consume-removal —
    // removeAllById runs OUTSIDE the registry gate — on-hit procs on
    // the actor, reactive triggers and ailments on the target,
    // survive-lethal grants inside resolveActionHit) must be
    // effective before the next hit/read in this loop, so the
    // refresh is deliberately not registry-gated either — and runs
    // for dodged hits too (same as the pre-extraction loop).
    this.refreshParticipantStats(target)
    this.refreshParticipantStats(actor)

    return hitResult
  }

  /**
   * Kiem Tu Reimagined Task 2 — appliesBuff machinery shared by the
   * action's own appliesBuff and provider extra-impact defs / the
   * resolveBuff ctx channel. Keeps the gaugeDelta one-shot deferral
   * (pendingGaugeDeltaTargets consumed in completeAction).
   */
  private applyDeclaredBuff(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    buffSpec: TurnSkillBuffApplication,
    actionTargets: TurnBattleParticipant[],
  ): void {
    if (!this.registry) return

    // Skip an unresolvable buff id gracefully (renamed/drifted content
    // must not crash the tick) — same try/catch pattern as the
    // bossTrigger lookup above.
    let definition: BuffDefinition | undefined

    try {
      definition = this.registry.get(buffSpec.definitionId)
    } catch {
      definition = undefined
    }

    if (!definition) return

    // Kiem Tu Reimagined Task 11 — combo capstones may declare N stacks;
    // each apply() call adds one stack under 'stack' stackMode and is
    // idempotent under 'refresh'. Default 1 = previous behavior.
    const stacks = Math.max(1, buffSpec.stacks ?? 1)
    const duration = buffSpec.durationOverride ?? buffSpec.duration

    // The Tu Reimagined (plan Task 6/11) — the application resolves its
    // own target set: 'self'/'target'/'action_targets' read the
    // declared action; the ally/enemy scopes read the battle sides.
    const targets = this.resolveBuffApplicationTargets(battle, actor, buffSpec.target, actionTargets)

    // gaugeDelta là ONE-SHOT push SAU consume (consume đặt gauge về 0,
    // delta cộng lên trên — nếu áp trước sẽ bị consume ghi đè).
    const applied: TurnBattleParticipant[] = []

    for (const target of targets) {
      // clearsCcOnApply (Ba The, Task 9) — applying strips the TARGET
      // pool's cc effects before the new buff lands.
      if (definition.clearsCcOnApply) {
        target.buffs.clearCcEffects()
      }

      for (let i = 0; i < stacks; i++) {
        new BuffSystem(target.buffs).apply(
          definition,
          actor.entity,
          target.entity,
          this.registry,
          duration,
        )
      }

      // The Tu Reimagined (plan Task 11, D3/INV-12) — the grant lands a
      // source-tagged externalWard pool on the target: REPLACE, never
      // stack (recast refreshes to full; a lower recast lowers the
      // pool). sourceMaxHpRatio reads the GRANTING tank's live maxHp.
      if (buffSpec.externalWardGrant) {
        target.entity.externalWard = {
          sourceId: actor.entity.id,
          amount: Math.max(
            0,
            actor.entity.stats.maxHp * buffSpec.externalWardGrant.sourceMaxHpRatio,
          ),
        }
      }

      applied.push(target)
      // ARCH-002 (M7) — statModifier buffs are effective NOW, not at the
      // holder's next turn (kim_giap counter-read class).
      this.refreshParticipantStats(target)
    }

    this.pendingGaugeDeltaTargets = applied
    this.pendingGaugeDeltaDefinition = definition
  }

  /**
   * The Tu Reimagined (plan Task 6) — resolve a TurnSkillBuffApplication's
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
   * Kiem Tu Reimagined Task 2 — execute ONE provider-returned extra
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
            const primary = selectTarget(actor, declared.opposingSide)

            return primary ? collectTurnTargets(primary, declared.opposingSide, extraDef.targeting) : []
          })()

    const landedIds: string[] = []
    let hitCount = 0

    if (extraDef.damage) {
      const scaled = declared.suddenDeathMultiplier === 1
        ? extraDef.damage
        : scaleActionDamage(extraDef.damage, declared.suddenDeathMultiplier)

      for (const target of extraTargets) {
        const count = extraDef.instances?.count ?? 1

        for (let i = 0; i < count; i++) {
          if (!target.entity.alive) break

          const opts = extraDef.instances?.perInstanceOptions?.(i, target.entity)
          const result = this.resolveDeclaredHit(battle, actor, target, scaled, extraDef, actor.canInitiateWuxingReactions === true, declared, opts)
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

    if (extraScope === 'self' && !landedIds.includes(actor.id)) {
      landedIds.push(actor.id)
    }

    return {
      presetId: extraDef.presetId,
      // Authored targeting rides the payload so presentation reports the
      // same area the gameplay resolution used (A8 — no silent
      // single-cell downgrade when a combo declares AOE).
      targeting: extraDef.targeting,
      targetIds: extraTargets.map((target) => target.id),
      landedTargetIds: landedIds,
      hitCount,
    }
  }

  /**
   * Phap Tu An (Task 11) — declare phase for a queued repeat/multicast
   * execution: the descriptor IS the action (no selectAction, no charge,
   * no CC). The payload re-resolves — an element_basic composite root
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
      const picks = pickCompositePool(composite.pool, composite.count, this.rng)

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

    // Task 13 — same pre-burn capture as the normal declare path: a
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
        const primaryTarget = selectTarget(actor, opposingSide)

        if (primaryTarget) {
          affected = collectTurnTargets(primaryTarget, opposingSide, payloadSkill.targeting)

          if (payloadSkill.damage) {
            suddenDeathMultiplier = this.suddenDeathDamageMultiplier(battle.roundsElapsed ?? 0)
            scaledDamage =
              suddenDeathMultiplier === 1
                ? payloadSkill.damage
                : scaleActionDamage(payloadSkill.damage, suddenDeathMultiplier)

            // Task 13 — theScaling fold (same as declareActorAction).
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
   * Phap Tu An (Task 11) — enqueue the cast's own follow-up executions:
   *
   * - `repeatCasts` on the root skill: each committed cast queues that
   *   many 'repeat' entries (depth 0). Only casts that COMMIT (source
   *   'original'/'composite'/'empowered' — never a repeat/multicast
   *   itself) spawn repeats, so repeats can never recurse.
   * - `multicast` on the root skill: original/composite and
   *   multicast-sourced executions roll `chance`; success queues one
   *   'multicast' entry at depth+1, bounded by
   *   min(maxExtraCasts, MAX_MULTICAST) (P15: the special's repeat fires
   *   never roll — source 'repeat' is excluded; 'empowered' is too).
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
    // follow-ups — a whiffed-into-empty cast commits nothing.
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

      if (depth < cap && this.rng() < multicast.chance) {
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
   * Task 11 — presentation/orchestration seam: is the actor's pending
   * turn a queued EXECUTION (repeat/multicast) rather than a real turn?
   * Manual mode must NOT await player input for these — the cast was
   * already chosen; the follow-up resolves automatically.
   */
  isPendingQueuedExecution(actorId: string): boolean {
    return this.pendingQueuedExecution?.actorId === actorId
  }

  /**
   * Phap Tu Reimagined Task 10 — the ONE cast-commit sink: slot
   * cooldown + resource consume (root identity), the cast-count sink
   * (always rootSkillId), and the empowered form's consume-all-The
   * burn. `theBurned` was already captured at DECLARE (Task 13 — the
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
   * Phap Tu Reimagined Task 8 — the single The-gain hook. Values are
   * authored on the resolving TurnSkillDefinition: theGainOnLandedCast
   * applies once per landed cast; theGainOnCrit once more when any
   * direct hit of the cast crited. The cap reads the battle-snapshotted
   * entity.maxThe (Truong The nodes, 'no' route) with MAX_THE as the
   * default — never a hard-coded constant.
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
   * The Tu Reimagined (spec section 4.1, plan Task 15 ordering lock) —
   * free income on the DEFENDER's pool per hit outcome, granted
   * immediately at hit resolution so it is always BEFORE any reactive
   * window this hit may open (Phan consumes it):
   * - dodged -> +THE_GAIN_ON_EVADE
   * - taken (!dodged && hpDamage > 0) -> +THE_GAIN_ON_HIT_TAKEN
   * - landed but fully absorbed -> nothing (INV-16: not a "taken").
   * Marker-gated: non-the_tu_an participants never see this table.
   */
  private grantHitOutcomeIncome(target: TurnBattleParticipant, hitResult: { dodged: boolean; hpDamage: number }): void {
    if (!isUngTheCombatant(target.buffs)) {
      return
    }
    grantThe(
      target.entity,
      hitResult.dodged
        ? theGainOnEvade(target.buffs)
        : hitResult.hpDamage > 0
          ? theGainOnHitTaken(target.buffs)
          : 0,
    )
  }

  /**
   * The Tu Reimagined (spec 6.2/7.1, plan Tasks 15-18) — one reactive
   * window pass on a holder's pool: every reactiveProc effect matching
   * `trigger` attempts in pool order. Per attempt: pay-per-attempt cost
   * (resolveProcCost — bach_ung freeProcs / tu_the delta already inside)
   * -> insufficient The means NO roll; the stat channel rolls via
   * clampStatValue; success credits the gain and pushes the effect's
   * queuedAction onto the typed bypass queue with the composite context.
   * Returns per-attempt results so callers (e.g. the Ho intercept
   * window, Task 17) can act on a successful roll that queues nothing.
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
      /** Task 20 — the ally-action window on a non-damaging action; only
       * effects carrying firesOnNonDamagingAction may roll. */
      nonDamaging?: boolean
    },
    opts?: { once?: boolean },
  ): { paid: boolean; success: boolean; effect?: ReactiveProcEffect }[] {
    const attempts: { paid: boolean; success: boolean; effect?: ReactiveProcEffect }[] = []

    for (const buff of holder.buffs.getAll()) {
      for (const effect of buff.effects) {
        if (effect.type !== 'reactiveProc' || effect.trigger !== trigger) {
          continue
        }

        // Task 20 — the Tro window on a non-damaging ally action opens
        // only for effects that opted in via firesOnNonDamagingAction.
        if (context.nonDamaging === true && !effect.firesOnNonDamagingAction) {
          continue
        }

        if (opts?.once && attempts.length > 0) {
          return attempts
        }

        if (!tryPayProcCost(holder.entity, resolveProcCost(holder.buffs, effect.theCost ?? THE_PROC_COST))) {
          attempts.push({ paid: false, success: false })
          continue
        }

        const chance = clampStatValue(
          effect.chanceStat,
          holder.entity.stats[effect.chanceStat] ?? 0,
        )
        const success = Math.random() < chance

        if (success) {
          onProcSuccess(holder.entity, effect.theGainOnSuccess)

          // Task 20 (spec 8.2 "tro_kich heals ally") — a successful Tro
          // proc heals the TRIGGERING ally through the vitals authority.
          if (effect.healsTriggeringAllyMaxHpRatio !== undefined && context.attacker?.entity.alive) {
            this.combat.applyHealing(
              context.attacker.entity,
              context.attacker.entity.stats.maxHp * effect.healsTriggeringAllyMaxHpRatio,
              holder.entity.id,
              'healing',
            )
          }

          const queuedAction = effect.queuedAction

          if (queuedAction) {
            const targetIds =
              queuedAction.targetMode === 'attacker'
                ? context.attacker?.entity.alive
                  ? [context.attacker.id]
                  : []
                : (context.triggeringTargets ?? [])
                    .filter((participant) => participant.entity.alive)
                    .map((participant) => participant.id)

            if (targetIds.length > 0) {
              battle.queuedFollowUps = battle.queuedFollowUps ?? []
              battle.queuedFollowUps.push({
                actorId: holder.id,
                executionKind: 'reactive_bypass',
                actionSource: queuedAction.actionSource,
                payloadSkillId: queuedAction.payloadSkillId,
                targetIds,
                triggerContext: {
                  origin: trigger === 'onAllyActionComplete' ? 'ally_action' : 'enemy_hit',
                  intercepted: context.intercepted,
                  outcome: context.outcome,
                },
              })
            }
          }
        }

        attempts.push({ paid: true, success, effect })
      }
    }

    return attempts
  }

  /**
   * The dodge-side window (spec 6.2.2): the defender's pool gets an
   * onEvade pass after its +THE_GAIN_ON_EVADE income already landed —
   * the just-earned income can fund this hit's check (ordering lock,
   * review P1.6). Natural actions only — reactive actions never open
   * new windows (INV-9).
   */
  private resolveEvadeWindow(
    battle: TurnBattle,
    target: TurnBattleParticipant,
    attacker: TurnBattleParticipant,
    declared: TurnDeclaredAction,
  ): void {
    if (declared.actionSource !== 'normal' && declared.actionSource !== 'skill') {
      return
    }

    this.resolveReactiveProcs(battle, target, 'onEvade', {
      attacker,
      outcome: 'evaded',
      intercepted: declared.intercepted === true,
    })
  }

  /**
   * The Tro window (spec 6.2.3, plan Task 18) — after a player-side
   * action lands >=1 damaging hit, every OTHER living player-side
   * participant carrying an onAllyActionComplete reactiveProc (tro_mon
   * marker) rolls once; success queues its payload against the whole
   * landed set. Never fires on the actor's own window (ally !== actor)
   * or on reactive actions (INV-9 — a counter/follow-up hit does not
   * open another reactive window).
   */
  private resolveAllyActionWindow(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    declared: TurnDeclaredAction,
    landedTargets: TurnBattleParticipant[],
  ): void {
    if (
      !battle.players.includes(actor) ||
      (declared.actionSource !== 'normal' && declared.actionSource !== 'skill')
    ) {
      return
    }

    // Task 20 (spec 8.2 "follow-up on ANY ally action") + review fix
    // (MED-4) — "dealt no damage" gates firesOnNonDamagingAction rolls
    // (a whiffed damaging action still counts), but it is NOT a
    // targeting fact: a whiffed action inherits its declared.affected
    // targets. Only an action that AUTHORED no damage (self-buff, pure
    // utility — nothing to inherit) fans out to every living enemy.
    const nonDamaging = landedTargets.length === 0
    const authoredDamaging =
      declared.scaledDamage !== null ||
      declared.chargedSkill?.damage != null ||
      (declared.compositePickedSkills?.some((picked) => picked.damage != null) ?? false)
    // Review fix (MED-5) — a composite action pushes the same target once
    // per landed pick; dedupe by id so Tro Kich resolves once per
    // triggering TARGET, not once per hit.
    const landedUnique = [...new Map(landedTargets.map((p) => [p.id, p])).values()]
    const followUpTargets = !nonDamaging
      ? landedUnique.filter((participant) => participant.entity.alive)
      : authoredDamaging
        ? declared.affected.filter((participant) => participant.entity.alive)
        : battle.enemies.filter((participant) => participant.entity.alive)

    if (followUpTargets.length === 0) {
      return
    }

    for (const ally of battle.players) {
      if (ally === actor || !ally.entity.alive) {
        continue
      }

      this.resolveReactiveProcs(battle, ally, 'onAllyActionComplete', {
        attacker: actor,
        triggeringTargets: followUpTargets,
        nonDamaging,
      })
    }
  }

  /**
   * The Ho intercept window (spec 6.2.1, plan Task 17) — runs at the top
   * of applyActionImpact, post-declare/pre-impact: on success the
   * declared target is substituted and the hit resolves fully vs the
   * protector (dodge/ward/block/procs all live downstream).
   * Preconditions: actor is enemy-side, the action is a NATURAL
   * (normal/skill — INV-9, same gate as the Phan/Tro windows) single-
   * target action by AUTHORED targeting shape (an all_lanes AoE whose
   * other targets died stays AoE), and the target is a LIVING player-
   * side participant. Candidates are player-side participants carrying
   * an onAllyTargeted/intercept reactiveProc (the ho_mon marker),
   * excluding the original target. Exactly ONE roll: the nearest
   * protector to the attacker by Chebyshev attempts; no fallback to
   * further candidates (D5).
   */
  private resolveInterceptWindow(
    battle: TurnBattle,
    declared: TurnDeclaredAction,
    actor: TurnBattleParticipant,
  ): void {
    if (!battle.enemies.includes(actor)) {
      return
    }

    // INV-9 — reactive/replayed actions (counter/follow_up/intercept and
    // queued executions) never open new reactive windows.
    if (declared.actionSource !== 'normal' && declared.actionSource !== 'skill') {
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

    const candidates = battle.players.filter(
      (participant) =>
        participant !== original &&
        participant.entity.alive &&
        participant.buffs
          .getAll()
          .some((buff) =>
            buff.effects.some(
              (effect) =>
                effect.type === 'reactiveProc' &&
                effect.trigger === 'onAllyTargeted' &&
                effect.mechanic === 'intercept',
            ),
          ),
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

    const winning = attempts.find((attempt) => attempt.success)

    if (!winning) {
      return
    }

    declared.affected = [nearest]
    declared.intercepted = true
    declared.interceptedBy = nearest.id

    // A charge-resolve action's hit lane reads chargeTargetIds — keep it
    // the id-mirror of `affected` so the substitution lands on the
    // protector there too.
    if (declared.chargeResolved) {
      declared.chargeTargetIds = [nearest.id]
    }

    // Task 20 (spec 8.2 "intercept->ally ward") — the node-baked marker
    // rider: the rescued ally gains a grantsExternalWard marker sourced
    // by the protector plus the ward pool itself. Same existence-bound
    // contract as son_nhac_ho_the — reconcileExternalWard owns expiry.
    const wardGrant = winning.effect?.grantsWardToOriginalTarget

    if (wardGrant !== undefined && this.registry !== undefined) {
      let definition: BuffDefinition | undefined

      try {
        definition = this.registry.get(wardGrant.buffDefinitionId)
      } catch {
        definition = undefined
      }

      if (definition !== undefined) {
        // The marker lands on the rescued ally's pool SOURCED BY the
        // protector — sourceId must match the ward's sourceId or the
        // existence-bound reconcile clears the pool at the next refresh.
        new BuffSystem(original.buffs).apply(definition, nearest.entity, original.entity, this.registry)
        original.entity.externalWard = {
          sourceId: nearest.entity.id,
          amount: nearest.entity.stats.maxHp * wardGrant.sourceMaxHpRatio,
        }
      }
    }
  }

  /**
   * Own-basic-lands income (spec 4.1) — the acting participant's own
   * basic landed a hit. Reads the authored theEconomy.gainOnBasicHit
   * field off the ung_the marker clone (single channel, review P1).
   */
  private grantBasicLandedIncome(actor: TurnBattleParticipant, skillId: string | undefined): void {
    if (!isUngTheCombatant(actor.buffs) || skillId === undefined || skillId !== actor.basic?.id) {
      return
    }
    grantThe(actor.entity, theGainOnBasicHit(actor.buffs))
  }

  /**
   * The Tu Reimagined (spec 7.1, plan Task 16/v2.4 P0.1) — a queued
   * reactive entry declares as a REAL TurnDeclaredAction (targets,
   * payload skill, scaledDamage) while skipping the entire natural-turn
   * lifecycle: no turn/round counters, no buff/DoT ticks, no CC check,
   * no regen/resource deltas, no charge advance, no cooldown ticks. The
   * impact still flows through applyActionImpact — bypass != a second
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
    const baseSkill = payload ?? actor.basic ?? null

    // Spec 6.1 / plan Task 19 — bach_ung's payload upgrade rider merges
    // its authored payloadAilments into the payload's appliesAilments at
    // resolve time. Clone so the participant's reactivePayloads entry is
    // never mutated across declares.
    let skill = baseSkill

    if (skill) {
      const riders = actor.buffs
        .getAll()
        .flatMap((buff) => buff.effects)
        .flatMap((effect) =>
          effect.type === 'reactiveEconomy' ? effect.payloadAilments ?? [] : [],
        )

      if (riders.length > 0) {
        skill = {
          ...skill,
          appliesAilments: [...(skill.appliesAilments ?? []), ...riders],
        }
      }
    }

    const opposingSide = battle.players.includes(actor) ? battle.enemies : battle.players

    let affected: TurnBattleParticipant[] = []

    if (entry.targetIds && entry.targetIds.length > 0) {
      // Queue-time captured targets (spec 6.2 — counter hits the attacker
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
      // No captured targets — positional fallback keeps the action legal.
      const primary = selectTarget(actor, opposingSide)

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
          slot: null, // slotless — no cooldown/resource commit (spec 7.1)
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
   * The Tu Reimagined (spec section 3.4, plan Task 7) — Cuong Chien's
   * signature scalar: skills authored with scalesWithMissingHp multiply
   * their damage by (1 + missingHpRatio * coefficient), re-read against
   * the actor's LIVE hp at each hit. Non-the_tu damage passes through.
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
   * Action Playback Task 3 (2026-09-05) — PHA 3/3: turn cleanup (gauge
   * consume, gauge-delta push, wave spawn, win/loss check, battle log).
   */
  completeAction(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    declared: TurnDeclaredAction,
    targetIds: string[],
  ): TurnStepResult {
    // Defect-fix Task 1 — bypass turn KHÔNG consume gauge (counter-reactor
    // không mất progress của lượt kế tiếp vì side effect của phản ứng).
    consumeGaugeAfterAction(actor, declared.isFollowUpBypass ? 0 : 1)

    // Task 11 — the cast's own follow-up executions queue at action end:
    // repeatCasts spawn 'repeat' entries; a multicast-capable root skill
    // rolls `chance` for one 'multicast' entry (re-rolling per execution
    // until the depth cap). Repeat/empowered sources never roll.
    this.enqueueFollowUpExecutions(battle, actor, declared)

    // Future Systems Task 6 — gauge-delta one-shot push SAU consume
    // (consume đặt gauge về 0; delta cộng lên trên, không bị ghi đè).
    if (this.pendingGaugeDeltaTargets.length > 0) {
      for (const participant of this.pendingGaugeDeltaTargets) {
        applyGaugeDeltaEffects(this.pendingGaugeDeltaDefinition!, participant)
      }

      this.pendingGaugeDeltaTargets = []
      this.pendingGaugeDeltaDefinition = undefined
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

    // Slice 7 extension — battle log: 1 entry/lượt, append-only.
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
   * Slice 7 (Completion Task 10) — resolve lượt của MỘT actor ĐÃ peek:
   * thin wrapper gọi 3 phase Action Playback back-to-back (signature/
   * hành vi KHÔNG ĐỔI — mọi caller/test cũ giữ nguyên).
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
   * forced slot — giữ nguyên signature/hành vi cho mọi caller Slice 1-6
   * (auto mode, runToCompletion(), mọi test cũ).
   */
  resolveNextStep(battle: TurnBattle): TurnStepResult {
    // Intro phase (2026-09-07 plan Task 4): combat has not started - safe
    // no-op, same wait-phase contract as the countdown branch below.
    if (battle.state === 'intro') {
      return { state: 'intro', actorId: '', skillId: '', targetIds: [], ccBlocked: false }
    }

    // Countdown phase: combat chưa bắt đầu — no-op an toàn (gauge không
    // chạy, không ai hành động; GameManager tick countdown qua
    // tickCountdown() thay vì gọi method này).
    if (battle.state === 'countdown') {
      return { state: 'countdown', actorId: '', skillId: '', targetIds: [], ccBlocked: false }
    }

    // Trận đã kết thúc (victory/defeat) — KHÔNG ghi đè state thành defeat
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

  /** Thin wrapper for tests/dev tooling — loops resolveNextStep() to completion. */
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

  /**
   * R3 (AR-03) — Chance-gated ailment application supporting multiple ailments
   * and multi-stack application. Shares reaction triggering across damaging
   * and non-damaging skill execution paths.
   */
  private applySkillAilments(
    actor: TurnBattleParticipant,
    target: TurnBattleParticipant,
    actionOrSkill: SelectedAction | TurnSkillDefinition,
    initiatesReactions: boolean,
  ): void {
    if (!this.registry) return

    const skill = 'skill' in actionOrSkill ? actionOrSkill.skill : actionOrSkill
    if (!skill) return

    const ailments =
      skill.appliesAilments ??
      (skill.appliesAilment ? [skill.appliesAilment] : [])

    for (const ailment of ailments) {
      // Task 11 — ailment rolls route through the injected rng (same
      // deterministic seam as composite picks and multicast rolls).
      if (this.rng() < ailment.chance) {
        // Skip an unresolvable ailment id gracefully — same try/catch
        // pattern as the bossTrigger lookup in declareActorAction.
        let definition: BuffDefinition | undefined

        try {
          definition = this.registry.get(ailment.buffDefinitionId)
        } catch {
          definition = undefined
        }

        if (definition) {
          const stackCount = ailment.stacks ?? 1

          for (let s = 0; s < stackCount; s++) {
            new BuffSystem(target.buffs).apply(definition, actor.entity, target.entity, this.registry)
          }

          if (initiatesReactions) {
            this.reactionManager?.checkAndTrigger(
              target.buffs,
              ailment.buffDefinitionId,
              actor.entity,
              target.entity,
              this.combat,
              this.registry,
            )
          }
        }
      }
    }
  }

  /**
   * Phap Tu Reimagined Task 13 (spec §4) — the 'dot' route's detonation.
   * Consumes EVERY live ailment instance whose definition carries a
   * `dot` effect (pure-utility ailments are never touched — a scalpel,
   * not a cleanser); each consumed instance pays
   * (perTick x remainingTurns x stacks) x amp as direct damage through
   * the authoritative vitals pipeline (death mid-loop stops the rest).
   * Each consumed id then re-seeds ONCE at a fixed 1 stack / authored
   * duration through BuffSystem.apply — which recomputes potency
   * against the caster's CURRENT stats (never the consumed snapshot).
   * The re-seed is not an application event: no chance roll, no
   * ailmentStackBonus, and reaction-silent — TurnReactionManager is
   * never reached from here. Iterates a snapshot so re-seeded
   * instances are never revisited.
   */
  private applyDetonate(
    actor: TurnBattleParticipant,
    target: TurnBattleParticipant,
    amp: number,
  ): void {
    if (!this.registry) return

    const consumedIds = new Set<string>()

    for (const buff of [...target.buffs.getAll()]) {
      if (!target.entity.alive) break

      let definition: BuffDefinition | undefined

      try {
        definition = this.registry.get(buff.id)
      } catch {
        definition = undefined
      }

      if (!definition?.effects.some((effect) => effect.type === 'dot')) continue
      if (!target.buffs.hasInstance(buff)) continue

      const perTick = buff.effects.reduce(
        (total, effect) =>
          total + (effect.type === 'dot' ? (effect.damagePerTurn ?? effect.damagePerSecond ?? 0) : 0),
        0,
      )
      const burst = perTick * buff.remainingTurns * buff.stacks * amp

      // Consume the exact instance; same-id duplicates still consume —
      // only the re-seed below dedupes by id.
      target.buffs.removeInstance(buff.id, buff.sourceId)
      consumedIds.add(buff.id)

      if (burst > 0) {
        this.combat.applyDirectDamage(target.entity, burst, actor.entity.id)
      }
    }

    // Re-seed ONCE per consumed id — a fixed 1 stack at the ailment's
    // authored duration; BuffSystem.apply recomputes potency against
    // the caster's current stats and never reaches the reaction check.
    for (const id of consumedIds) {
      if (!target.entity.alive) break

      new BuffSystem(target.buffs).apply(this.registry.get(id), actor.entity, target.entity, this.registry)
    }
  }

  // Sudden Death (roadmap 9.5 Combat Fairness Guards): damage +30%/turn
  // from turn 11. The unit is ATB ROUNDS — the same contract the
  // 2026-09-12 D2 revision gave perfectClearTurnLimit. Reading the raw
  // totalTurnsElapsed actor-action counter made escalation arrive
  // participant-count times early (a 1v3 stage hit the grace boundary in
  // ~3 rounds) and compound ~0.3 x actors per round — the reported
  // abnormal damage ramp.
  private suddenDeathDamageMultiplier(roundsElapsed: number): number {
    const roundsPastGrace = roundsElapsed - 9

    return roundsPastGrace > 0 ? 1 + 0.3 * roundsPastGrace : 1
  }
}
