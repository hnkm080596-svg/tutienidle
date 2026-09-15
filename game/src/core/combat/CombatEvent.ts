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

  // `value` = pre-absorb magnitude of the hit (finalDamage). For the
  // post-absorb truth read the breakdown fields below — a fully
  // warded hit has value>0 but hpDamage==0.
  value?: number

  // Hit-path absorb breakdown (D5/D11), set on 'damage' events emitted
  // by resolveActionHit. hpDamage is the ACTUAL HP the target lost
  // (post-clamp) — presentation showing "HP lost" text must read this,
  // never `value`. DoT ticks set hpDamage == value (no absorb applies).
  hpDamage?: number
  wardAbsorbed?: number
  // The Tu Reimagined (plan Task 11) — the externalWard component of
  // wardAbsorbed: the HUD's separate "Son Nhac Ho The" layer animates
  // its own consumption off this field; wardAbsorbed stays the total.
  externalWardAbsorbed?: number
  manaShieldAbsorbed?: number

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
