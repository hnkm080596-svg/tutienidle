// Phase 5 (Reliability, muc XVII spec) - NumberFormatter dung chung
// cho moi so lon hien thi trong UI (Linh luc, Damage, HP, Cost,
// Currency, EXP, Resource). Quy tac: duoi 10,000 hien nguyen so co
// dau phay; tu 10,000 tro len rut gon theo hau to K/M/B/T (lam tron
// 2 chu so thap phan, bo so 0 thua o cuoi); tu 1e15 tro len (vuot
// qua T, game khong dat ten tiep) chuyen sang ky hieu khoa hoc.
// activateAt: nguong bat dau dung hau to nay (KHONG phai so chia) -
// K chi kich hoat tu 10,000 tro len du chia cho 1,000, de 1,250 van
// hien nguyen dang thay vi "1.25K".
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
