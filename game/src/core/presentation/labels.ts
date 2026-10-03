// Workstream B (gameplay-ui-feedback-responsive-cleanup-plan.md sec5) -
// resolver trinh bay dung chung, thay cho viec component tu fallback
// thang ve ID/enum khi thieu entry trong registry.
import type { MaterialRegistry } from '@/core/material/MaterialRegistry'
import type { AffixRegistry } from '@/core/equipment/AffixRegistry'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'
import type { ItemQuality } from '@/core/item/ItemQuality'
import type { ProfessionGrade } from '@/core/profession/ProfessionGrade'
import { EQUIPMENT_SLOT_LABELS } from '@/core/equipment/EquipmentTypes'
import { ITEM_QUALITY_LABELS } from '@/core/item/ItemQuality'
import { PROFESSION_GRADE_NAMES } from '@/core/profession/ProfessionGrade'
import { REALMS } from '@/data/realms/realm'

const UNKNOWN_DATA_LABEL = 'Dữ liệu không hợp lệ'

export const SPIRIT_STONE_LABEL = 'Linh Thạch'

export function materialLabel(id: string, registry: MaterialRegistry): string {
  return registry.has(id) ? registry.get(id).name : UNKNOWN_DATA_LABEL
}

export function affixLabel(affixId: string, registry: AffixRegistry): string {
  return registry.has(affixId) ? registry.get(affixId).name : UNKNOWN_DATA_LABEL
}

export function equipmentSlotLabel(slot: EquipmentSlot | string): string {
  return (EQUIPMENT_SLOT_LABELS as Record<string, string>)[slot] ?? UNKNOWN_DATA_LABEL
}

// Rework P6 (item-grade-quality-rework, Task 21) - truc Chat vat pham
// (ItemQuality, 5 bac Hoang->Tien). `equipmentRarityLabel` (truc
// EquipmentRarity cu) da XOA - moi call site chuyen sang ham nay, cung
// 1 truc Chat duy nhat voi ItemQuality.ts's ITEM_QUALITY_LABELS.
export function equipmentQualityLabel(quality: ItemQuality | string): string {
  return (ITEM_QUALITY_LABELS as Record<string, string>)[quality] ?? UNKNOWN_DATA_LABEL
}

// Truc Pham Nghe (ProfessionGrade, 10 bac Cuu Pham->Tien Pham theo dai
// canh gioi) - KHAC truc Chat o tren, xem ProfessionGrade.ts's header.
export function gradeLabel(grade: ProfessionGrade | string): string {
  return (PROFESSION_GRADE_NAMES as Record<string, string>)[grade] ?? UNKNOWN_DATA_LABEL
}

export function realmLabel(realmId: string): string {
  return REALMS.find((realm) => realm.id === realmId)?.name ?? UNKNOWN_DATA_LABEL
}
