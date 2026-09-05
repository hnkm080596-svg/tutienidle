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
  const cloned: TurnBattleParticipant[] = [
    ...battle.players.map(cloneGaugeActor),
    ...battle.enemies.map(cloneGaugeActor),
  ]

  const upcoming: TurnBattleParticipant[] = []

  for (let i = 0; i < count; i++) {
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
