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
}

export interface TurnBattle {
  player: TurnBattleParticipant
  enemies: TurnBattleParticipant[]
  state: TurnBattleState
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

    const actorBuffSystem = new TurnBuffSystem(actor.buffs)

    // CC check TRƯỚC tick: buff stun/freeze duration=N phải block đúng N
    // lượt của holder (áp ở lượt N-1, block lượt N..N+1, hết sau khi block
    // lượt cuối). Tick trước sẽ làm duration-1 expire trước khi kịp block.
    const ccBlocked = actorBuffSystem.isStunned() || actorBuffSystem.isFrozen()

    actorBuffSystem.update(actor.entity, this.combat, this.registry)

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
      }
    }

    consumeGaugeAfterAction(actor)

    if (!battle.player.entity.alive) {
      battle.state = 'defeat'
    } else if (battle.enemies.every((enemy) => !enemy.entity.alive)) {
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
