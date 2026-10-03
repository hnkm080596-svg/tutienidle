import type { SkillEventType } from './SkillEvents'

export type SkillType =
  | 'active'
  | 'passive'

export type SkillTarget =
  | 'self'
  | 'enemy'
  | 'all_enemies'
  | 'ally'
  | 'all_allies'

export type SkillEffectType =
  | 'damage'
  | 'heal'
  | 'buff'
  | 'debuff'
  | 'add_stack'
  | 'remove_buff'

// Tai nguyen bi tru khi cast - 'none' cho basic/moving (chi co
// cooldown), 'mana' cho special. 'momentum' DA GO (spec 2026-09-15 D7 -
// The Tu An fuels reactive checks from 'the'/currentThe; The Tu Hien has
// no pool resource).
// 'rage' DA GO (spec muc 5.4 - Pha Thien Nhat Kich chuyen thanh node,
// khong con consumer nao). 'sword_intent' DA GO (Kiem Tu Reimagined
// spec 2026-09-15 sec7 - no battle pool; Ngu's Kiem Y is persisted
// PlayerData.swordPath state, not a cast resource).
export type SkillResourceType =
  | 'none'
  | 'mana'
  // Phase A3 (2026-09-07) - Phap Tu The pool (CombatEntity.currentThe),
  // gates Thuan-path ultimates. Turn-based gating reuses the generic
  // RESOURCE_FIELD mechanism (TurnSkillAction.ts) - no new code path.
  | 'the'

// Dieu kien tich stack cho passiveModifiers - moi passive tu chon
// 1 trigger, khong dung chung mot co che (xem PassiveSystem).
// Tai dung SkillEventType tu SkillEvents.ts, 'per_second' la gia
// tri bo sung cho passive tich theo thoi gian thay vi theo hanh dong.
export type PassiveTrigger = SkillEventType | 'per_second'