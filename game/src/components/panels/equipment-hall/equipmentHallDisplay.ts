// Task 19 (item-grade-quality-rework, rework P6) — pure display helpers
// shared by Enhance/Wash/Refine tabs (tier color class, affix label,
// stat-precision-aware value formatting). Extracted verbatim from the
// former EquipmentHallPanel.vue shell.
import type { RolledAffix } from '@/core/equipment/RolledAffix'
import type { AffixRegistry } from '@/core/equipment/AffixRegistry'
import { affixLabel } from '@/core/presentation/labels'
import { statLabel, formatStat } from '@/core/stats/StatLabels'
import type { Stats } from '@/core/stats/StatBlock'

/**
 * Tier hiển thị bằng MÀU chứ không phải text "(tier N)" (2026-08-30 bug
 * report) — tái dùng ĐÚNG token --affix-tier-N mà Tooltip.vue's
 * `.tooltip__section-row--tier-N` đã dùng, giữ nhất quán 1 quy tắc màu
 * tier DUY NHẤT trong toàn project.
 */
export function tierClass(tier: number): string {
  return `qi-hall__tier-${tier}`
}

export function affixDisplayLabel(rolled: RolledAffix, affixRegistry: AffixRegistry): string {
  const affix = affixRegistry.has(rolled.affixId) ? affixRegistry.get(rolled.affixId) : undefined

  return affix
    ? `${affixLabel(rolled.affixId, affixRegistry)} (${statLabel(affix.stat)})`
    : affixLabel(rolled.affixId, affixRegistry)
}

/**
 * Format giá trị stat theo đúng độ chính xác loại stat (formatStat) —
 * stat lạ/registry thiếu fallback 2 chữ số thập phân, KHÔNG bao giờ
 * ép số thập phân nhỏ về "0.0" (bug report 2026-08-30).
 */
export function formatAffixValue(stat: keyof Stats | undefined, value: number): string {
  if (stat === undefined) {
    return (Math.round(value * 100) / 100).toString()
  }

  return formatStat(stat, value)
}
