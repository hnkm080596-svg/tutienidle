// Slot Revamp (tooltip-revamp-plan.md mục 17.2) — trục semantic loại
// trừ lẫn nhau thay vì danh sách boolean độc lập có thể mâu thuẫn.
// Precedence thật sự nằm trong SlotView.vue (đọc comment ở đó), file
// này chỉ khai type dùng chung cho SlotView + mọi consumer.
export type SlotAvailability = 'available' | 'disabled' | 'locked'
export type SlotInteraction = 'idle' | 'selected' | 'processing'
export type SlotValidation = 'neutral' | 'valid' | 'invalid' | 'missing'
export type SlotMarker = 'none' | 'equipped' | 'new'
export type SlotComparison = 'neutral' | 'upgrade' | 'downgrade'

export interface SlotPresentationState {
  availability?: SlotAvailability
  interaction?: SlotInteraction
  validation?: SlotValidation
  marker?: SlotMarker
  comparison?: SlotComparison
}

// Slot Variant (2026-09-15 ruling, consolidated spec) - backdrop/hover
// art is a per-PLACE modification, declared via the `variant` prop
// instead of scattered --slot-* overrides in consumers (one owner:
// SlotView).
//   item      = default, EVERY item-holding cell (bag tabs, Qi hall
//               pickers, codex, combat...): flat dark tile backdrop
//               inv-slot-backdrop.png + bright sheen hover
//               bag-slot-hover.png ("cell select").
//   equipment = ONLY the 6 worn equipment slots (paperdoll): frosted
//               glass slot-backdrop.png ("empty" - reads faintly on
//               the dark backdrop) + pale gold frame hover
//               slot-frame-hover.png ("click").
// Item hover fits the cell edge exactly (inset 0, 100% 100%); the
// equipment gold frame bakes ~2-3% transparent padding into its PNG
// edges, so it overshoots via --slot-hover-inset: -4% to land the
// bright stroke on the slot border. equip-slot-backdrop.png (stray
// metal rim) + equip-slot-hover.png (black 293x134 banner cut from
// the wrong region) were removed.
export type SlotVariant = 'item' | 'equipment'

// Badge nhỏ ở layer 6 (mục 17.3) — thay cho các span tự absolute-
// position bên ngoài Slot (vd .paperdoll__enhance-badge cũ).
export type SlotBadgeKind = 'enhance' | 'equipped' | 'new' | 'comparison'

export interface SlotBadge {
  kind: SlotBadgeKind
  text: string
  tone?: 'default' | 'positive' | 'negative'
}

// Props snapshot a tooltip card's static SlotView header binds verbatim
// (item-info-card spec section 3) - builders emit this bag, ItemCardBody does
// `v-bind="content.slotPreview"` onto a `static` SlotView so the card
// preview IS the slot (seal + Chat edge included).
export interface SlotPreviewProps {
  icon?: string
  label?: string
  accessibleLabel?: string
  amount?: number
  equipmentQualityRank?: number
  rarityRank?: number
  rarityRankScale?: 5 | 10
  badges?: readonly SlotBadge[]
  state?: SlotPresentationState
  variant?: SlotVariant
}
