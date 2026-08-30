import { computed, type ComputedRef, type Ref } from 'vue'
import type { Material } from '@/core/material/Material'
import { REALMS } from '@/data/realms/realm'
import { PILL_FAMILIES } from '@/data/pill/PillFamilies'

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

// Quáng/Gỗ phân phẩm DÙNG NHÃN TUỔI thống nhất với Linh Thảo (spec
// 2026-08-30-unify-material-quality-names-design.md — id quality giữ
// nguyên `hoang..tien`, chỉ nhãn hiển thị đổi sang hệ tuổi). Vẫn gộp
// theo "họ" gỗ/quáng resourceKind+realmId, badge hiện bậc cao nhất đang
// sở hữu.
const QUALITY_LABELS: Record<string, string> = {
  hoang: 'Thập Niên',
  huyen: 'Bách Niên',
  dia: 'Thiên Niên',
  thien: 'Vạn Niên',
  tien: 'Thượng Cổ',
}

const QUALITY_ORDER = ['hoang', 'huyen', 'dia', 'thien', 'tien']

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

/** Số phẩm hoang..tien để chọn badge/đại diện "cao nhất" — như ageRank nhưng cho Gỗ/Quáng. */
export function qualityRank(quality: string | undefined): number {
  if (!quality) return -1

  return QUALITY_ORDER.indexOf(quality)
}

/**
 * Rank biến thể DÙNG CHUNG cho mọi kiểu họ gộp (thảo theo niên đại, gỗ/
 * quáng theo phẩm) — biến thể "cao nhất" làm đại diện icon/tooltip và
 * badge. Material không có age/quality (vd. gỗ mặc định không phẩm) xếp
 * thấp nhất (-1), giống hành vi ageRank cũ.
 */
export function variantRank(material: Material): number {
  const meta = material.profession

  if (meta?.age !== undefined) return ageRank(meta.age)
  if (meta?.quality !== undefined) return qualityRank(meta.quality)

  return -1
}

function variantLabel(material: Material): string | undefined {
  const meta = material.profession

  if (meta?.age !== undefined) return ageLabel(meta.age, material.years)
  if (meta?.quality !== undefined) return QUALITY_LABELS[meta.quality]

  return undefined
}

/**
 * Tên GỐC của họ (bỏ prefix tuổi) — tên material giờ có dạng
 * "<Tuổi> <Tên gốc>" (spec 2026-08-30-unify-material-quality-names);
 * ô gộp họ hiển thị tên gốc, tuổi/chất đã có trong badge nên không
 * lặp. Material legacy không khớp prefix nào giữ nguyên tên.
 */
export function baseNameFor(material: Material): string {
  const label = variantLabel(material)

  if (label && material.name.startsWith(`${label} `)) {
    return material.name.slice(label.length + 1)
  }

  return material.name
}

/** Khoá gộp họ: thảo theo herbBaseId, gỗ/quáng theo resourceKind+realmId — undefined nếu không gộp. */
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
    const rank = variantRank(variant.material)

    return rank > acc.rank ? { rank, variant } : acc
  }, { rank: Number.NEGATIVE_INFINITY, variant: family.variants[0]! })

  const label = variantLabel(best.variant.material)

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

      // Gộp theo HỌ: thảo theo herbBaseId, gỗ/quáng theo resourceKind+
      // realmId — material legacy không có meta đi theo đường riêng.
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
