import { describe, expect, it } from 'vitest'
import type { Technique } from './Technique'
import {
  BASE_TECHNIQUE_INSIGHT_REQUIRED,
  getTechniqueInsightTotalRequired,
  getTechniqueTierProgress,
} from './TechniqueTier'

describe('technique insight curve', () => {
  it('uses 10/20/30/40 percent tier segments', () => {
    const total = BASE_TECHNIQUE_INSIGHT_REQUIRED
    expect(getTechniqueTierProgress(0, total)).toMatchObject({ tier: 'so_nhap', nextThreshold: 100 })
    expect(getTechniqueTierProgress(100, total)).toMatchObject({ tier: 'tieu_thanh', nextThreshold: 300 })
    expect(getTechniqueTierProgress(300, total)).toMatchObject({ tier: 'dai_thanh', nextThreshold: 600 })
    expect(getTechniqueTierProgress(600, total)).toMatchObject({ tier: 'vien_man', nextThreshold: 1000 })
    expect(getTechniqueTierProgress(1000, total).nextThreshold).toBeUndefined()
  })

  it('Luyện Khí technique needs three times the mortal baseline', () => {
    const technique = { insightMultiplier: 3 } as Pick<Technique, 'insightMultiplier'>
    expect(getTechniqueInsightTotalRequired(technique)).toBe(BASE_TECHNIQUE_INSIGHT_REQUIRED * 3)
  })
})
