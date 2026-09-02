import type { Equipment } from '@/core/equipment/Equipment'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { EquipmentSlotState } from '@/core/equipment/EquipmentSlotState'
import type { AffixRegistry } from '@/core/equipment/AffixRegistry'
import type { ZoneRegistry } from '@/core/stage/ZoneRegistry'
import { getEffectiveAffixValue, GLOBAL_MAX_AFFIXES, MAIN_STAT_REALM_SCALE } from '@/core/equipment/EquipmentSystem'
import { ITEM_QUALITY_AFFIX_SLOTS, ITEM_QUALITY_IMPLICIT_MULTIPLIER } from '@/core/equipment/ItemQualityBalance'
import { getGlobalCultivationLevel } from '@/core/realm/realmSystem'
import { realmFromGrade } from '@/core/profession/ProfessionGrade'
import { composeEquipmentDisplayName, composeEquipmentNameSegments } from '@/core/equipment/EquipmentNaming'
import { EQUIPMENT_SLOT_LABELS } from '@/core/equipment/EquipmentTypes'
import { statLabel, formatStat } from '@/core/stats/StatLabels'
import { equipmentQualityLabel, gradeLabel, realmLabel } from '@/core/presentation/labels'
import type { SlotComparison } from '@/components/common/SlotTypes'
import type { EquipmentTooltipContent, TooltipSection } from './useTooltip'

// Dùng chung bởi buildEquipmentTooltip (build rows "So với trang bị
// đang mặc") VÀ getEquipmentComparisonTone (Slot Revamp mục 17.7 —
// tín hiệu upgrade/downgrade nhỏ NGAY TRÊN SlotView, không chỉ trong
// tooltip) — 1 nguồn tính delta duy nhất, tránh lệch nhau giữa 2 nơi.
function statValuesByStat(instance: EquipmentInstance, affixRegistry: AffixRegistry): Map<string, number> {
  return new Map<string, number>([
    [instance.mainStat.stat, instance.mainStat.flat ?? 0],
    ...instance.affixes.map(rolled => [affixRegistry.get(rolled.affixId).stat, rolled.value] as const),
  ])
}

function computeEquipmentStatDeltas(
  instance: EquipmentInstance,
  comparedInstance: EquipmentInstance,
  affixRegistry: AffixRegistry,
): { stat: string; delta: number }[] {
  const equippedByStat = statValuesByStat(comparedInstance, affixRegistry)
  const candidateByStat = statValuesByStat(instance, affixRegistry)
  const stats = new Set([...equippedByStat.keys(), ...candidateByStat.keys()])

  return [...stats].map(stat => ({
    stat,
    delta: (candidateByStat.get(stat) ?? 0) - (equippedByStat.get(stat) ?? 0),
  }))
}

// Tổng hợp delta nhiều stat khác thang đo (percent lẫn flat) thành 1
// tone duy nhất — đếm số stat tăng/giảm thay vì cộng dồn giá trị thô
// (không thể cộng %crit với flat attack có ý nghĩa), khớp cách
// buildEquipmentTooltip() đã tô tone từng dòng.
export function getEquipmentComparisonTone(
  instance: EquipmentInstance,
  comparedInstance: EquipmentInstance | undefined,
  affixRegistry: AffixRegistry,
): SlotComparison {
  if (!comparedInstance || comparedInstance.instanceId === instance.instanceId) {
    return 'neutral'
  }

  const deltas = computeEquipmentStatDeltas(instance, comparedInstance, affixRegistry)
  const positive = deltas.filter(entry => entry.delta > 0).length
  const negative = deltas.filter(entry => entry.delta < 0).length

  if (positive === negative) return 'neutral'
  return positive > negative ? 'upgrade' : 'downgrade'
}

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
  zoneRegistry: ZoneRegistry,
  comparedInstance?: EquipmentInstance,
): EquipmentTooltipContent {
  const mainStatValue = formatStat(instance.mainStat.stat, instance.mainStat.flat ?? 0)
  const rolledRange = template.mainStats.find(range => range.stat === instance.mainStat.stat)

  const sections: TooltipSection[] = [
    {
      label: 'Chỉ Số Chính',

      // Giá trị thật đã roll+scale theo cảnh giới lúc rớt (instance.mainStat)
      // — phạm vi gốc trong ngoặc là range tương ứng trên TEMPLATE,
      // CHƯA scale, chỉ để tham khảo tương đối giữa các item cùng loại.
      rows: [{ label: statLabel(instance.mainStat.stat), value: `+${mainStatValue}` }],
    },
  ]

  const rarityAffixCap = ITEM_QUALITY_AFFIX_SLOTS[instance.quality]
  const bonusAffixSlots = slotState?.bonusAffixSlots ?? 0
  const affixCapacity = Math.min(GLOBAL_MAX_AFFIXES, rarityAffixCap.prefix + rarityAffixCap.suffix + bonusAffixSlots)

  if (instance.affixes.length > 0 || affixCapacity > 0) {
    sections.push({
      label: `Chỉ Số Phụ (${instance.affixes.length}/${affixCapacity})`,

      rows: instance.affixes.map(rolled => {
        const affix = affixRegistry.get(rolled.affixId)
        const value = getEffectiveAffixValue(rolled, affix)

        return {
          // Tooltip luôn gọi một stat bằng tên chuẩn trong StatLabels. Tên
          // affix mang tính văn phong (ví dụ "Chuẩn Xác") dễ bị hiểu nhầm là
          // một stat khác với accuracyRating ("Độ chính xác").
          label: statLabel(affix.stat),

          value: `+${formatStat(affix.stat, value)}`,

          tier: rolled.tier,

          tone: affix.pool === 'supreme' ? 'special' as const : 'default' as const,
        }
      }),
    })
  }

  const forgeRows: { label: string; value: string }[] = []

  const enhanceLevel = slotState?.enhanceLevel ?? 0

  if (enhanceLevel > 0) {
    forgeRows.push({ label: 'Cường Hóa', value: `+${enhanceLevel}/${template.maxEnhanceLevel}` })
  }

  const maxForgePoints = instance.forgeUsesTotal

  if (maxForgePoints > 0) {
    forgeRows.push({ label: 'Tình trạng rèn', value: `${instance.forgeUsesRemaining}/${maxForgePoints}` })
  }

  if (forgeRows.length > 0) {
    sections.push({ label: 'Rèn', rows: forgeRows })
  }

  // Phù/Trận legacy đã khai tử (plan §10.1) — không còn socket rows.

  const instanceRealmId = realmFromGrade(instance.grade)

  // Rework P6 (item-grade-quality-rework, Task 21) — hiển thị RÕ 2
  // trục riêng biệt của item, tránh lẫn lộn Phẩm (ProfessionGrade,
  // theo đại cảnh giới) với Chất (ItemQuality, độ hiếm roll). Đặt SAU
  // "Rèn" để sections[0] (Chỉ Số Chính) giữ nguyên vị trí — advancedSections
  // dưới đây tự nhặt lại section này qua filter loại "Chỉ Số Chính"/"Chỉ Số Phụ".
  sections.push({
    label: 'Phân Loại',

    rows: [
      { label: 'Phẩm', value: `${gradeLabel(instance.grade)} (${realmLabel(instanceRealmId)})` },
      { label: 'Chất', value: equipmentQualityLabel(instance.quality) },
    ],
  })

  const deltas = comparedInstance && comparedInstance.instanceId !== instance.instanceId
    ? computeEquipmentStatDeltas(instance, comparedInstance, affixRegistry)
    : []
  const deltaByStat = new Map(deltas.map(entry => [entry.stat, entry.delta]))
  const comparedStats = comparedInstance ? statValuesByStat(comparedInstance, affixRegistry) : new Map<string, number>()
  const candidateStats = statValuesByStat(instance, affixRegistry)

  const appendDelta = (stat: EquipmentInstance['mainStat']['stat'], value: string) => {
    const delta = deltaByStat.get(stat)
    if (delta === undefined) return { value }
    const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '•'
    return {
      value: `${value}  ${arrow} ${delta >= 0 ? '+' : ''}${formatStat(stat, delta)}`,
      tone: delta > 0 ? 'positive' as const : delta < 0 ? 'negative' as const : 'muted' as const,
    }
  }

  const realmScale = 1 + getGlobalCultivationLevel(instanceRealmId, instance.realmLevel ?? 1) * MAIN_STAT_REALM_SCALE
  const qualityScale = ITEM_QUALITY_IMPLICIT_MULTIPLIER[instance.quality]
  const effectiveMainRange = rolledRange
    ? `[${formatStat(instance.mainStat.stat, rolledRange.min * qualityScale * realmScale)}–${formatStat(instance.mainStat.stat, rolledRange.max * qualityScale * realmScale)}]`
    : '[—]'
  const advancedMain = appendDelta(instance.mainStat.stat, `+${mainStatValue} ${effectiveMainRange}`)

  const advancedAffixRows = instance.affixes.map(rolled => {
    const affix = affixRegistry.get(rolled.affixId)
    const tier = affix.tiers.find(candidate => candidate.tier === rolled.tier)
    const value = getEffectiveAffixValue(rolled, affix)
    const range = tier ? ` [${formatStat(affix.stat, tier.min)}–${formatStat(affix.stat, tier.max)}]` : ''
    const compared = appendDelta(affix.stat, `+${formatStat(affix.stat, value)}${range}`)

    return {
      label: statLabel(affix.stat),
      value: compared.value,
      tone: compared.tone ?? (affix.pool === 'supreme' ? 'special' as const : 'default' as const),
      tier: rolled.tier,
    }
  })

  for (const [stat] of comparedStats) {
    if (candidateStats.has(stat)) continue
    const typedStat = stat as EquipmentInstance['mainStat']['stat']
    const compared = appendDelta(typedStat, `+${formatStat(typedStat, 0)}`)
    advancedAffixRows.push({ label: statLabel(typedStat), value: compared.value, tone: compared.tone ?? 'muted', tier: 0 })
  }

  const advancedSections: TooltipSection[] = [
    { label: 'Chỉ Số Chính', rows: [{ label: statLabel(instance.mainStat.stat), ...advancedMain }] },
  ]
  if (advancedAffixRows.length > 0 || affixCapacity > 0) {
    advancedSections.push({ label: `Chỉ Số Phụ (${instance.affixes.length}/${affixCapacity})`, rows: advancedAffixRows })
  }
  advancedSections.push(...sections.filter(section => section.label !== 'Chỉ Số Chính' && !section.label.startsWith('Chỉ Số Phụ')))

  return {
    kind: 'equipment',

    // Vật phẩm không còn tên riêng (2026-08-15) — tiêu đề tooltip ghép
    // đủ Phẩm/Set/Địa Giới + từ loại, xem EquipmentNaming.ts.
    name: composeEquipmentDisplayName(instance, template, zoneRegistry),

    nameSegments: composeEquipmentNameSegments(instance, template, zoneRegistry),

    imagePath: instance.icon ?? template.icon,

    slotLabel: EQUIPMENT_SLOT_LABELS[instance.slot],

    qualityKey: instance.quality,

    description: template.description,

    sections,

    advancedSections,
  }
}
