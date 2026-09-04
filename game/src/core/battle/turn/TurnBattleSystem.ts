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
import type { TurnSkillDefinition, TurnSkillSlot } from './TurnSkillAction'

export type TurnBattleState = 'fighting' | 'victory' | 'defeat'

export interface TurnBattleParticipant {
  id: string
  entity: CombatEntity
  speed: number
  priority: number
  actionGauge: number
  alive: boolean
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

export class TurnBattleSystem {
  constructor(
    private readonly combat: CombatSystem,
    private readonly maxTurns: number = DEFAULT_MAX_TURNS,
  ) {}

  runToCompletion(battle: TurnBattle): TurnBattleState {
    const allParticipants = [battle.player, ...battle.enemies]

    for (let turn = 0; turn < this.maxTurns; turn++) {
      for (const participant of allParticipants) {
        participant.alive = participant.entity.alive
      }

      const resolved = resolveNextTurn(allParticipants)

      if (!resolved) {
        battle.state = 'defeat'
        return battle.state
      }

      const actor = resolved.actor
      const opposingSide = actor === battle.player ? battle.enemies : [battle.player]
      const target = selectTarget(actor, opposingSide)

      if (target) {
        this.combat.resolveActionHit(actor.entity, target.entity, { kind: 'physical', multiplier: 1 })
      }

      consumeGaugeAfterAction(actor)

      if (!battle.player.entity.alive) {
        battle.state = 'defeat'
        return battle.state
      }

      if (battle.enemies.every((enemy) => !enemy.entity.alive)) {
        battle.state = 'victory'
        return battle.state
      }
    }

    battle.state = 'defeat'
    return battle.state
  }
}
