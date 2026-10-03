import type { TurnBattle, TurnBattleParticipant } from './TurnBattleSystem'
import { consumeGaugeAfterAction } from './ActionGauge'
import { resolveNextTurn } from './TurnQueue'

// Slice 7 extension (Completion Task 11) - turn-order preview: tra N actor
// ke tiep theo gauge-fill order ma KHONG mutate battle that.

export interface BattleLogEntry {
  turn: number

  actorId: string

  skillId: string

  targetIds: string[]

  ccBlocked: boolean
}

/**
 * Simulate gauge advancement tren CLONE gauge values (chi cac field dieu
 * khien thu tu - speed/priority/alive/actionGauge/priority; CombatEntity
 * mang class instance nen structuredClone khong an toan). Tra ve actor
 * identity THAT tu battle goc (reference) de UI doc entity that.
 */
export function peekUpcomingActors(
  battle: TurnBattle,
  count: number,
): TurnBattleParticipant[] {
  // Queued executions/follow-ups drain BEFORE gauge order inside
  // dequeueFollowUpActor -- lead with them or the first 'upcoming' entry
  // is wrong while a repeat/counter is pending. Display approximation:
  // dead actors are skipped; the chain-depth guard is not simulated.
  const upcoming: TurnBattleParticipant[] = []

  const findAlive = (actorId: string): TurnBattleParticipant | undefined => {
    const participant =
      battle.players.find((member) => member.id === actorId) ??
      battle.enemies.find((enemy) => enemy.id === actorId)

    return participant !== undefined && participant.entity.alive ? participant : undefined
  }

  for (const entry of battle.queuedExecutions ?? []) {
    if (upcoming.length >= count) return upcoming
    const actor = findAlive(entry.actorId)
    if (actor !== undefined) upcoming.push(actor)
  }

  for (const entry of battle.queuedFollowUps ?? []) {
    if (upcoming.length >= count) return upcoming
    const actor = findAlive(entry.actorId)
    if (actor !== undefined) upcoming.push(actor)
  }

  const cloned: TurnBattleParticipant[] = [
    ...battle.players.map(cloneGaugeActor),
    ...battle.enemies.map(cloneGaugeActor),
  ]

  for (let i = upcoming.length; i < count; i++) {
    const resolved = resolveNextTurn(cloned.filter((actor) => actor.alive))

    if (!resolved) {
      break
    }

    const real =
      battle.players.find((member) => member.id === resolved.actor.id) ??
      battle.enemies.find((enemy) => enemy.id === resolved.actor.id)

    if (!real) {
      break
    }

    upcoming.push(real)

    const clone = cloned.find((actor) => actor.id === resolved.actor.id)

    if (clone) {
      consumeGaugeAfterAction(clone, 1)
    }
  }

  return upcoming
}

function cloneGaugeActor(participant: TurnBattleParticipant): TurnBattleParticipant {
  return {
    ...participant,
    alive: participant.entity.alive,
    basic: undefined,
    special: undefined,
    ultimate: undefined,
    resources: undefined,
    bossTrigger: undefined,
    // buffs la reference chung - resolveNextTurn chi doc, an toan.
    //
    // Defect Task 8 (2026-09-05): clone participant van TRO CHUNG entity song
    // (khong deep-copy CombatEntity) - an toan vi preview chi doc, khong
    // mutate. Neu sau nay preview logic can mo phong trang thai gia dinh
    // (vd. "neu X chet thi thu tu doi the nao"), phai deep-copy entity o day
    // truoc, khong sua truc tiep.
  }
}
