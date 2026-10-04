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
  /**
   * M10 (ARCH-008) - user-locked retirement (2026-09-14): a retired family
   * keeps its data (herb chain, bag entries on old saves, in-flight alchemy
   * jobs resolve) but is explicitly UNAVAILABLE on craftable + usable
   * surfaces - generated recipes/pills carry `retired: true`, the craft
   * gate and the consume gate both reject it.
   */
  retired?: boolean
}

/** Nguon su that duy nhat cho tam loai dan va tam loai linh thao tuong ung. */
export const PILL_FAMILIES: readonly PillFamilyDefinition[] = [
  { id: 'tu_linh_dan', name: 'Tụ Linh Đan', herbId: 'tu_linh_thao', herbName: 'Tụ Linh Thảo', effect: { kind: 'cultivation' } },
  // Hoi Xuan Dan - retired 2026-09-14 per user decision (ARCH-008 / M10);
  // classified DEFERRED per QI-D8 (M-QI-04): identity/data tolerance kept
  // (material defs, retired-marked recipes, old-save bag entries, in-flight
  // alchemy jobs), but the family is removed from the live chapter loop -
  // pruned from the Dong Thien grotto pool and its daily quest retargeted
  // to Tu Linh Thao - until a real effect/sink is authored.
  { id: 'hoi_xuan_dan', name: 'Hồi Xuân Đan', herbId: 'hoi_xuan_thao', herbName: 'Hồi Xuân Thảo', effect: { kind: 'hp_regen' }, retired: true },
  { id: 'hoi_linh_dan', name: 'Hồi Linh Đan', herbId: 'hoi_linh_thao', herbName: 'Hồi Linh Thảo', effect: { kind: 'mp_regen' } },
  { id: 'phi_van_dan', name: 'Phi Vân Đan', herbId: 'phi_van_thao', herbName: 'Phi Vân Thảo', effect: { kind: 'permanent_stat', stat: 'dexterity' } },
  { id: 'to_cot_dan', name: 'Tố Cốt Đan', herbId: 'to_cot_thao', herbName: 'Tố Cốt Thảo', effect: { kind: 'permanent_stat', stat: 'strength' } },
  { id: 'thoi_the_dan', name: 'Thối Thể Đan', herbId: 'thoi_the_thao', herbName: 'Thối Thể Thảo', effect: { kind: 'permanent_stat', stat: 'vitality' } },
  { id: 'duong_than_dan', name: 'Dưỡng Thần Đan', herbId: 'duong_than_thao', herbName: 'Dưỡng Thần Thảo', effect: { kind: 'permanent_stat', stat: 'intelligence' } },
  { id: 'khai_linh_dan', name: 'Khải Linh Đan', herbId: 'khai_linh_hoa', herbName: 'Khải Linh Hoa', effect: { kind: 'permanent_stat', stat: 'attunement' } },
] as const

/**
 * economy-review 2026-10-04: per-realm recipe availability. Family-level
 * `retired` retires the whole family; the mp_regen line is additionally
 * retired AT MORTAL only - maxMp/manaRegenPerTurn are spell-domain stats
 * that stay 0 until the qi_refining spell path unlocks, so the mortal
 * recipe is a dead craft while later-realm recipes stay live.
 * One predicate owns both surfaces that gate on it: the generated recipe
 * flag (alchemyRecipes) and the Dong Thien grotto herb pool
 * (ProductionCatalog).
 */
export function isPillFamilyRecipeLiveAtRealm(
  family: PillFamilyDefinition,
  realmId: string,
): boolean {
  if (family.retired === true) return false
  if (family.effect.kind === 'mp_regen' && realmId === 'mortal') return false
  return true
}
