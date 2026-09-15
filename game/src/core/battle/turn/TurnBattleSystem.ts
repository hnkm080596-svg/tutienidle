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
import { tickCooldowns, selectAction, selectForcedAction, commitAction, collectTurnTargets } from './TurnSkillAction'
import type { TurnSkillDefinition, TurnSkillSlot, SelectedAction, DynamicBasicProvider, ForcedTurnChoice } from './TurnSkillAction'
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
import { selectRandomDistinctElementPair } from './TurnSkillAction'
import { refundGauge, GAUGE_MAX } from './ActionGauge'
import { TurnReactionManager } from './TurnReactionManager'
import { MAX_THE, THE_GAIN_PER_LINK, THE_GAIN_PER_FINISHER } from '../../combat/CombatTypes'
import type { DamageResult } from '../../combat/CombatTypes'
import { SurviveLethalGuard } from '../../talent/SurviveLethalGuard'
import type { BuffDefinition } from '../../buff/BuffTypes'

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
   */
  queuedFollowUpActorIds?: string[]
  /** Defect-fix Task 1 — reciprocity guard: đếm consecutive bypass turns qua
   * queue, reset khi 1 normal gauge turn resolve; cap trong dequeueFollowUpActor()
   * để 2 entity counter-buff không bounce follow-up lẫn nhau vô hạn. */
  followUpChainDepth?: number
}

/**
 * Luật targeting §4: cùng hàng thì chọn gần nhất theo cột (không thể
 * nhắm xuyên qua entity đứng gần hơn cùng hàng); không có ai cùng hàng
 * thì chọn gần nhất toàn bàn cờ theo Chebyshev.
 */
export function selectTarget(
  actor: TurnBattleParticipant,
  opposingSide: TurnBattleParticipant[],
): TurnBattleParticipant | undefined {
  const living = opposingSide.filter((participant) => participant.entity.alive)

  if (living.length === 0) {
    return undefined
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

  /** Marker Reaction Path equipped NHƯNG pool chưa inject — 0 hit an toàn. */
  markerNoPool: boolean

  action: SelectedAction | null

  opposingSide: TurnBattleParticipant[]

  affected: TurnBattleParticipant[]

  scaledDamage: ActionDamageInfo | null

  isReactionPath: boolean

  /** Sudden-death multiplier capture tại declare (Reaction Path picks scale riêng per-pick). */
  suddenDeathMultiplier: number

  reactionPathPicks: [TurnSkillDefinition, TurnSkillDefinition] | null

  /** Defect-fix Task 1 — turn này được grant qua follow-up/counter bypass
   * queue thay vì normal gauge readiness — completeAction bỏ consume gauge
   * cho các turn này (bypass không tốn progress của lượt kế tiếp). */
  isFollowUpBypass: boolean
}

/**
 * Kiem Tu Reimagined Task 2 — one extra declared impact produced by a
 * dynamicBasic provider's onCastResolved (combo payload). Presentation
 * emits each entry separately; each carries its own preset so distinct
 * combos stay visually distinguishable.
 */
export interface TurnActionExtraImpact {
  presetId?: TurnSkillDefinition['presetId']
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
    private readonly reactionPathPool?: readonly TurnSkillDefinition[],
    // Phase A1 (2026-09-07) — optional collaborator, same pattern as
    // registry/spawnEnemy above; consumers no-op safely when absent.
    private readonly reactionManager?: TurnReactionManager,
    // 9.5 #9 — committed-cast notification. Fires once per action that
    // actually commits (same point as commitAction): normal casts and
    // charge-initiation count; charge ticks/resolve, CC-blocked turns and
    // markerNoPool placeholders do not. Generic over actors — consumers
    // filter to the participants they care about.
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
  private pendingFollowUpBypassActorId: string | null = null

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
    const queue = battle.queuedFollowUpActorIds

    if (!queue || queue.length === 0) {
      return null
    }

    if ((battle.followUpChainDepth ?? 0) >= MAX_FOLLOW_UP_CHAIN_DEPTH) {
      // Reciprocity guard tripped — drop phần còn lại của queue, quay về
      // normal gauge order thay vì bounce vô hạn.
      battle.queuedFollowUpActorIds = undefined
      battle.followUpChainDepth = 0
      return null
    }

    const queuedId = queue.shift()

    if (queue.length === 0) {
      battle.queuedFollowUpActorIds = undefined
    }

    const queued =
      battle.players.find((member) => member.id === queuedId) ??
      battle.enemies.find((enemy) => enemy.id === queuedId)

    if (!queued || !queued.alive) {
      return this.dequeueFollowUpActor(battle)
    }

    battle.followUpChainDepth = (battle.followUpChainDepth ?? 0) + 1
    this.pendingFollowUpBypassActorId = queued.id

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
            const affected = collectTurnTargets(primaryTarget, opposingSide, chargedSkill.targeting)

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
      const isFollowUpBypass = this.pendingFollowUpBypassActorId === actor.id

      if (isFollowUpBypass) {
        this.pendingFollowUpBypassActorId = null
      }

      return {
        actorId: actor.id,
        skillId: '',
        ccBlocked,
        isCharging,
        chargeResolved: false,
        chargeTargetIds: [],
        chargedSkill: null,
        markerNoPool: false,
        action: null,
        opposingSide: [],
        affected: [],
        scaledDamage: null,
        isReactionPath: false,
        suddenDeathMultiplier: 1,
        reactionPathPicks: null,
        isFollowUpBypass,
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
    let affected: TurnBattleParticipant[] = []
    let scaledDamage: ActionDamageInfo | null = null
    let isReactionPath = false
    let markerNoPool = false
    let suddenDeathMultiplierCaptured = 1
    let reactionPathPicks: [TurnSkillDefinition, TurnSkillDefinition] | null = null

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
      if (!action.slot && actor.entity.specialAttacks?.length) {
        const attackCount = (actor.specialAttackCounter ?? 0) + 1

        actor.specialAttackCounter = attackCount

        const specialAttack = actor.entity.specialAttacks.find(
          (candidate) => attackCount % candidate.everyNth === 0,
        )

        if (specialAttack) {
          action = {
            ...action,
            damage: { kind: 'physical', multiplier: specialAttack.damageMultiplier },
          }
        }
      }

      const isChargeInit = (action.skill?.chargeTurns ?? 0) > 0

      if (isChargeInit) {
        // Future Systems Task 7 — charge INITIATION (Thế): KHÔNG resolve
        // ngay — ghi charge state, đòn tự resolve khi charge xong (Trảm).
        // Cooldown/resource vẫn commit như cast thường (commitAction).
        actor.chargingTurnsRemaining = action.skill!.chargeTurns
        actor.pendingChargedSkillId = action.skillId
      }

      const targetScope = action.skill?.targetScope ?? 'enemy'

      if (targetScope === 'self') {
        affected = [actor]
        scaledDamage = null
      } else {
        opposingSide = battle.players.includes(actor) ? battle.enemies : battle.players
        const primaryTarget = selectTarget(actor, opposingSide)

        if (primaryTarget && !isChargeInit) {
          affected = collectTurnTargets(primaryTarget, opposingSide, action.targeting)

          if (action.damage) {
            const suddenDeathMultiplier = this.suddenDeathDamageMultiplier(battle.roundsElapsed ?? 0)
            suddenDeathMultiplierCaptured = suddenDeathMultiplier
            scaledDamage = suddenDeathMultiplier === 1 ? action.damage : scaleActionDamage(action.damage, suddenDeathMultiplier)
          }

          // R3 (AR-18) — Generic composite action policy.
          const isReactionComposite =
            action.skill?.compositePicks?.poolType === 'reaction_path'

          if (isReactionComposite && this.reactionPathPool) {
            reactionPathPicks = selectRandomDistinctElementPair([...this.reactionPathPool])
            isReactionPath = true
          } else if (isReactionComposite) {
            // Marker equipped nhưng pool chưa inject — placeholder damage
            // vô nghĩa, bỏ qua hit hoàn toàn (không crash, không hit).
            markerNoPool = true
            scaledDamage = null
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

    // Defect-fix Task 1 — bypass flag: turn này đến từ follow-up queue
    // (đọc từ bridge field, clear sau khi đọc).
    const isFollowUpBypass = this.pendingFollowUpBypassActorId === actor.id

    if (isFollowUpBypass) {
      this.pendingFollowUpBypassActorId = null
    }

    return {
      actorId: actor.id,
      skillId,
      ccBlocked,
      isCharging,
      chargeResolved,
      chargeTargetIds,
      chargedSkill: chargedSkillCaptured,
      markerNoPool,
      action,
      opposingSide,
      affected,
      scaledDamage,
      isReactionPath,
      suddenDeathMultiplier: suddenDeathMultiplierCaptured,
      reactionPathPicks,
      isFollowUpBypass,
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
    const actor =
      battle.players.find((member) => member.id === declared.actorId) ??
      battle.enemies.find((enemy) => enemy.id === declared.actorId)

    if (!actor) {
      return { targetIds, extraImpacts }
    }

    // Charge-resolve turn: hits apply từ chargedSkill capture tại declare
    // (pendingChargedSkillId đã clear ở declare — đọc declared.chargedSkill).
    if (declared.isCharging && declared.chargeResolved) {
      const chargedSkill = declared.chargedSkill

      if (chargedSkill && chargedSkill.damage) {
        const opposingSide = battle.players.includes(actor) ? battle.enemies : battle.players

        const suddenDeathMultiplier = this.suddenDeathDamageMultiplier(battle.roundsElapsed ?? 0)
        const chargedDamage = suddenDeathMultiplier === 1
          ? chargedSkill.damage
          : scaleActionDamage(chargedSkill.damage, suddenDeathMultiplier)

        for (const target of declared.chargeTargetIds) {
          const targetParticipant = opposingSide.find((p) => p.id === target)

          if (!targetParticipant || !targetParticipant.entity.alive) continue

          const hitResult = this.combat.resolveActionHit(actor.entity, targetParticipant.entity, chargedDamage)

          if (!hitResult.dodged) {
            targetIds.push(target)
          }

          // ARCH-002 (M7) — the hit may have mutated either pool (survive-
          // lethal grants, defensive procs inside the damage authority):
          // refresh both effective views before the next hit/read.
          this.refreshParticipantStats(targetParticipant)
          this.refreshParticipantStats(actor)
        }
      }

      // M8 (ARCH-010) — the shared per-action The gain below lives past
      // this branch's early return, so a charged completion fires it
      // HERE, exactly once, resolved through the slot that owns the
      // charged skill (same special/ultimate inference declare uses).
      // Ordering parity with the normal path is preserved: the cast
      // resource/cooldown was already committed at charge-init, so the
      // gain lands on the post-consume pool — Bat Kiem Thuat accrues
      // currentThe at hit completion and Tru Tien Kiem Tran stays
      // reachable. Gated on captured targets like the normal path's
      // `affected.length > 0` requirement.
      if (chargedSkill && declared.chargeTargetIds.length > 0) {
        if (actor.special?.skill.id === chargedSkill.id) {
          actor.entity.currentThe = Math.min(MAX_THE, (actor.entity.currentThe ?? 0) + THE_GAIN_PER_LINK)
        } else if (actor.ultimate?.skill.id === chargedSkill.id) {
          actor.entity.currentThe = Math.min(MAX_THE, (actor.entity.currentThe ?? 0) + THE_GAIN_PER_FINISHER)
        }
      }

      return { targetIds, extraImpacts }
    }

    // 9.5 #9 — charge-init commits its cast HERE, not in the
    // affected-gated block below: enemy-targeted charge skills collect
    // targets only at resolve time, so `affected` stays empty at declare
    // and the block below never ran for them — their cooldown/resource
    // were never committed (dead isChargeInit branch). The charge-resolve
    // turn returns early above and never reaches this point.
    if (declared.action && !declared.markerNoPool && (declared.action.skill?.chargeTurns ?? 0) > 0) {
      commitAction(actor.entity, declared.action)
      this.onSkillCast?.(actor, declared.action.skillId)
    }

    if (declared.action && declared.affected.length > 0 && !declared.markerNoPool) {
      const action = declared.action

      // R5 (AR-14) — Emit authoritative gameplay 'attack' event on action commit,
      // ensuring passive listeners receive events identically in headless and presentation modes.
      this.combat.eventBus.emit('attack', {
        type: 'attack',
        sourceId: actor.id,
        targetId: declared.affected[0]?.id ?? actor.id,
        skillId: declared.skillId,
      })

      if (declared.isReactionPath && declared.reactionPathPicks) {
        for (const pickedSkill of declared.reactionPathPicks) {
          if (!pickedSkill.damage) continue

          const pickedDamage = declared.suddenDeathMultiplier === 1
            ? pickedSkill.damage
            : scaleActionDamage(pickedSkill.damage, declared.suddenDeathMultiplier)

          for (const target of declared.affected) {
            if (!target.entity.alive) continue

            const hitResult = this.combat.resolveActionHit(actor.entity, target.entity, pickedDamage)

            if (!hitResult.dodged) {
              targetIds.push(target.id)

              if (this.registry) {
                this.applySkillAilments(actor, target, pickedSkill)
              }

              // ARCH-002 (M7) — refresh after hit + ailment mutations; the
              // actor too: applySkillAilments -> TurnReactionManager can
              // grant the SOURCE a buff (e.g. Tho Tu self-stack).
              this.refreshParticipantStats(target)
              this.refreshParticipantStats(actor)
            }
          }
        }
      } else if (declared.scaledDamage) {
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
              action.skill ?? null,
              hitOptions,
            )

            if (!hitResult.dodged) {
              targetLanded = true
            }
          }

          if (targetLanded) {
            targetIds.push(target.id)
          }
        }
    } else if (action.skill?.targetScope !== 'self') {
      // Non-damaging action targeting enemies (e.g. pure debuff skill like doc_chuong)
      for (const target of declared.affected) {
        if (!target.entity.alive) continue
        targetIds.push(target.id)

        this.applySkillAilments(actor, target, action)
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
        commitAction(actor.entity, action)
        this.onSkillCast?.(actor, action.skillId)

        // Phase A3 — Thế Thuần Hệ gain, simplified from legacy's
        // chain-link-position rule (no turn-based chain state exists —
        // see the A3 spec's Global Constraints). Fires once per landed
        // action from special/ultimate slots only; basic attacks do not
        // generate Thế. Capped at MAX_THE. Runs AFTER commitAction so an
        // ultimate's pool consumption (100 → 0) is already reflected —
        // the finisher gain lands on the post-cast pool, mirroring
        // legacy's gain-after-consume ordering. Deliberately NOT inside
        // the registry gate: Thế gain is engine-native resource accrual,
        // not buff-registry content.
        if (action.slot && action.slot === actor.special) {
          actor.entity.currentThe = Math.min(MAX_THE, (actor.entity.currentThe ?? 0) + THE_GAIN_PER_LINK)
        } else if (action.slot && action.slot === actor.ultimate) {
          actor.entity.currentThe = Math.min(MAX_THE, (actor.entity.currentThe ?? 0) + THE_GAIN_PER_FINISHER)
        }

        if (action.skill?.appliesBuff) {
          this.applyDeclaredBuff(actor, action.skill.appliesBuff, declared.affected)
        }

        if (action.skill?.targetScope === 'self') {
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
              this.applyDeclaredBuff(actor, { definitionId: buff.definitionId, target: 'target', duration: buff.duration }, [buffTarget])
            },
          })

          for (const extraDef of extraDefs) {
            extraImpacts.push(this.applyExtraImpact(battle, actor, declared, extraDef))
          }
        }
      }
    }

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
    hitOptions?: Partial<HitResolveOptions>,
  ): DamageResult {
    const hitResult = this.combat.resolveActionHit(actor.entity, target.entity, damage, hitOptions)

    // AR-04: downstream on-hit effects, debuffs and consume triggers
    // require a landed hit — dodged attacks bypass all of them.
    if (!hitResult.dodged) {
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
        // queuesFollowUp → battle.queuedFollowUpActorIds.
        const { firedFollowUp } = hitResult.hpDamage > 0
          ? new BuffSystem(target.buffs).rollReactiveTrigger(target.entity, 'onImpactLanded', this.registry)
          : { firedFollowUp: false }

        if (firedFollowUp) {
          // Defect-fix Task 1 — FIFO queue: AOE hit trigger counter trên
          // nhiều target không drop tất cả trừ cái cuối.
          battle.queuedFollowUpActorIds = battle.queuedFollowUpActorIds ?? []
          battle.queuedFollowUpActorIds.push(target.id)
        }

        // Phase A1 (2026-09-07) / R3 (AR-03) — chance-gated ailment application,
        // then reaction check against the just-applied id.
        if (skill) {
          this.applySkillAilments(actor, target, skill)
        }
      }
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
    actor: TurnBattleParticipant,
    buffSpec: { definitionId: string; target: 'self' | 'target'; duration?: number },
    targets: TurnBattleParticipant[],
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

    // gaugeDelta là ONE-SHOT push SAU consume (consume đặt gauge về 0,
    // delta cộng lên trên — nếu áp trước sẽ bị consume ghi đè).
    if (buffSpec.target === 'self') {
      new BuffSystem(actor.buffs).apply(
        definition,
        actor.entity,
        actor.entity,
        this.registry,
        buffSpec.duration,
      )
      this.pendingGaugeDeltaTargets = [actor]
      // ARCH-002 (M7) — statModifier buffs are effective NOW, not
      // at the actor's next turn (kim_giap counter-read class).
      this.refreshParticipantStats(actor)
    } else {
      const applied: TurnBattleParticipant[] = []

      for (const target of targets) {
        new BuffSystem(target.buffs).apply(
          definition,
          actor.entity,
          target.entity,
          this.registry,
          buffSpec.duration,
        )
        applied.push(target)
        this.refreshParticipantStats(target)
      }

      this.pendingGaugeDeltaTargets = applied
    }

    this.pendingGaugeDeltaDefinition = definition
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
          const result = this.resolveDeclaredHit(battle, actor, target, scaled, extraDef, opts)
          hitCount += 1

          if (!result.dodged && !landedIds.includes(target.id)) {
            landedIds.push(target.id)
          }
        }
      }
    }

    if (extraDef.appliesBuff) {
      this.applyDeclaredBuff(actor, extraDef.appliesBuff, extraTargets)
    }

    if (extraScope === 'self' && !landedIds.includes(actor.id)) {
      landedIds.push(actor.id)
    }

    return {
      presetId: extraDef.presetId,
      targetIds: extraTargets.map((target) => target.id),
      landedTargetIds: landedIds,
      hitCount,
    }
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

    return { state: battle.state, actorId: actor.id, skillId: declared.skillId, targetIds, ccBlocked: declared.ccBlocked }
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
  ): void {
    if (!this.registry) return

    const skill = 'skill' in actionOrSkill ? actionOrSkill.skill : actionOrSkill
    if (!skill) return

    const ailments =
      skill.appliesAilments ??
      (skill.appliesAilment ? [skill.appliesAilment] : [])

    for (const ailment of ailments) {
      if (Math.random() < ailment.chance) {
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

          this.reactionManager?.checkAndTrigger(
            target.buffs,
            ailment.buffDefinitionId,
            actor.entity,
            target.entity,
            this.combat,
            this.registry,
            actor.buffs,
          )
        }
      }
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
