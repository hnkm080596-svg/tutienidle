import { computed, type ComputedRef, type Ref } from 'vue'
import type { Material } from '@/core/material/Material'
import { REALMS } from '@/data/realms/realm'
import { PILL_FAMILIES } from '@/data/pill/PillFamilies'

// Filter/search/gop ho cho MaterialBag (economy-fixes-sinks-plan.md sec3.2 B4).
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

const AGE_LABEL_KEYS: Record<string, string> = {
  decade: 'bag.filter.age.decade',
  century: 'bag.filter.age.century',
  millennium: 'bag.filter.age.millennium',
  myriad_year: 'bag.filter.age.myriadYear',
  thuong_co: 'bag.filter.age.thuongCo',
}

export function ageLabelKey(age: string | undefined): string | null {
  return (age && AGE_LABEL_KEYS[age]) || null
}

// gp123 6E (task C2): Go/Quang dung CUNG truc tuoi voi Linh Thao - id
// `<realm>_wood_<age>` / `<realm>_ore_<age>`. He nhan chat cu
// (QUALITY_LABEL_KEYS/DATA_QUALITY_LABELS/qualityRank) da bi xoa cung
// id pham hoang..tien. Van gop theo "ho" go/quang resourceKind+realmId,
// badge hien bac tuoi cao nhat dang so huu.

const REALM_NAME_BY_ID: Readonly<Record<string, string>> = Object.fromEntries(
  REALMS.map((realm) => [realm.id, realm.name]),
)

export function realmLabel(realmId: string): string {
  return REALM_NAME_BY_ID[realmId] ?? realmId
}

/** Normalize ten tim kiem: lowercase + bo dau tieng Viet (NFD strip). */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** So nien dai de chon badge "rong nhat" - thieu meta xep thap nhat. */
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
 * Rank bien the DUNG CHUNG cho moi kieu ho gop (thao/go/quang theo tuoi)
 * - bien the "cao nhat" lam dai dien icon/tooltip va badge. Material
 * khong co age (vd. material legacy) xep thap nhat (-1).
 */
export function variantRank(material: Material): number {
  const meta = material.profession

  return meta?.age !== undefined ? ageRank(meta.age) : -1
}

/** Prefix tuoi cua ten material ("Thap Nien Linh Moc" -> "Thap Nien") - ten data GOC vi, dung de strip prefix khi hien ten goc ho. */
function variantLabel(material: Material): string | undefined {
  const meta = material.profession

  return meta?.age !== undefined ? dataAgeLabel(meta.age, material.years) : undefined
}

// ===== Bang nhan DATA (vi goc) - KHONG phai UI label: ten material trong
// registry co dang "<Tuoi> <Ten goc>" (materials.ts), variantLabel chi
// dung de tach prefix do. Nhan HIEN THI cho user di qua locale key
// (ageLabelKey + t() o consumer). =====

const DATA_AGE_LABELS: Record<string, string> = {
  decade: 'Thập Niên',
  century: 'Bách Niên',
  millennium: 'Thiên Niên',
  myriad_year: 'Vạn Niên',
  thuong_co: 'Thượng Cổ',
}

function dataAgeLabel(age: string, years: number | undefined): string | undefined {
  if (DATA_AGE_LABELS[age]) {
    return DATA_AGE_LABELS[age]
  }

  return years !== undefined ? `${years} năm` : undefined
}

/**
 * Ten GOC cua ho (bo prefix tuoi) - ten material gio co dang
 * "<Tuoi> <Ten goc>" (spec 2026-08-30-unify-material-quality-names);
 * o gop ho hien thi ten goc, tuoi/chat da co trong badge nen khong
 * lap. Material legacy khong khop prefix nao giu nguyen ten.
 */
export function baseNameFor(material: Material): string {
  const label = variantLabel(material)

  if (label && material.name.startsWith(`${label} `)) {
    return material.name.slice(label.length + 1)
  }

  return material.name
}

/** Khoa gop ho: thao theo herbBaseId, go/quang theo resourceKind+realmId - undefined neu khong gop. */
function familyKeyFor(material: Material): string | undefined {
  const meta = material.profession

  if (!meta) return undefined

  if (meta.resourceKind === 'herb') return meta.herbBaseId

  if (meta.resourceKind === 'wood' || meta.resourceKind === 'ore') {
    return `${meta.resourceKind}:${meta.realmId}`
  }

  return undefined
}

export interface HerbVariant {
  material: Material

  amount: number
}

export interface HerbFamilyGroup {
  herbBaseId: string

  /** Ten hien thi lay tu bien the dau tien gap. */
  name: string

  realmId: string

  variants: HerbVariant[]

  /**
   * Badge: "Pham Nhan * Thap Nien" (nien dai rong nhat ho) - GHEP SAN
   * vi data realm + KEY locale bac tuoi ("{realm} * {badgeKey}") de
   * consumer t() 1 lan; bac chi co suffix so nam thi giu nguyen so.
   */
  badgeLabel: string
}

export interface FilteredMaterial {
  /** Khoa on dinh cho grid - material rieng hoac herbBaseId cua ho. */
  key: string

  material: Material

  /** Tong amount cua ho thao (cong don bien the). */
  amount: number

  /** Ho thao da gop - render thanh 1 o thay cho nhieu bien the. */
  family?: HerbFamilyGroup
}

export interface BagFilterOptions {
  searchQuery: Ref<string>

  activeGroup: Ref<MaterialGroup | 'all'>
}

export interface BagFilterState {
  /** Item da loc + gop ho thao - dua thang vao sort/pagination sau do. */
  filtered: ComputedRef<FilteredMaterial[]>

  /** So o hien thi sau loc/gop - dem UI. */
  visibleCount: ComputedRef<number>

  /** Co dang ap dung filter nao khong (search hoac nhom khac 'all'). */
  isFiltering: ComputedRef<boolean>

  clear: () => void
}

function badgeFor(family: HerbFamilyGroup): string {
  const best = family.variants.reduce((acc, variant) => {
    const rank = variantRank(variant.material)

    return rank > acc.rank ? { rank, variant } : acc
  }, { rank: Number.NEGATIVE_INFINITY, variant: family.variants[0]! })

  const meta = best.variant.material.profession

  const badgeKey = ageLabelKey(meta?.age)

  const realmName = realmLabel(family.realmId)

  return badgeKey ? `${realmName} · ${badgeKey}` : realmName
}

export function useBagFilter(
  entries: ComputedRef<{ material: Material; amount: number }[]>,
  options: BagFilterOptions,
): BagFilterState {
  const { searchQuery, activeGroup } = options

  const filtered = computed<FilteredMaterial[]>(() => {
    const query = normalizeSearchText(searchQuery.value.trim())

    const grouped = new Map<string, FilteredMaterial>()

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

      const meta = entry.material.profession

      // Gop theo HO: thao theo herbBaseId, go/quang theo resourceKind+
      // realmId - material legacy khong co meta di theo duong rieng.
      const familyKey = familyKeyFor(entry.material)

      if (familyKey) {
        const existing = grouped.get(familyKey)

        if (existing?.family) {
          existing.amount += entry.amount
          existing.family.variants.push({ material: entry.material, amount: entry.amount })
        } else {
          grouped.set(familyKey, {
            key: familyKey,
            material: entry.material,
            amount: entry.amount,
            family: {
              herbBaseId: familyKey,
              name: baseNameFor(entry.material),
              realmId: meta!.realmId,
              variants: [{ material: entry.material, amount: entry.amount }],
              badgeLabel: '',
            },
          })
        }

        continue
      }

      const key = entry.material.id

      grouped.set(key, {
        key,
        material: entry.material,
        amount: entry.amount,
      })
    }

    // Badge tinh SAU khi gop du bien the - nien dai rong nhat cua ho,
    // dung ca khi bien the den theo thu tu nien dai bat ky.
    const result = Array.from(grouped.values())

    for (const item of result) {
      if (item.family) {
        item.family.badgeLabel = badgeFor(item.family)
      }
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
// Material keeps the specialized composable above (family grouping);
// equipment/pill only need search + one group dimension. Group identity
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
