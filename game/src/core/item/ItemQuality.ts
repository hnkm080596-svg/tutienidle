import type { NameSegment } from './NameSegment'

export type ItemQuality = 'hoang' | 'huyen' | 'dia' | 'thien' | 'tien'

export const ITEM_QUALITY_ORDER: readonly ItemQuality[] = ['hoang', 'huyen', 'dia', 'thien', 'tien']

export const ITEM_QUALITY_LABELS: Record<ItemQuality, string> = {
  hoang: 'Hoàng Chất',
  huyen: 'Huyền Chất',
  dia: 'Địa Chất',
  thien: 'Thiên Chất',
  tien: 'Tiên Chất',
}

export function composeItemQualityNameSegments(name: string, quality: ItemQuality): NameSegment[] {
  return [
    {
      text: ITEM_QUALITY_LABELS[quality],
      colorVar: `--rank-color-${ITEM_QUALITY_ORDER.indexOf(quality) + 1}`,
      tone: quality,
    },
    { text: name },
  ]
}
