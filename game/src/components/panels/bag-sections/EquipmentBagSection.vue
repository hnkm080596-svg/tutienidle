<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SlotView from '../../common/SlotView.vue'
import Chip from '../../common/primitives/Chip.vue'
import BagPaginationControls, { type BagSortOption } from './BagPaginationControls.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useUiStore, type EquipmentSortMode } from '@/stores/ui'
import { useBagPagination } from '@/composables/useBagPagination'
import { useBagGridLayout } from '@/composables/useBagGridLayout'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { compareNumber, compareText, stableSort, withDirection } from '@/composables/useBagSort'
import { useEntryFilter } from '@/composables/useBagFilter'
import type { BagCell } from './BagCell'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import { composeEquipmentNameSegments } from '@/core/equipment/EquipmentNaming'
import { gradeLabel } from '@/core/presentation/labels'
import { itemQualityRank, professionGradeRank } from '@/core/profession/slotRank'
import { compareProfessionGrades } from '@/core/profession/ProfessionGrade'
import { EQUIPMENT_SLOTS } from '@/core/equipment/EquipmentSlotState'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { SlotPresentationState } from '@/components/common/SlotTypes'

const { t } = useI18n()

// Grid responsive theo chieu rong that - xem ghi chu day du o
// useBagGridLayout.ts/MaterialBagSection.vue (cung pattern ap cho ca
// bag-sections).
const { gridRef, pageSize, gridStyle } = useBagGridLayout()

const ui = useUiStore()

const gameManager = useGameManager()

const { stateVersion, bumpState } = useStateVersion()

const { equip } = useEquipmentActions()

function handleClick(instanceId: string) {
  equip(instanceId)
}

interface EquipmentEntry {
  cell: BagCell

  instance: EquipmentInstance

  name: string
}

// Task 4 schema bridge keeps the two existing sort controls wired to the
// closest new fields. Task 19 owns their final unified UI contract.
const SORT_OPTIONS: Array<BagSortOption & { value: EquipmentSortMode }> = [
  { value: 'quality', label: 'Phẩm' },
  { value: 'rarity', label: 'Chất' },
  { value: 'realm', label: 'Cảnh giới' },
  { value: 'slot', label: 'Vị trí' },
  { value: 'name', label: 'Tên', ascLabel: 'Tên A–Z', descLabel: 'Tên Z–A' },
  { value: 'forge', label: 'Điểm Rèn' },
]

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

    if (instance.equipped) {
      nameSegments.push({ text: '(đang mặc)' })
    }

    // Slot Revamp (muc 17.7 "Equipment bag: Quality, Rarity, equipped,
    // comparison") - equipped chi la marker nho (khong doi nen). So sanh
    // chi tiet hien chi duoc lo trong tooltip advanced khi giu Alt; chua co
    // nut/toggle bat mui ten ^/v truc tiep tren slot. Vi vay khong tu gan
    // state.comparison cho toi khi UX toggle do duoc thiet ke va trien khai.
    const state: SlotPresentationState = {}

    if (instance.equipped) {
      state.marker = 'equipped'
    }

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

// ================= Filter/search + slot chips =================
// Mirrors the MaterialBagSection filter bar; filter runs BEFORE sort +
// pagination. Group axis = equipment slot (single dimension).
const searchQuery = ref('')

const activeGroup = ref<EquipmentSlot | 'all'>('all')

const { filtered, visibleCount } = useEntryFilter(
  entries,
  { searchQuery, activeGroup },
  { name: (entry) => entry.name, group: (entry) => entry.instance.slot },
)

const GROUP_CHIPS = computed<Array<{ value: EquipmentSlot | 'all'; label: string }>>(() => [
  { value: 'all', label: t('panels.bag.groups.all') },
  ...EQUIPMENT_SLOTS.map((slot) => ({
    value: slot,
    label: t(`panels.bag.paperdoll.slots.${slot}`),
  })),
])

// Clicking the already-active chip clears the group filter.
function toggleGroup(value: EquipmentSlot | 'all') {
  activeGroup.value = activeGroup.value === value ? 'all' : value
}

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

// Sort chay tren ban copy cua list DA LOC TRUOC pagination.
const cells = computed<BagCell[]>(() => {
  const sortState = ui.bagSorts.equipment

  if (sortState.mode === 'default') {
    return filtered.value.map((entry) => entry.cell)
  }

  const sorted = stableSort(
    filtered.value,
    withDirection(EQUIPMENT_COMPARATORS[sortState.mode], sortState.direction),
  )

  return sorted.map((entry) => entry.cell)
})

const { currentPage, totalPages, goToPage, resetPage, gridCells } = useBagPagination(cells, pageSize)

watch(
  () => ({ ...ui.bagSorts.equipment }),
  () => resetPage(),
)

// Filter changes reset to the first page (same contract as sort).
watch([searchQuery, activeGroup], () => resetPage())
</script>

<template>
  <div class="bag-section">
    <div class="bag-section__filters">
      <input
        v-model="searchQuery"
        type="search"
        class="bag-section__search"
        :placeholder="t('panels.bag.search.equipmentPlaceholder')"
        :aria-label="t('panels.bag.search.equipmentAria')"
      >

      <div class="bag-section__chips" role="group" :aria-label="t('panels.bag.filterAriaEquipment')">
        <Chip
          v-for="chip in GROUP_CHIPS"
          :key="chip.value"
          :active="activeGroup === chip.value"
          @click="toggleGroup(chip.value)"
        >
          {{ chip.label }}
        </Chip>
      </div>

      <span class="bag-section__count">{{ visibleCount }} {{ t('panels.bag.countSuffix') }}</span>
    </div>

    <div ref="gridRef" class="bag-section__grid" :style="gridStyle">
      <SlotView
        v-for="(cell, index) in gridCells"
        :key="cell?.key ?? index"
        class="bag-section__slot"
        :item="cell"
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

    <BagPaginationControls
      :current-page="currentPage"
      :total-pages="totalPages"
      :sort-options="SORT_OPTIONS"
      :active-mode="ui.bagSorts.equipment.mode"
      :active-direction="ui.bagSorts.equipment.direction"
      @go-to-page="goToPage"
      @select-mode="(mode) => ui.setBagSortMode('equipment', mode as EquipmentSortMode)"
      @toggle-direction="ui.toggleBagSortDirection('equipment')"
      @reset-sort="ui.resetBagSort('equipment')"
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
  /* Art lives on the SlotView `variant` prop (default `item` -
     inventory art - here); consumers no longer override --slot-*
     art vars directly. */
}
</style>
