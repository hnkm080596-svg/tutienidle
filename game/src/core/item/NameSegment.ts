// Composed item name segments (item-info-card spec 2026-09-14): text
// structure ONLY - the single display color now lives on the tooltip /
// toast payload (nameColorVar/nameTone), not per segment. Used by
// SlotView's nameSegments prop (aria + opt-in caption), EquipmentNaming
// and ItemGrade compose functions.
export interface NameSegment {
  text: string
}
