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
  | 'ailment'
  | 'add_stack'
  | 'remove_buff'

// Tài nguyên bị trừ khi cast — 'none' cho basic/moving (chỉ có
// cooldown), 'mana' cho special, 'rage' cho ultimate. 'sword_intent'
// (Kiếm Tu, 2026-08-15) — pool RIÊNG 0-9999, xem
// CombatEntity.currentSwordIntent/CombatTypes.ts's MAX_SWORD_INTENT.
// 'momentum' (Thể Tu, Combat Rework Phase 7) — pool RIÊNG 0-100, xem
// CombatEntity.currentMomentum/CombatTypes.ts's MAX_MOMENTUM. Skill
// có cost theo momentum thì canUse() TỰ CHẶN cho tới khi Momentum đầy,
// scheduler auto-cast thống nhất của BattleSystem (plan §8.4) TỰ bắn
// ngay khi đủ — không cần logic "auto-swap đòn kế tiếp" riêng.
export type SkillResourceType =
  | 'none'
  | 'mana'
  | 'rage'
  | 'sword_intent'
  | 'momentum'

// Điều kiện tích stack cho passiveModifiers — mỗi passive tự chọn
// 1 trigger, không dùng chung một cơ chế (xem PassiveSystem).
// Tái dùng SkillEventType từ SkillEvents.ts, 'per_second' là giá
// trị bổ sung cho passive tích theo thời gian thay vì theo hành động.
export type PassiveTrigger = SkillEventType | 'per_second'