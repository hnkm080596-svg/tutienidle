// Workstream B (gameplay-ui-feedback-responsive-cleanup-plan.md §5) —
// resolver trình bày dùng chung, thay cho việc component tự fallback
// thẳng về ID/enum khi thiếu entry trong registry.
import type { MaterialRegistry } from '@/core/material/MaterialRegistry'
import type { AffixRegistry } from '@/core/equipment/AffixRegistry'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'
import type { EquipmentQuality } from '@/core/equipment/EquipmentQuality'
import type { EquipmentRarity } from '@/core/equipment/EquipmentRarity'
import { EQUIPMENT_SLOT_LABELS } from '@/core/equipment/EquipmentTypes'
import { EQUIPMENT_QUALITY_LABELS } from '@/core/equipment/EquipmentQuality'
import { EQUIPMENT_RARITY_LABELS } from '@/core/equipment/EquipmentRarity'
import { REALMS } from '@/data/realms/realm'

const UNKNOWN_DATA_LABEL = 'Dữ liệu không hợp lệ'

export function materialLabel(id: string, registry: MaterialRegistry): string {
  return registry.has(id) ? registry.get(id).name : UNKNOWN_DATA_LABEL
}

export function affixLabel(affixId: string, registry: AffixRegistry): string {
  return registry.has(affixId) ? registry.get(affixId).name : UNKNOWN_DATA_LABEL
}

export function equipmentSlotLabel(slot: EquipmentSlot | string): string {
  return (EQUIPMENT_SLOT_LABELS as Record<string, string>)[slot] ?? UNKNOWN_DATA_LABEL
}

export function equipmentQualityLabel(quality: EquipmentQuality | string): string {
  return (EQUIPMENT_QUALITY_LABELS as Record<string, string>)[quality] ?? UNKNOWN_DATA_LABEL
}

export function equipmentRarityLabel(rarity: EquipmentRarity | string): string {
  return (EQUIPMENT_RARITY_LABELS as Record<string, string>)[rarity] ?? UNKNOWN_DATA_LABEL
}

export function realmLabel(realmId: string): string {
  return REALMS.find((realm) => realm.id === realmId)?.name ?? UNKNOWN_DATA_LABEL
}
