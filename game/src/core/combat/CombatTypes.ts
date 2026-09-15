// 'elemental' dùng cho damage tới từ nhiều SkillDamageComponent trộn
// lẫn (vd 20% Physical + 80% Fire) — xem ElementDamageCalculator.ts.
// 'primordial' (Hỗn Nguyên) thay thế hẳn 'true' cũ — gây sát thương
// CHUẨN, bỏ qua Armor/Resistance hoàn toàn. KHÔNG còn 'magic' — đã
// gộp vào tổng hợp 5 hành (không skill/enemy nào dùng damage type
// 'magic' riêng, xác nhận qua grep lúc revamp).
export type DamageType = 'physical' | 'primordial' | 'elemental'

// Nộ (rage) đã GỠ (spec 2026-08-29-kiem-the-kiem-y mục 5.4) —
// consumer duy nhất (Phá Thiên Nhất Kích) chuyển thành passive node
// của route Bạt Kiếm, pool currentRage/MAX_RAGE dọn sạch không để
// mồ côi (dev phase, không migration).

// The Tu Reimagined (spec 2026-09-15 D7/section 7.13) — Momentum
// (momentum cap/momentum resource/per-hit momentum grant/momentum resource
// resourceType) retired; the hidden path fuels reactive checks from
// currentThe, the visible path has no pool resource.


// Pháp Tu Đạo Sắc (spec 2026-08-30-phap-tu-dao-sac §2.3) — Thế Thuần
// hệ Pháp Tu sau Lập Đạo: pool 0-100 tích xuyên kill trong phiên farm
// (+10 mỗi link chuỗi cast hoàn tất, +20 finisher E), KHÔNG decay,
// đầy thì bắn được Ultimate nhánh (reset về 0). Số liệu khởi điểm
// playtest theo convention.
export const MAX_THE = 100
export const THE_GAIN_PER_LINK = 10
export const THE_GAIN_PER_FINISHER = 20

// stat-system-reimagined Task 5 (D5/D11) — explicit hit outcome level:
//   miss     — accuracy/dodge roll failed; nothing landed
//   absorbed — landed, but ward + MP shield absorbed everything
//   taken    — hpDamage > 0
// Only `taken` fires damage-proportional triggers (leech,
// on-hit-taken procs); `landed` (absorbed OR taken) still fires
// ailment-application rolls and resets turnsSinceLastHitLanded.
export type HitOutcome = 'miss' | 'absorbed' | 'taken'

export interface DamageResult {
  sourceId: string

  targetId: string

  rawDamage: number

  finalDamage: number

  // Post-absorb HP loss (finalDamage - wardAbsorbed - manaShieldAbsorbed).
  // Leech/on-hit-taken triggers read THIS, never finalDamage (D11).
  hpDamage: number

  outcome: HitOutcome

  damageType: DamageType

  critical: boolean

  // true nếu target né được (accuracy vs evasion contest — xem
  // CombatSystem.resolveHit()), auto finalDamage/rawDamage = 0 và
  // KHÔNG có gì bị trừ/tích.
  dodged: boolean

  // true nếu target block thành công (giảm damage theo
  // blockEffectiveness) — không loại trừ dodged, chỉ 1 trong 2 xảy ra.
  blocked: boolean

  // Phần damage bị Ward hấp thụ trước khi trừ vào currentHp — 0 nếu
  // không có ward hoặc ward đã cạn. TOTAL = external + native.
  wardAbsorbed: number

  // The Tu Reimagined (plan Task 11) — the externalWard component of
  // wardAbsorbed: the separate protection-only pool (source-tagged,
  // exempt from wardMax/regen) absorbs BEFORE native currentWard.
  externalWardAbsorbed: number

  // Pháp Tu Redesign (magicpath) — phần damage bị Mana Shield "đẩy"
  // sang mana (SAU Ward, TRƯỚC HP) — 0 nếu không có manaShieldPercent
  // hoặc mana đã cạn. Xem CombatSystem.resolveAttack().
  manaShieldAbsorbed: number

  targetKilled: boolean
}
