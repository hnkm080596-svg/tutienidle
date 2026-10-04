/**
 * 1 dong Affix DA ROLL tren 1 EquipmentInstance cu the - value da
 * roll san trong range cua dung tier do (xem AffixTierDef trong
 * Affix.ts), khong tinh lai moi lan doc.
 */
export interface RolledAffix {
  affixId: string

  tier: number

  value: number
}
