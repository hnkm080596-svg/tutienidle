import type { Equipment } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import type { ZoneRegistry } from '../stage/ZoneRegistry'
import type { NameSegment } from '../item/NameSegment'
import { composeItemQualityNameSegments } from '../item/ItemQuality'
import { PROFESSION_GRADE_NAMES } from '../profession/ProfessionGrade'
import { professionGradeRank } from '@/composables/slots/normalizeSlotRank'

// Tên vật phẩm ghép động (Rework P6, Task 21) — 2 TRỤC riêng biệt, mỗi
// phần tô màu riêng theo ĐÚNG thang rank của trục đó:
//   [Phẩm Nghề (ProfessionGrade, 10 bậc)] · [Chất (ItemQuality, 5 bậc)
//   + Địa Giới/Từ loại]
// Dùng chung cho tooltip (useEquipmentTooltip.ts) VÀ caption trên
// SlotView (EquipmentBagSection.vue/EquipmentPaperdoll.vue).
export function composeEquipmentNameSegments(
  instance: EquipmentInstance,
  template: Equipment,
  zoneRegistry: ZoneRegistry,
): NameSegment[] {
  const gradeSegment: NameSegment = {
    text: PROFESSION_GRADE_NAMES[instance.grade],
    colorVar: `--rank-color-${professionGradeRank(instance.grade)}`,
    tone: instance.grade,
  }

  const zoneName =
    instance.zoneId && zoneRegistry.has(instance.zoneId)
      ? `${zoneRegistry.get(instance.zoneId).name} `
      : ''

  return [gradeSegment, ...composeItemQualityNameSegments(`${zoneName}${template.name}`, instance.quality)]
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
    .map((segment) => segment.text)
    .join(' · ')
}
