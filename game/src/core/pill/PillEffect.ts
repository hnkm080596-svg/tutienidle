import type { Buff } from '../buff/Buff'
import type { StatType } from '../stats/StatTypes'

export type PillEffectType =
  | 'heal'
  | 'cultivation'
  | 'buff'
  | 'permanent_stat'

export interface PillEffect {
  type: PillEffectType

  // Với 'permanent_stat': lượng flat cộng vĩnh viễn MỖI LẦN dùng
  // (dùng nhiều lần thì cộng dồn qua stacks, xem PillSystem.use()).
  value?: number

  // Buff đầy đủ, dùng khi type === 'buff'. Pill không có registry
  // buff riêng để tra theo id (BuffSystem.apply() vốn đã nhận
  // thẳng object Buff), nên effect mang theo definition luôn.
  buff?: Buff

  // Dùng khi type === 'permanent_stat'.
  stat?: StatType
}
