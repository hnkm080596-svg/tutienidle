import type { SkillDamageComponent } from '../../skill/SkillDamageComponent'

// 2 nhánh damage — khớp đúng 2 method hiện có của CombatSystem
// (attack() 1 DamageType duy nhất, attackWithElements() nhiều
// component trộn hành) để lúc missile trúng đích gọi thẳng lại đúng
// method cũ, không tính damage kiểu khác. 'primordial' (Hỗn Nguyên)
// thay thế hẳn 'true' cũ. Không còn 'magic' (gộp vào tổng hợp 5 hành).
export type MissileDamageInfo =
  | { kind: 'physical' | 'primordial'; multiplier: number }
  | { kind: 'elemental'; components: SkillDamageComponent[]; multiplier: number }

/**
 * Combat Rework Phase 3 (projectile behaviors) — khai báo hành vi bay
 * NGOÀI Normal, data-driven theo đúng nguyên tắc "không tạo
 * FireballMissile/SwordMissile riêng" (plan mục 17): 1 Missile duy
 * nhất, hành vi khai qua field optional. undefined/0/false ở mọi field
 * = Normal (spawn → target → hit → damage → destroy), hành vi hệt như
 * trước khi có behavior này — không phá vỡ call site cũ.
 */
export interface ProjectileBehavior {
  // Sau khi trúng, bay tiếp CÙNG HƯỚNG tới mục tiêu kế tiếp (chưa bị
  // trúng) nằm xa hơn theo đúng hướng bay — số lần xuyên tối đa.
  pierceCount?: number

  // Sau khi trúng, đổi hướng sang mục tiêu CÒN SỐNG gần nhất chưa bị
  // trúng (bất kỳ hướng nào) — số lần nảy tối đa.
  bounceCount?: number

  // Mỗi tick tự tính lại hướng bay theo vị trí HIỆN TẠI của mục tiêu
  // (thay vì cố định hướng lúc bắn) — mục tiêu di chuyển vẫn bị đuổi theo.
  homing?: boolean

  // Lúc trúng, gây damage luôn cho MỌI mục tiêu khác (chưa bị trúng)
  // trong bán kính này quanh điểm trúng — cùng 1 tick, không tốn pierce/bounce.
  aoeRadius?: number

  // Thổ Tu Pure (Plans/EarthPath mục XVI, 2026-08-21) — % damage cho
  // mục tiêu PHỤ (trúng qua aoeRadius, KHÔNG phải mục tiêu chính) so
  // với multiplier gốc — xem BattleSystem.resolveMissiles()'s
  // isPrimary. undefined = mọi mục tiêu AOE ăn full damage (hành vi
  // gốc trước khi có field này, KHÔNG đổi cho content cũ).
  aoeSecondaryDamagePercent?: number

  // Thổ Tu Pure (Plans/EarthPath mục XVI) — world-unit đẩy lùi mục
  // tiêu khỏi nguồn bắn mỗi lần TRÚNG (cả primary lẫn AOE secondary) —
  // xem BattleSystem.resolveMissiles(). undefined = không đẩy lùi.
  knockbackDistance?: number
}

/**
 * 1 "đạn" bay từ nguồn tới đích trên trục X — khi vị trí trùng đích
 * (MissileSystem.update()) mới thật sự tính damage, không áp dụng
 * tức thời lúc bắn. Model 1D, không có Y — khớp sân đấu ngang hiện
 * tại (xem core/battle/BattleLane.ts).
 */
export interface Missile {
  id: string

  // Id CombatEntity bắn ra — tra lại entity SỐNG qua Battle lúc
  // trúng (không giữ tham chiếu trực tiếp, vì stats/vị trí có thể
  // đổi trong lúc đạn đang bay).
  sourceId: string

  targetId: string

  x: number

  // world unit/giây.
  speed: number

  // +1 bay theo chiều X tăng dần, -1 bay theo chiều X giảm dần —
  // tính 1 lần lúc bắn từ vị trí source/target lúc đó, không đổi
  // giữa chừng dù target có di chuyển tiếp (đạn bay thẳng). Ngoại lệ:
  // `behavior.homing` tự tính lại mỗi tick (xem MissileSystem.update()).
  direction: 1 | -1

  damage: MissileDamageInfo

  // Roll critical NGAY lúc bắn (mang theo suốt hành trình) — dodge
  // thì roll lúc TRÚNG (xem MissileSystem/CombatSystem.resolveMissileHit),
  // vì né là phản ứng của mục tiêu tại thời điểm bị đánh trúng.
  critical: boolean

  // undefined = đòn đánh cơ bản (không qua skill nào).
  skillId?: string

  // Danh sách id đã bị chính missile này gây damage — chặn Pierce/
  // Bounce/AOE trúng lại CÙNG 1 mục tiêu nhiều lần trong 1 lượt bay.
  hitEntityIds: string[]

  behavior?: ProjectileBehavior

  // Bản sao ghi/đếm ngược của behavior.pierceCount/bounceCount — tách
  // khỏi behavior (immutable, có thể share giữa nhiều missile cùng
  // skill) để mỗi missile tự trừ dần độc lập.
  pierceRemaining?: number

  bounceRemaining?: number
}
