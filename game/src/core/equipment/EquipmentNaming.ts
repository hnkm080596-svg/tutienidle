import type { Equipment } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import type { ZoneRegistry } from '../stage/ZoneRegistry'
import type { NameSegment } from '../item/NameSegment'
import { ITEM_QUALITY_SHORT_LABELS } from '../item/ItemQuality'

// Composed name "{Chat} - {Name}". Structure owner only - display
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

// Flat-string form of the full composed name (no segments) - for
// consumers that only take a string, e.g. the tooltip title
// (useEquipmentTooltip.ts). Items no longer carry unique names
// (2026-08-15), so `template.name` alone (e.g. "Kiem") is not
// descriptive enough - both segments must be joined for the real
// display name.
export function composeEquipmentDisplayName(
  instance: EquipmentInstance,
  template: Equipment,
  zoneRegistry: ZoneRegistry,
): string {
  return composeEquipmentNameSegments(instance, template, zoneRegistry)
    .map((segment) => segment.text)
    .join(' ')
}
