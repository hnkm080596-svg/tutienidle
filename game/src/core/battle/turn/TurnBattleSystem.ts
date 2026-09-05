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
import type { TurnSkillDefinition, TurnSkillSlot, TurnSkillSlotRole, SelectedAction } from './TurnSkillAction'
import type { ActionDamageInfo } from '../ActionImpactSystem'
import { TurnBuffPool } from './TurnBuffPool'
import { TurnBuffSystem } from './TurnBuffSystem'
import type { TurnBuffRegistry } from './TurnBuffTypes'
import { applyTurnStartDeltas } from './ResourceTurnHook'
import type { TurnResourceDelta } from './ResourceTurnHook'
import { isTurnTriggerReady } from './BossTurnTriggers'
import { shouldSpawnNextEnemy, isStageComplete } from './WaveSpawnTrigger'
import { scaleActionDamage } from '../ActionImpactSystem'
import { recomputeEffectiveStats } from './TurnStatsRecompute'
import type { BattleLogEntry } from './TurnOrderPreview'
import { selectRandomDistinctElementPair } from './TurnSkillAction'
import { REACTION_PATH_SPECIAL_ID } from '../../../data/skill/TurnReactionPathSkills'
import { refundGauge, GAUGE_MAX } from './ActionGauge'
import type { TurnBuffDefinition } from './TurnBuffTypes'

/**
 * Future Systems Task 6 — gauge-delta effect: bắn 1 LẦN ngay khi buff
 * được áp, đẩy % GAUGE_MAX vào actionGauge của participant nhận buff
 * (refundGauge đã clamp [0, GAUGE_MAX]). Không phải tick liên tục.
 */
function applyGaugeDeltaEffects(
  definition: TurnBuffDefinition,
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

export type TurnBattleState = 'countdown' | 'fighting' | 'victory' | 'defeat'

export interface TurnBattleParticipant {
  id: string
  entity: CombatEntity
  speed: number
  priority: number
  actionGauge: number
  alive: boolean
  buffs: TurnBuffPool
  consecutiveHardCcTurns: number
  baTheTriggeredAtTurn?: number
  basic?: TurnSkillDefinition
  special?: TurnSkillSlot
  ultimate?: TurnSkillSlot
  resources?: TurnResourcePool
  bossTrigger?: TurnBossTrigger
  /** Future Systems Task 7 — charge state (Thế→Trảm). CỐ Ý tách biệt counter CC Bá Thể. */
  chargingTurnsRemaining?: number
  pendingChargedSkillId?: string
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
  /**
   * Countdown phase (flow: Countdown → Spawn → Gauge combat → Wave →
   * Result) — số lượt-pacing còn lại trước khi state chuyển 'fighting'.
   * GameManager pacing loop tick giảm; engine `resolveNextStep()` KHÔNG
   * resolve combat trong pha này (chỉ tick countdown khi được gọi qua
   * `tickCountdown()`), enemies đã spawn đứng yên chờ.
   */
  countdownTurnsRemaining?: number
  wave?: {
    totalEnemyCount: number
    spawnedCount: number
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

export class TurnBattleSystem {
  constructor(
    private readonly combat: CombatSystem,
    private readonly maxTurns: number = DEFAULT_MAX_TURNS,
    private readonly registry?: TurnBuffRegistry,
    private readonly spawnEnemy?: () => TurnBattleParticipant,
    private readonly reactionPathPool?: readonly TurnSkillDefinition[],
  ) {}

  // Action Playback Task 3 — gauge-delta deferral chuyển từ local vars
  // của resolveActorTurn cũ thành class fields (applyActionImpact ghi,
  // completeAction tiêu thụ — 2 phase tách nhau qua GameManager khi
  // presentationActive, nên state phải sống trên instance).
  private pendingGaugeDeltaTargets: TurnBattleParticipant[] = []
  private pendingGaugeDeltaDefinition: TurnBuffDefinition | undefined

  // Defect-fix Task 1 (2026-09-05) — bridge dequeueFollowUpActor() →
  // declareActorAction(): set ngay trước khi trả bypass actor, đọc 1 lần
  // trong declare để populate TurnDeclaredAction.isFollowUpBypass rồi clear.
  private pendingFollowUpBypassActorId: string | null = null

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
    forcedSkillSlot?: TurnSkillSlotRole,
  ): TurnDeclaredAction {
    battle.totalTurnsElapsed = (battle.totalTurnsElapsed ?? 0) + 1

    const actorBuffSystem = new TurnBuffSystem(actor.buffs)

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

            const suddenDeathMultiplier = this.suddenDeathDamageMultiplier(battle.totalTurnsElapsed ?? 0)
            const chargedDamage = suddenDeathMultiplier === 1
              ? chargedSkill.damage
              : scaleActionDamage(chargedSkill.damage, suddenDeathMultiplier)

            // Action Playback Task 3 — DEFERRED: damage apply tại
            // applyActionImpact (capture picks thay vì resolve ngay).
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
    const hardCcActive = actorBuffSystem.isStunned() || actorBuffSystem.isFrozen()

    let ccBlocked: boolean

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

    actorBuffSystem.update(actor.entity, this.combat, this.registry)

    if (actor.entity.stats.hpRegenPerTurn > 0) {
      actor.entity.currentHp = Math.min(actor.entity.maxHp, actor.entity.currentHp + actor.entity.stats.hpRegenPerTurn)
    }

    if (actor.resources) {
      actor.resources.values = applyTurnStartDeltas(actor.resources.values, actor.resources.deltasPerTurn)
    }

    if (
      actor.bossTrigger &&
      !actor.bossTrigger.firedAlready &&
      this.registry &&
      isTurnTriggerReady({ afterTurns: actor.bossTrigger.afterTurns }, battle.totalTurnsElapsed ?? 0)
    ) {
      const definition = this.registry.get(actor.bossTrigger.buffDefinitionId)

      new TurnBuffSystem(actor.buffs).apply(definition, actor.entity, actor.entity, this.registry)

      actor.bossTrigger.firedAlready = true
    }

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

      // Stats recompute (Completion Task 4): fold statModifier buffs đang
      // active vào entity stats TRƯỚC khi chọn/hành động — luôn tính TỪ
      // baseStats để không double-apply các recompute trước đó.
      actor.entity.stats = recomputeEffectiveStats(actor.entity.baseStats ?? actor.entity.stats, actor.buffs)

      action = forcedSkillSlot
        ? selectForcedAction(actor, forcedSkillSlot)
        : selectAction(actor)

      const isChargeInit = (action.skill?.chargeTurns ?? 0) > 0

      if (isChargeInit) {
        // Future Systems Task 7 — charge INITIATION (Thế): KHÔNG resolve
        // ngay — ghi charge state, đòn tự resolve khi charge xong (Trảm).
        // Cooldown/resource vẫn commit như cast thường (commitAction).
        actor.chargingTurnsRemaining = action.skill!.chargeTurns
        actor.pendingChargedSkillId = action.skillId
      }

      opposingSide = battle.players.includes(actor) ? battle.enemies : battle.players
      const primaryTarget = selectTarget(actor, opposingSide)

      if (primaryTarget && !isChargeInit) {
        affected = collectTurnTargets(primaryTarget, opposingSide, action.targeting)

        const suddenDeathMultiplier = this.suddenDeathDamageMultiplier(battle.totalTurnsElapsed ?? 0)
        suddenDeathMultiplierCaptured = suddenDeathMultiplier
        scaledDamage = suddenDeathMultiplier === 1 ? action.damage : scaleActionDamage(action.damage, suddenDeathMultiplier)

        // Future Systems Task 5 — Reaction Path marker: capture picks tại
        // declare; hits áp tại applyActionImpact (Action Playback defer).
        if (action.skillId === REACTION_PATH_SPECIAL_ID && this.reactionPathPool) {
          reactionPathPicks = selectRandomDistinctElementPair([...this.reactionPathPool])
          isReactionPath = true
        } else if (action.skillId === REACTION_PATH_SPECIAL_ID) {
          // Marker equipped nhưng pool chưa inject — placeholder damage
          // vô nghĩa, bỏ qua hit hoàn toàn (không crash, không hit).
          markerNoPool = true
          scaledDamage = null
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
  ): { targetIds: string[] } {
    const targetIds: string[] = []
    const actor =
      battle.players.find((member) => member.id === declared.actorId) ??
      battle.enemies.find((enemy) => enemy.id === declared.actorId)

    if (!actor) {
      return { targetIds }
    }

    // Charge-resolve turn: hits apply từ chargedSkill capture tại declare
    // (pendingChargedSkillId đã clear ở declare — đọc declared.chargedSkill).
    if (declared.isCharging && declared.chargeResolved) {
      const chargedSkill = declared.chargedSkill

      if (chargedSkill) {
        const opposingSide = battle.players.includes(actor) ? battle.enemies : battle.players

        const suddenDeathMultiplier = this.suddenDeathDamageMultiplier(battle.totalTurnsElapsed ?? 0)
        const chargedDamage = suddenDeathMultiplier === 1
          ? chargedSkill.damage
          : scaleActionDamage(chargedSkill.damage, suddenDeathMultiplier)

        for (const target of declared.chargeTargetIds) {
          const targetParticipant = opposingSide.find((p) => p.id === target)

          if (!targetParticipant || !targetParticipant.entity.alive) continue

          this.combat.resolveActionHit(actor.entity, targetParticipant.entity, chargedDamage)
          targetIds.push(target)
        }
      }

      return { targetIds }
    }

    if (declared.action && declared.affected.length > 0 && !declared.markerNoPool) {
      const action = declared.action

      if (declared.isReactionPath && declared.reactionPathPicks) {
        for (const pickedSkill of declared.reactionPathPicks) {
          const pickedDamage = declared.suddenDeathMultiplier === 1
            ? pickedSkill.damage
            : scaleActionDamage(pickedSkill.damage, declared.suddenDeathMultiplier)

          for (const target of declared.affected) {
            if (!target.entity.alive) continue

            this.combat.resolveActionHit(actor.entity, target.entity, pickedDamage)
            targetIds.push(target.id)
          }
        }
      } else if (declared.scaledDamage) {
        for (const target of declared.affected) {
          if (!target.entity.alive) continue

          this.combat.resolveActionHit(actor.entity, target.entity, declared.scaledDamage)
          targetIds.push(target.id)

          if (this.registry) {
            new TurnBuffSystem(actor.buffs).rollOnHitEffects(actor.entity, target.entity, this.registry)

            // Action Playback Task 5 — onImpactLanded counter trigger trên
            // TARGET bị hit; queuesFollowUp → battle.queuedFollowUpActorId.
            const { firedFollowUp } = new TurnBuffSystem(target.buffs).rollReactiveTrigger(target.entity, 'onImpactLanded', this.registry)

            if (firedFollowUp) {
              // Defect-fix Task 1 — FIFO queue: AOE hit trigger counter trên
              // nhiều target không drop tất cả trừ cái cuối.
              battle.queuedFollowUpActorIds = battle.queuedFollowUpActorIds ?? []
              battle.queuedFollowUpActorIds.push(target.id)
            }
          }
        }
      }

      const isChargeInit = (action.skill?.chargeTurns ?? 0) > 0

      if (isChargeInit) {
        // Charge-init: không hit — vẫn commit cooldown/resource (giá
        // cast của lượt bắt đầu Thế).
        commitAction(actor.entity, action)
      } else {
        commitAction(actor.entity, action)

        if (action.skill?.appliesBuff && this.registry) {
          const definition = this.registry.get(action.skill.appliesBuff.definitionId)

          // gaugeDelta là ONE-SHOT push SAU consume (consume đặt gauge về 0,
          // delta cộng lên trên — nếu áp trước sẽ bị consume ghi đè).
          if (action.skill.appliesBuff.target === 'self') {
            new TurnBuffSystem(actor.buffs).apply(definition, actor.entity, actor.entity, this.registry)
            this.pendingGaugeDeltaTargets = [actor]
          } else {
            const targets: TurnBattleParticipant[] = []

            for (const target of declared.affected) {
              new TurnBuffSystem(target.buffs).apply(definition, actor.entity, target.entity, this.registry)
              targets.push(target)
            }

            this.pendingGaugeDeltaTargets = targets
          }

          this.pendingGaugeDeltaDefinition = definition
        }
      }
    }

    return { targetIds }
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

    if (battle.wave && this.spawnEnemy) {
      const aliveEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length

      if (shouldSpawnNextEnemy(battle.wave.spawnedCount, battle.wave.totalEnemyCount, aliveEnemyCount)) {
        battle.enemies.push(this.spawnEnemy())
        battle.wave.spawnedCount += 1
      }
    }

    const finalAliveEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length

    if (battle.players.every((member) => !member.entity.alive)) {
      battle.state = 'defeat'
    } else if (
      battle.wave
        ? isStageComplete(battle.wave.spawnedCount, battle.wave.totalEnemyCount, finalAliveEnemyCount)
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
    forcedSkillSlot?: TurnSkillSlotRole,
  ): TurnStepResult {
    const declared = this.declareActorAction(battle, actor, forcedSkillSlot)
    const { targetIds } = this.applyActionImpact(battle, declared)
    return this.completeAction(battle, actor, declared, targetIds)
  }

  /**
   * Thin wrapper (Slice 7): peekNextActor() + resolveActorTurn() không
   * forced slot — giữ nguyên signature/hành vi cho mọi caller Slice 1-6
   * (auto mode, runToCompletion(), mọi test cũ).
   */
  resolveNextStep(battle: TurnBattle): TurnStepResult {
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

  private suddenDeathDamageMultiplier(totalTurnsElapsed: number): number {
    const turnsPastGrace = totalTurnsElapsed - 10

    return turnsPastGrace > 0 ? 1 + 0.3 * turnsPastGrace : 1
  }
}
