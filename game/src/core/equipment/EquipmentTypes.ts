export type EquipmentSlot = 'weapon' | 'helmet' | 'armor' | 'boots' | 'ring' | 'necklace'

// Trích từ EquipmentHallPanel.vue (2026-08-15, tooltip Equipment dùng
// chung).
export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Vũ Khí',
  helmet: 'Mũ',
  armor: 'Giáp',
  boots: 'Giày',
  ring: 'Nhẫn',
  necklace: 'Dây Chuyền',
}
