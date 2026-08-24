import type { Zone } from '@/core/stage/Zone'

const mortalFloors = Array.from({ length: 10 }, (_, index) => `mortal_dong_${index + 1}`)

const qiFloors = [
  'qi_refining_forest',
  'qi_refining_deep_forest',
  'qi_refining_ember_canyon',
  'qi_refining_scorched_ridge',
  'qi_refining_sand_plain',
  'qi_refining_stone_range',
  'qi_refining_blade_peak',
  'qi_refining_mineral_pit',
  'qi_refining_mystic_marsh',
  'qi_refining_abyssal_pool',
]

const foundationFloors = Array.from({ length: 10 }, (_, index) => `foundation_floor_${index + 1}`)

export const zones: Zone[] = [
  {
    id: 'thanh_van',
    name: 'Thanh Vân',
    requiredRealmId: 'mortal',
    stageIds: [...mortalFloors, ...qiFloors, ...foundationFloors],
  },
]
