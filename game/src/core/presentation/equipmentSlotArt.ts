import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'

// Art moi slot (Minh ve 2026-10-11): hinh ve 6 slot trang bi - dung
// lam fallback khi o socket khong co do (paperdoll) va cell chieu slot
// trong Cuong Hoa, thay cho fallback chu truoc day.
const EQUIPMENT_SLOT_ART: Record<EquipmentSlot, string> = {
  weapon: '/assets/ui/tien-hiep-2026-10/controls/equipment-slot-weapon-v1.png',
  helmet: '/assets/ui/tien-hiep-2026-10/controls/equipment-slot-helmet-v1.png',
  armor: '/assets/ui/tien-hiep-2026-10/controls/equipment-slot-armor-v1.png',
  boots: '/assets/ui/tien-hiep-2026-10/controls/equipment-slot-boots-v1.png',
  ring: '/assets/ui/tien-hiep-2026-10/controls/equipment-slot-ring-v1.png',
  necklace: '/assets/ui/tien-hiep-2026-10/controls/equipment-slot-necklace-v1.png',
}

export function equipmentSlotArt(slot: EquipmentSlot | string): string | undefined {
  return EQUIPMENT_SLOT_ART[slot as EquipmentSlot]
}
