import type { Equipment } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import type { ZoneRegistry } from '../stage/ZoneRegistry'
import type { NameSegment } from '../item/NameSegment'
import { ITEM_QUALITY_SHORT_LABELS } from '../item/ItemQuality'

// Composed name "{Chat} - {Name}". Structure owner only — display
// color is the payload's nameColorVar (item-info-card spec 2026-09-14).
// Pham no longer leads the name; it renders as the tooltip "Canh gioi"
// line instead. Used by tooltips (useEquipmentTooltip.ts), slot
// captions (EquipmentBagSection.vue/EquipmentPaperdoll.vue) and loot
// notifications.
export function composeEquipmentNameSegments(
  instance: EquipmentInstance,
  template: Equipment,
  zoneRegistry: ZoneRegistry,
): NameSegment[] {
  const zoneName =
    instance.zoneId && zoneRegistry.has(instance.zoneId)
      ? `${zoneRegistry.get(instance.zoneId).name} `
      : ''

  return [
    { text: ITEM_QUALITY_SHORT_LABELS[instance.quality] },
    { text: `- ${zoneName}${template.name}` },
  ]
}

// Tên đầy đủ dạng CHUỖI PHẲNG (không màu) — dùng cho chỗ chỉ nhận
// string, vd tiêu đề tooltip (useEquipmentTooltip.ts). Từ vật phẩm
// KHÔNG còn tên riêng (2026-08-15) nên bản thân `template.name` một
// mình (vd "Kiếm") không đủ mô tả — ghép đủ cả 2 segment mới đúng tên
// hiển thị thật.
export function composeEquipmentDisplayName(
  instance: EquipmentInstance,
  template: Equipment,
  zoneRegistry: ZoneRegistry,
): string {
  return composeEquipmentNameSegments(instance, template, zoneRegistry)
    .map((segment) => segment.text)
    .join(' ')
}
