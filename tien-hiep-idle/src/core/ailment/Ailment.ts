import type { AilmentCategory, AilmentCcEffect, AilmentId, AilmentStackMode } from './AilmentTypes'
import type { StatType } from '../stats/StatTypes'
import type { ElementType } from '../element/ElementType'

/**
 * 1 hiệu ứng ailment đang active trên 1 entity — tách hẳn khỏi Buff
 * (chỉ đổi stat) vì Ailment cần 2 hành vi Buff không có: DoT (tự trừ
 * HP theo thời gian, độc lập với StatModifier) và CC (Choáng/Đóng
 * Băng chặn hẳn hành động/di chuyển — không diễn tả được bằng
 * StatModifier). Làm Chậm là ngoại lệ — tuy là CC nhưng biểu diễn
 * được bằng StatModifier (giảm % attackSpeed/movementSpeed), xem
 * AilmentSystem.getActiveModifiers().
 *
 * `id` chính là AilmentId — 1 entity chỉ có TỐI ĐA 1 instance mỗi
 * loại ailment tại 1 thời điểm (giống Buff.id dùng làm khoá lookup),
 * áp thêm lần nữa thì xử lý theo stackMode thay vì tạo instance mới.
 */
export interface Ailment {
  id: AilmentId

  category: AilmentCategory

  sourceId: string

  targetId: string

  duration: number

  remainingTime: number

  stacks: number

  maxStacks?: number

  stackMode: AilmentStackMode

  // DoT — snapshot 1 LẦN lúc áp dụng (không đọc lại stats nguồn mỗi
  // tick, xem AilmentSystem.apply()) — rẻ, ổn định kể cả khi nguồn
  // đã chết/đổi buff giữa chừng. Damage MỖI GIÂY cho 1 stack; tổng
  // damage/giây = damagePerSecond * stacks.
  damagePerSecond?: number

  // Plans/magicpathgeneral Phase 9/11 (2026-08-21) — snapshot từ
  // AilmentTemplate.element lúc áp (xem AilmentSystem.apply()), dùng
  // để CombatSystem.applyDotDamage() biết DOT RES penetration nào
  // áp dụng (Kim Thế chỉ xuyên kháng DoT 'metal') và Poison Recovery
  // có kích hoạt không (chỉ DoT 'wood'), KHÔNG cần tra lại registry
  // mỗi tick.
  element?: ElementType | 'physical'

  // CC — chỉ Choáng/Đóng Băng (chặn hành động/di chuyển hẳn).
  ccEffect?: AilmentCcEffect

  // 'modifier' — StatModifier phát sinh khi ailment còn active (Làm
  // Chậm/Cuồng Bạo/Suy Nhược/Uy Áp/Hàn Khí), xem
  // AilmentSystem.getActiveModifiers(). Tổng quát hoá field
  // `slowPercent` cũ (chỉ diễn tả được đúng 1 kiểu debuff).
  statModifiers?: { stat: StatType; percent?: number; flat?: number }[]

  // Pháp Tu (Thủy Tu, 2026-08-15) — tổng số giây ailment NÀY đã liên
  // tục active trên target, KHÔNG reset khi refresh/stack (chỉ reset
  // về 0 khi thật sự bị xoá rồi áp lại từ đầu) — dùng để chuyển hoá
  // theo THỜI GIAN (Làm Chậm giữ >2s -> Đóng Băng), khác hẳn
  // convertsToOnMaxStacks cũ (chuyển hoá theo SỐ LẦN áp). `convertsToId`/
  // `convertsAfterContinuousSeconds` snapshot từ AilmentTemplate ngay
  // lúc tạo instance (xem AilmentSystem.apply()) để update() không cần
  // giữ registry suốt vòng đời — chỉ cần registry khi THẬT SỰ chuyển
  // hoá (tra template đích, xem AilmentSystem.convertAilment()).
  continuousSeconds: number

  convertsToId?: AilmentId

  convertsAfterContinuousSeconds?: number

  // Mộc Tu Trúc Cơ Pure ("Mộc Thế" major, Plans/PoisonPath mục 8,
  // 2026-08-21 — tên hiển thị đổi thành "Mộc Thế" từ "Độc Căn" theo
  // Plans/magicpathgeneral Phase 7/8, field GIỮ NGUYÊN) — snapshot 1
  // LẦN lúc áp (cùng tinh thần damagePerSecond ở trên, KHÔNG cập nhật
  // lại khi stackMode 'stack' re-apply — xem AilmentSystem.apply()).
  // Nhân thêm vào damage/giây theo số tầng hiện có (đọc từ
  // `continuousSeconds`, xem AilmentSystem.update()), undefined/0 =
  // tắt hẳn cơ chế (mọi ailment khác Trúng Độc không có nguồn cấp nào
  // cho stat này nên vô hại).
  poisonRootPercentPerStack?: number

  poisonRootMaxStacks?: number

  poisonRootThresholdBonusPercent?: number

  // Thổ Tu (Thạch Hóa, Plans/magicpathgeneral, 2026-08-21) — snapshot
  // từ AilmentTemplate lúc áp, xem AilmentRegistry.ts's ghi chú +
  // AilmentSystem.rollOnHitEffects().
  onHitChance?: number

  onHitAppliesAilmentId?: AilmentId
}
