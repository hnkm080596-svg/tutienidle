// Turn-Based Combat Completion (Task 8) — cầu nối GameManager ↔ TurnBattle.
// Adapter chuyển CombatEntity (đã có từ playerToCombatEntity/
// enemyToCombatEntity) thành TurnBattleParticipant, đọc speed THẬT từ
// Stat System (stats.speed, đã rename ở conversion trước).
import type { CombatEntity } from '../combat/CombatEntity'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import type { TurnSkillDefinition, TurnSkillSlot } from '../battle/turn/TurnSkillAction'
import { BAT_KIEM_THUAT } from '../../data/skill/BatKiemThuat'
import { TurnBuffPool } from '../battle/turn/TurnBuffPool'

/**
 * Future Systems Task 8 (2026-09-04) — special/ultimate role theo build.
 * Kiếm Tu: Bạt Kiếm Thuật (2-phase charge, Task 7/8) ở `special`;
 * ultimate chưa có content (Slice 2 priority-fallback xử lý graceful).
 *
 * Phase A3 (2026-09-07) — Pháp Tu KHÔNG đi qua map buildId nữa: 'phap_tu'
 * là path id, không đủ để biết element (bug Component 1 trong spec A3 —
 * 'phap_tu' match không slot nào nên Pháp Tuplayer không có
 * special/ultimate). GameManager resolve qua SkillToTurnSkillConverter
 * rồi truyền `resolvedSpecialUltimate` trực tiếp (param 5). Kiếm Tu giữ
 * lookup tĩnh qua buildId (ultimate tĩnh, xem Task 4 A3).
 */
const SPECIALS_BY_BUILD: Record<string, TurnSkillDefinition> = {
  kiem_tu: BAT_KIEM_THUAT,
}

const ULTIMATES_BY_BUILD: Record<string, TurnSkillDefinition> = {}

export function toTurnBattleParticipant(
  entity: CombatEntity,
  priority: number,
  basic: TurnSkillDefinition,
  buildId?: string,
  resolvedSpecialUltimate?: { special?: TurnSkillDefinition; ultimate?: TurnSkillDefinition },
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

  const special =
    resolvedSpecialUltimate?.special ?? (buildId !== undefined ? SPECIALS_BY_BUILD[buildId] : undefined)
  const ultimate =
    resolvedSpecialUltimate?.ultimate ?? (buildId !== undefined ? ULTIMATES_BY_BUILD[buildId] : undefined)

  if (special) {
    participant.special = {
      skill: special,
      remainingCooldownTurns: 0,
    } satisfies TurnSkillSlot
  }

  if (ultimate) {
    participant.ultimate = {
      skill: ultimate,
      remainingCooldownTurns: 0,
    } satisfies TurnSkillSlot
  }

  if (entity.bossTrigger) {
    participant.bossTrigger = {
      afterTurns: entity.bossTrigger.afterTurns,
      buffDefinitionId: entity.bossTrigger.buffDefinitionId,
      firedAlready: false,
    }
  }

  return participant
}
