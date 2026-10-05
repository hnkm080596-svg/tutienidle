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

/**
 * Entity name label fitting (ui-combat reskin, 2026-10-04) - enemy labels
 * used to render at a fixed 14px under the sprite and bleed into the
 * neighbour column's label. Labels are now CAPPED at the column's cell
 * width: try each font size in `fontSizes` (descending), keep the first
 * that fits; when none fits, ellipsize at the smallest size.
 *
 * `measure(text, fontSize)` returns the rendered pixel width - callers
 * pass a Phaser-text-backed measure in scenes and a stub in tests.
 */
export function fitEntityLabelText(
  name: string,
  measure: (text: string, fontSize: number) => number,
  maxWidth: number,
  fontSizes: readonly number[] = [14, 12],
): { text: string; fontSize: number } {
  for (const fontSize of fontSizes) {
    if (measure(name, fontSize) <= maxWidth) {
      return { text: name, fontSize }
    }
  }

  const smallest = fontSizes[fontSizes.length - 1] ?? 14
  let trimmed = name

  while (trimmed.length > 1) {
    trimmed = trimmed.slice(0, -1)

    if (measure(`${trimmed}…`, smallest) <= maxWidth) {
      return { text: `${trimmed}…`, fontSize: smallest }
    }
  }

  return { text: '…', fontSize: smallest }
}