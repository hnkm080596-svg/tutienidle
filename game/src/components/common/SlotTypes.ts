// Slot Revamp (tooltip-revamp-plan.md muc 17.2) - truc semantic loai
// tru lan nhau thay vi danh sach boolean doc lap co the mau thuan.
// Precedence that su nam trong SlotView.vue (doc comment o do), file
// nay chi khai type dung chung cho SlotView + moi consumer.
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
//               inv-slot-backdrop.png + pale gold frame hover
//               slot-frame-hover.png ("click").
//   equipment = the Trang Bi scope's cells (owner ruling 2026-10-08):
//               the Codex preview's item-slot-v1.png cell art
//               (backdrop + thin frame in one image) painted via
//               --slot-bg-image + pale gold frame hover.
//   bag       = reserved for the dense Kho Vat / Tru Vat grids; for now
//               shares the same item-slot-v1.png cell art.
// Item hover fits the cell edge exactly (inset 0, 100% 100%); the
// equipment gold frame bakes ~2-3% transparent padding into its PNG
// edges, so it overshoots via --slot-hover-inset: -4% to land the
// bright stroke on the slot border. equip-slot-backdrop.png (stray
// metal rim) + equip-slot-hover.png (black 293x134 banner cut from
// the wrong region) were removed.
//   circle    = ring art (equipment-circle-frame-v1.png); dormant -
//               the doll sockets moved to `socket` on 2026-10-08.
//   socket    = the 6 worn sockets on the reskinned paperdoll (owner
//               ruling 2026-10-08): equipment-socket-v2.png chamfered
//               square art with ornate cloud corners. The seal stamp
//               would sit on the art's top-left cloud, so the variant
//               suppresses it; hover-frame + badges still render.
//               Rank/badge data still flows to tooltip + aria-label.
export type SlotVariant = 'item' | 'equipment' | 'bag' | 'circle' | 'socket'

// Badge nho o layer 6 (muc 17.3) - thay cho cac span tu absolute-
// position ben ngoai Slot (vd .paperdoll__enhance-badge cu).
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
