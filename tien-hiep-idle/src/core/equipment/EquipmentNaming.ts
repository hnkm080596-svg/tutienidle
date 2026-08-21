import type { Equipment } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import type { EquipmentSetRegistry } from './EquipmentSetRegistry'
import type { ZoneRegistry } from '../stage/ZoneRegistry'
import type { NameSegment } from '../item/NameSegment'
import { PHAM_LABELS } from '../item/Pham'

// Tên vật phẩm ghép động (2026-08-15) — 3 segment, mỗi phần tô màu
// riêng: [Phẩm] · [Set, nếu template có setId] · [Địa Giới + Tên gốc].
// Dùng chung cho tooltip (useEquipmentTooltip.ts) VÀ caption trên
// SlotView (EquipmentBagSection.vue/EquipmentPaperdoll.vue).
export function composeEquipmentNameSegments(
  instance: EquipmentInstance,
  template: Equipment,
  zoneRegistry: ZoneRegistry,
  setRegistry: EquipmentSetRegistry,
): NameSegment[] {
  const segments: NameSegment[] = [
    { text: PHAM_LABELS[instance.rarity], colorVar: `--item-rarity-${instance.rarity}` },
  ]

  if (template.setId && setRegistry.has(template.setId)) {
    const set = setRegistry.get(template.setId)

    segments.push({ text: set.name, colorVar: set.colorVar })
  }

  const zoneName = instance.zoneId && zoneRegistry.has(instance.zoneId)
    ? `${zoneRegistry.get(instance.zoneId).name} `
    : ''

  segments.push({ text: `${zoneName}${template.name}`, colorVar: `--rarity-${instance.quality}` })

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
  setRegistry: EquipmentSetRegistry,
): string {
  return composeEquipmentNameSegments(instance, template, zoneRegistry, setRegistry)
    .map(segment => segment.text)
    .join(' · ')
}
