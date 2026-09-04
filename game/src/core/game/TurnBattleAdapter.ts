// Turn-Based Combat Completion (Task 8) — cầu nối GameManager ↔ TurnBattle.
// Adapter chuyển CombatEntity (đã có từ playerToCombatEntity/
// enemyToCombatEntity) thành TurnBattleParticipant, đọc speed THẬT từ
// Stat System (stats.speed, đã rename ở conversion trước).
import type { CombatEntity } from '../combat/CombatEntity'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import { TurnBuffPool } from '../battle/turn/TurnBuffPool'

export function toTurnBattleParticipant(
  entity: CombatEntity,
  priority: number,
  basic: TurnSkillDefinition,
): TurnBattleParticipant {
  return {
    id: entity.id,
    entity,
    speed: entity.stats.speed,
    priority,
    actionGauge: 0,
    alive: entity.alive,
    buffs: new TurnBuffPool(),
    consecutiveHardCcTurns: 0,
    basic,
  }
}
