/**
 * 1 dòng Affix ĐÃ ROLL trên 1 EquipmentInstance cụ thể — value đã
 * roll sẵn trong range của đúng tier đó (xem AffixTierDef trong
 * Affix.ts), không tính lại mỗi lần đọc.
 */
export interface RolledAffix {
  affixId: string

  tier: number

  value: number
}
