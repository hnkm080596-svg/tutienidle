import { computed, type ComputedRef, type Ref } from 'vue'
import type { Material } from '@/core/material/Material'
import { REALMS } from '@/data/realms/realm'

// Filter/search/gộp họ cho MaterialBag (economy-fixes-sinks-plan.md §3.2 B4).
// Tách thuần function khỏi component để dễ test và tái dùng.

// Nhóm hiển thị — gộp các category material nhỏ (monster_core/
// spirit_stone/byproduct/other) về "khác".
export type MaterialGroup = 'wood' | 'ore' | 'herb' | 'essence' | 'other'

export const MATERIAL_GROUPS: readonly MaterialGroup[] = ['wood', 'ore', 'herb', 'essence', 'other']

export const GROUP_LABELS: Record<MaterialGroup, string> = {
  wood: 'Gỗ',
  ore: 'Quặng',
  herb: 'Thảo',
  essence: 'Tinh Hoa',
  other: 'Khác',
}

export function toMaterialGroup(category: Material['category']): MaterialGroup {
  if (category === 'wood' || category === 'ore' || category === 'herb' || category === 'essence') {
    return category
  }

  return 'other'
}

const AGE_LABELS: Record<string, string> = {
  decade: 'Thập Niên',
  century: 'Bách Niên',
  millennium: 'Thiên Niên',
  myriad_year: 'Vạn Niên',
}

const REALM_NAME_BY_ID: Readonly<Record<string, string>> = Object.fromEntries(
  REALMS.map((realm) => [realm.id, realm.name]),
)

export function realmLabel(realmId: string): string {
  return REALM_NAME_BY_ID[realmId] ?? realmId
}

export function ageLabel(age: string | undefined, years: number | undefined): string | undefined {
  if (age && AGE_LABELS[age]) {
    return AGE_LABELS[age]
  }

  return years !== undefined ? `${years} năm` : undefined
}

/** Normalize tên tìm kiếm: lowercase + bỏ dấu tiếng Việt (NFD strip). */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Số niên đại để chọn badge "rộng nhất" — thiếu meta xếp thấp nhất. */
export function ageRank(age: string | undefined): number {
  switch (age) {
    case 'decade': return 0
    case 'century': return 1
    case 'millennium': return 2
    case 'myriad_year': return 3
    default: return -1
  }
}

export interface HerbVariant {
  material: Material

  amount: number
}

export interface HerbFamilyGroup {
  herbBaseId: string

  /** Tên hiển thị lấy từ biến thể đầu tiên gặp. */
  name: string

  realmId: string

  variants: HerbVariant[]

  /** Badge hiển thị: "Phàm Nhân · Thập Niên" (niên đại rộng nhất họ). */
  badgeLabel: string
}

export interface FilteredMaterial {
  /** Khóa ổn định cho grid — material riêng hoặc herbBaseId của họ. */
  key: string

  material: Material

  /** Tổng amount của họ thảo (cộng dồn biến thể). */
  amount: number

  /** Họ thảo đã gộp — render thành 1 ô thay cho nhiều biến thể. */
  family?: HerbFamilyGroup
}

export interface BagFilterOptions {
  searchQuery: Ref<string>

  activeGroup: Ref<MaterialGroup | 'all'>
}

export interface BagFilterState {
  /** Item đã lọc + gộp họ thảo — đưa thẳng vào sort/pagination sau đó. */
  filtered: ComputedRef<FilteredMaterial[]>

  /** Số ô hiển thị sau lọc/gộp — đếm UI. */
  visibleCount: ComputedRef<number>

  /** Có đang áp dụng filter nào không (search hoặc nhóm khác 'all'). */
  isFiltering: ComputedRef<boolean>

  clear: () => void
}

function badgeFor(family: HerbFamilyGroup): string {
  const best = family.variants.reduce((acc, variant) => {
    const rank = ageRank(variant.material.profession?.age)

    return rank > acc.rank ? { rank, variant } : acc
  }, { rank: Number.NEGATIVE_INFINITY, variant: family.variants[0]! })

  const label = ageLabel(best.variant.material.profession?.age, best.variant.material.years)

  return label ? `${realmLabel(family.realmId)} · ${label}` : realmLabel(family.realmId)
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
      // Filter nhóm trước.
      const group = toMaterialGroup(entry.material.category)

      if (activeGroup.value !== 'all' && group !== activeGroup.value) {
        continue
      }

      // Search theo tên (đã normalize bỏ dấu).
      if (query && !normalizeSearchText(entry.material.name).includes(query)) {
        continue
      }

      const meta = entry.material.profession

      // Gộp thảo theo HỌ (herbBaseId) — thảo legacy không có meta đi
      // theo đường material riêng.
      if (meta?.resourceKind === 'herb' && meta.herbBaseId) {
        const familyKey = meta.herbBaseId

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
              name: entry.material.name,
              realmId: meta.realmId,
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

    // Badge tính SAU khi gộp đủ biến thể — niên đại rộng nhất của họ,
    // đúng cả khi biến thể đến theo thứ tự niên đại bất kỳ.
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
