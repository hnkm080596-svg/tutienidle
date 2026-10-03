// combatTextFormat (ui-discoverability-refactor-plan.md sec3.2) - tach tu
// CombatScene.ts: formatDotDamageText la ham thuan, test truc tiep.
import { formatNumber } from '@/core/format/NumberFormatter'

/**
 * Format so DoT hien thi (ham thuan, test truc tiep) - tong >=1 lam tron
 * qua formatter chung; 0<x<1 hien 1 chu so thap phan voi san 0.1 nen
 * KHONG bao gio render "-0.0" (fix 2026-08-26).
 */
export function formatDotDamageText(value: number): string {
  const rounded = Math.round(value)

  if (Math.abs(rounded) >= 1) {
    return `-${formatNumber(rounded)}`
  }

  const tenth = Math.max(1, Math.round(Math.abs(value) * 10)) / 10

  return `-${tenth.toFixed(1)}`
}