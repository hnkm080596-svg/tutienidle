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
  // post-absorb truth read the breakdown fields below - a fully
  // warded hit has value>0 but hpDamage==0.
  value?: number

  // Hit-path absorb breakdown (D5/D11), set on 'damage' events emitted
  // by resolveActionHit. hpDamage is the ACTUAL HP the target lost
  // (post-clamp) - presentation showing "HP lost" text must read this,
  // never `value`. DoT ticks set hpDamage == value (no absorb applies).
  hpDamage?: number
  wardAbsorbed?: number
  // The Tu Reimagined (plan Task 11) - the externalWard component of
  // wardAbsorbed: the HUD's separate "Son Nhac Ho The" layer animates
  // its own consumption off this field; wardAbsorbed stays the total.
  externalWardAbsorbed?: number
  manaShieldAbsorbed?: number

  damageType?:
    | 'physical'
    | 'primordial'
    | 'elemental'

  critical?: boolean

  // Plans/magicpathgeneral Phase 10/12/13 (2026-08-21) - CHI set khi
  // event 'damage' nay den tu 1 tick "damage-over-time-o-1-diem" (DoT
  // gan tren entity HOAC Lava Zone theo vi tri, xem CombatSystem.
  // applyDotDamage()), undefined cho don danh/skill thuong. Ten
  // "effectId" (khong phai "ailmentId") vi nguon tick khong nhat thiet
  // la 1 Ailment instance (Lava Zone khong phai DoT tren target - xem
  // BattleSystem.updateLavaZones()). Cho phep he thong khac (vd Huyet
  // Pha) lang nghe DUNG loai tick ma khong can AilmentSystem biet gi
  // ve chung ("khong hard-code Huyet Pha trong Bleed").
  effectId?: string
}
