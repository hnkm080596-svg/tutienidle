import type { Technique, TechniqueTier } from './Technique'

// Temporary balance variable. All technique insight requirements derive
// from this value so balancing does not require touching progression logic.
export const BASE_TECHNIQUE_INSIGHT_REQUIRED = 1_000

export const TECHNIQUE_TIER_COST_SHARES = {
  so_nhap: 0.1,
  tieu_thanh: 0.2,
  dai_thanh: 0.3,
  vien_man: 0.4,
} as const satisfies Record<TechniqueTier, number>

export function getTechniqueInsightTotalRequired(technique: Pick<Technique, 'insightMultiplier'>): number {
  return Math.floor(BASE_TECHNIQUE_INSIGHT_REQUIRED * (technique.insightMultiplier ?? 1))
}

interface TierThreshold {
  tier: TechniqueTier
  lowerShare: number
}

const TIER_THRESHOLDS: TierThreshold[] = [
  { tier: 'so_nhap', lowerShare: 0 },
  { tier: 'tieu_thanh', lowerShare: TECHNIQUE_TIER_COST_SHARES.so_nhap },
  { tier: 'dai_thanh', lowerShare: 0.3 },
  {
    tier: 'vien_man',
    lowerShare: 0.6,
  },
]

export function getTechniqueTierProgress(
  insight: number,
  totalRequired = BASE_TECHNIQUE_INSIGHT_REQUIRED,
): {
  tier: TechniqueTier
  lowerBound: number
  nextThreshold: number | undefined
} {
  const clamped = Math.max(0, insight)
  let currentIndex = 0

  for (let index = 0; index < TIER_THRESHOLDS.length; index++) {
    if (clamped >= totalRequired * TIER_THRESHOLDS[index]!.lowerShare) {
      currentIndex = index
    }
  }

  const current = TIER_THRESHOLDS[currentIndex]!
  const lowerBound = Math.floor(totalRequired * current.lowerShare)
  const nextShare = TIER_THRESHOLDS[currentIndex + 1]?.lowerShare ?? 1
  const nextThreshold = clamped >= totalRequired ? undefined : Math.floor(totalRequired * nextShare)

  return { tier: current.tier, lowerBound, nextThreshold }
}

export function getTechniqueTier(insight: number, totalRequired?: number): TechniqueTier {
  return getTechniqueTierProgress(insight, totalRequired).tier
}

export const TECHNIQUE_TIER_LABELS: Record<TechniqueTier, string> = {
  so_nhap: 'Sơ Nhập',
  tieu_thanh: 'Tiểu Thành',
  dai_thanh: 'Đại Thành',
  vien_man: 'Viên Mãn',
}
