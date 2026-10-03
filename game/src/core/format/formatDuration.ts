// Dinh dang thoi gian dung chung (i18n refactor Task 8) - thay cac cho
// tu viet formatter rai rac (ProductionPanel, OfflineSummaryModal,
// CombatVictoryPanel, CombatDefeatPanel). 3 style:
//   - compact:   "2h 30p", "5p 10s", "45s" - bo unit 0; h>0 luon kem p;
//                m>0 luon kem s (pad 2 chu so).
//   - precise:   "2h 30m 15s" - luon du h/m/s, khong bo unit 0.
//   - countdown: "45s" - tong giay nguyen, cho dem nguoc combat.
// Gia tri le: compact/precise lam tron XUONG, countdown lam tron GAN.
// Am / NaN / Infinity bi kep ve 0 - cung chinh sach defensive voi
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
