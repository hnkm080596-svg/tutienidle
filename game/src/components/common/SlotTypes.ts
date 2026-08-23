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

// Badge nhỏ ở layer 6 (mục 17.3) — thay cho các span tự absolute-
// position bên ngoài Slot (vd .paperdoll__enhance-badge cũ).
export type SlotBadgeKind = 'enhance' | 'equipped' | 'new' | 'comparison'

export interface SlotBadge {
  kind: SlotBadgeKind
  text: string
  tone?: 'default' | 'positive' | 'negative'
}
