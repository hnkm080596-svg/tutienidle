<script setup lang="ts">
import { computed, watch } from 'vue'
import SlotView from '../../common/SlotView.vue'
import BagPaginationControls, { type BagSortOption } from './BagPaginationControls.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useUiStore, type EquipmentSortMode } from '@/stores/ui'
import { useBagPagination } from '@/composables/useBagPagination'
import { useBagGridLayout } from '@/composables/useBagGridLayout'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { compareNumber, compareText, stableSort, withDirection } from '@/composables/useBagSort'
import type { BagCell } from './BagCell'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import { composeEquipmentNameSegments } from '@/core/equipment/EquipmentNaming'
import { equipmentQualityRank, itemGradeRank } from '@/composables/slots/normalizeSlotRank'
import { getRealmIndex } from '@/core/realm/realmSystem'
import { EQUIPMENT_SLOTS } from '@/core/equipment/EquipmentSlotState'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { SlotPresentationState } from '@/components/common/SlotTypes'

// Grid responsive theo chiều rộng thật — xem ghi chú đầy đủ ở
// useBagGridLayout.ts/MaterialBagSection.vue (cùng pattern áp cho cả
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

// "quality" (Phàm Khí→Thiên Địa Trọng Khí, trần Điểm Rèn) và "rarity"
// (Hoàng→Tiên, hệ Phẩm hiện ở mọi tooltip) là 2 TRỤC KHÁC NHAU — nhãn
// "Phẩm chất"/"Phẩm" tách biệt để không gây hiểu nhầm là 1 thứ (2026-08-30
// bug report: "Rarity"/"Slot" tiếng Anh lọt vào UI toàn tiếng Việt).
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

  // Chỉ hiện đồ CHƯA trang bị (bấm để trang bị).
  const instances = gameManager.equipmentBag.getAll().filter((instance) => !instance.equipped)

  return instances.map((instance) => {
    // Audit fix 2026-08-31 — equipmentRegistry.get() THROW với itemId
    // lạ (data edit/save lệch) từng chết cả panel qua ErrorBoundary;
    // getEquipmentTemplate() tra an toàn trả undefined (GameManager.ts).
    const template = gameManager.getEquipmentTemplate(instance.itemId)

    const equippedComparison = gameManager.equipmentBag.getEquippedInSlot(instance.slot)

    // Registry miss → hiển thị itemId thô thay vì chết cả màn hình
    // (pattern EquipmentHallPanel.vue:126 `template?.name ?? instance.itemId`).
    const displayName = template?.name ?? instance.itemId

    // Tên ghép động (2026-08-15) — Phẩm · Set (nếu có) · Địa Giới+Tên
    // gốc, xem EquipmentNaming.ts. "(đang mặc)" nối thêm làm segment
    // riêng (màu mặc định), giữ nguyên hành vi cũ. Registry miss chỉ
    // hiện itemId thô — composeEquipmentNameSegments KHÔNG nhận
    // template nullable nên gọi có điều kiện (pattern
    // EquipmentHallPanel.vue:138-140).
    const nameSegments = template
      ? composeEquipmentNameSegments(instance, template, gameManager.zoneRegistry)
      : [{ text: instance.itemId }]

    if (instance.equipped) {
      nameSegments.push({ text: '(đang mặc)' })
    }

    // Slot Revamp (mục 17.7 "Equipment bag: Quality, Rarity, equipped,
    // comparison") — equipped chỉ là marker nhỏ (không đổi nền). So sánh
    // chi tiết hiện chỉ được lộ trong tooltip advanced khi giữ Alt; chưa có
    // nút/toggle bật mũi tên ▲/▼ trực tiếp trên slot. Vì vậy không tự gán
    // state.comparison cho tới khi UX toggle đó được thiết kế và triển khai.
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

        nameSegments,

        description: template?.description,

        equipmentQualityRank: equipmentQualityRank(instance.quality),

        rarityRank: itemGradeRank(instance.rarity),

        state,

        // slotState (Cường Hóa) gắn theo SLOT chứ không theo instance
        // (xem EquipmentSlotState.ts) — chỉ có ý nghĩa THẬT SỰ thuộc về
        // món đồ này khi nó đang được trang bị. Registry miss → không
        // tooltip (buildEquipmentTooltip đòi template thật, BagCell.tooltip
        // optional) — cell vẫn hiển thị, không chết panel.
        tooltip: template
          ? buildEquipmentTooltip(
              instance,
              template,
              gameManager.affixRegistry,
              instance.equipped ? gameManager.getSlotState(instance.slot) : null,
              gameManager.zoneRegistry,
              equippedComparison,
            )
          : undefined,

        icon: instance.icon ?? template?.icon,

        onClick: () => handleClick(instance.instanceId),
      },
    }
  })
})

// Tiêu chí Trang Bị (plan Workstream E) — mặc định/quality/rarity/
// realm/slot/name/forge.
const EQUIPMENT_COMPARATORS: Record<Exclude<EquipmentSortMode, 'default'>, (a: EquipmentEntry, b: EquipmentEntry) => number> = {
  quality: (a, b) =>
    equipmentQualityRank(a.instance.quality) - equipmentQualityRank(b.instance.quality),

  rarity: (a, b) => itemGradeRank(a.instance.rarity) - itemGradeRank(b.instance.rarity),

  realm: (a, b) => getRealmIndex(a.instance.realmId) - getRealmIndex(b.instance.realmId),

  slot: (a, b) => {
    const indexA = EQUIPMENT_SLOTS.indexOf(a.instance.slot)

    const indexB = EQUIPMENT_SLOTS.indexOf(b.instance.slot)

    return (indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA) -
      (indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB)
  },

  name: (a, b) => compareText(a.name, b.name),

  forge: (a, b) => compareNumber(a.instance.forgePoints, b.instance.forgePoints),
}

// Sort chạy trên bản copy của TOÀN BỘ list TRƯỚC pagination.
const cells = computed<BagCell[]>(() => {
  const sortState = ui.bagSorts.equipment

  if (sortState.mode === 'default') {
    return entries.value.map((entry) => entry.cell)
  }

  const sorted = stableSort(
    entries.value,
    withDirection(EQUIPMENT_COMPARATORS[sortState.mode], sortState.direction),
  )

  return sorted.map((entry) => entry.cell)
})

const { currentPage, totalPages, goToPage, resetPage, gridCells } = useBagPagination(cells, pageSize)

watch(
  () => ({ ...ui.bagSorts.equipment }),
  () => resetPage(),
)
</script>

<template>
  <div class="bag-section">
    <div ref="gridRef" class="bag-section__grid" :style="gridStyle">
      <SlotView
        v-for="(cell, index) in gridCells"
        :key="cell?.key ?? index"
        class="bag-section__slot"
        :item="cell"
        :label="cell?.label"
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
