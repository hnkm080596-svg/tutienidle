import type { TurnBattle, TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import type { TurnSkillDefinition, TurnSkillSlot } from '../battle/turn/TurnSkillAction'
import { hasResourceFor } from '../battle/turn/TurnSkillAction'
import { turnSkillDisplayMetaOf } from '../../data/skill/TurnSkillDisplayMeta'
import { skillIconPath } from '../../data/skill/SkillIconManifest'

// Slice 7 (2026-09-04) -- ban rewrite HOAN TOAN cua CombatSkillPresentation:
// ban cu doc shape real-time `Battle` (skillCadenceRemainingBySlot/castTime/
// stats.speed) von KHONG ton tai tren TurnBattleParticipant -- dead code tu
// Slice 6 cutover (6 test fail pre-existing la trieu chung). Mo hinh N-slot
// loadout da bi Slice 2 thay bang 3 skill role co dinh -- file nay gio phan
// chieu dung model do.

export type TurnSkillPresentationStateKind =
  | 'ready'
  | 'not_your_turn'
  | 'cooldown'
  | 'blocked_resource'
  | 'locked'
  | 'empty'

export interface TurnSkillPresentationEntry {
  skillId: string

  /** Bang 9.5 #5 -- ten hien thi that (TurnSkillDisplayMeta); undefined = fallback nhan role. */
  skillName?: string

  /** Bang 9.5 #5 -- mo ta tooltip that; undefined = khong override tooltip. */
  skillDescription?: string

  /** Three-path design (2026-09-25) -- icon path resolved tu
   * TurnSkillDisplayMeta.iconKey qua SKILL_ICON_MANIFEST; undefined =
   * slot roi ve monogram. */
  skillIcon?: string

  cooldownRemaining: number

  cooldownTotal: number

  resourceCost: number

  state: TurnSkillPresentationStateKind
}

/** Bo sung display metadata (name/description) vao entry -- lookup an toan theo skillId. */
function withDisplayMeta(entry: TurnSkillPresentationEntry): TurnSkillPresentationEntry {
  const meta = turnSkillDisplayMetaOf(entry.skillId)

  if (!meta) {
    return entry
  }

  return {
    ...entry,
    skillName: meta.name,
    skillDescription: meta.description,
    skillIcon: skillIconPath(meta.iconKey),
  }
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

  // The Tu Reimagined (T22) -- emblemOnly slots (Phan Chinh) are passive
  // emblems: the engine never selects them, so the bar renders the name
  // locked instead of offering an untappable "ready" state.
  if (slot.skill.emblemOnly) {
    return { ...entry, state: 'locked' }
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
 * Turn-based replacement cho `buildLoadoutPresentation` da retire. 'locked'
 * giu trong union cho forward-compat (mo hinh 3 role khong con khai niem
 * unlock theo realm -- khop spec 5); 'empty' phu "participant khong co
 * slot nay" la trang thai not-ready-content duy nhat co that hien nay.
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
  // Party (Future Systems Task 9/10): presentation theo participant duoc
  // chi dinh -- mac dinh players[0] (main character); GameManager truyen
  // paused actor khi manual pause la party member khac players[0].
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
