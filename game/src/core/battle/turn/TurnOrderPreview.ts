import type { TurnBattle, TurnBattleParticipant } from './TurnBattleSystem'
import { resolveNextTurn } from './TurnQueue'

// Slice 7 extension (Completion Task 11) — turn-order preview: trả N actor
// kế tiếp theo gauge-fill order mà KHÔNG mutate battle thật.

export interface BattleLogEntry {
  turn: number

  actorId: string

  skillId: string

  targetIds: string[]

  ccBlocked: boolean
}

/**
 * Simulate gauge advancement trên CLONE gauge values (chỉ các field điều
 * khiển thứ tự — speed/priority/alive/actionGauge/priority; CombatEntity
 * mang class instance nên structuredClone không an toàn). Trả về actor
 * identity THẬT từ battle gốc (reference) để UI đọc entity thật.
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
      clone.actionGauge = 0
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
    // buffs là reference chung — resolveNextTurn chỉ đọc, an toàn.
    //
    // Defect Task 8 (2026-09-05): clone participant vẫn TRỎ CHUNG entity sống
    // (không deep-copy CombatEntity) — an toàn vì preview chỉ đọc, không
    // mutate. Nếu sau này preview logic cần mô phỏng trạng thái giả định
    // (vd. "nếu X chết thì thứ tự đổi thế nào"), phải deep-copy entity ở đây
    // trước, không sửa trực tiếp.
  }
}
