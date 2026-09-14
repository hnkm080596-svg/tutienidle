import type { Equipment } from '@/core/equipment/Equipment'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { EquipmentSlotState } from '@/core/equipment/EquipmentSlotState'
import type { AffixRegistry } from '@/core/equipment/AffixRegistry'
import type { ZoneRegistry } from '@/core/stage/ZoneRegistry'
import { getEffectiveAffixValue, GLOBAL_MAX_AFFIXES, MAIN_STAT_REALM_SCALE } from '@/core/equipment/EquipmentSystem'
import { ITEM_QUALITY_AFFIX_SLOTS, ITEM_QUALITY_IMPLICIT_MULTIPLIER } from '@/core/equipment/ItemQualityBalance'
import { getGlobalCultivationLevel } from '@/core/realm/realmSystem'
import { realmFromGrade } from '@/core/profession/ProfessionGrade'
import { itemQualityRank, professionGradeRank } from '@/core/profession/slotRank'
import { composeEquipmentDisplayName } from '@/core/equipment/EquipmentNaming'
import { EQUIPMENT_SLOT_LABELS } from '@/core/equipment/EquipmentTypes'
import { statLabel, formatStat } from '@/core/stats/StatLabels'
import { gradeLabel, realmLabel } from '@/core/presentation/labels'
import type { SlotComparison } from '@/components/common/SlotTypes'
import type { EquipmentTooltipContent, TooltipSection, TooltipStatRow } from './useTooltip'

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

// Compare context (item-info-card spec §4): the equipped counterpart a
// candidate is compared against. Drives BOTH the inline delta fields on
// stat rows AND the compareWith paired-card payload — one source so the
// markers and the card can never disagree.
export interface EquipmentCompareContext {
  instance: EquipmentInstance

  template: Equipment

  slotState: EquipmentSlotState | null

  mainStatRangeQuote?: { min: number; max: number }
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
  compare?: EquipmentCompareContext,
  mainStatRangeQuote?: { min: number; max: number },
): EquipmentTooltipContent {
  const mainStatValue = formatStat(instance.mainStat.stat, instance.mainStat.flat ?? 0)
  // R9 (AR-23 4c): the effective range is the EQUIPMENT SYSTEM's quote.
  // The old self-computed scaling here duplicated the roll pipeline.
  const effectiveMainRangeValues = mainStatRangeQuote ?? (() => {
    const rolledRange = template.mainStats.find(range => range.stat === instance.mainStat.stat)
    const realmScale = 1 + getGlobalCultivationLevel(realmFromGrade(instance.grade), instance.realmLevel ?? 1) * MAIN_STAT_REALM_SCALE
    const qualityScale = ITEM_QUALITY_IMPLICIT_MULTIPLIER[instance.quality]
    return rolledRange
      ? { min: rolledRange.min * qualityScale * realmScale, max: rolledRange.max * qualityScale * realmScale }
      : undefined
  })()

  // Delta fields (spec §4) — computed up front so every stat row can
  // spread { delta, deltaTone }; empty when there is no real compare
  // (no context, or the candidate IS the equipped item).
  const hasCompare = compare !== undefined && compare.instance.instanceId !== instance.instanceId
  const deltas = hasCompare
    ? computeEquipmentStatDeltas(instance, compare.instance, affixRegistry)
    : []
  const deltaByStat = new Map(deltas.map(entry => [entry.stat, entry.delta]))
  const comparedStats = hasCompare ? statValuesByStat(compare.instance, affixRegistry) : new Map<string, number>()
  const candidateStats = statValuesByStat(instance, affixRegistry)

  function deltaFields(stat: string): { delta?: string; deltaTone?: 'positive' | 'negative' | 'muted' } {
    const delta = deltaByStat.get(stat)
    if (delta === undefined) return {}
    const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '•'
    return {
      delta: `${arrow} ${delta >= 0 ? '+' : ''}${formatStat(stat as EquipmentInstance['mainStat']['stat'], delta)}`,
      deltaTone: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'muted',
    }
  }

  // R9 (AR-23 4c): range from the domain quote when supplied; the inline
  // fallback above now owns the legacy path for callers without a
  // system handle.
  const effectiveMainRange = effectiveMainRangeValues
    ? `[${formatStat(instance.mainStat.stat, effectiveMainRangeValues.min)}–${formatStat(instance.mainStat.stat, effectiveMainRangeValues.max)}]`
    : '[—]'

  const sections: TooltipSection[] = [
    {
      label: 'Chỉ Số Chính',

      // Rolled+realm-scaled value (instance.mainStat); range renders
      // muted inline after it (spec §3 — advancedSections is gone,
      // range/delta now live on the row itself).
      rows: [{
        label: statLabel(instance.mainStat.stat),
        value: `+${mainStatValue}`,
        range: effectiveMainRange,
        ...deltaFields(instance.mainStat.stat),
      }],
    },
  ]

  const rarityAffixCap = ITEM_QUALITY_AFFIX_SLOTS[instance.quality]
  const bonusAffixSlots = slotState?.bonusAffixSlots ?? 0
  const affixCapacity = Math.min(GLOBAL_MAX_AFFIXES, rarityAffixCap.prefix + rarityAffixCap.suffix + bonusAffixSlots)

  const affixRows: TooltipStatRow[] = instance.affixes.map(rolled => {
    const affix = affixRegistry.get(rolled.affixId)
    const tier = affix.tiers.find(candidate => candidate.tier === rolled.tier)
    const value = getEffectiveAffixValue(rolled, affix)

    return {
      // The tooltip always calls a stat by its canonical StatLabels
      // name — affix names are literary (e.g. "Chuan Xac") and could be
      // misread as a different stat than accuracyRating.
      label: statLabel(affix.stat),

      value: `+${formatStat(affix.stat, value)}`,

      range: tier ? `[${formatStat(affix.stat, tier.min)}–${formatStat(affix.stat, tier.max)}]` : undefined,

      tier: rolled.tier,

      tone: affix.pool === 'supreme' ? 'special' as const : 'default' as const,

      ...deltaFields(affix.stat),
    }
  })

  // Stats the equipped counterpart has but the candidate lacks — muted
  // "+0" rows in the SAME affix section carrying the negative delta.
  for (const [stat] of comparedStats) {
    if (candidateStats.has(stat)) continue
    const typedStat = stat as EquipmentInstance['mainStat']['stat']
    affixRows.push({
      label: statLabel(typedStat),
      value: `+${formatStat(typedStat, 0)}`,
      tone: 'muted',
      tier: 0,
      ...deltaFields(typedStat),
    })
  }

  if (affixRows.length > 0 || affixCapacity > 0) {
    sections.push({ label: `Chỉ Số Phụ (${instance.affixes.length}/${affixCapacity})`, rows: affixRows })
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
  const displayName = composeEquipmentDisplayName(instance, template, zoneRegistry)

  return {
    kind: 'equipment',

    name: displayName,

    // Single title color on the Chat ramp: quality rank (1-5) spread
    // onto odd steps 1-3-5-7-9 of the 10-step --rank-color scale
    // (spec §2); 'tien' upgrades to the rainbow tone.
    nameColorVar: `--rank-color-${itemQualityRank(instance.quality) * 2 - 1}`,

    nameTone: instance.quality === 'tien' ? 'tien' : undefined,

    // Static SlotView header (spec §3): the same signal set the bag
    // cell binds — seal rank (Pham), Chat edge (quality), aria with
    // the grade word a color-blind reader needs.
    slotPreview: {
      icon: instance.icon ?? template.icon,
      label: displayName,
      accessibleLabel: `${displayName}, ${gradeLabel(instance.grade)}`,
      equipmentQualityRank: professionGradeRank(instance.grade),
      rarityRank: itemQualityRank(instance.quality),
    },

    imagePath: instance.icon ?? template.icon,

    slotLabel: EQUIPMENT_SLOT_LABELS[instance.slot],

    qualityKey: instance.quality,

    gradeLine: `Cảnh giới: ${gradeLabel(instance.grade)} (${realmLabel(instanceRealmId)})`,

    description: template.description,

    sections,

    // The equipped counterpart card — built WITHOUT a compare context
    // so the recursion stops at depth 1. The key is omitted entirely
    // (not set to undefined) so 'compareWith' in the inner card is
    // false — spec §4 forbids nested pairs.
    ...(hasCompare
      ? {
          compareWith: buildEquipmentTooltip(
            compare.instance,
            compare.template,
            affixRegistry,
            compare.slotState,
            zoneRegistry,
            undefined,
            compare.mainStatRangeQuote,
          ),
        }
      : {}),
  }
}
