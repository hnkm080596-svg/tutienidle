import type { TooltipContent } from '@/composables/useTooltip'
import type { NameSegment } from '@/core/item/NameSegment'

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

  rarity?: string

  itemRarity?: string

  onClick?: () => void

  // Tooltip có cấu trúc (2026-08-15) — ưu tiên hơn label/description
  // nếu có, xem SlotView.vue's prop `tooltip`.
  tooltip?: TooltipContent

  // Ảnh riêng của item — đọc từ field `icon` khai NGAY TRÊN data item
  // (Equipment/Pill/Talisman/Formation/Technique, xem core/assets/
  // AssetPaths.ts's ghi chú), truyền thẳng vào SlotView.vue's prop
  // `itemIcon`.
  itemIcon?: string

  // Tên ghép động, nhiều đoạn tô màu riêng (2026-08-15) — ưu tiên HƠN
  // `label` nếu có, xem SlotView.vue's prop `nameSegments`.
  nameSegments?: NameSegment[]
}
