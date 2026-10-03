import type { TooltipContent } from '@/composables/useTooltip'
import type { NameSegment } from '@/core/item/NameSegment'
import type { SlotPresentationState } from '@/components/common/SlotTypes'

// Shape dung chung cho moi bag-section (tach tu BagGrid.vue, xem
// composables/useBagPagination.ts) - moi section tu map du lieu bag
// rieng (equipment/material/pill/talisman/formation) ve shape nay de
// SlotView render dong nhat.
export interface BagCell {
  key: string

  label: string

  // Accessible name override (item-info-card spec section 5b) - "Name, Pham"
  // so the grade is readable without color; SlotView binds it onto
  // aria-label in place of `label`.
  accessibleLabel?: string

  description?: string

  amount?: number

  selected?: boolean

  // Rank chuan hoa 1-9 (xem core/profession/slotRank.ts) -
  // truyen thang vao SlotView.vue's prop `equipmentQualityRank`/`rarityRank`.
  equipmentQualityRank?: number

  rarityRank?: number

  // Tran cua thang `rarityRank` - CHI MaterialBagSection.vue truyen
  // (10, vi material feed professionRankOf 1-10 vao rarityRank thay vi
  // itemQualityRank 1-5); moi section khac bo trong = mac dinh 5 o
  // SlotView.vue (Fix 1, final review item-grade-quality-rework).
  rarityRankScale?: 5 | 10

  // Marker/comparison (equipped, upgrade/downgrade) - chi Equipment
  // bag section dung, xem SlotView.vue's prop `state`.
  state?: SlotPresentationState

  onClick?: () => void

  // Tooltip co cau truc (2026-08-15) - uu tien hon label/description
  // neu co, xem SlotView.vue's prop `tooltip`.
  tooltip?: TooltipContent

  // Anh rieng cua item - doc tu field `icon` khai NGAY TREN data item
  // (Equipment/Pill/Talisman/Formation/Technique, xem core/assets/
  // AssetPaths.ts's ghi chu), truyen thang vao SlotView.vue's prop
  // `icon`.
  icon?: string

  // Composed name shown as the slot caption (2026-08-15) - wins over
  // `label` when present, see SlotView.vue's prop `nameSegments`.
  // Segments carry text only; name color lives on the tooltip payload
  // (item-info-card refactor).
  nameSegments?: NameSegment[]
}
