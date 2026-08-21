import type { PassiveTrigger } from '../skill/SkillTypes'
import type { StatModifier } from '../stats/StatCalculator'
import type { Pham } from '../item/Pham'

/**
 * Trận pháp — khảm vào vũ khí (EquipmentInstance.socketedFormation)
 * để cấp 1 passive kích hoạt theo trigger, giống cơ chế passive
 * skill (PassiveSystem) nhưng gắn theo trang bị thay vì theo nhân
 * vật — chỉ có hiệu lực khi vũ khí đó đang equipped.
 */
export interface Formation {
  id: string

  name: string

  description?: string

  // Path ảnh minh hoạ — khai NGAY TRÊN data item (2026-08-15), xem
  // ghi chú tương tự trong core/technique/Technique.ts.
  icon?: string

  // Naming-principles pass (2026-08-14) — thay `grade: number` cũ,
  // xem Pill.ts's ghi chú tương tự.
  pham: Pham

  trigger: PassiveTrigger

  modifiers: StatModifier[]
}
