<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SlotView from '../../common/SlotView.vue'
import BagChipSelect from './BagChipSelect.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useUiStore, type BagSortStateMap, type EquipmentSortMode } from '@/stores/ui'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { compareNumber, compareText, stableSort, withDirection } from '@/composables/useBagSort'
import type { BagCell } from './BagCell'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import { composeEquipmentNameSegments } from '@/core/equipment/EquipmentNaming'
import { gradeLabel } from '@/core/presentation/labels'
import { itemQualityRank, professionGradeRank } from '@/core/profession/slotRank'
import { compareProfessionGrades } from '@/core/profession/ProfessionGrade'
import { EQUIPMENT_SLOTS } from '@/core/equipment/EquipmentSlotState'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { SlotPresentationState } from '@/components/common/SlotTypes'

const { t } = useI18n()

// Bag grid: 8 cols x 5 rows (owner ruling 2026-10-08 - cells must be
// SQUARE and fit the card height; 8 cols is the widest grid whose
// square cells fit 5 rows in the bag card).
const EQUIPMENT_BAG_COLUMNS = 8
const EQUIPMENT_BAG_MIN_CELLS = EQUIPMENT_BAG_COLUMNS * 5
const gridStyle = {
  '--grid-columns': String(EQUIPMENT_BAG_COLUMNS),
}

const ui = useUiStore()

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

const { equip } = useEquipmentActions()

// 'pick' mode (Minh ruling 2026-10-09): the Hoa Luyen card embeds the
// whole bag - cell clicks emit 'pick' instead of equipping, pickedIds
// mark selected cells, inertIds dim cells that cannot be picked. The
// 'filtered' emit reports the visible id set (after the Loai-item
// dropdown) so the host scopes bulk actions to what is on screen.
const props = withDefaults(
  defineProps<{
    mode?: 'bag' | 'pick'
    pickedIds?: string[]
    inertIds?: string[]
    // Sort bucket the grid reads/writes - 'dissolve' keeps the embedded
    // pick grid's sort independent of the real equipment tab's. Typed to
    // the equipment-family buckets only: this grid sorts equipment, and
    // a material/pill key would break the comparator index below.
    sortKey?: 'equipment' | 'dissolve'
    // Owner ruling 2026-10-09: the n/100 capacity label is a bag-view
    // concern - pick-mode hosts (Hoa Luyen) hide it.
    showCount?: boolean
  }>(),
  { mode: 'bag', pickedIds: () => [], inertIds: () => [], sortKey: 'equipment', showCount: true },
)

const emit = defineEmits<{
  pick: [instanceId: string]
  filtered: [instanceIds: string[]]
}>()

const pickedSet = computed(() => new Set(props.pickedIds))

const inertSet = computed(() => new Set(props.inertIds))

function handleClick(instanceId: string) {
  if (props.mode === 'pick') {
    if (!inertSet.value.has(instanceId)) emit('pick', instanceId)
    return
  }

  equip(instanceId)
}

interface EquipmentEntry {
  cell: BagCell

  instance: EquipmentInstance

  name: string
}

const entries = computed<EquipmentEntry[]>(() => {
  stateVersion.value

  // Chi hien do CHUA trang bi (bam de trang bi).
  const instances = gameManager.equipmentBag.getAll().filter((instance) => !instance.equipped)

  return instances.map((instance) => {
    // Audit fix 2026-08-31 - equipmentRegistry.get() THROW voi itemId
    // la (data edit/save lech) tung chet ca panel qua ErrorBoundary;
    // getEquipmentTemplate() tra an toan tra undefined (GameManager.ts).
    const template = gameManager.equipmentOps.getEquipmentTemplate(instance.itemId)

    const equippedComparison = gameManager.equipmentBag.getEquippedInSlot(instance.slot)

    // Compare context (item-info-card spec section 4) - the equipped
    // counterpart's template is resolved the same safe way as the
    // candidate's; a registry miss just drops the compare pair.
    const equippedTemplate = equippedComparison
      ? gameManager.equipmentOps.getEquipmentTemplate(equippedComparison.itemId)
      : undefined

    // G1 (Mission G Task 37) - the tooltip contract requires the
    // authoritative range quote. A quote miss = malformed item data, so
    // the dependent surface drops (same "registry miss -> no tooltip"
    // rule above): no candidate quote, no tooltip; no equipped quote,
    // no compare pair.
    const mainStatRangeQuote = template
      ? gameManager.equipmentSystem.quoteMainStatRange(instance, gameManager.equipmentRegistry)
      : undefined

    const equippedMainStatRangeQuote = equippedComparison && equippedTemplate
      ? gameManager.equipmentSystem.quoteMainStatRange(equippedComparison, gameManager.equipmentRegistry)
      : undefined

    // Registry miss -> hien thi itemId tho thay vi chet ca man hinh
    // (pattern EquipmentHallPanel.vue:126 `template?.name ?? instance.itemId`).
    const displayName = template?.name ?? instance.itemId

    // Ten ghep dong (2026-08-15) - Pham * Set (neu co) * Dia Gioi+Ten
    // goc, xem EquipmentNaming.ts. "(dang mac)" noi them lam segment
    // rieng (mau mac dinh), giu nguyen hanh vi cu. Registry miss chi
    // hien itemId tho - composeEquipmentNameSegments KHONG nhan
    // template nullable nen goi co dieu kien (pattern
    // EquipmentHallPanel.vue:138-140).
    const nameSegments = template
      ? composeEquipmentNameSegments(instance, template, gameManager.zoneRegistry)
      : [{ text: instance.itemId }]

    // equipped marker removed (owner ruling 2026-10-08): the canonical
    // list above only renders unequipped items, so instance.equipped can
    // never be true here - the branch was dead code.

    // Slot Revamp (muc 17.7 "Equipment bag: Quality, Rarity, equipped,
    // comparison") - equipped chi la marker nho (khong doi nen). So sanh
    // chi tiet hien chi duoc lo trong tooltip advanced khi giu Alt; chua co
    // nut/toggle bat mui ten ^/v truc tiep tren slot. Vi vay khong tu gan
    // state.comparison cho toi khi UX toggle do duoc thiet ke va trien khai.
    const state: SlotPresentationState = {}

    // equipped marker removed (owner ruling 2026-10-08): the canonical
    // list above only renders unequipped items, so instance.equipped can
    // never be true here - the branch was dead code.

    return {
      instance,

      name: displayName,

      cell: {
        key: instance.instanceId,

        label: displayName,

        // spec section 5b - aria includes the Pham word (the seal is a
        // decorative glyph; screen readers get the grade via this label).
        accessibleLabel: `${displayName}, ${gradeLabel(instance.grade)}`,

        nameSegments,

        description: template?.description,

        equipmentQualityRank: professionGradeRank(instance.grade),

        rarityRank: itemQualityRank(instance.quality),

        state,

        // slotState (Cuong Hoa) gan theo SLOT chu khong theo instance
        // (xem EquipmentSlotState.ts) - chi co y nghia THAT SU thuoc ve
        // mon do nay khi no dang duoc trang bi. Registry miss -> khong
        // tooltip (buildEquipmentTooltip doi template that, BagCell.tooltip
        // optional) - cell van hien thi, khong chet panel.
        tooltip: template && mainStatRangeQuote
          ? buildEquipmentTooltip(
              instance,
              template,
              gameManager.affixRegistry,
              instance.equipped ? gameManager.equipmentOps.getSlotState(instance.slot) : null,
              gameManager.zoneRegistry,
              equippedComparison && equippedTemplate && equippedMainStatRangeQuote
                ? {
                    instance: equippedComparison,
                    template: equippedTemplate,
                    slotState: gameManager.equipmentOps.getSlotState(equippedComparison.slot),
                    mainStatRangeQuote: equippedMainStatRangeQuote,
                  }
                : undefined,
              mainStatRangeQuote,
            )
          : undefined,

        icon: instance.icon ?? template?.icon,

        onClick: () => handleClick(instance.instanceId),
      },
    }
  })
})

// ================= Loai-item filter + sort selects ==================
// Owner ruling 2026-10-08: chips + footer selects removed. Two dropdowns
// - Loai item (7 options: Tat Ca + 6 socket types) filters first, then
// Sap Xep sorts inside the filtered result. The quality-tone (Kim/Tu/
// Lam) filter UI is dropped; sorting by chất lives in the sort select.
type TypeFilter = 'all' | EquipmentSlot
const typeFilter = ref<TypeFilter>('all')

const TYPE_OPTIONS = computed<Array<{ value: TypeFilter; label: string }>>(() => [
  { value: 'all', label: t('panels.bag.groups.all') },
  ...EQUIPMENT_SLOTS.map((slot) => ({
    value: slot,
    label: t(`panels.bag.paperdoll.slots.${slot}`),
  })),
])

const filtered = computed(() =>
  entries.value.filter(
    (entry) => typeFilter.value === 'all' || entry.instance.slot === typeFilter.value,
  ),
)

// Report the visible id set whenever the Loai-item filter or the bag
// contents change - the pick host scopes select-all to this view.
watch(
  filtered,
  (list) => emit('filtered', list.map((entry) => entry.instance.instanceId)),
  { immediate: true },
)
const visibleCount = computed(() => filtered.value.length)

// Design capacity label (preview "18/100") - the domain has no real bag
// cap; 100 is the designed display cap.
const BAG_DISPLAY_CAPACITY = 100

// Tieu chi Trang Bi (plan Workstream E) - mac dinh/quality/rarity/
// realm/slot/name/forge.
const EQUIPMENT_COMPARATORS: Record<Exclude<EquipmentSortMode, 'default'>, (a: EquipmentEntry, b: EquipmentEntry) => number> = {
  quality: (a, b) =>
    professionGradeRank(a.instance.grade) - professionGradeRank(b.instance.grade),

  rarity: (a, b) => itemQualityRank(a.instance.quality) - itemQualityRank(b.instance.quality),

  realm: (a, b) => compareProfessionGrades(a.instance.grade, b.instance.grade),

  slot: (a, b) => {
    const indexA = EQUIPMENT_SLOTS.indexOf(a.instance.slot)

    const indexB = EQUIPMENT_SLOTS.indexOf(b.instance.slot)

    return (indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA) -
      (indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB)
  },

  name: (a, b) => compareText(a.name, b.name),

  forge: (a, b) => compareNumber(a.instance.forgeUsesRemaining, b.instance.forgeUsesRemaining),
}

// Sort chay tren ban copy cua list DA LOC - the preview's Sap Xep
// select maps onto the existing equipment sort store ('default' vs
// 'quality'); direction stays whatever the store holds.
const cells = computed<BagCell[]>(() => {
  const sortState = ui.bagSorts[props.sortKey]

  const base =
    sortState.mode === 'default'
      ? filtered.value
      : stableSort(
          filtered.value,
          withDirection(EQUIPMENT_COMPARATORS[sortState.mode], sortState.direction),
        )

  const mapped = base.map((entry) => entry.cell)

  if (props.mode !== 'pick') return mapped

  return mapped.map((cell) => ({
    ...cell,
    state: {
      ...(cell.state ?? {}),
      interaction: pickedSet.value.has(cell.key) ? ('selected' as const) : ('idle' as const),
    },
  }))
})

// Sap Xep select: every comparator in EQUIPMENT_COMPARATORS is wired -
// default/quality(pham nghe)/rarity(chat)/realm/slot/name/forge - plus
// the direction toggle via ui.toggleBagSortDirection.
const SORT_MODES: readonly EquipmentSortMode[] = [
  'default',
  'quality',
  'rarity',
  'realm',
  'slot',
  'name',
  'forge',
]
const sortMode = computed<EquipmentSortMode>(() => ui.bagSorts[props.sortKey].mode as EquipmentSortMode)

// Owner ruling: direction lives inside the sort dropdown - first pick
// of a mode is asc, re-picking the same mode flips it (no +/- button).
function onSortPick(mode: string) {
  if (mode === ui.bagSorts[props.sortKey].mode) {
    ui.toggleBagSortDirection(props.sortKey)
  } else {
    ui.setBagSortMode(props.sortKey, mode as EquipmentSortMode)
  }
}

const SORT_OPTIONS = computed<Array<{ value: EquipmentSortMode; label: string }>>(() =>
  SORT_MODES.map((m) => ({
    value: m,
    label:
      t(`equipment.sortModes.${m}`) +
      (m === ui.bagSorts[props.sortKey].mode && m !== 'default'
        ? ui.bagSorts[props.sortKey].direction === 'asc'
          ? ' ↑'
          : ' ↓'
        : ''),
  })),
)

// Owner ruling: the bag paginates at one full grid (7 cols x 5 rows = 35
// cells) instead of scrolling; the pager sits mid-toolbar between the
// dropdowns and the capacity count. Each page still pads to 35 cells.
// Pick mode (owner ruling 2026-10-09): the Hoa Luyen grid drops one
// row - 8x4=32 cells per page.
const page = ref(0)
const pageSize = computed(() =>
  props.mode === 'pick' ? EQUIPMENT_BAG_COLUMNS * 4 : EQUIPMENT_BAG_MIN_CELLS,
)
const pageCount = computed(() => Math.max(1, Math.ceil(cells.value.length / pageSize.value)))
const pageIndex = computed(() => Math.min(page.value, pageCount.value - 1))

const gridCells = computed<Array<BagCell | undefined>>(() => {
  const start = pageIndex.value * pageSize.value
  const padded = cells.value.slice(start, start + pageSize.value)
  while (padded.length < pageSize.value) padded.push(undefined as unknown as BagCell)
  return padded
})

function prevPage() {
  page.value = Math.max(0, pageIndex.value - 1)
}
function nextPage() {
  page.value = Math.min(pageCount.value - 1, pageIndex.value + 1)
}

// Codex design-paper cells: square item-slot art owns the bag cell edge
// (the drawn tien-hiep slot frame) - applied here only, material/pill
// bags keep their own chrome.
const ITEM_SLOT_SRC = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/item-slot-v1.png')
</script>

<template>
  <div class="bag-section" :style="{ '--equipment-item-slot': `url('${ITEM_SLOT_SRC}')` }">
    <!-- Toolbar (owner ruling 2026-10-08): two dropdowns replace the
         title/Hoa-Luyen header and the chips row - Loai item filters,
         Sap Xep sorts inside the filtered set, +/- toggles direction.
         The footer Pham-Chat/Sap-Xep selects are gone (their logic
         moved here); capacity text hidden pending a real bag cap. -->
    <div class="bag-section__toolbar">
      <!-- Pick-mode hosts may inject extra controls at the row head. -->
      <slot name="toolbar-start" />
      <!-- Owner ruling: custom chip-art dropdowns (BagChipSelect) - the
           equipment filter chip art + bag card nine-slice list backdrop;
           native <select> could not wear either. -->
      <BagChipSelect
        v-model="typeFilter"
        :options="TYPE_OPTIONS"
        :label="t('panels.bag.filterAriaEquipment')"
      />
      <BagChipSelect
        :model-value="sortMode"
        :options="SORT_OPTIONS"
        :label="t('equipment.order')"
        @update:model-value="onSortPick"
      />
      <!-- Owner ruling: pager sits between the dropdowns and the capacity
           count; it hides until the bag overflows one page (same in pick
           mode - owner ruling 2026-10-09). -->
      <div v-if="pageCount > 1" class="bag-section__pager">
        <button
          type="button"
          class="bag-section__page-btn"
          :disabled="pageIndex === 0"
          :aria-label="t('panels.bag.pagePrev')"
          @click="prevPage"
        >‹</button>
        <span class="bag-section__page-label">{{ pageIndex + 1 }}/{{ pageCount }}</span>
        <button
          type="button"
          class="bag-section__page-btn"
          :disabled="pageIndex >= pageCount - 1"
          :aria-label="t('panels.bag.pageNext')"
          @click="nextPage"
        >›</button>
      </div>
      <!-- Owner ruling: capacity count returns beside the dropdowns,
           pinned to the bag's right edge (no real cap yet - display only). -->
      <span v-if="showCount" class="bag-section__count-label">
        {{ visibleCount }}/{{ BAG_DISPLAY_CAPACITY }}
      </span>
    </div>

    <div class="bag-section__grid" :style="gridStyle">
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
        variant="equipment"
        :item="cell ?? null"
        :label="cell?.label"
        :accessible-label="cell?.accessibleLabel"
        :name-segments="cell?.nameSegments"
        :description="cell?.description"
        :amount="cell?.amount"
        :equipment-quality-rank="cell?.equipmentQualityRank"
        :rarity-rank="cell?.rarityRank"
        :state="cell?.state"
        :tooltip="cell?.tooltip"
        :icon="cell?.icon"
        @click="cell?.onClick?.()"
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
  gap: 8px;
}

/* Preview header: title owns the row start, count/capacity + the two
   action buttons pin to the right above a hairline rule. */
.bag-section__header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 33px;
  padding-bottom: 7px;
  border-bottom: 1px solid #92783e66;
}

.bag-section__title {
  flex: 1;
  margin: 0;
  font: 700 24px/1.2 var(--font-display, Georgia, serif);
  color: #f3e4c4;
}

.bag-section__pager {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.bag-section__page-btn {
  width: 30px;
  height: 30px;
  border: 1px solid #8e7440;
  border-radius: 50%;
  background: rgba(232, 217, 174, 0.18);
  color: #ffe9ae;
  /* Owner ruling 2026-10-09: same face as the scene op-tab buttons so
     every function control in Trang Bi reads alike. */
  font-family: var(--pc-font-body, var(--font-display, Georgia, serif));
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}
.bag-section__page-btn:hover:not(:disabled) {
  background: rgba(232, 217, 174, 0.24);
  color: #ffe9ae;
}
.bag-section__page-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.bag-section__page-label {
  min-width: 44px;
  text-align: center;
  font-family: var(--pc-font-body, var(--font-display, Georgia, serif));
  font-size: 15px;
  font-weight: 600;
  color: #e8d9ae;
}

.bag-section__count-label {
  margin-left: auto;
  font-family: var(--pc-font-body, var(--font-display, Georgia, serif));
  font-size: 15px;
  font-weight: 600;
  color: #e8d9ae;
  white-space: nowrap;
}

.bag-section__icon-btn,
.bag-section__op-btn {
  border: 1px solid #8e7440;
  background: #23251e;
  color: #eedfbf;
  font-family: var(--pc-font-body, var(--font-display, Georgia, serif));
  font-weight: 600;
  cursor: pointer;
}

.bag-section__icon-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  font-size: 15px;
  line-height: 1;
}

.bag-section__op-btn {
  height: 30px;
  min-width: 118px;
  padding: 0 12px;
  font-size: 14px;
}

.bag-section__icon-btn:hover,
.bag-section__op-btn:hover {
  color: #ffe9ae;
  border-color: #c9a95f;
}

.bag-section__chips {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
}

/* Toolbar (owner ruling 2026-10-08): Loai-item select + sort select +
   direction toggle on one row. */
.bag-section__toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

.bag-section__chip-select {
  position: relative;
  isolation: isolate;
  /* Art kept at native 1225x324 proportions (owner ruling: no stretch) -
     the element is sized to the art, not the other way around. */
  flex: 0 0 auto;
  height: 36px;
  aspect-ratio: 1225 / 324;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}
.bag-section__chip-select::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-normal-v2.png') center / contain no-repeat;
  pointer-events: none;
}
.bag-section__chip-select:hover::before {
  background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-hover-v2.png');
}
.bag-section__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(var(--grid-columns), minmax(0, 1fr));
  /* Rows size to the square cells (owner ruling: gap ngang == gap doc),
     packed to the BOTTOM edge so extra card height lands above row 1
     instead of inflating the inter-row gap. */
  /* Owner ruling 2026-10-08: gaps must read EQUAL on both axes. Rows
     split the card height evenly (minmax 0 so they may shrink below
     the cell's aspect-ratio) - cells end up ~1% squat, pitch is
     identical horizontally and vertically. */
  grid-auto-rows: minmax(0, 1fr);
  align-content: end;
  gap: 4px;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: #8a7444 transparent;
}

/* item-slot-v2 IS the cell (design-paper Trang Bi); the PNG itself was
   recentered (2026-10-08) so its transparent margins are symmetric -
   owner ruling: art paints at natural size (the zoom experiment was
   rejected for cropping the cloud corners). */

.bag-section__slot {
  width: 100%;
  aspect-ratio: 1 / 1;
}

/* pick mode (Hóa Luyện): picked cells carry the same ✓ badge the old
   dissolve grid drew; inert cells dim and keep the pointer quiet. */
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

/* Preview footer: two labeled selects on the card's bottom edge. */
.bag-section__footer {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding-top: 2px;
  color: #c9b184;
  font-size: 13px;
  font-weight: 600;
}

.bag-section__select-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.bag-section__select {
  position: relative;
  z-index: 3;
  width: 100%;
  min-width: 0;
  height: 100%;
  border: 0;
  background: transparent;
  color: #f2e3c2;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  padding: 0 26px 0 14px;
}
.bag-section__select option {
  color: #eedfbf;
  background: #23251e;
}
.bag-section__select:focus-visible {
  outline: none;
}
.bag-section__chip-select:focus-within {
  box-shadow: 0 0 0 2px var(--hk-gold-muted), 0 0 10px var(--hk-glow-gold);
}
</style>
