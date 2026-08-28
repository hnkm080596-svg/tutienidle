import type { MainStatKey } from '@/core/stats/StatTypes'

export type PillFamilyEffect =
  | { kind: 'cultivation' }
  | { kind: 'hp_regen' }
  | { kind: 'mp_regen' }
  | { kind: 'permanent_stat'; stat: MainStatKey }

export interface PillFamilyDefinition {
  id: string
  name: string
  herbId: string
  herbName: string
  effect: PillFamilyEffect
}

/** Nguồn sự thật duy nhất cho tám loại đan và tám loại linh thảo tương ứng. */
export const PILL_FAMILIES: readonly PillFamilyDefinition[] = [
  { id: 'tu_linh_dan', name: 'Tụ Linh Đan', herbId: 'tu_linh_thao', herbName: 'Tụ Linh Thảo', effect: { kind: 'cultivation' } },
  { id: 'hoi_xuan_dan', name: 'Hồi Xuân Đan', herbId: 'hoi_xuan_thao', herbName: 'Hồi Xuân Thảo', effect: { kind: 'hp_regen' } },
  { id: 'hoi_linh_dan', name: 'Hồi Linh Đan', herbId: 'hoi_linh_thao', herbName: 'Hồi Linh Thảo', effect: { kind: 'mp_regen' } },
  { id: 'phi_van_dan', name: 'Phi Vân Đan', herbId: 'phi_van_thao', herbName: 'Phi Vân Thảo', effect: { kind: 'permanent_stat', stat: 'dexterity' } },
  { id: 'to_cot_dan', name: 'Tố Cốt Đan', herbId: 'to_cot_thao', herbName: 'Tố Cốt Thảo', effect: { kind: 'permanent_stat', stat: 'strength' } },
  { id: 'thoi_the_dan', name: 'Thối Thể Đan', herbId: 'thoi_the_thao', herbName: 'Thối Thể Thảo', effect: { kind: 'permanent_stat', stat: 'vitality' } },
  { id: 'duong_than_dan', name: 'Dưỡng Thần Đan', herbId: 'duong_than_thao', herbName: 'Dưỡng Thần Thảo', effect: { kind: 'permanent_stat', stat: 'intelligence' } },
  { id: 'khai_linh_dan', name: 'Khải Linh Đan', herbId: 'khai_linh_hoa', herbName: 'Khải Linh Hoa', effect: { kind: 'permanent_stat', stat: 'attunement' } },
] as const
