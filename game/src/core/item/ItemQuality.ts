export type ItemQuality = 'hoang' | 'huyen' | 'dia' | 'thien' | 'tien'

export const ITEM_QUALITY_ORDER: readonly ItemQuality[] = ['hoang', 'huyen', 'dia', 'thien', 'tien']

export const ITEM_QUALITY_LABELS: Record<ItemQuality, string> = {
  hoang: 'Hoàng Chất',
  huyen: 'Huyền Chất',
  dia: 'Địa Chất',
  thien: 'Thiên Chất',
  tien: 'Tiên Chất',
}

// Short tier word used as the "Chat - Name" name prefix (ruling
// 2026-09-14): "Hoang - Thanh Van Kiem". The full "... Chat" labels
// stay for standalone Chất lines (tooltip rows).
export const ITEM_QUALITY_SHORT_LABELS: Record<ItemQuality, string> = {
  hoang: 'Hoàng',
  huyen: 'Huyền',
  dia: 'Địa',
  thien: 'Thiên',
  tien: 'Tiên',
}
