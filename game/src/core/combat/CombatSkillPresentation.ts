import type { TurnBattle, TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import type { TurnSkillDefinition, TurnSkillSlot } from '../battle/turn/TurnSkillAction'
import { hasResourceFor } from '../battle/turn/TurnSkillAction'

// Slice 7 (2026-09-04) — bản rewrite HOÀN TOÀN của CombatSkillPresentation:
// bản cũ đọc shape real-time `Battle` (skillCadenceRemainingBySlot/castTime/
// stats.speed) vốn KHÔNG tồn tại trên TurnBattleParticipant — dead code từ
// Slice 6 cutover (6 test fail pre-existing là triệu chứng). Mô hình N-slot
// loadout đã bị Slice 2 thay bằng 3 skill role cố định — file này giờ phản
// chiếu đúng model đó.

export type TurnSkillPresentationStateKind =
  | 'ready'
  | 'not_your_turn'
  | 'cooldown'
  | 'blocked_resource'
  | 'locked'
  | 'empty'

export interface TurnSkillPresentationEntry {
  skillId: string

  cooldownRemaining: number

  cooldownTotal: number

  resourceCost: number

  state: TurnSkillPresentationStateKind
}

const EMPTY_ENTRY: TurnSkillPresentationEntry = {
  skillId: '',
  cooldownRemaining: 0,
  cooldownTotal: 0,
  resourceCost: 0,
  state: 'empty',
}

function basicEntry(
  basic: TurnSkillDefinition | undefined,
  isPlayerTurnPaused: boolean,
): TurnSkillPresentationEntry {
  if (!basic) {
    return EMPTY_ENTRY
  }

  const entry = {
    skillId: basic.id,
    cooldownRemaining: 0,
    cooldownTotal: 0,
    resourceCost: basic.resourceCost ?? 0,
  }

  return {
    ...entry,
    state: isPlayerTurnPaused ? 'ready' : 'not_your_turn',
  }
}

function slotEntry(
  slot: TurnSkillSlot | undefined,
  isPlayerTurnPaused: boolean,
  entity: TurnBattleParticipant['entity'],
): TurnSkillPresentationEntry {
  if (!slot) {
    return EMPTY_ENTRY
  }

  const cooldownTotal = slot.skill.cooldownTurns
  const cooldownRemaining = slot.remainingCooldownTurns
  const resourceCost = slot.skill.resourceCost ?? 0
  const entry = {
    skillId: slot.skill.id,
    cooldownRemaining,
    cooldownTotal,
    resourceCost,
  }

  if (!isPlayerTurnPaused) {
    return { ...entry, state: 'not_your_turn' }
  }

  if (cooldownRemaining > 0) {
    return { ...entry, state: 'cooldown' }
  }

  if (!hasResourceFor(entity, slot.skill)) {
    return { ...entry, state: 'blocked_resource' }
  }

  return { ...entry, state: 'ready' }
}

/**
 * Turn-based replacement cho `buildLoadoutPresentation` đã retire. 'locked'
 * giữ trong union cho forward-compat (mô hình 3 role không còn khái niệm
 * unlock theo realm — khớp spec §5); 'empty' phủ "participant không có
 * slot này" là trạng thái not-ready-content duy nhất có thật hiện nay.
 */
export function buildTurnSkillPresentation(
  battle: TurnBattle,
  isPlayerTurnPaused: boolean,
): {
  basic: TurnSkillPresentationEntry
  special: TurnSkillPresentationEntry
  ultimate: TurnSkillPresentationEntry
} {
  const player = battle.player

  return {
    basic: basicEntry(player.basic, isPlayerTurnPaused),
    special: slotEntry(player.special, isPlayerTurnPaused, player.entity),
    ultimate: slotEntry(player.ultimate, isPlayerTurnPaused, player.entity),
  }
}
