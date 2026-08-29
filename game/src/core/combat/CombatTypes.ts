// 'elemental' dùng cho damage tới từ nhiều SkillDamageComponent trộn
// lẫn (vd 20% Physical + 80% Fire) — xem ElementDamageCalculator.ts.
// 'primordial' (Hỗn Nguyên) thay thế hẳn 'true' cũ — gây sát thương
// CHUẨN, bỏ qua Armor/Resistance hoàn toàn. KHÔNG còn 'magic' — đã
// gộp vào tổng hợp 5 hành (không skill/enemy nào dùng damage type
// 'magic' riêng, xác nhận qua grep lúc revamp).
export type DamageType = 'physical' | 'primordial' | 'elemental'

// Ngưỡng thanh nộ tối đa — chiêu cuối (ultimate) tốn gần bằng mức
// này. Xem CombatSystem.attack() (tích rage theo damage) và
// SkillSystem (trừ rage khi cast ultimate).
export const MAX_RAGE = 100

// Kiếm Tu (2026-08-15) — Kiếm Ý CHIẾN ĐẤU, pool RIÊNG tách hẳn khỏi
// Nộ Khí (không dùng chung MAX_RAGE — thang điểm khác hẳn, 9999 vs
// 100, và tích theo cơ chế khác: mỗi kiếm ĐÁNH TRÚNG của Ngự Kiếm
// Thuật +1, không theo % damage gây/nhận như Rage). Xem
// CombatEntity.currentSwordIntent, SkillTypes.ts's 'sword_intent'.
export const MAX_SWORD_INTENT = 9999

// Thể Tu (Combat Rework Phase 7) — Momentum tích theo ĐÒN TRÚNG của
// skill Impact (Skill.grantsMomentumPerHit, giống grantsSwordIntentPerHit
// nhưng theo LƯỢNG chứ không phải cố định +1), đủ 100 thì skill "Heavy
// Impact" (resourceType 'momentum', cost 100) đủ điều kiện canUse().
// Thang điểm nhỏ (100, không phải 9999 như Kiếm Ý) vì Momentum tích
// nhanh mỗi đòn cận chiến, không phải theo missile bắn xa.
export const MAX_MOMENTUM = 100

// Hỏa Tu Pure (Plans/FirePath mục 7, 2026-08-21) — Hỏa Thế tích theo
// LƯỢT CAST (Skill.grantsHoaThePerCast, xem BattleSystem.castSkill()),
// KHÔNG theo đòn trúng như Momentum/Kiếm Ý. "5 tầng" đúng số spec gốc
// (thang điểm nhỏ vì mỗi tầng tương lai sẽ mạnh, không cần pool lớn
// như Kiếm Ý 9999).
export const MAX_HOA_THE = 5

// Thổ Tu Pure (Plans/EarthPath mục XV, 2026-08-21) — Thổ Thế tích theo
// LƯỢT CAST (Skill.grantsThoThePerCast, xem BattleSystem.castSkill()),
// cùng thang điểm nhỏ với Hỏa Thế ("Max: 5 tầng" đúng số spec gốc) —
// KHÔNG tự giảm theo thời gian (doc không nhắc decay).
export const MAX_THO_THE = 5

// Kim Tu Trúc Cơ Pure (Plans/KimPath mục 9/11, 2026-08-21) — Kim Thế
// tích theo ROLL THÀNH CÔNG (Skill.grantsKimThePerProc, xem
// SkillEffectSystem.ts's apply()), cùng thang điểm nhỏ với Hỏa/Thổ Thế.
// stats.kimTheMaxStacksBonus (node "Kim Uyên") cộng thêm lên trên nền
// này — xem BattleSystem.castSkill()'s Math.min().
export const MAX_KIM_THE = 5

// Kim Tu Trúc Cơ Pure (mục 12, "decay chậm") — không proc Xuất Huyết
// mới trong ngần này giây thì mất 1 tầng Kim Thế (KHÔNG phải continuous
// per-second như HOA_THE_BASE_DECAY_PER_SECOND) — xem
// BattleSystem.updateKimThe().
export const KIM_THE_DECAY_INTERVAL_SECONDS = 5

// Plans/magicpathgeneral Phase 13 (2026-08-21) — Huyết Phá: charge
// tích theo ROLL Xuất Huyết THÀNH CÔNG y hệt Kim Thế (Skill.
// grantsHuyetPhaPerProc, cùng nhánh case 'ailment' trong
// SkillEffectSystem.ts's apply()), CHẠM NGƯỠNG này thì consume/reset
// về 0 + trigger burst damage MỘT LẦN (xem CombatEntity.currentHuyetPha,
// CombatSystem's applyDotDamage() cho phần damage — KHÔNG mutate 1
// debuff/ailment cũ nào, burst là 1 tick damage riêng, đúng invariant
// Phase 16 "reaction-like payoff, không sửa trực tiếp state cũ"). "Max:
// 5 tầng" theo đúng số Plans/KimPath mục 13/15 để lại.
export const MAX_HUYET_PHA = 5

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

export interface DamageResult {
  sourceId: string

  targetId: string

  rawDamage: number

  finalDamage: number

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
