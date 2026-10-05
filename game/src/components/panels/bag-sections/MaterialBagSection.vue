<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SlotView from '../../common/SlotView.vue'
import InkNineSlice from '../../common/primitives/InkNineSlice.vue'
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
import { betaMaterialStackVisible } from '@/core/betaScope'
import { usePlayerStore } from '@/stores/player'
import type { BagCell } from './BagCell'
import type { Material, MaterialCategory } from '@/core/material/Material'
import { createMaterialTooltipBuilder, materialRealmLabel, professionRankOfMaterial } from '@/composables/useMaterialTooltip'

const { t } = useI18n()

// Canonical material item-info card - shared with drop previews
// (exploration reward cells) via the extracted builder factory.
const buildTooltip = createMaterialTooltipBuilder(t)

// Thu tu co dinh cho sort theo Phan loai/Nguon (asc).
const CATEGORY_ORDER: MaterialCategory[] = [
  'herb', 'wood', 'ore', 'monster_core', 'spirit_stone', 'essence', 'byproduct', 'other',
]

// ui-audit economy M3: material categories without icon art
// (spirit_stone/monster_core/essence/byproduct/other) all rendered the
// SAME gray letter monogram, so distinct resources looked identical.
// Each icon-less cell now carries a category accent var that tints the
// monogram disc (see the :deep rule on .bag-section__slot).
const CATEGORY_ACCENT: Record<MaterialCategory, string> = {
  herb: 'var(--jade)',
  wood: 'var(--chrome-500)',
  ore: 'var(--rank-color-5)',
  monster_core: 'var(--cinnabar)',
  spirit_stone: 'var(--mineral-gold)',
  essence: 'var(--rank-color-7)',
  byproduct: 'var(--chrome-300)',
  other: 'var(--surface-text-muted)',
}

type MaterialBagCell = BagCell & { accentVar?: string }

function accentFor(material: Material): string | undefined {
  return material.icon ? undefined : CATEGORY_ACCENT[material.category]
}

const SOURCE_ORDER: Material['sourceType'][] = ['boss', 'monster', 'building', 'exploration']

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

// Material item-info card builder now lives in useMaterialTooltip.ts -
// see createMaterialTooltipBuilder above.

const ui = useUiStore()

const gameManager = useGameManager()
const player = usePlayerStore()

const { stateVersion } = useStateVersion()

// Grid responsive theo CHIEU RONG THAT cua .bag-section__grid (do qua
// ResizeObserver, xem useBagGridLayout.ts) - cot/kich thuoc o tu tinh
// lai moi khi container resize, KHONG con 1 slotPx co dinh suy tu %
// chieu cao panel nhu ban cu.
const { gridRef, pageSize, gridStyle } = useBagGridLayout()

interface MaterialEntry {
  cell: MaterialBagCell

  material: Material

  amount: number
}

// Material name segments - text structure only (item-info-card spec
// 2026-09-14); display color lives on the tooltip payload. Used for
// every material cell (single + family).
function materialNameSegments(material: Material, trailing?: { text: string }) {
  const segments = [{ text: material.name }]

  return trailing ? [...segments, trailing] : segments
}

// Cell aria override (spec section 5b): "{name}, {realm}" so the Pham
// axis is readable without color - the realm text is the material's
// Pham axis.
function materialAccessibleLabel(name: string, material: Material): string {
  const realmId = material.profession?.realmId
  const realmText = materialRealmLabel(realmId, t)

  return realmText ? `${name}, ${realmText}` : name
}

const entries = computed<MaterialEntry[]>(() => {
  stateVersion.value

  // BETA SCOPE LOCK v2 - a source-suppressed material (the companion
  // pull token, whose recurring faucets are all gated at the policy
  // layer) renders in no live bag cell: CurrencyHud already censors the
  // same id, and the bag agrees rather than presenting a live surface
  // for a scope-hidden domain. Banked balances stay persisted, never
  // deleted.
  return gameManager.materialBag.getAll()
    // suppressed faucets - pull token permanently, domain-scoped
    // materials until the shared unlock realm - are persisted but must
    // not brand on a beta surface.
    .filter((stack) => betaMaterialStackVisible(stack.material, player.realmId))
    .map((stack) => ({
    material: stack.material,

    amount: stack.amount,

    cell: {
      key: stack.material.id,

      label: stack.material.name,

      accessibleLabel: materialAccessibleLabel(stack.material.name, stack.material),

      description: stack.material.description,

      amount: stack.amount,

      icon: stack.material.icon,

      tooltip: buildTooltip(stack.material, { owned: stack.amount }),

      rarityRank: professionRankOfMaterial(stack.material),

      // Material chi co 1 truc rank (Pham Nghe, 1-10) - feed vao prop
      // rarityRank (mac dinh tran 5, thang itemQualityRank equipment)
      // nen PHAI kem rarityRankScale: 10, neu khong rank 5 (Ngu Pham,
      // giua thang) bi hieu nham la kich tran (Fix 1, final review).
      rarityRankScale: 10,

      nameSegments: materialNameSegments(stack.material),
    },
  }))
})

// ================= Filter/search/gop ho (plan sec3.2 B4) =================
// State filter song trong phien (cung nhom transient voi bagSorts,
// KHONG ghi save). Filter chay TRUOC sort + pagination.
const searchQuery = ref('')

const activeGroup = ref<MaterialGroup | 'all'>('all')

// entries map ve shape {material, amount} - composable khong biet BagCell.
const filterInput = computed(() =>
  entries.value.map((entry) => ({ material: entry.material, amount: entry.amount })),
)

const { filtered, visibleCount } = useBagFilter(filterInput, { searchQuery, activeGroup })

// Material cua 1 o ho thao: bien the nien dai CAO NHAT lam dai dien
// tooltip/icon (badge da hien realm + nien dai rong nhat tren o).
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

// Badge ho: composable ghep san "{realmVi} * {badgeKey}" - tach lay KEY
// bac tuoi roi t() (realm ghep san la ten data vi; cac realm da co du
// nhan trong locale neu can tach sau).
function familyBadgeLabel(item: FilteredMaterial): string {
  const badge = item.family?.badgeLabel ?? ''
  const separator = badge.indexOf(' · ')

  if (separator === -1) return badge

  return `${badge.slice(0, separator)} · ${t(badge.slice(separator + 3))}`
}

function familyCell(item: FilteredMaterial): MaterialBagCell {
  const material = representativeMaterial(item)

  // O ho hien thi TEN GOC (khong prefix tuoi - badge da ghi
  // realm * bac cao nhat, tranh lap tuoi hai lan tren cung o).
  const baseLabel = baseNameFor(material)

  const baseRank = professionRankOfMaterial(material)

  const badge = familyBadgeLabel(item)

  return {
    key: item.key,

    label: baseLabel,

    accessibleLabel: materialAccessibleLabel(baseLabel, material),

    description: material.description,

    amount: item.amount,

    icon: material.icon,

    accentVar: accentFor(material),

    tooltip: buildTooltip(material, { owned: item.amount }),

    rarityRank: baseRank,

    rarityRankScale: 10,

    nameSegments: [{ text: baseLabel }, ...(badge ? [{ text: badge }] : [])],
  }
}

// O filter bar: tim kiem theo ten + chip nhom (bam lai chip dang chon
// de bo filter nhom). Nhan chip qua key-mapping composable (useBagFilter
// khong import i18n) -> t(key).
const GROUP_CHIPS = computed<Array<{ value: MaterialGroup | 'all'; label: string }>>(() => [
  { value: 'all', label: t('panels.bag.groups.all') },
  ...MATERIAL_GROUPS.map((group) => ({ value: group, label: t(groupLabelKey(group)) })),
])

function toggleGroup(value: MaterialGroup | 'all') {
  activeGroup.value = activeGroup.value === value ? 'all' : value
}

// ================= Sort (giu nguyen hanh vi Workstream E) =================
// Filter chay TRUOC sort; sort tren MOT BAN COPY (stableSort) roi moi
// pagination. Ho thao da gop sort theo ten ho.
const MATERIAL_COMPARATORS: Record<Exclude<MaterialSortMode, 'default'>, (a: FilteredMaterial, b: FilteredMaterial) => number> = {
  category: (a, b) =>
    CATEGORY_ORDER.indexOf(a.material.category) - CATEGORY_ORDER.indexOf(b.material.category),

  years: (a, b) => compareNumber(a.material.years, b.material.years),

  amount: (a, b) => a.amount - b.amount,

  name: (a, b) => compareText(a.material.name, b.material.name),

  source: (a, b) =>
    SOURCE_ORDER.indexOf(a.material.sourceType) - SOURCE_ORDER.indexOf(b.material.sourceType),
}

// Ghim Linh Thach o o dau (plan Workstream D) - chay TRUOC comparator
// sort thuong, KHONG qua withDirection(), ap dung o MOI mode (ke ca
// default) va ca hai direction.
function comparePinned(a: FilteredMaterial, b: FilteredMaterial): number {
  const aPinned = a.material.category === 'spirit_stone'
  const bPinned = b.material.category === 'spirit_stone'

  if (aPinned === bPinned) return 0

  return aPinned ? -1 : 1
}

const cells = computed<MaterialBagCell[]>(() => {
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
          accessibleLabel: materialAccessibleLabel(item.material.name, item.material),
          description: item.material.description,
          amount: item.amount,
          icon: item.material.icon,
          accentVar: accentFor(item.material),
          tooltip: buildTooltip(item.material, { owned: item.amount }),
          rarityRank: professionRankOfMaterial(item.material),
          rarityRankScale: 10,
          nameSegments: materialNameSegments(item.material),
        },
  )
})

const { currentPage, totalPages, goToPage, resetPage, gridCells } = useBagPagination(cells, pageSize)

// Doi mode/direction/filter -> quay ve trang dau.
watch(
  () => ({ ...ui.bagSorts.material }),
  () => resetPage(),
)

watch([searchQuery, activeGroup], () => resetPage())
</script>

<template>
  <div class="bag-section">
    <div class="bag-section__filters">
      <span class="bag-section__search-wrap">
        <InkNineSlice chrome-id="text-field" layer="surface" />
        <input
          v-model="searchQuery"
          type="search"
            class="bag-section__search"
            :placeholder="t('panels.bag.search.materialPlaceholder')"
            :aria-label="t('panels.bag.search.materialAria')"
          >
      </span>

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

      <span class="bag-section__count"><InkNineSlice chrome-id="resource-pill" layer="surface" /><span class="bag-section__count-label">{{ visibleCount }} {{ t('panels.bag.countUnitSuffix') }}</span></span>
    </div>

    <div ref="gridRef" class="bag-section__grid" :style="gridStyle">
      <SlotView
        v-for="(cell, index) in gridCells"
        :key="cell?.key ?? index"
        class="bag-section__slot"
        variant="bag"
        :item="cell"
        :label="cell?.label"
        :accessible-label="cell?.accessibleLabel"
        :description="cell?.description"
        :amount="cell?.amount"
        :icon="cell?.icon"
        :tooltip="cell?.tooltip"
        :rarity-rank="cell?.rarityRank"
        :rarity-rank-scale="cell?.rarityRankScale"
        :name-segments="cell?.nameSegments"
        :style="cell?.accentVar ? { '--material-accent': cell.accentVar } : undefined"
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
  gap: 2px;
}

.bag-section__filters {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

/* Drawn field chrome (owner ruling: search uses the text-field art,
   not a CSS frame) - wrap carries the slice, input paints on top. */
.bag-section__search-wrap {
  position: relative;
  flex: 1 1 120px;
  min-width: 0;
  height: 32px;
}

.bag-section__search-wrap .ink-nine-slice {
  inset: 0;
}

.bag-section__search-wrap:focus-within {
  outline: 2px solid var(--chrome-300);
  outline-offset: 1px;
}

.bag-section__search {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  padding: 0 var(--space-2);
  background: transparent;
  color: var(--text-primary);
  border: 0;
  font-family: var(--font-body);
  font-size: var(--text-xs);
}

.bag-section__search::placeholder {
  color: var(--text-secondary);
}

.bag-section__search:focus-visible {
  outline: none;
}

.bag-section__chips {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}

/* "N mon" counter: resource-pill chrome capsule (owner ruling) - the
   drawn capsule carries the count, text sits on the light pill face. */
.bag-section__count {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  height: 28px;
  padding: 0 10px;
  color: #e8d9ae;
  font-size: var(--text-xs);
  white-space: nowrap;
}

.bag-section__count .ink-nine-slice {
  inset: 0;
}

.bag-section__count-label {
  position: relative;
  z-index: 2;
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

/* audit M3: icon-less materials still render the letter monogram, but
   the disc + glyph now take the category accent var set per cell so
   spirit stones / cores / essences stop looking identical. */
.bag-section__slot :deep(.slot-view__monogram) {
  background: color-mix(in srgb, var(--material-accent, var(--ink-700)) 26%, var(--ink-700));
  color: var(--material-accent, var(--slot-rarity-color, var(--text-secondary)));
}
</style>
