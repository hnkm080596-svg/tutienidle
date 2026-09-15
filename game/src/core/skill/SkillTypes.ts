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

// Tài nguyên bị trừ khi cast — 'none' cho basic/moving (chỉ có
// cooldown), 'mana' cho special. 'momentum' (Thể Tu) — pool
// RIÊNG 0-100, xem
// CombatEntity.currentMomentum/CombatTypes.ts's MAX_MOMENTUM. Skill
// có cost theo momentum thì hasResourceFor() (TurnSkillAction.ts) TỰ
// CHẶN cho tới khi Momentum đủ — engine selectAction rơi về slot/basic
// sẵn sàng thay vì "auto-swap đòn kế tiếp" riêng.
// 'rage' ĐÃ GỠ (spec mục 5.4 — Phá Thiên Nhất Kích chuyển thành node,
// không còn consumer nào). 'sword_intent' ĐÃ GỠ (Kiem Tu Reimagined
// spec 2026-09-15 §7 — no battle pool; Ngu's Kiem Y is persisted
// PlayerData.kiemTu state, not a cast resource).
export type SkillResourceType =
  | 'none'
  | 'mana'
  | 'momentum'
  // Phase A3 (2026-09-07) — Pháp Tu Thế pool (CombatEntity.currentThe),
  // gates Thuần-path ultimates. Turn-based gating reuses the generic
  // RESOURCE_FIELD mechanism (TurnSkillAction.ts) — no new code path.
  | 'the'

// Điều kiện tích stack cho passiveModifiers — mỗi passive tự chọn
// 1 trigger, không dùng chung một cơ chế (xem PassiveSystem).
// Tái dùng SkillEventType từ SkillEvents.ts, 'per_second' là giá
// trị bổ sung cho passive tích theo thời gian thay vì theo hành động.
export type PassiveTrigger = SkillEventType | 'per_second'