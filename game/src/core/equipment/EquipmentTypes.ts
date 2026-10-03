export type EquipmentSlot = 'weapon' | 'helmet' | 'armor' | 'boots' | 'ring' | 'necklace'

// Trich tu EquipmentHallPanel.vue (2026-08-15, tooltip Equipment dung
// chung).
export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Vũ Khí',
  helmet: 'Mũ',
  armor: 'Giáp',
  boots: 'Giày',
  ring: 'Nhẫn',
  necklace: 'Dây Chuyền',
}
