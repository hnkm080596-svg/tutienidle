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
import { tickCooldowns, selectAction, commitAction, collectTurnTargets } from './TurnSkillAction'
import type { TurnSkillDefinition, TurnSkillSlot } from './TurnSkillAction'
import { TurnBuffPool } from './TurnBuffPool'
import { TurnBuffSystem } from './TurnBuffSystem'
import type { TurnBuffRegistry } from './TurnBuffTypes'
import { applyTurnStartDeltas } from './ResourceTurnHook'
import type { TurnResourceDelta } from './ResourceTurnHook'
import { isTurnTriggerReady } from './BossTurnTriggers'
import { shouldSpawnNextEnemy, isStageComplete } from './WaveSpawnTrigger'

export interface TurnResourcePool {
  values: Record<string, number>
  deltasPerTurn: TurnResourceDelta[]
}

export interface TurnBossTrigger {
  afterTurns: number
  buffDefinitionId: string
  firedAlready: boolean
}

export type TurnBattleState = 'fighting' | 'victory' | 'defeat'

export interface TurnBattleParticipant {
  id: string
  entity: CombatEntity
  speed: number
  priority: number
  actionGauge: number
  alive: boolean
  buffs: TurnBuffPool
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
  wave?: {
    totalEnemyCount: number
    spawnedCount: number
  }
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
   * Resolves exactly ONE actor's turn. Production entry point from Slice
   * 3 onward — GameManager/UI call this repeatedly instead of running a
   * battle to completion in one call (needed once Slice 5 adds wave
   * pauses and Slice 7 adds manual input waits).
   */
  resolveNextStep(battle: TurnBattle): TurnStepResult {
    const allParticipants = [battle.player, ...battle.enemies]

    for (const participant of allParticipants) {
      participant.alive = participant.entity.alive
    }

    const resolved = resolveNextTurn(allParticipants)

    if (!resolved) {
      battle.state = 'defeat'
      return { state: 'defeat', actorId: '', skillId: '', targetIds: [], ccBlocked: false }
    }

    const actor = resolved.actor

    battle.totalTurnsElapsed = (battle.totalTurnsElapsed ?? 0) + 1

    const actorBuffSystem = new TurnBuffSystem(actor.buffs)

    // CC check TRƯỚC tick: buff stun/freeze duration=N phải block đúng N
    // lượt của holder (áp ở lượt N-1, block lượt N..N+1, hết sau khi block
    // lượt cuối). Tick trước sẽ làm duration-1 expire trước khi kịp block.
    const ccBlocked = actorBuffSystem.isStunned() || actorBuffSystem.isFrozen()

    actorBuffSystem.update(actor.entity, this.combat, this.registry)

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

      const action = selectAction(actor)

      skillId = action.skillId

      const opposingSide = actor === battle.player ? battle.enemies : [battle.player]
      const primaryTarget = selectTarget(actor, opposingSide)

      if (primaryTarget) {
        const affected = collectTurnTargets(primaryTarget, opposingSide, action.targeting)

        for (const target of affected) {
          this.combat.resolveActionHit(actor.entity, target.entity, action.damage)
          targetIds.push(target.id)
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

    return { state: battle.state, actorId: actor.id, skillId, targetIds, ccBlocked }
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
}
