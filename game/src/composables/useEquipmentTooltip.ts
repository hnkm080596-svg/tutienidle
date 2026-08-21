import type { Equipment } from '@/core/equipment/Equipment'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { EquipmentSlotState } from '@/core/equipment/EquipmentSlotState'
import type { AffixRegistry } from '@/core/equipment/AffixRegistry'
import type { FormationRegistry } from '@/core/formation/FormationRegistry'
import type { TalismanRegistry } from '@/core/talisman/TalismanRegistry'
import type { ZoneRegistry } from '@/core/stage/ZoneRegistry'
import type { EquipmentSetRegistry } from '@/core/equipment/EquipmentSetRegistry'
import { getMaxForgePoints, GLOBAL_MAX_AFFIXES } from '@/core/equipment/EquipmentSystem'
import { composeEquipmentDisplayName } from '@/core/equipment/EquipmentNaming'
import { EQUIPMENT_QUALITY_LABELS } from '@/core/equipment/EquipmentQuality'
import { EQUIPMENT_SLOT_LABELS } from '@/core/equipment/EquipmentTypes'
import { EQUIPMENT_RARITY_AFFIX_SLOTS } from '@/core/equipment/EquipmentRarity'
import { PHAM_LABELS } from '@/core/item/Pham'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import { statLabel, formatStat } from '@/core/stats/StatLabels'
import type { EquipmentTooltipContent, TooltipSection } from './useTooltip'

// Tooltip Equipment có cấu trúc (2026-08-15) — loại CUỐI trong đợt
// "tooltip theo từng loại item" (Technique/Pill/Talisman/Formation/
// Equipment). Build TỪ ĐÚNG EquipmentInstance + Equipment template
// thật, không bịa số. Tách hàm dùng chung ở đây (khác 4 loại trước tự
// build tại chỗ trong component) vì CẢ EquipmentBagSection.vue LẪN
// EquipmentPaperdoll.vue đều cần — 2 component, không có 1 nơi hiển
// nhiên để đặt hàm cục bộ.
//
// `slotState` = null cho đồ CHƯA trang bị trong túi (Cường Hóa/Trận
// Pháp/Phù Chú gắn theo SLOT nhân vật chứ không theo item cụ thể, xem
// EquipmentSlotState.ts — 1 món đồ nằm im trong túi KHÔNG thừa hưởng
// cấp Cường Hóa/Trận Pháp/Phù Chú của slot đó, chỉ món ĐANG MẶC mới
// thật sự có những thứ này).
export function buildEquipmentTooltip(
  instance: EquipmentInstance,
  template: Equipment,
  affixRegistry: AffixRegistry,
  slotState: EquipmentSlotState | null,
  formationRegistry: FormationRegistry,
  talismanRegistry: TalismanRegistry,
  zoneRegistry: ZoneRegistry,
  setRegistry: EquipmentSetRegistry,
): EquipmentTooltipContent {
  const mainStatValue = formatStat(instance.mainStat.stat, instance.mainStat.flat ?? 0)
  const mainStatRange = `${formatStat(template.mainStat.stat, template.mainStat.min)}~${formatStat(template.mainStat.stat, template.mainStat.max)}`

  const sections: TooltipSection[] = [
    {
      label: 'Chỉ Số Chính',

      // Giá trị thật đã roll+scale theo cảnh giới lúc rớt (instance.mainStat)
      // — phạm vi gốc trong ngoặc là range của TEMPLATE (Equipment.mainStat),
      // CHƯA scale, chỉ để tham khảo tương đối giữa các item cùng loại.
      rows: [{ label: statLabel(instance.mainStat.stat), value: `+${mainStatValue} (gốc ${mainStatRange})` }],
    },
  ]

  const rarityAffixCap = EQUIPMENT_RARITY_AFFIX_SLOTS[instance.rarity]
  const bonusAffixSlots = slotState?.bonusAffixSlots ?? 0
  const affixCapacity = Math.min(GLOBAL_MAX_AFFIXES, rarityAffixCap.prefix + rarityAffixCap.suffix + bonusAffixSlots)

  if (instance.affixes.length > 0 || affixCapacity > 0) {
    sections.push({
      label: `Chỉ Số Phụ (${instance.affixes.length}/${affixCapacity})`,

      rows: instance.affixes.map(rolled => {
        const affix = affixRegistry.get(rolled.affixId)

        return {
          label: `${affix.name} (${affix.kind === 'prefix' ? 'Tiền Tố' : 'Hậu Tố'})`,

          value: `+${formatStat(affix.stat, rolled.value)} (Bậc ${rolled.tier})`,
        }
      }),
    })
  }

  const forgeRows: { label: string; value: string }[] = []

  const enhanceLevel = slotState?.enhanceLevel ?? 0

  if (enhanceLevel > 0) {
    forgeRows.push({ label: 'Cường Hóa', value: `+${enhanceLevel}/${template.maxEnhanceLevel}` })
  }

  const maxForgePoints = getMaxForgePoints(instance.quality, instance.forgePotential)

  if (maxForgePoints > 0) {
    forgeRows.push({ label: 'Điểm Rèn', value: `${instance.forgePoints}/${maxForgePoints}` })
  }

  if (forgeRows.length > 0) {
    sections.push({ label: 'Đầu Tư', rows: forgeRows })
  }

  // Trận Pháp/Phù Chú gắn theo SLOT (xem ghi chú trên) — CHỈ hiện khi
  // món này đang thật sự mặc (slotState !== null). socketedFormation
  // trong thực tế chỉ tồn tại ở slot 'weapon' (FormationSystem.socket()
  // hardcode 'weapon'), nhưng đọc thẳng slotState thay vì check
  // instance.slot === 'weapon' để không tự áp đặt luật đó ở đây.
  const socketRows: { label: string; value: string }[] = []

  if (slotState?.socketedFormation) {
    const formationId = slotState.socketedFormation.formationId

    socketRows.push({
      label: 'Trận Pháp',

      value: formationRegistry.has(formationId) ? formationRegistry.get(formationId).name : formationId,
    })
  }

  if (slotState && slotState.appliedTalismanIds.length > 0) {
    socketRows.push({
      label: 'Phù Chú',

      value: slotState.appliedTalismanIds
        .map(id => (talismanRegistry.has(id) ? talismanRegistry.get(id).name : id))
        .join(', '),
    })
  }

  if (socketRows.length > 0) {
    sections.push({ label: 'Trận Pháp & Phù Chú', rows: socketRows })
  }

  const requirementRows: { label: string; value: string }[] = [
    { label: 'Cảnh giới rớt', value: getCurrentRealm(instance.realmId).name },
  ]

  if (template.requiredRealmId) {
    requirementRows.push({ label: 'Yêu cầu trang bị', value: getCurrentRealm(template.requiredRealmId).name })
  }

  sections.push({ label: 'Yêu Cầu', rows: requirementRows })

  return {
    kind: 'equipment',

    // Vật phẩm không còn tên riêng (2026-08-15) — tiêu đề tooltip ghép
    // đủ Phẩm/Set/Địa Giới + từ loại, xem EquipmentNaming.ts.
    name: composeEquipmentDisplayName(instance, template, zoneRegistry, setRegistry),

    imagePath: template.icon,

    slotLabel: EQUIPMENT_SLOT_LABELS[instance.slot],

    qualityLabel: EQUIPMENT_QUALITY_LABELS[instance.quality],

    phamLabel: PHAM_LABELS[instance.rarity],

    description: template.description,

    sections,
  }
}
