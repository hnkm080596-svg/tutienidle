import type { TurnBattle, TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import type { TurnSkillDefinition, TurnSkillSlot } from '../battle/turn/TurnSkillAction'
import { hasResourceFor } from '../battle/turn/TurnSkillAction'
import { turnSkillDisplayMetaOf } from '../../data/skill/TurnSkillDisplayMeta'

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

  /** Bảng 9.5 #5 — tên hiển thị thật (TurnSkillDisplayMeta); undefined = fallback nhãn role. */
  skillName?: string

  /** Bảng 9.5 #5 — mô tả tooltip thật; undefined = không override tooltip. */
  skillDescription?: string

  cooldownRemaining: number

  cooldownTotal: number

  resourceCost: number

  state: TurnSkillPresentationStateKind
}

/** Bổ sung display metadata (name/description) vào entry — lookup an toàn theo skillId. */
function withDisplayMeta(entry: TurnSkillPresentationEntry): TurnSkillPresentationEntry {
  const meta = turnSkillDisplayMetaOf(entry.skillId)

  if (!meta) {
    return entry
  }

  return { ...entry, skillName: meta.name, skillDescription: meta.description }
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
  participantOverride?: TurnBattleParticipant,
): {
  basic: TurnSkillPresentationEntry
  special: TurnSkillPresentationEntry
  ultimate: TurnSkillPresentationEntry
} {
  // Party (Future Systems Task 9/10): presentation theo participant được
  // chỉ định — mặc định players[0] (main character); GameManager truyền
  // paused actor khi manual pause là party member khác players[0].
  const player =
    participantOverride ?? battle.players[0]

  if (!player) {
    return {
      basic: EMPTY_ENTRY,
      special: EMPTY_ENTRY,
      ultimate: EMPTY_ENTRY,
    }
  }

  return {
    basic: withDisplayMeta(basicEntry(player.basic, isPlayerTurnPaused)),
    special: withDisplayMeta(slotEntry(player.special, isPlayerTurnPaused, player.entity)),
    ultimate: withDisplayMeta(slotEntry(player.ultimate, isPlayerTurnPaused, player.entity)),
  }
}
