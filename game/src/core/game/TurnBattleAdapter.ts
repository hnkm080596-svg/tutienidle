// Turn-Based Combat Completion (Task 8) â€” cáº§u ná»‘i GameManager â†” TurnBattle.
// Adapter chuyá»ƒn CombatEntity (Ä‘Ã£ cÃ³ tá»« playerToCombatEntity/
// enemyToCombatEntity) thÃ nh TurnBattleParticipant, Ä‘á»c speed THáº¬T tá»«
// Stat System (stats.speed, Ä‘Ã£ rename á»Ÿ conversion trÆ°á»›c).
import type { CombatEntity } from '../combat/CombatEntity'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import type { TurnSkillDefinition, TurnSkillSlot } from '../battle/turn/TurnSkillAction'
import { BAT_KIEM_THUAT } from '../../data/skill/BatKiemThuat'
import { TurnBuffPool } from '../battle/turn/TurnBuffPool'

/**
 * Future Systems Task 8 (2026-09-04) â€” special/ultimate role theo build.
 * Kiáº¿m Tu: Báº¡t Kiáº¿m Thuáº­t (2-phase charge, Task 7/8) á»Ÿ `special`;
 * ultimate chÆ°a cÃ³ content (Slice 2 priority-fallback xá»­ lÃ½ graceful).
 * CÃ¡c build khÃ¡c: chÆ°a author special/ultimate â€” undefined.
 */
const SPECIALS_BY_BUILD: Record<string, TurnSkillDefinition> = {
  kiem_tu: BAT_KIEM_THUAT,
}

export function toTurnBattleParticipant(
  entity: CombatEntity,
  priority: number,
  basic: TurnSkillDefinition,
  buildId?: string,
): TurnBattleParticipant {
  const participant: TurnBattleParticipant = {
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

  const special = buildId !== undefined ? SPECIALS_BY_BUILD[buildId] : undefined

  if (special) {
    participant.special = {
      skill: special,
      remainingCooldownTurns: 0,
    } satisfies TurnSkillSlot
  }

  return participant
}
