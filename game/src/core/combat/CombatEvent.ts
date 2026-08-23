export type CombatEventType =
  | 'attack'
  | 'hit'
  | 'damage'
  | 'critical'
  | 'kill'
  | 'death'
  | 'heal'
  | 'dodge'
  | 'block'

export interface CombatEvent {
  type: CombatEventType

  sourceId?: string

  targetId?: string

  value?: number

  damageType?:
    | 'physical'
    | 'primordial'
    | 'elemental'

  critical?: boolean

  // Plans/magicpathgeneral Phase 10/12/13 (2026-08-21) — CHỈ set khi
  // event 'damage' này đến từ 1 tick "damage-over-time-ở-1-điểm" (DoT
  // gắn trên entity HOẶC Lava Zone theo vị trí, xem CombatSystem.
  // applyDotDamage()), undefined cho đòn đánh/skill thường. Tên
  // "effectId" (không phải "ailmentId") vì nguồn tick không nhất thiết
  // là 1 Ailment instance (Lava Zone không phải DoT trên target — xem
  // BattleSystem.updateLavaZones()). Cho phép hệ thống khác (vd Huyết
  // Phá) lắng nghe ĐÚNG loại tick mà không cần AilmentSystem biết gì
  // về chúng ("không hard-code Huyết Phá trong Bleed").
  effectId?: string
}
