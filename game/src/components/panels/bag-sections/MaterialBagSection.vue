<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SlotView from '../../common/SlotView.vue'
import BagChipSelect from './BagChipSelect.vue'
import type { BagSortOption } from './BagPaginationControls.vue'
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
  materialChatRank,
  groupLabelKey,
  MATERIAL_GROUPS,
  type FilteredMaterial,
  type MaterialGroup,
} from '@/composables/useBagFilter'
import { betaMaterialStackVisible } from '@/core/betaScope'
import { usePlayerStore } from '@/stores/player'
import type { BagCell } from './BagCell'
import type { Material, MaterialCategory } from '@/core/material/Material'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

// Equipment item-slot chrome for the cells (owner ruling 2026-10-11:
// Tru Vat cells wear the same ornate slot art as the Trang Bi bag).
const ITEM_SLOT_SRC = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/item-slot-v1.png')
// Design capacity label shared with the equipment bag - no real bag cap
// exists yet; 100 is the designed display cap.
const BAG_DISPLAY_CAPACITY = 100
import { createMaterialTooltipBuilder, materialRealmLabel, professionRankOfMaterial } from '@/composables/useMaterialTooltip'

const { t } = useI18n()

// 'pick' mode (Minh ruling 2026-10-12): the Phan Giai card embeds the
// whole material bag - cell clicks emit 'pick' with the stack's
// materialId instead of doing nothing, pickedIds mark selected cells,
// inertIds dim non-decomposable stacks. The 'filtered' emit reports the
// visible materialId set so the host scopes bulk actions to on-screen
// stacks. Same contract as EquipmentBagSection's pick mode (Hoa Luyen).
const props = withDefaults(
  defineProps<{
    mode?: 'bag' | 'pick'
    pickedIds?: string[]
    inertIds?: string[]
    // Sort bucket - 'decompose' keeps the embedded pick grid's sort
    // independent of the Tru Vat material tab's.
    sortKey?: 'material' | 'decompose'
    showCount?: boolean
  }>(),
  { mode: 'bag', pickedIds: () => [], inertIds: () => [], sortKey: 'material', showCount: true },
)

const emit = defineEmits<{
  pick: [materialId: string]
  filtered: [materialIds: string[]]
}>()

const pickedSet = computed(() => new Set(props.pickedIds))

const inertSet = computed(() => new Set(props.inertIds))

function handleCellClick(materialId: string) {
  if (props.mode !== 'pick' || inertSet.value.has(materialId)) return
  emit('pick', materialId)
}

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
  { value: 'default', label: t('panels.bag.sort.default') },
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

// Sort dropdown (owner ruling 2026-10-11: Tru Vat toolbar matches the
// equipment bag - filter chip + sort chip + pager + count). Picking
// the ACTIVE mode toggles direction like the equipment select.
const SORT_CHIP_OPTIONS = computed<Array<{ value: MaterialSortMode; label: string }>>(() =>
  SORT_OPTIONS.value.map((option) => {
    const active = option.value === ui.bagSorts[props.sortKey].mode && option.value !== 'default'
    if (!active) return { value: option.value, label: option.label }
    const directed =
      option.ascLabel || option.descLabel
        ? (ui.bagSorts[props.sortKey].direction === 'asc' ? option.ascLabel : option.descLabel)
        : option.label + (ui.bagSorts[props.sortKey].direction === 'asc' ? ' ↑' : ' ↓')
    return { value: option.value, label: directed ?? option.label }
  }),
)

function onSortPick(mode: string) {
  if (mode === ui.bagSorts[props.sortKey].mode) {
    ui.toggleBagSortDirection(props.sortKey)
  } else {
    ui.setBagSortMode(props.sortKey, mode as MaterialSortMode)
  }
}

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
const { gridRef, layout, pageSize: layoutPageSize, gridStyle } = useBagGridLayout()

// Pick mode (owner ruling 2026-10-12): the embedded Phan Giai grid
// paginates a fixed 4 rows like the Hoa Luyen equipment pick grid -
// the card reserves its bottom strip for the action row.
const pageSize = computed(() =>
  props.mode === 'pick' ? layout.value.columns * 4 : layoutPageSize.value,
)

interface MaterialEntry {
  cell: MaterialBagCell

  material: Material

  amount: number
}

// Material name segments - text structure only (item-info-card spec
// 2026-09-14); display color lives on the tooltip payload. Used for
// every material cell.
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

      // Owner ruling 2026-10-11: nguyen lieu co day du Pham + Chat
      // giong trang bi - seal Pham lay grade (1-10), con Chat edge/
      // streak lay NIEN DAI (5 tang -> thang 1-5 y het
      // itemQualityRank ben equipment).
      equipmentQualityRank: professionRankOfMaterial(stack.material),
      rarityRank: materialChatRank(stack.material),

      nameSegments: materialNameSegments(stack.material),
    },
  }))
})

// ================= Filter/search/gop ho (plan sec3.2 B4) =================
// State filter song trong phien (cung nhom transient voi bagSorts,
// KHONG ghi save). Filter chay TRUOC sort + pagination.
// Owner ruling 2026-10-11: search UI removed - the query stays
// permanently empty, feeding the filter pipeline an inert input.
const searchQuery = ref('')

const activeGroup = ref<MaterialGroup | 'all'>('all')

// entries map ve shape {material, amount} - composable khong biet BagCell.
const filterInput = computed(() =>
  entries.value.map((entry) => ({ material: entry.material, amount: entry.amount })),
)

const { filtered, visibleCount } = useBagFilter(filterInput, { searchQuery, activeGroup })

// O filter bar: tim kiem theo ten + chip nhom (bam lai chip dang chon
// de bo filter nhom). Nhan chip qua key-mapping composable (useBagFilter
// khong import i18n) -> t(key).
const GROUP_CHIPS = computed<Array<{ value: MaterialGroup | 'all'; label: string }>>(() => [
  { value: 'all', label: t('panels.bag.groups.all') },
  ...MATERIAL_GROUPS.map((group) => ({ value: group, label: t(groupLabelKey(group)) })),
])


// ================= Sort (giu nguyen hanh vi Workstream E) =================
// Filter chay TRUOC sort; sort tren MOT BAN COPY (stableSort) roi moi
// pagination.
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
  const sortState = ui.bagSorts[props.sortKey]

  const normalCompare: (a: FilteredMaterial, b: FilteredMaterial) => number =
    sortState.mode === 'default'
      ? () => 0
      : withDirection(MATERIAL_COMPARATORS[sortState.mode], sortState.direction)

  const sorted = stableSort(
    filtered.value,
    (a, b) => comparePinned(a, b) || normalCompare(a, b),
  )

  const mapped: MaterialBagCell[] = sorted.map((item) => ({
    key: item.material.id,
    label: item.material.name,
    accessibleLabel: materialAccessibleLabel(item.material.name, item.material),
    description: item.material.description,
    amount: item.amount,
    icon: item.material.icon,
    accentVar: accentFor(item.material),
    tooltip: buildTooltip(item.material, { owned: item.amount }),
    // Owner ruling 2026-10-11 (xem block material cell tren):
    // Pham seal <- grade, Chat streak <- nien dai (thang 1-5).
    equipmentQualityRank: professionRankOfMaterial(item.material),
    rarityRank: materialChatRank(item.material),
    nameSegments: materialNameSegments(item.material),
  }))

  if (props.mode !== 'pick') return mapped

  return mapped.map((cell) => ({
    ...cell,
    state: {
      ...(cell.state ?? {}),
      interaction: pickedSet.value.has(cell.key) ? ('selected' as const) : ('idle' as const),
    },
  }))
})

const { currentPage, totalPages, goToPage, resetPage, gridCells } = useBagPagination(cells, pageSize)

// Report the visible materialId set whenever the filter/bag contents
// change - the pick host scopes select-all to this view.
watch(
  filtered,
  (list) => emit('filtered', list.map((item) => item.material.id)),
  { immediate: true },
)

// Doi mode/direction/filter -> quay ve trang dau.
watch(
  () => ({ ...ui.bagSorts[props.sortKey] }),
  () => resetPage(),
)

watch(activeGroup, () => resetPage())
</script>

<template>
  <div class="bag-section" :style="{ '--equipment-item-slot': `url('${ITEM_SLOT_SRC}')` }">
    <div class="bag-section__toolbar">
      <!-- Owner ruling 2026-10-11: no search field - toolbar matches
           the equipment bag verbatim (filter + sort + pager + count).
           searchQuery stays wired empty so the filter pipeline keeps
           its contract without a UI affordance. -->
      <BagChipSelect
        v-model="activeGroup"
        :options="GROUP_CHIPS"
        :label="t('panels.bag.filterAria')"
      />
      <BagChipSelect
        :model-value="ui.bagSorts[props.sortKey].mode"
        :options="SORT_CHIP_OPTIONS"
        :label="t('panels.bag.sort.button')"
        @update:model-value="onSortPick"
      />
      <!-- Inline pager between the dropdowns and the count (equipment
           toolbar layout); hidden until the bag overflows one page. -->
      <div v-if="totalPages > 1" class="bag-section__pager">
        <button
          type="button"
          class="bag-section__page-btn"
          :disabled="currentPage === 0"
          :aria-label="t('panels.bag.pagePrev')"
          @click="goToPage(currentPage - 1)"
        >
‹
</button>
        <span class="bag-section__page-label">{{ currentPage + 1 }}/{{ totalPages }}</span>
        <button
          type="button"
          class="bag-section__page-btn"
          :disabled="currentPage >= totalPages - 1"
          :aria-label="t('panels.bag.pageNext')"
          @click="goToPage(currentPage + 1)"
        >
›
</button>
      </div>
      <!-- Owner ruling 2026-10-11: "N loai" IS the slot count - render
           it in the equipment bag's x/100 capacity format. Pick-mode
           hosts (Phan Giai) hide it - a bag-view concern. -->
      <span v-if="showCount" class="bag-section__count-label">{{ visibleCount }}/{{ BAG_DISPLAY_CAPACITY }}</span>
    </div>

    <div ref="gridRef" class="bag-section__grid" :style="gridStyle">
      <SlotView
        v-for="(cell, index) in gridCells"
        :key="cell?.key ?? index"
        :class="[
          'bag-section__slot',
          {
            'bag-section__slot--picked': cell && pickedSet.has(cell.key),
            'bag-section__slot--inert': cell && inertSet.has(cell.key),
          },
        ]"
        variant="bag"
        :data-bag-key="cell?.key"
        :item="cell"
        :label="cell?.label"
        :accessible-label="cell?.accessibleLabel"
        :description="cell?.description"
        :amount="cell?.amount"
        :icon="cell?.icon"
        :tooltip="cell?.tooltip"
        :equipment-quality-rank="cell?.equipmentQualityRank"
        :rarity-rank="cell?.rarityRank"
        :rarity-rank-scale="cell?.rarityRankScale"
        :name-segments="cell?.nameSegments"
        :style="cell?.accentVar ? { '--material-accent': cell.accentVar } : undefined"
        @click="cell && handleCellClick(cell.key)"
      />
    </div>
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

.bag-section__toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Inline pager + count: equipment-toolbar siblings (owner ruling
   2026-10-11). */
.bag-section__pager {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.bag-section__page-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid #8a7444;
  background: #23251e;
  color: #f3e4c4;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.bag-section__page-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.bag-section__page-label {
  font-size: var(--text-xs);
  color: #e8d9ae;
  white-space: nowrap;
}

.bag-section__count-label {
  margin-left: auto;
  font-size: var(--text-xs);
  color: #e8d9ae;
  white-space: nowrap;
}

.bag-section__chips {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}

/* Grid fills the card like the equipment bag: rows split the card
   height evenly (minmax 0 so they may shrink) and pack to the BOTTOM
   edge - spare card height lands above row 1 instead of inflating the
   inter-row gap. Columns/gap come from useBagGridLayout measuring the
   real grid rect. */
.bag-section__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(var(--grid-columns), minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  align-content: end;
  gap: var(--grid-gap);
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: #8a7444 transparent;
}

.bag-section__slot {
  width: 100%;
  aspect-ratio: 1 / 1;
}

/* audit M3: icon-less materials still render the letter monogram, but
   the disc + glyph now take the category accent var set per cell so
   spirit stones / cores / essences stop looking identical. */
/* pick mode (Phan Giai): picked cells carry the same check badge the
   Hoa Luyen grid draws; inert cells dim and keep the pointer quiet. */
.bag-section__slot--picked {
  position: relative;
}
.bag-section__slot--picked::after {
  content: '✓';
  position: absolute;
  top: -4px;
  right: -4px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--jade, #5b8a6a);
  color: #f3e4c4;
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 0 0 2px #151713;
}
.bag-section__slot--inert {
  opacity: 0.45;
}

.bag-section__slot :deep(.slot-view__monogram) {
  background: color-mix(in srgb, var(--material-accent, var(--ink-700)) 26%, var(--ink-700));
  color: var(--material-accent, var(--slot-rarity-color, var(--text-secondary)));
}
</style>
