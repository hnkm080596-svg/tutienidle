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
import type { TurnSkillDefinition, TurnSkillSlot, TurnSkillSlotRole } from './TurnSkillAction'
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
  /** Action Playback (2026-09-05) — counter/follow-up (§6 spec): actor này nhảy thẳng vào 'ready' ngay sau standby, bỏ qua idle. */
  queuedFollowUpActorId?: string
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

export interface TurnStepResult {
  state: TurnBattleState
  actorId: string
  skillId: string
  targetIds: string[]
  ccBlocked: boolean
}

export class TurnBattleSystem {
  constructor(
    private readonly combat: CombatSystem,
    private readonly maxTurns: number = DEFAULT_MAX_TURNS,
    private readonly registry?: TurnBuffRegistry,
    private readonly spawnEnemy?: () => TurnBattleParticipant,
    private readonly reactionPathPool?: readonly TurnSkillDefinition[],
  ) {}

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
   * Trả về actor vừa resolve (nếu có) để GameManager manual mode pause
   * đúng actor phe player ngay tại tick ready. CC check/buff tick
   * (resolveActorTurn) chạy như thường; turn counter +1 đúng mỗi turn.
   */
  tickPacing(battle: TurnBattle): TurnBattleParticipant | null {
    if (battle.state !== 'fighting') {
      return null
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

    const allParticipants = [...battle.players, ...battle.enemies]

    for (const participant of allParticipants) {
      participant.alive = participant.entity.alive
    }

    const resolved = resolveNextTurn(allParticipants)

    return resolved?.actor ?? null
  }

  /**
   * Slice 7 (Completion Task 10) — resolve lượt của MỘT actor ĐÃ peek:
   * toàn bộ phần sau-phát-hiện-actor của resolveNextStep cũ (buff tick,
   * resource tick, boss trigger, CC check, action selection, gauge
   * consume, wave spawn, victory/defeat check). forcedSkillSlot ép skill
   * role cụ thể (manual UI); slot KHÔNG sẵn sàng (cooldown/resource) bị
   * bỏ qua im lặng theo priority thường — UI disable nút không sẵn sàng
   * nên đây chỉ là backstop, không phải error path.
   */
  resolveActorTurn(
    battle: TurnBattle,
    actor: TurnBattleParticipant,
    forcedSkillSlot?: TurnSkillSlotRole,
  ): TurnStepResult {
    battle.totalTurnsElapsed = (battle.totalTurnsElapsed ?? 0) + 1

    const actorBuffSystem = new TurnBuffSystem(actor.buffs)

    let skillId = ''

    const targetIds: string[] = []

    // Future Systems Task 6 — gauge-delta deferral: appliesBuff block ghi
    // candidate vào đây, apply SAU consumeGaugeAfterAction (xem cuối turn).
    const pendingGaugeDeltaTargets: TurnBattleParticipant[] = []
    let pendingGaugeDeltaDefinition: TurnBuffDefinition | undefined

    // Future Systems Task 7 — charge state (Thế→Trảm). Charging takes
    // precedence: KHÔNG đụng CC counter Bá Thể (đã bất động tự nhiên,
    // không double penalty); buff tick/hpRegen/resource vẫn chạy (actor
    // vẫn sống); action resolution bị thay thế bởi charge tick/resolve;
    // wave-spawn + win-condition tail CHUNG ở cuối (không return sớm).
    const isCharging = (actor.chargingTurnsRemaining ?? 0) > 0
    let chargedSkillId = ''
    let chargeResolved = false

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

            for (const target of affected) {
              if (!target.entity.alive) continue

              this.combat.resolveActionHit(actor.entity, target.entity, chargedDamage)
              targetIds.push(target.id)
            }
          }
        }

        actor.chargingTurnsRemaining = undefined
        chargeResolved = true
      }
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

      const action = forcedSkillSlot
        ? selectForcedAction(actor, forcedSkillSlot)
        : selectAction(actor)

      skillId = action.skillId

      const isChargeInit = (action.skill?.chargeTurns ?? 0) > 0

      if (isChargeInit) {
        // Future Systems Task 7 — charge INITIATION (Thế): KHÔNG resolve
        // ngay — ghi charge state, đòn tự resolve khi charge xong (Trảm).
        // Cooldown/resource vẫn commit như cast thường (commitAction).
        actor.chargingTurnsRemaining = action.skill!.chargeTurns
        actor.pendingChargedSkillId = action.skillId
      }

      const opposingSide = battle.players.includes(actor) ? battle.enemies : battle.players
      const primaryTarget = selectTarget(actor, opposingSide)

      if (primaryTarget && !isChargeInit) {
        const affected = collectTurnTargets(primaryTarget, opposingSide, action.targeting)

        const suddenDeathMultiplier = this.suddenDeathDamageMultiplier(battle.totalTurnsElapsed ?? 0)
        const scaledDamage = suddenDeathMultiplier === 1 ? action.damage : scaleActionDamage(action.damage, suddenDeathMultiplier)

        // Future Systems Task 5 — Reaction Path marker: special cast 2 hành
        // random KHÁC nhau (mỗi pick 1 hit qua từng target). Marker KHÔNG
        // bao giờ resolve damage placeholder trực tiếp; không có pool →
        // 0 hit (cooldown/resource vẫn tiêu — lượt bị "miss" an toàn).
        if (action.skillId === REACTION_PATH_SPECIAL_ID && this.reactionPathPool) {
          const [first, second] = selectRandomDistinctElementPair([...this.reactionPathPool])

          for (const pickedSkill of [first, second]) {
            const pickedDamage = suddenDeathMultiplier === 1
              ? pickedSkill.damage
              : scaleActionDamage(pickedSkill.damage, suddenDeathMultiplier)

            for (const target of affected) {
              if (!target.entity.alive) continue

              this.combat.resolveActionHit(actor.entity, target.entity, pickedDamage)
              targetIds.push(target.id)
            }
          }
        } else if (action.skillId === REACTION_PATH_SPECIAL_ID) {
          // Marker equipped nhưng pool chưa inject — placeholder damage
          // vô nghĩa, bỏ qua hit hoàn toàn (không crash, không hit).
        } else {
          for (const target of affected) {
            if (!target.entity.alive) continue

            this.combat.resolveActionHit(actor.entity, target.entity, scaledDamage)
            targetIds.push(target.id)

            if (this.registry) {
              new TurnBuffSystem(actor.buffs).rollOnHitEffects(actor.entity, target.entity, this.registry)
            }
          }
        }

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
            pendingGaugeDeltaTargets.push(actor)
          } else {
            for (const target of affected) {
              new TurnBuffSystem(target.buffs).apply(definition, actor.entity, target.entity, this.registry)
              pendingGaugeDeltaTargets.push(target)
            }
          }

          pendingGaugeDeltaDefinition = definition
          }
        }
      }
    }

    // Charging turn: skillId phản ánh charge state (bắt đầu/tick → pending
    // id; resolve → charged id đã push hits vào targetIds ở charge block).
    if (isCharging && !chargeResolved) {
      skillId = actor.pendingChargedSkillId ?? chargedSkillId
    } else if (chargeResolved) {
      skillId = chargedSkillId
    }

    consumeGaugeAfterAction(actor)

    // Future Systems Task 6 — gauge-delta one-shot push SAU consume
    // (consume đặt gauge về 0; delta cộng lên trên, không bị ghi đè).
    if (pendingGaugeDeltaTargets.length > 0) {
      for (const participant of pendingGaugeDeltaTargets) {
        applyGaugeDeltaEffects(pendingGaugeDeltaDefinition!, participant)
      }

      pendingGaugeDeltaTargets.length = 0
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
      skillId,
      targetIds,
      ccBlocked,
    }

    battle.log = battle.log ?? []
    battle.log.push(logEntry)

    return { state: battle.state, actorId: actor.id, skillId, targetIds, ccBlocked }
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
