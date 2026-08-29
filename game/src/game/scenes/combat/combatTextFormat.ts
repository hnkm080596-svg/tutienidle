// combatTextFormat (ui-discoverability-refactor-plan.md §3.2) — tách từ
// CombatScene.ts: formatDotDamageText là hàm thuần, test trực tiếp.
import { formatNumber } from '@/core/format/NumberFormatter'

/**
 * Format số DoT hiển thị (hàm thuần, test trực tiếp) — tổng ≥1 làm tròn
 * qua formatter chung; 0<x<1 hiện 1 chữ số thập phân với sàn 0.1 nên
 * KHÔNG bao giờ render "-0.0" (fix 2026-08-26).
 */
export function formatDotDamageText(value: number): string {
  const rounded = Math.round(value)

  if (Math.abs(rounded) >= 1) {
    return `-${formatNumber(rounded)}`
  }

  const tenth = Math.max(1, Math.round(Math.abs(value) * 10)) / 10

  return `-${tenth.toFixed(1)}`
}