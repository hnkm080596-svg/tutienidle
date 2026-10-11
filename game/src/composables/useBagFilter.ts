import { computed, type ComputedRef, type Ref } from 'vue'
import type { Material } from '@/core/material/Material'

// Filter/search cho MaterialBag (economy-fixes-sinks-plan.md sec3.2 B4).
// Tach thuan function khoi component de de test va tai dung.

// Nhom hien thi - gop cac category material nho (monster_core/
// spirit_stone/byproduct/other) ve "khac". Composable thuan function
// KHONG import i18n (core/composables rule) - tra ve KEY locale, consumer
// render qua t(key) (pattern useBagFilter -> MaterialBagSection).
export type MaterialGroup = 'wood' | 'ore' | 'herb' | 'essence' | 'other'

export const MATERIAL_GROUPS: readonly MaterialGroup[] = ['wood', 'ore', 'herb', 'essence', 'other']

export const GROUP_LABEL_KEYS: Record<MaterialGroup, string> = {
  wood: 'bag.filter.group.wood',
  ore: 'bag.filter.group.ore',
  herb: 'bag.filter.group.herb',
  essence: 'bag.filter.group.essence',
  other: 'bag.filter.group.other',
}

export function groupLabelKey(group: MaterialGroup): string {
  return GROUP_LABEL_KEYS[group]
}

export function toMaterialGroup(category: Material['category']): MaterialGroup {
  if (category === 'wood' || category === 'ore' || category === 'herb' || category === 'essence') {
    return category
  }

  return 'other'
}

/** Normalize ten tim kiem: lowercase + bo dau tieng Viet (NFD strip). */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** So nien dai de so sanh bac tuoi - thieu meta xep thap nhat. */
export function ageRank(age: string | undefined): number {
  switch (age) {
    case 'decade': return 0
    case 'century': return 1
    case 'millennium': return 2
    case 'myriad_year': return 3
    case 'thuong_co': return 4
    default: return -1
  }
}

/**
 * Rank bien the (thao/go/quang theo tuoi) - dung cho cac consumer can
 * so sanh nien dai material (tooltip, pick-mode). Material khong co
 * age (vd. material legacy) xep thap nhat (-1).
 */
export function variantRank(material: Material): number {
  const meta = material.profession

  return meta?.age !== undefined ? ageRank(meta.age) : -1
}

/**
 * Chat axis of a material = its NIEN DAI tier (owner ruling 2026-10-11:
 * nguyen lieu co Pham + Chat giong trang bi). 5 tang ageRank(0..4) anh
 * xa len thang Chat 1-5 y het itemQualityRank cua equipment; material
 * khong co age meta tra undefined (khong streak, nhu Chat 1).
 */
export function materialChatRank(material: Material): number | undefined {
  const rank = variantRank(material)
  return rank >= 0 ? rank + 1 : undefined
}

export interface FilteredMaterial {
  /** Khoa on dinh cho grid - chinh material.id. */
  key: string

  material: Material

  amount: number
}

export interface BagFilterOptions {
  searchQuery: Ref<string>

  activeGroup: Ref<MaterialGroup | 'all'>
}

export interface BagFilterState {
  /** Item da loc - moi stack material 1 phan tu, dung cho sort/pagination. */
  filtered: ComputedRef<FilteredMaterial[]>

  /** So o hien thi sau loc - dem UI. */
  visibleCount: ComputedRef<number>

  /** Co dang ap dung filter nao khong (search hoac nhom khac 'all'). */
  isFiltering: ComputedRef<boolean>

  clear: () => void
}

export function useBagFilter(
  entries: ComputedRef<{ material: Material; amount: number }[]>,
  options: BagFilterOptions,
): BagFilterState {
  const { searchQuery, activeGroup } = options

  const filtered = computed<FilteredMaterial[]>(() => {
    const query = normalizeSearchText(searchQuery.value.trim())

    // Moi stack material 1 phan tu - nien dai nao cung la o rieng
    // (owner ruling: khong gop theo ho).
    const result: FilteredMaterial[] = []

    for (const entry of entries.value) {
      // Filter nhom truoc.
      const group = toMaterialGroup(entry.material.category)

      if (activeGroup.value !== 'all' && group !== activeGroup.value) {
        continue
      }

      // Search theo ten (da normalize bo dau).
      if (query && !normalizeSearchText(entry.material.name).includes(query)) {
        continue
      }

      result.push({
        key: entry.material.id,
        material: entry.material,
        amount: entry.amount,
      })
    }

    return result
  })

  const visibleCount = computed(() => filtered.value.length)

  const isFiltering = computed(
    () => searchQuery.value.trim() !== '' || activeGroup.value !== 'all',
  )

  function clear() {
    searchQuery.value = ''

    activeGroup.value = 'all'
  }

  return { filtered, visibleCount, isFiltering, clear }
}

// ===== Generic name-search + single-axis group filter (C1) =====
// Material keeps the specialized composable above; equipment/pill only
// need search + one group dimension. Group identity
// is a plain string so consumers pick their own axis (equipment slot,
// pill effect type) without this file importing domain types.

export interface EntryFilterOptions<G extends string = string> {
  searchQuery: Ref<string>

  activeGroup: Ref<G | 'all'>
}

export interface EntryFilterState<T> {
  filtered: ComputedRef<T[]>

  visibleCount: ComputedRef<number>

  isFiltering: ComputedRef<boolean>

  clear: () => void
}

export function useEntryFilter<T>(
  entries: ComputedRef<T[]>,
  options: EntryFilterOptions,
  matchers: {
    name: (entry: T) => string
    group: (entry: T) => string
  },
): EntryFilterState<T> {
  const { searchQuery, activeGroup } = options

  const filtered = computed<T[]>(() => {
    const query = normalizeSearchText(searchQuery.value.trim())

    return entries.value.filter((entry) => {
      if (activeGroup.value !== 'all' && matchers.group(entry) !== activeGroup.value) {
        return false
      }

      return !query || normalizeSearchText(matchers.name(entry)).includes(query)
    })
  })

  const visibleCount = computed(() => filtered.value.length)

  const isFiltering = computed(
    () => searchQuery.value.trim() !== '' || activeGroup.value !== 'all',
  )

  function clear() {
    searchQuery.value = ''

    activeGroup.value = 'all'
  }

  return { filtered, visibleCount, isFiltering, clear }
}

// Pill group axis = first effect type (mirrors the 'effect' sort
// comparator, which also reads effects[0].type). 'other' catches pills
// with no effects. Label keys resolved by consumer via t().
export type PillEffectGroup =
  | 'heal' | 'cultivation' | 'permanent_stat' | 'random_main_stat'
  | 'regen' | 'skill_insight' | 'buff' | 'other'

export const PILL_EFFECT_GROUPS: readonly PillEffectGroup[] = [
  'cultivation', 'heal', 'regen', 'buff', 'permanent_stat', 'random_main_stat', 'skill_insight', 'other',
]

export const PILL_EFFECT_GROUP_LABEL_KEYS: Record<PillEffectGroup, string> = {
  cultivation: 'bag.filter.pillEffect.cultivation',
  heal: 'bag.filter.pillEffect.heal',
  regen: 'bag.filter.pillEffect.regen',
  buff: 'bag.filter.pillEffect.buff',
  permanent_stat: 'bag.filter.pillEffect.permanentStat',
  random_main_stat: 'bag.filter.pillEffect.randomMainStat',
  skill_insight: 'bag.filter.pillEffect.skillInsight',
  other: 'bag.filter.group.other',
}
