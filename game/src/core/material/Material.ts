import type { ProfessionMaterialMeta } from '../profession/ProfessionMaterial'
import type { SourceType } from './SourceType'
import type { ElementType } from '../element/ElementType'

// "tunghematandsuch" pass (2026-08-14) — thêm 'wood' (Linh Mộc, chế
// Phù) và 'byproduct' (Bụi Cốt/Tinh Luyện Cốt, phế liệu từ Luyện
// Khí/Cường Hóa) — 2 nhóm mới hoàn toàn, chưa có category nào khớp.
export type MaterialCategory =
  'herb' | 'wood' | 'ore' | 'monster_core' | 'spirit_stone' | 'essence' | 'byproduct' | 'other'

/**
 * "tunghematandsuch" pass (mục 3) — cố ý giữ TỐI GIẢN
 * (name/category/years/element/sourceType/description), KHÔNG thêm
 * Rarity/Quality/Grade/Purity/Potential — tránh lặp lại chồng chéo
 * Quality+Rarity+phẩm chất+niên đại mà tài liệu cảnh báo. `grade:
 * number` cũ đã XOÁ (confirmed không nơi nào trong code đọc field
 * này, thuần authoring — không mất logic gì). Tài liệu còn đề xuất
 * `BaseValue` (giá trị kinh tế) nhưng game CHƯA có hệ thống vendor/
 * pricing nào tiêu thụ nó — bỏ qua field này, tránh lặp lại lỗi
 * "material chết" (field không ai đọc) đã rút kinh nghiệm ở lượt
 * naming-principles trước.
 */
export interface Material {
  id: string

  name: string

  category: MaterialCategory

  // "Niên đại" (tài liệu mục 1-2, 6-7) — trục sức mạnh của nguyên liệu
  // tự nhiên (Linh Thảo/Linh Mộc/Linh Thiết), KHÔNG phải 1 loại
  // Quality riêng — quyết định TRẦN phẩm cấp tối đa mà 1 công thức
  // dùng nguyên liệu này có thể đạt tới (xem data/alchemy/alchemyRecipes.ts).
  // Không khai = không áp dụng trục niên đại (material Yêu Tài/phế
  // liệu/currency đặc thù khác).
  years?: number

  element?: ElementType

  // Nguồn CHÍNH của material này (MASTER SPEC Mục II-V) — xem
  // SourceType.ts's ghi chú: nhãn phân loại, không phải ràng buộc
  // cứng chỉ nguồn đó mới được rơi.
  sourceType: SourceType

  description?: string

  // Metadata nghề (2026-08-24, resource-professions-rework plan §4.1) —
  // optional nên save/legacy material không có vẫn load bình thường;
  // consumer mới (catalog/reward/recipe/validator) bắt buộc material có
  // meta đầy đủ.
  profession?: ProfessionMaterialMeta

  // PNG icon của template; không nằm trong save stack nên có thể bổ sung
  // dần mà không cần migration.
  icon?: string

  // Trần stack riêng (plan Workstream F) — undefined = MAX_STACK_AMOUNT
  // chung. Linh Thạch đặt MAX_SAFE_INTEGER vì chi phí Đột Phá scale tới
  // hàng tỷ; MaterialBag.add() đọc field này lúc clamp.
  stackLimit?: number
}
