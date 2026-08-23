import type { Equipment } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import type { ZoneRegistry } from '../stage/ZoneRegistry'
import type { NameSegment } from '../item/NameSegment'
import { EQUIPMENT_RARITY_LABELS } from './EquipmentRarity'

// Tên vật phẩm ghép động: [Phẩm] · [Địa Giới + Từ loại], mỗi phần tô màu riêng.
// Dùng chung cho tooltip (useEquipmentTooltip.ts) VÀ caption trên
// SlotView (EquipmentBagSection.vue/EquipmentPaperdoll.vue).
export function composeEquipmentNameSegments(
  instance: EquipmentInstance,
  template: Equipment,
  zoneRegistry: ZoneRegistry,
): NameSegment[] {
  const segments: NameSegment[] = [
    { text: EQUIPMENT_RARITY_LABELS[instance.rarity], colorVar: `--item-rarity-${instance.rarity}`, tone: instance.rarity },
  ]

  const zoneName = instance.zoneId && zoneRegistry.has(instance.zoneId)
    ? `${zoneRegistry.get(instance.zoneId).name} `
    : ''

  segments.push({ text: `${zoneName}${template.name}`, colorVar: `--rarity-${instance.quality}`, tone: instance.quality })

  return segments
}

// Tên đầy đủ dạng CHUỖI PHẲNG (không màu) — dùng cho chỗ chỉ nhận
// string, vd tiêu đề tooltip (useEquipmentTooltip.ts). Từ vật phẩm
// KHÔNG còn tên riêng (2026-08-15) nên bản thân `template.name` một
// mình (vd "Kiếm") không đủ mô tả — ghép đủ cả 3 segment mới đúng tên
// hiển thị thật.
export function composeEquipmentDisplayName(
  instance: EquipmentInstance,
  template: Equipment,
  zoneRegistry: ZoneRegistry,
): string {
  return composeEquipmentNameSegments(instance, template, zoneRegistry)
    .map(segment => segment.text)
    .join(' · ')
}
