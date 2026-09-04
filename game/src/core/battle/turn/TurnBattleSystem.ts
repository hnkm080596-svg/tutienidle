// TurnBattleSystem Slice 1 (spec 2026-09-04) — engine turn-based độc lập,
// headless, KHÔNG nối vào BattleSystem.ts/GameManager. Chứng minh ATB
// gauge (TurnQueue) + targeting + CombatSystem.resolveActionHit chạy
// đúng end-to-end trước khi lớp thêm skill/buff/reaction/hazard zone ở
// slice sau.
import type { CombatEntity } from '../../combat/CombatEntity'
import type { CombatSystem } from '../../combat/CombatSystem'
import { entityGridPosition, getChebyshevDistance } from '../BattleGrid'
import { consumeGaugeAfterAction } from './ActionGauge'
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
}

export interface TurnBattle {
  player: TurnBattleParticipant
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

    const allParticipants = [battle.player, ...battle.enemies]

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

    let skillId = ''

    const targetIds: string[] = []

    if (actor.entity.alive && !ccBlocked) {
      tickCooldowns(actor)

      // Stats recompute (Completion Task 4): fold statModifier buffs đang
      // active vào entity stats TRƯỚC khi chọn/hành động — luôn tính TỪ
      // baseStats để không double-apply các recompute trước đó.
      actor.entity.stats = recomputeEffectiveStats(actor.entity.baseStats ?? actor.entity.stats, actor.buffs)

      const action = forcedSkillSlot
        ? selectForcedAction(actor, forcedSkillSlot)
        : selectAction(actor)

      skillId = action.skillId

      const opposingSide = actor === battle.player ? battle.enemies : [battle.player]
      const primaryTarget = selectTarget(actor, opposingSide)

      if (primaryTarget) {
        const affected = collectTurnTargets(primaryTarget, opposingSide, action.targeting)

        const suddenDeathMultiplier = this.suddenDeathDamageMultiplier(battle.totalTurnsElapsed ?? 0)
        const scaledDamage = suddenDeathMultiplier === 1 ? action.damage : scaleActionDamage(action.damage, suddenDeathMultiplier)

        for (const target of affected) {
          if (!target.entity.alive) continue

          this.combat.resolveActionHit(actor.entity, target.entity, scaledDamage)
          targetIds.push(target.id)

          if (this.registry) {
            new TurnBuffSystem(actor.buffs).rollOnHitEffects(actor.entity, target.entity, this.registry)
          }
        }

        commitAction(actor.entity, action)

        if (action.skill?.appliesBuff && this.registry) {
          const definition = this.registry.get(action.skill.appliesBuff.definitionId)

          if (action.skill.appliesBuff.target === 'self') {
            new TurnBuffSystem(actor.buffs).apply(definition, actor.entity, actor.entity, this.registry)
          } else {
            for (const target of affected) {
              new TurnBuffSystem(target.buffs).apply(definition, actor.entity, target.entity, this.registry)
            }
          }
        }
      }
    }

    consumeGaugeAfterAction(actor)

    if (battle.wave && this.spawnEnemy) {
      const aliveEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length

      if (shouldSpawnNextEnemy(battle.wave.spawnedCount, battle.wave.totalEnemyCount, aliveEnemyCount)) {
        battle.enemies.push(this.spawnEnemy())
        battle.wave.spawnedCount += 1
      }
    }

    const finalAliveEnemyCount = battle.enemies.filter((enemy) => enemy.entity.alive).length

    if (!battle.player.entity.alive) {
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
