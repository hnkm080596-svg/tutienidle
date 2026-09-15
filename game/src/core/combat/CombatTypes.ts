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

// Kiếm Tu (2026-08-15) — Kiếm Ý CHIẾN ĐẤU, pool RIÊNG (thang điểm
// 9999, tích theo cơ chế riêng: mỗi kiếm ĐÁNH TRÚNG của Ngự Kiếm
// Thuật +1, không theo % damage gây/nhận). Xem
// CombatEntity.currentSwordIntent, SkillTypes.ts's 'sword_intent'.
export const MAX_SWORD_INTENT = 9999

// Thể Tu (Combat Rework Phase 7) — Momentum tích theo ĐÒN TRÚNG của
// skill Impact (Skill.grantsMomentumPerHit, giống grantsSwordIntentPerHit
// nhưng theo LƯỢNG chứ không phải cố định +1), đủ 100 thì skill "Heavy
// Impact" (resourceType 'momentum', cost 100) đủ điều kiện canUse().
// Thang điểm nhỏ (100, không phải 9999 như Kiếm Ý) vì Momentum tích
// nhanh mỗi đòn cận chiến, không phải theo missile bắn xa.
export const MAX_MOMENTUM = 100

// Kiếm Thế / Kiếm Ý (spec 2026-08-29-kiem-the-kiem-y) — 2 tài nguyên
// route Kiếm Tu sau khi chốt đường ở Quán Khí:
//   - Kiếm Thế (route Kiếm Trận): pool TRONG TRẬN 0-100, reset mỗi
//     trận, tích = số kiếm của trận mỗi lần cast (Lưỡng Nghi +2 ...
//     Vô Cực +9). Tiêu hao cho ult Tru Tiên Kiếm Trận (cost 10 × số
//     kiếm) + buff sát thương +1% mỗi 2 điểm (đầy 100 = +50%).
//   - Kiếm Ý tạm (route Bạt Kiếm): pool trong trận khởi đầu bằng số
//     kiếm ý VĨNH VIỄN (tầng boss diệt × 10), cap cộng thêm tối đa
//     MAX_KIEM_Y_TEMP_CAP lên trên nền vĩnh viễn (vd 10 vĩnh viễn +
//     90 tạm). Tiêu hao ăn TẠM TRƯỚC — vĩnh viễn bất khả xâm phạm
//     (xem KiemTuResourceSystem.consumeKiemYTempFirst).
// Số liệu "khởi điểm tinh chỉnh playtest" theo spec mục 2/3.2.
export const MAX_KIEM_THE = 100
export const MAX_KIEM_Y_TEMP_CAP = 900

// +1 Kiếm Ý tạm mỗi lần mất KIEM_Y_DMG_TAKEN_GAIN_PER_MAXHP_PERCENT%
// maxHP (spec mục 3.2 — "tinh chỉnh playtest").
export const KIEM_Y_DMG_TAKEN_GAIN_PER_MAXHP_PERCENT = 5

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
// Only `taken` fires damage-proportional triggers (leech, thorns,
// on-hit-taken procs); `landed` (absorbed OR taken) still fires
// ailment-application rolls and resets turnsSinceLastHitLanded.
export type HitOutcome = 'miss' | 'absorbed' | 'taken'

export interface DamageResult {
  sourceId: string

  targetId: string

  rawDamage: number

  finalDamage: number

  // Post-absorb HP loss (finalDamage - wardAbsorbed - manaShieldAbsorbed).
  // Leech/thorns/on-hit-taken triggers read THIS, never finalDamage (D11).
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
  // không có ward hoặc ward đã cạn.
  wardAbsorbed: number

  // Pháp Tu Redesign (magicpath) — phần damage bị Mana Shield "đẩy"
  // sang mana (SAU Ward, TRƯỚC HP) — 0 nếu không có manaShieldPercent
  // hoặc mana đã cạn. Xem CombatSystem.resolveAttack().
  manaShieldAbsorbed: number

  targetKilled: boolean
}
