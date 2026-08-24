<script setup lang="ts">
import { computed } from 'vue'
import SlotView from '../../common/SlotView.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBagPagination } from '@/composables/useBagPagination'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { usePlayerStore } from '@/stores/player'
import type { BagCell } from './BagCell'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import { composeEquipmentNameSegments } from '@/core/equipment/EquipmentNaming'
import { useBagGridLayout } from '@/composables/useBagGridLayout'
import { equipmentQualityRank, itemGradeRank } from '@/composables/slots/normalizeSlotRank'
import type { SlotPresentationState } from '@/components/common/SlotTypes'

// Grid responsive theo chiều rộng thật — xem ghi chú đầy đủ ở
// useBagGridLayout.ts/MaterialBagSection.vue (cùng pattern áp cho cả
// 5 bag-sections).
const { gridRef, pageSize, gridStyle } = useBagGridLayout()

// pendingTarget: đang chờ áp Phù Chú/khảm Trận Pháp lên 1 món trang
// bị — chủ động truyền từ ngoài vào (nguồn có thể là ref cục bộ trong
// BagGrid.vue, hoặc ui.pendingEquipTarget dùng chung khi điều hướng
// TỪ panel khác — UI redesign Step 9: trỏ vào đây qua Kho/tab Trang Bị,
// trước đó từng đi qua Khí Đường/EquipmentHallPanel.vue Phase 5, xem
// BagGrid.vue) — section này không tự giữ state "đang chờ", chỉ phản
// ứng theo prop rồi emit 'resolved' khi xong.
const props = defineProps<{
  pendingTarget?: { kind: 'talisman' | 'formation'; id: string } | null
}>()

const emit = defineEmits<{ resolved: [] }>()

const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()
const { equip } = useEquipmentActions()

function handleClick(instanceId: string) {
  if (props.pendingTarget?.kind === 'talisman') {
    if (gameManager.applyTalisman(props.pendingTarget.id, instanceId)) {
      // Phù Chú mở thêm substat cho item — nếu item đang trang bị,
      // player.modifiers phải đồng bộ lại ngay, không thì finalStats
      // hiện sai tới tick kế tiếp.
      player.setEquipmentModifiers(gameManager.getEquipmentModifiers())
      bumpState()
      emit('resolved')
    }

    return
  }

  if (props.pendingTarget?.kind === 'formation') {
    if (gameManager.socketFormation(props.pendingTarget.id, instanceId)) {
      player.setExternalModifiers(gameManager.getAggregatedModifiers(player.$state))
      bumpState()
      emit('resolved')
    }

    return
  }

  equip(instanceId)
}

const cells = computed<BagCell[]>(() => {
  stateVersion.value

  // Bình thường chỉ hiện đồ CHƯA trang bị (bấm để trang bị). Đang chờ
  // áp Phù/khảm Trận thì hiện CẢ đồ đang trang bị (áp/khảm thẳng lên
  // món đang mặc, khỏi phải tháo ra trước) — Trận Pháp còn lọc thêm
  // chỉ vũ khí vì chỉ vũ khí khảm được.
  let instances = gameManager.equipmentBag.getAll()

  if (props.pendingTarget?.kind === 'formation') {
    instances = instances.filter(instance => instance.slot === 'weapon')
  } else if (props.pendingTarget?.kind !== 'talisman') {
    instances = instances.filter(instance => !instance.equipped)
  }

  return instances.map(instance => {
    const template = gameManager.equipmentRegistry.get(instance.itemId)
    const equippedComparison = gameManager.equipmentBag.getEquippedInSlot(instance.slot)

    // Tên ghép động (2026-08-15) — Phẩm · Set (nếu có) · Địa Giới+Tên
    // gốc, xem EquipmentNaming.ts. "(đang mặc)" nối thêm làm segment
    // riêng (màu mặc định), giữ nguyên hành vi cũ.
    const nameSegments = composeEquipmentNameSegments(instance, template, gameManager.zoneRegistry)

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
      key: instance.instanceId,

      label: template.name,

      nameSegments,

      description: template.description,

      equipmentQualityRank: equipmentQualityRank(instance.quality),

      rarityRank: itemGradeRank(instance.rarity),

      state,

      // slotState (Cường Hóa/Trận Pháp/Phù Chú) gắn theo SLOT chứ
      // không theo instance (xem EquipmentSlotState.ts) — chỉ có ý
      // nghĩa THẬT SỰ thuộc về món đồ này khi nó đang được trang bị,
      // đồ CHƯA mặc trong túi không thừa hưởng những thứ đó của slot.
      tooltip: buildEquipmentTooltip(
        instance,
        template,
        gameManager.affixRegistry,
        instance.equipped ? gameManager.getSlotState(instance.slot) : null,
        gameManager.formationRegistry,
        gameManager.talismanRegistry,
        gameManager.zoneRegistry,
        equippedComparison,
      ),

      icon: instance.icon ?? template.icon,

      onClick: () => handleClick(instance.instanceId),
    }
  })
})

const { currentPage, totalPages, goToPage, gridCells } = useBagPagination(cells, pageSize)
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
        :quality-rank="cell?.equipmentQualityRank"
        :rarity-rank="cell?.rarityRank"
        :state="cell?.state"
        :tooltip="cell?.tooltip"
        :icon="cell?.icon"
        @click="cell?.onClick?.()"
      />
    </div>

    <div class="bag-section__pages">
      <button type="button" :disabled="currentPage === 0" @click="goToPage(currentPage - 1)">‹</button>

      <button
        v-for="page in totalPages"
        :key="page"
        type="button"
        :class="{ 'is-active': currentPage === page - 1 }"
        @click="goToPage(page - 1)"
      >
        {{ page }}
      </button>

      <button type="button" :disabled="currentPage === totalPages - 1" @click="goToPage(currentPage + 1)">›</button>
    </div>
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

.bag-section__pages {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.bag-section__pages button {
  min-width: 36px;
  min-height: 32px;
  padding: 0;
  font-size: var(--text-sm);
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
}

.bag-section__pages button.is-active {
  background: var(--gold-500);
  color: var(--gold-ink);
  border-color: var(--gold-500);
}
</style>
