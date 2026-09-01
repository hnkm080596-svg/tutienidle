// Định dạng thời gian dùng chung (i18n refactor Task 8) — thay các chỗ
// tự viết formatter rải rác (ProductionPanel, OfflineSummaryModal,
// CombatVictoryPanel, CombatDefeatPanel). 3 style:
//   - compact:   "2h 30p", "5p 10s", "45s" — bỏ unit 0; h>0 luôn kèm p;
//                m>0 luôn kèm s (pad 2 chữ số).
//   - precise:   "2h 30m 15s" — luôn đủ h/m/s, không bỏ unit 0.
//   - countdown: "45s" — tổng giây nguyên, cho đếm ngược combat.
// Giá trị lẻ: compact/precise làm tròn XUỐNG, countdown làm tròn GẦN.
// Âm / NaN / Infinity bị kẹp về 0 — cùng chính sách defensive với
// NumberFormatter.ts.

export type DurationStyle = 'compact' | 'precise' | 'countdown'

function clampToWholeSeconds(seconds: number, rounding: 'floor' | 'round'): number {
  if (!Number.isFinite(seconds)) {
    return 0
  }

  const whole = rounding === 'floor' ? Math.floor(seconds) : Math.round(seconds)

  return Math.max(0, whole)
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatDuration(seconds: number, style: DurationStyle = 'compact'): string {
  if (style === 'countdown') {
    return `${clampToWholeSeconds(seconds, 'round')}s`
  }

  const total = clampToWholeSeconds(seconds, 'floor')
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (style === 'precise') {
    return `${hours}h ${minutes}m ${secs}s`
  }

  if (hours > 0) {
    if (minutes === 0 && secs === 0) {
      return `${hours}h 0p`
    }

    return `${hours}h ${minutes}p ${pad2(secs)}s`
  }

  if (minutes > 0) {
    return `${minutes}p ${pad2(secs)}s`
  }

  return `${secs}s`
}
