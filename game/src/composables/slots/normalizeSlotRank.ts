// Slot Revamp (tooltip-revamp-plan.md mục 17.5) — SlotView không được
// biết ID domain (vd 'hoang'/'tien_pham'); mọi consumer tự chuẩn hoá về
// rank số nguyên qua các hàm này TRƯỚC khi truyền prop qualityRank/rarityRank.
// Cùng thang --rank-color-1..10 (assets/theme.css).
//
// Rework P6 (item-grade-quality-rework, Task 20) — mô hình 2 trục CHUẨN:
//   - "Grade" = Phẩm Nghề (ProfessionGrade, 10 bậc Cửu Phẩm→Tiên Phẩm,
//     theo đại cảnh giới) → rank 1-10, ánh xạ 1:1, KHÔNG clamp (bậc 10
//     mới thêm dùng --rank-color-10/--rank-gradient-10 riêng).
//   - "Quality" = Phẩm Chất vật phẩm (ItemQuality, 5 bậc Hoàng→Tiên) →
//     rank 1-5, ánh xạ 1:1 (dải riêng, KHÔNG rải đều lên 1-3-5-7-9 như
//     model cũ — xem ItemQuality.ts's composeItemQualityNameSegments đã
//     dùng đúng quy ước này từ Task 1).
// EquipmentQuality.ts (module cũ, 9 bậc) đã bị XOÁ hẳn (Task 22, đã
// merge). ItemGrade.ts (rải 1-3-5-7-9) KHÔNG bị xoá — nó là trục Phẩm
// riêng, VĨNH VIỄN, cho Đan/Phù/Trận (Pill/Talisman/Formation), không
// liên quan gì tới 2 trục equipment-only ở file này (professionGradeRank/
// itemQualityRank). Không dùng ItemGrade.ts ở đây không phải vì nó
// "chưa xoá" — nó ở lại vì phục vụ 1 domain hoàn toàn khác.
import { ITEM_QUALITY_ORDER, type ItemQuality } from '@/core/item/ItemQuality'
import { PROFESSION_GRADE_ORDER, type ProfessionGrade } from '@/core/profession/ProfessionGrade'

// 5 bậc Phẩm Chất vật phẩm (Hoàng/Huyền/Địa/Thiên/Tiên) ánh xạ 1:1 vào rank 1-5.
export function itemQualityRank(quality: ItemQuality): number {
  return ITEM_QUALITY_ORDER.indexOf(quality) + 1
}

// Phẩm nghề (Cửu Phẩm→Tiên Phẩm, 10 bậc) ánh xạ 1:1 vào rank 1-10 — KHÔNG
// còn clamp về 9 (bậc 10 "Tiên Phẩm" giờ có màu/gradient riêng, xem theme.css).
export function professionGradeRank(grade: ProfessionGrade): number {
  return PROFESSION_GRADE_ORDER.indexOf(grade) + 1
}

// Cho nơi chỉ có sẵn NameSegment.tone (string, không rõ nguồn) — thử cả
// 2 thang thay vì hardcode literal bậc cao nhất của từng thang.
export function isMaxRankTone(tone?: string): boolean {
  if (!tone) return false

  if ((ITEM_QUALITY_ORDER as readonly string[]).includes(tone)) {
    return itemQualityRank(tone as ItemQuality) === ITEM_QUALITY_ORDER.length
  }

  if ((PROFESSION_GRADE_ORDER as readonly string[]).includes(tone)) {
    return professionGradeRank(tone as ProfessionGrade) === PROFESSION_GRADE_ORDER.length
  }

  return false
}
