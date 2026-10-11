import type { Pill } from './Pill'
import type { ItemQuality } from '../item/ItemQuality'

export interface PillStack {
  pill: Pill

  amount: number

  // Truc chat dan (M-PILL-GRADE): chat da roll cua stack nay. Additive -
  // dan cu/drop/qua tang khong mang truong = hoang (khong migration).
  // Hai stack cung vien dan nhung khac chat KHONG gop vao nhau.
  quality?: ItemQuality
}
