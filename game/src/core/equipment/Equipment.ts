import type { EquipmentSlot } from './EquipmentTypes'
import type { StatType } from '../stats/StatTypes'
export interface RecipeMaterialCost {
  materialId: string

  amount: number
}

// MASTER SPEC Muc VI (Phase 6, hop nhat framework COST) - Luyen Khi
// (Cuong Hoa/Tay Luyen/Tinh Luyen/Hoa Luyen) dung CHUNG shape chi phi
// nguyen lieu voi Recipe (Dan) thay vi tu dinh nghia lai
// {materialId,amount} rieng - Khi van KHONG dung Recipe/CraftingSystem
// that (giu nguyen hanh vi INSTANT, khong co craftDuration/hang cho) vi
// day la thao tac tuc thoi quen thuoc voi nguoi choi, chi hop nhat
// phan TYPE cua chi phi, khong hop nhat luong thuc thi.
export type EquipmentEnhanceCost = RecipeMaterialCost

export interface EquipmentStatRange {
  stat: StatType

  min: number

  max: number
}

export interface Equipment {
  id: string

  // Ten GOC, KHONG chua tien to Pham/Set/Dia Gioi (2026-08-15, co che
  // Set + ten ghep dong) - vd "Tram Khong Kiem", khong phai "Thai Hu
  // Tram Khong Kiem". Ten day du hien thi ghep dong luc runtime, xem
  // EquipmentNaming.ts's composeEquipmentNameSegments().
  name: string

  description?: string

  // Path anh minh hoa - khai NGAY TREN data item (2026-08-15), xem
  // ghi chu tuong tu trong core/technique/Technique.ts.
  icon?: string

  iconPool?: string[]

  slot: EquipmentSlot

  grade: number

  maxEnhanceLevel: number

  // Implicit - chi so CHAC CHAN co tren moi instance cua template nay
  // (roll 1 gia tri trong range roi scale them theo canh gioi nguoi
  // choi luc rot, xem EquipmentSystem.createInstance()), tach biet
  // hoan toan khoi Affix pool (Prefix/Suffix, xem Affix.ts) - Implicit
  // khong tinh vao gioi han so Affix theo Rarity.
  // Moi lua chon main stat so huu range rieng. Chi Nhan/Day Chuyen co
  // nhieu hon mot lua chon; cac slot con lai luon co dung mot phan tu.
  mainStats: readonly EquipmentStatRange[]

  enhanceCost?: EquipmentEnhanceCost[]

  // "tunghematandsuch" pass (2026-08-14) - Cuong Hoa gio CUNG ton
  // Linh Thach (MaterialBag), xem EquipmentSystem.enhance().
  enhanceSpiritStoneCost?: number
}
