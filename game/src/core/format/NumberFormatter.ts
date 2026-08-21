// Phase 5 (Reliability, mục XVII spec) — NumberFormatter dùng chung
// cho mọi số lớn hiển thị trong UI (Linh lực, Damage, HP, Cost,
// Currency, EXP, Resource). Quy tắc: dưới 10,000 hiện nguyên số có
// dấu phẩy; từ 10,000 trở lên rút gọn theo hậu tố K/M/B/T (làm tròn
// 2 chữ số thập phân, bỏ số 0 thừa ở cuối); từ 1e15 trở lên (vượt
// quá T, game không đặt tên tiếp) chuyển sang ký hiệu khoa học.
// activateAt: ngưỡng bắt đầu dùng hậu tố này (KHÔNG phải số chia) —
// K chỉ kích hoạt từ 10,000 trở lên dù chia cho 1,000, để 1,250 vẫn
// hiện nguyên dạng thay vì "1.25K".
const SUFFIX_TIERS: Array<{ activateAt: number; divisor: number; suffix: string }> = [
  { activateAt: 1e12, divisor: 1e12, suffix: 'T' },
  { activateAt: 1e9, divisor: 1e9, suffix: 'B' },
  { activateAt: 1e6, divisor: 1e6, suffix: 'M' },
  { activateAt: 1e4, divisor: 1e3, suffix: 'K' },
]

const SCIENTIFIC_THRESHOLD = 1e15

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0'
  }

  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  if (abs >= SCIENTIFIC_THRESHOLD) {
    return sign + abs.toExponential(2).replace('e+', 'e')
  }

  for (const tier of SUFFIX_TIERS) {
    if (abs >= tier.activateAt) {
      const scaled = roundTo2(abs / tier.divisor)

      return sign + trimTrailingZeros(scaled) + tier.suffix
    }
  }

  return sign + Math.round(abs).toLocaleString('en-US')
}

function trimTrailingZeros(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}
