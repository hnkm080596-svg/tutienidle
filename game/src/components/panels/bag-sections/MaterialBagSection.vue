<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SlotView from '../../common/SlotView.vue'
import Chip from '../../common/primitives/Chip.vue'
import BagPaginationControls, { type BagSortOption } from './BagPaginationControls.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useUiStore, type MaterialSortMode } from '@/stores/ui'
import { useBagPagination } from '@/composables/useBagPagination'
import { useBagGridLayout } from '@/composables/useBagGridLayout'
import {
  compareNumber,
  compareText,
  stableSort,
  withDirection,
} from '@/composables/useBagSort'
import {
  useBagFilter,
  variantRank,
  baseNameFor,
  groupLabelKey,
  MATERIAL_GROUPS,
  type FilteredMaterial,
  type MaterialGroup,
} from '@/composables/useBagFilter'
import { ELEMENT_LABELS } from '@/core/element/ElementLabels'
import { SPIRIT_STONE_LABEL } from '@/core/presentation/labels'
import { getProfessionGradeForRealm } from '@/core/profession/ProfessionGrade'
import { professionGradeRank } from '@/composables/slots/normalizeSlotRank'
import type { BagCell } from './BagCell'
import type { Material, MaterialCategory } from '@/core/material/Material'
import type { GradedItemTooltipContent } from '@/composables/useTooltip'

const { t } = useI18n({ useScope: 'local' })

// Thứ tự cố định cho sort theo Phân loại/Nguồn (asc).
const CATEGORY_ORDER: MaterialCategory[] = [
  'herb', 'wood', 'ore', 'monster_core', 'spirit_stone', 'essence', 'byproduct', 'other',
]

const SOURCE_ORDER: Material['sourceType'][] = ['boss', 'monster', 'building', 'exploration']

const SOURCE_LABELS = computed<Record<Material['sourceType'], string>>(() => ({
  boss: t('panels.bag.tooltip.sourceTypes.boss'),
  monster: t('panels.bag.tooltip.sourceTypes.monster'),
  building: t('panels.bag.tooltip.sourceTypes.building'),
  exploration: t('panels.bag.tooltip.sourceTypes.exploration'),
}))

const CATEGORY_LABELS = computed<Record<MaterialCategory, string>>(() => ({
  herb: t('panels.bag.tooltip.categories.herb'),
  wood: t('panels.bag.tooltip.categories.wood'),
  ore: t('panels.bag.tooltip.categories.ore'),
  monster_core: t('panels.bag.tooltip.categories.monsterCore'),
  spirit_stone: SPIRIT_STONE_LABEL,
  essence: t('panels.bag.tooltip.categories.essence'),
  byproduct: t('panels.bag.tooltip.categories.byproduct'),
  other: t('panels.bag.tooltip.categories.other'),
}))

const SORT_OPTIONS = computed<Array<BagSortOption & { value: MaterialSortMode }>>(() => [
  { value: 'category', label: t('panels.bag.sort.category') },
  { value: 'years', label: t('panels.bag.sort.years') },
  { value: 'amount', label: t('panels.bag.sort.amount') },
  {
    value: 'name',
    label: t('panels.bag.sort.name'),
    ascLabel: t('panels.bag.sort.nameAsc'),
    descLabel: t('panels.bag.sort.nameDesc'),
  },
  { value: 'source', label: t('panels.bag.sort.source') },
])

// Nhãn cảnh giới cho tooltip — người chơi không phân biệt được màu
// (color-blind) vẫn đọc được realm trên tooltip (spec §"Cảnh giới").
const REALM_LABELS = computed<Record<string, string>>(() => ({
  mortal: t('panels.bag.tooltip.realms.mortal'),
  qi_refining: t('panels.bag.tooltip.realms.qiRefining'),
  foundation_establishment: t('panels.bag.tooltip.realms.foundationEstablishment'),
  golden_core: t('panels.bag.tooltip.realms.goldenCore'),
  nascent_soul: t('panels.bag.tooltip.realms.nascentSoul'),
  soul_transformation: t('panels.bag.tooltip.realms.soulTransformation'),
  void_refinement: t('panels.bag.tooltip.realms.voidRefinement'),
  body_integration: t('panels.bag.tooltip.realms.bodyIntegration'),
  mahayana: t('panels.bag.tooltip.realms.mahayana'),
  tribulation: t('panels.bag.tooltip.realms.tribulation'),
}))

const AGE_LABELS = computed<Record<string, string>>(() => ({
  decade: t('panels.bag.tooltip.ages.decade'),
  century: t('panels.bag.tooltip.ages.century'),
  millennium: t('panels.bag.tooltip.ages.millennium'),
  myriad_year: t('panels.bag.tooltip.ages.myriadYear'),
  thuong_co: t('panels.bag.tooltip.ages.thuongCo'),
}))

function buildTooltip(material: Material, owned: number): GradedItemTooltipContent {
  const realmId = material.profession?.realmId
  const realmText = realmId ? REALM_LABELS.value[realmId] : undefined

  const rows = [
    { label: t('panels.bag.tooltip.category'), value: CATEGORY_LABELS.value[material.category] },
    { label: t('panels.bag.tooltip.source'), value: SOURCE_LABELS.value[material.sourceType] },
    ...(realmText ? [{ label: t('panels.bag.tooltip.realm'), value: realmText }] : []),
  ]

  if (material.profession?.age) {
    rows.push({
      label: t('panels.bag.tooltip.age'),
      value: AGE_LABELS.value[material.profession.age] ?? t('panels.bag.tooltip.yearsSuffix', { count: material.years ?? 0 }),
    })
  } else if (material.years !== undefined) {
    rows.push({ label: t('panels.bag.tooltip.age'), value: t('panels.bag.tooltip.yearsSuffix', { count: material.years }) })
  }
  if (material.element !== undefined)
    rows.push({ label: t('panels.bag.tooltip.element'), value: ELEMENT_LABELS[material.element] })

  return {
    kind: 'material',
    name: material.name,
    imagePath: material.icon,
    ownedLabel: t('panels.bag.tooltip.owned', { count: owned }),
    description: material.description,
    sections: [{ label: t('panels.bag.tooltip.section'), rows }],
  }
}

const ui = useUiStore()

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

// Grid responsive theo CHIỀU RỘNG THẬT của .bag-section__grid (đo qua
// ResizeObserver, xem useBagGridLayout.ts) — cột/kích thước ô tự tính
// lại mỗi khi container resize, KHÔNG còn 1 slotPx cố định suy từ %
// chiều cao panel như bản cũ.
const { gridRef, pageSize, gridStyle } = useBagGridLayout()

interface MaterialEntry {
  cell: BagCell

  material: Material

  amount: number
}

// Màu theo phẩm nghề cảnh giới (spec 2026-08-30-unify-material-quality-
// names-design.md): nhìn TÊN biết tuổi/chất, nhìn MÀU (tên + khung) biết
// realm. Material không có profession meta (linh thạch, legacy...) không
// tô — undefined = màu mặc định.
function professionRankOf(material: Material): number | undefined {
  const realmId = material.profession?.realmId

  if (!realmId) {
    return undefined
  }

  const grade = getProfessionGradeForRealm(realmId)

  return grade ? professionGradeRank(grade) : undefined
}

// Tên material tô màu phẩm realm qua NameSegment — dùng cho mọi ô có
// material (single + family).
function materialNameSegments(material: Material, trailing?: { text: string; colorVar: string }) {
  const rank = professionRankOf(material)

  const segments = [
    {
      text: material.name,
      colorVar: rank === undefined ? undefined : `--rank-color-${rank}`,
    },
  ]

  return trailing ? [...segments, trailing] : segments
}

const entries = computed<MaterialEntry[]>(() => {
  stateVersion.value

  return gameManager.materialBag.getAll().map((stack) => ({
    material: stack.material,

    amount: stack.amount,

    cell: {
      key: stack.material.id,

      label: stack.material.name,

      description: stack.material.description,

      amount: stack.amount,

      icon: stack.material.icon,

      tooltip: buildTooltip(stack.material, stack.amount),

      rarityRank: professionRankOf(stack.material),

      // Material chỉ có 1 trục rank (Phẩm Nghề, 1-10) — feed vào prop
      // rarityRank (mặc định trần 5, thang itemQualityRank equipment)
      // nên PHẢI kèm rarityRankScale: 10, nếu không rank 5 (Ngũ Phẩm,
      // giữa thang) bị hiểu nhầm là kịch trần (Fix 1, final review).
      rarityRankScale: 10,

      nameSegments: materialNameSegments(stack.material),
    },
  }))
})

// ================= Filter/search/gộp họ (plan §3.2 B4) =================
// State filter sống trong phiên (cùng nhóm transient với bagSorts,
// KHÔNG ghi save). Filter chạy TRƯỚC sort + pagination.
const searchQuery = ref('')

const activeGroup = ref<MaterialGroup | 'all'>('all')

// entries map về shape {material, amount} — composable không biết BagCell.
const filterInput = computed(() =>
  entries.value.map((entry) => ({ material: entry.material, amount: entry.amount })),
)

const { filtered, visibleCount } = useBagFilter(filterInput, { searchQuery, activeGroup })

// Material của 1 ô họ thảo: biến thể niên đại CAO NHẤT làm đại diện
// tooltip/icon (badge đã hiện realm + niên đại rộng nhất trên ô).
function representativeMaterial(item: FilteredMaterial): Material {
  const variants = item.family?.variants

  if (!variants) {
    return item.material
  }

  return variants.reduce((best, variant) =>
    variantRank(variant.material) > variantRank(best.material)
      ? { material: variant.material, amount: 0 }
      : best,
  { material: variants[0]!.material, amount: 0 }).material
}

// Badge họ: composable ghép sẵn "{realmVi} · {badgeKey}" — tách lấy KEY
// bậc tuổi rồi t() (realm ghép sẵn là tên data vi; các realm đã có đủ
// nhãn trong locale nếu cần tách sau).
function familyBadgeLabel(item: FilteredMaterial): string {
  const badge = item.family?.badgeLabel ?? ''
  const separator = badge.indexOf(' · ')

  if (separator === -1) return badge

  return `${badge.slice(0, separator)} · ${t(badge.slice(separator + 3))}`
}

function familyCell(item: FilteredMaterial): BagCell {
  const material = representativeMaterial(item)

  // Ô họ hiển thị TÊN GỐC (không prefix tuổi — badge đã ghi
  // realm · bậc cao nhất, tránh lặp tuổi hai lần trên cùng ô).
  const baseLabel = baseNameFor(material)

  const baseRank = professionRankOf(material)

  const badge = familyBadgeLabel(item)

  return {
    key: item.key,

    label: baseLabel,

    description: material.description,

    amount: item.amount,

    icon: material.icon,

    tooltip: buildTooltip(material, item.amount),

    rarityRank: baseRank,

    rarityRankScale: 10,

    nameSegments: [
      { text: baseLabel, colorVar: baseRank === undefined ? undefined : `--rank-color-${baseRank}` },
      ...(badge ? [{ text: badge, colorVar: '--text-muted' }] : []),
    ],
  }
}

// Ô filter bar: tìm kiếm theo tên + chip nhóm (bấm lại chip đang chọn
// để bỏ filter nhóm). Nhãn chip qua key-mapping composable (useBagFilter
// không import i18n) → t(key).
const GROUP_CHIPS = computed<Array<{ value: MaterialGroup | 'all'; label: string }>>(() => [
  { value: 'all', label: t('panels.bag.groups.all') },
  ...MATERIAL_GROUPS.map((group) => ({ value: group, label: t(groupLabelKey(group)) })),
])

function toggleGroup(value: MaterialGroup | 'all') {
  activeGroup.value = activeGroup.value === value ? 'all' : value
}

// ================= Sort (giữ nguyên hành vi Workstream E) =================
// Filter chạy TRƯỚC sort; sort trên MỘT BẢN COPY (stableSort) rồi mới
// pagination. Họ thảo đã gộp sort theo tên họ.
const MATERIAL_COMPARATORS: Record<Exclude<MaterialSortMode, 'default'>, (a: FilteredMaterial, b: FilteredMaterial) => number> = {
  category: (a, b) =>
    CATEGORY_ORDER.indexOf(a.material.category) - CATEGORY_ORDER.indexOf(b.material.category),

  years: (a, b) => compareNumber(a.material.years, b.material.years),

  amount: (a, b) => a.amount - b.amount,

  name: (a, b) => compareText(a.material.name, b.material.name),

  source: (a, b) =>
    SOURCE_ORDER.indexOf(a.material.sourceType) - SOURCE_ORDER.indexOf(b.material.sourceType),
}

// Ghim Linh Thạch ở ô đầu (plan Workstream D) — chạy TRƯỚC comparator
// sort thường, KHÔNG qua withDirection(), áp dụng ở MỌI mode (kể cả
// default) và cả hai direction.
function comparePinned(a: FilteredMaterial, b: FilteredMaterial): number {
  const aPinned = a.material.category === 'spirit_stone'
  const bPinned = b.material.category === 'spirit_stone'

  if (aPinned === bPinned) return 0

  return aPinned ? -1 : 1
}

const cells = computed<BagCell[]>(() => {
  const sortState = ui.bagSorts.material

  const normalCompare: (a: FilteredMaterial, b: FilteredMaterial) => number =
    sortState.mode === 'default'
      ? () => 0
      : withDirection(MATERIAL_COMPARATORS[sortState.mode], sortState.direction)

  const sorted = stableSort(
    filtered.value,
    (a, b) => comparePinned(a, b) || normalCompare(a, b),
  )

  return sorted.map((item) =>
    item.family
      ? familyCell(item)
      : {
          key: item.material.id,
          label: item.material.name,
          description: item.material.description,
          amount: item.amount,
          icon: item.material.icon,
          tooltip: buildTooltip(item.material, item.amount),
          rarityRank: professionRankOf(item.material),
          rarityRankScale: 10,
          nameSegments: materialNameSegments(item.material),
        },
  )
})

const { currentPage, totalPages, goToPage, resetPage, gridCells } = useBagPagination(cells, pageSize)

// Đổi mode/direction/filter → quay về trang đầu.
watch(
  () => ({ ...ui.bagSorts.material }),
  () => resetPage(),
)

watch([searchQuery, activeGroup], () => resetPage())
</script>

<template>
  <div class="bag-section">
    <div class="bag-section__filters">
      <input
        v-model="searchQuery"
        type="search"
        class="bag-section__search"
        :placeholder="t('panels.bag.search.materialPlaceholder')"
        :aria-label="t('panels.bag.search.materialAria')"
      >

      <div class="bag-section__chips" role="group" :aria-label="t('panels.bag.filterAria')">
        <Chip
          v-for="chip in GROUP_CHIPS"
          :key="chip.value"
          :active="activeGroup === chip.value"
          @click="toggleGroup(chip.value)"
        >
          {{ chip.label }}
        </Chip>
      </div>

      <span class="bag-section__count">{{ visibleCount }} {{ t('panels.bag.countUnitSuffix') }}</span>
    </div>

    <div ref="gridRef" class="bag-section__grid" :style="gridStyle">
      <SlotView
        v-for="(cell, index) in gridCells"
        :key="cell?.key ?? index"
        class="bag-section__slot"
        :item="cell"
        :label="cell?.label"
        :description="cell?.description"
        :amount="cell?.amount"
        :icon="cell?.icon"
        :tooltip="cell?.tooltip"
        :rarity-rank="cell?.rarityRank"
        :rarity-rank-scale="cell?.rarityRankScale"
        :name-segments="cell?.nameSegments"
      />
    </div>

    <BagPaginationControls
      :current-page="currentPage"
      :total-pages="totalPages"
      :sort-options="SORT_OPTIONS"
      :active-mode="ui.bagSorts.material.mode"
      :active-direction="ui.bagSorts.material.direction"
      @go-to-page="goToPage"
      @select-mode="(mode) => ui.setBagSortMode('material', mode as MaterialSortMode)"
      @toggle-direction="ui.toggleBagSortDirection('material')"
      @reset-sort="ui.resetBagSort('material')"
    />
  </div>
</template>

<style scoped>
.bag-section {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 6px;
}

.bag-section__filters {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.bag-section__search {
  flex: 1 1 120px;
  min-width: 0;
  min-height: var(--tap-min);
  padding: 0 var(--space-2);
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: var(--text-xs);
}

.bag-section__search::placeholder {
  color: var(--text-muted);
}

.bag-section__search:focus-visible {
  outline: none;
  border-color: var(--chrome-300);
  box-shadow: var(--focus-ring-chrome);
}

.bag-section__chips {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.bag-section__count {
  color: var(--paper-text-muted);
  font-size: var(--text-xs);
  white-space: nowrap;
}

.bag-section__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(var(--grid-columns), minmax(0, 1fr));
  align-content: start;
  gap: var(--grid-gap);
  overflow: hidden;
}

.bag-section__slot {
  width: 100%;
  aspect-ratio: 1 / 1;
}
</style>
