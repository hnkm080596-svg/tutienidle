// Task 19 (item-grade-quality-rework, rework P6) - pure display helpers
// shared by Enhance/Wash/Refine tabs (tier color class, affix label,
// stat-precision-aware value formatting). Extracted verbatim from the
// former EquipmentHallPanel.vue shell.
import type { RolledAffix } from '@/core/equipment/RolledAffix'
import type { AffixRegistry } from '@/core/equipment/AffixRegistry'
import { affixLabel } from '@/core/presentation/labels'
import { statLabel, formatStat } from '@/core/stats/StatLabels'
import type { Stats } from '@/core/stats/StatBlock'

/**
 * Tier hien thi bang MAU chu khong phai text "(tier N)" (2026-08-30 bug
 * report) - tai dung DUNG token --affix-tier-N ma Tooltip.vue's
 * `.tooltip__section-row--tier-N` da dung, giu nhat quan 1 quy tac mau
 * tier DUY NHAT trong toan project.
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
 * Format gia tri stat theo dung do chinh xac loai stat (formatStat) -
 * stat la/registry thieu fallback 2 chu so thap phan, KHONG bao gio
 * ep so thap phan nho ve "0.0" (bug report 2026-08-30).
 */
export function formatAffixValue(stat: keyof Stats | undefined, value: number): string {
  if (stat === undefined) {
    return (Math.round(value * 100) / 100).toString()
  }

  return formatStat(stat, value)
}
