import type { TooltipContent } from '@/composables/useTooltip'
import type { NameSegment } from '@/core/item/NameSegment'
import type { SlotPresentationState } from '@/components/common/SlotTypes'

// Shape dùng chung cho mọi bag-section (tách từ BagGrid.vue, xem
// composables/useBagPagination.ts) — mỗi section tự map dữ liệu bag
// riêng (equipment/material/pill/talisman/formation) về shape này để
// SlotView render đồng nhất.
export interface BagCell {
  key: string

  label: string

  description?: string

  amount?: number

  selected?: boolean

  // Rank chuẩn hoá 1-9 (xem composables/slots/normalizeSlotRank.ts) —
  // truyền thẳng vào SlotView.vue's prop `equipmentQualityRank`/`rarityRank`.
  equipmentQualityRank?: number

  rarityRank?: number

  // Trần của thang `rarityRank` — CHỈ MaterialBagSection.vue truyền
  // (10, vì material feed professionRankOf 1-10 vào rarityRank thay vì
  // itemQualityRank 1-5); mọi section khác bỏ trống = mặc định 5 ở
  // SlotView.vue (Fix 1, final review item-grade-quality-rework).
  rarityRankScale?: 5 | 10

  // Marker/comparison (equipped, upgrade/downgrade) — chỉ Equipment
  // bag section dùng, xem SlotView.vue's prop `state`.
  state?: SlotPresentationState

  onClick?: () => void

  // Tooltip có cấu trúc (2026-08-15) — ưu tiên hơn label/description
  // nếu có, xem SlotView.vue's prop `tooltip`.
  tooltip?: TooltipContent

  // Ảnh riêng của item — đọc từ field `icon` khai NGAY TRÊN data item
  // (Equipment/Pill/Talisman/Formation/Technique, xem core/assets/
  // AssetPaths.ts's ghi chú), truyền thẳng vào SlotView.vue's prop
  // `icon`.
  icon?: string

  // Tên ghép động, nhiều đoạn tô màu riêng (2026-08-15) — ưu tiên HƠN
  // `label` nếu có, xem SlotView.vue's prop `nameSegments`.
  nameSegments?: NameSegment[]
}
