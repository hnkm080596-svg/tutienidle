import type { CombatEntity } from './CombatEntity'
import { clamp } from '../math/clamp'

// Realm Passive & Pressure System (2026-08-20) — thay thế hoàn toàn
// RealmSuppression.ts cũ (±8%/gap, không có mitigation nào). Chênh
// lệch cảnh giới (đại cảnh giới — REALMS index, không phải tầng nhỏ
// trong cùng 1 cảnh giới) giữa 2 bên combat: bên cảnh giới cao hơn gây
// nhiều sát thương hơn VÀ nhận ít sát thương hơn — CHỈ 1 con số vì
// "gây dư sát thương" của bên này chính là "nhận dư sát thương" của
// bên kia (mục IX tài liệu — không cộng thêm Damage Taken riêng, tránh
// nhân đôi).
const MAX_REALM_GAP = 5

// Bậc Nhập Đạo/Kiến Cơ (1-6, xem core/player/Player.ts's
// breakthroughGrade) giảm dần Pressure còn lại: grade1 = 100% (không
// giảm), grade6 = 0% (miễn nhiễm hoàn toàn), đúng bảng mục VIII tài
// liệu. B2 (2026-08-27): Realm Pressure là tuyệt đối theo cảnh giới;
// căn cơ là sức kháng của BÊN YẾU THẾ. gap > 0 đọc grade của target,
// gap < 0 đọc grade của source. Enemy không có khái niệm căn cơ ->
// grade 1 (chịu/toàn bộ pressure, không miễn nhiễm vô căn cứ).
const PRESSURE_REMAINING_PER_GRADE_STEP = 0.2
const DEFAULT_NO_FOUNDATION_GRADE = 1

// Ở gap = 1: bên cao gây ×2.00 (grade1) -> ×1.00 (grade6); bên thấp
// gây ×0.50 (grade1) -> ×1.00 (grade6) — đúng bảng mục VII/VIII. Chưa
// có curve multi-gap chính thức (tài liệu mục X khuyến nghị chỉ làm
// liền kề trước) nên tuyến tính hoá theo gap là phần mở rộng ĐƠN GIẢN
// NHẤT giữ đúng hành vi gap=1, cần tinh chỉnh qua playtest.
const HIGH_TO_LOW_PRESSURE_PER_GAP = 1.0
const LOW_TO_HIGH_PRESSURE_PER_GAP = 0.5

// Chặn dưới multiplier bên thấp cảnh giới — tránh multiplier 0/âm khi
// gap lớn (gap=5, grade1: 1 - 5*0.5 = -1.5 nếu không chặn).
const LOW_TO_HIGH_MULTIPLIER_FLOOR = 0.1

function resolveWeakerSideGrade(source: CombatEntity, target: CombatEntity, gap: number): number {
  const weakerSide = gap > 0 ? target : source

  return clamp(weakerSide.breakthroughGrade ?? DEFAULT_NO_FOUNDATION_GRADE, 1, 6)
}

/**
 * Hệ số Realm Pressure — nhân thẳng vào damage multiplier trước khi
 * tính damage (xem CombatSystem.resolveActionHit()). > 1 khi source
 * cao cảnh giới hơn target (gây dư sát thương), < 1 khi thấp hơn (gây
 * thiếu sát thương), = 1 khi cùng cảnh giới.
 */
export function getRealmPressureMultiplier(source: CombatEntity, target: CombatEntity): number {
  const gap = clamp(source.realmIndex - target.realmIndex, -MAX_REALM_GAP, MAX_REALM_GAP)

  if (gap === 0) {
    return 1
  }

  const grade = resolveWeakerSideGrade(source, target, gap)

  const pressureRemaining = clamp(1 - (grade - 1) * PRESSURE_REMAINING_PER_GRADE_STEP, 0, 1)

  if (gap > 0) {
    return 1 + gap * HIGH_TO_LOW_PRESSURE_PER_GAP * pressureRemaining
  }

  const lowered = 1 - Math.abs(gap) * LOW_TO_HIGH_PRESSURE_PER_GAP * pressureRemaining

  return clamp(lowered, LOW_TO_HIGH_MULTIPLIER_FLOOR, 1)
}
