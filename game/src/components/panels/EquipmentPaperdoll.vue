<script setup lang="ts">
import { computed } from 'vue'
import SlotView from '../common/SlotView.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { usePlayerStore } from '@/stores/player'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import { composeEquipmentNameSegments } from '@/core/equipment/EquipmentNaming'
import { itemQualityRank, professionGradeRank } from '@/composables/slots/normalizeSlotRank'
import type { EquipmentTooltipContent } from '@/composables/useTooltip'
import type { NameSegment } from '@/core/item/NameSegment'
import type { SlotBadge } from '@/components/common/SlotTypes'

const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()
const { unequip } = useEquipmentActions()

// Lưới 3 cột × 2 hàng (thay lục giác quanh sprite cũ — khối Equipment
// giờ chỉ chiếm 30% chiều cao panel, cố định cho Hành Trang/Tứ Nghệ,
// xem LeftPanel.vue) — không còn sprite nhân vật ở giữa.
const SLOT_LAYOUT: { slot: EquipmentSlot; label: string }[] = [
  { slot: 'helmet', label: 'Mũ' },
  { slot: 'necklace', label: 'Vòng cổ' },
  { slot: 'ring', label: 'Nhẫn' },
  { slot: 'weapon', label: 'Vũ khí' },
  { slot: 'armor', label: 'Giáp' },
  { slot: 'boots', label: 'Giày' },
]

const equippedBySlot = computed<Record<EquipmentSlot, EquipmentInstance | undefined>>(() => {
  stateVersion.value

  const result = {} as Record<EquipmentSlot, EquipmentInstance | undefined>

  for (const entry of SLOT_LAYOUT) {
    result[entry.slot] = gameManager.equipmentBag.getEquippedInSlot(entry.slot)
  }

  return result
})

// MASTER SPEC Mục XVI (Phase 9) — enhanceLevel giờ thuộc SLOT, hiện
// được NGAY CẢ KHI slot đang trống (đổi/tháo trang bị không mất cấp
// đã cường hóa) — minh chứng trực quan cho tách Item/Slot.
const enhanceLevelBySlot = computed<Record<EquipmentSlot, number>>(() => {
  stateVersion.value

  const result = {} as Record<EquipmentSlot, number>

  for (const entry of SLOT_LAYOUT) {
    result[entry.slot] = gameManager.getSlotState(entry.slot).enhanceLevel
  }

  return result
})

// Audit fix 2026-08-31 — equipmentRegistry.get() THROW với itemId lạ
// (data edit/save lệch) từng chết cả khối trang bị qua ErrorBoundary;
// getEquipmentTemplate() tra an toàn trả undefined (GameManager.ts) +
// fallback hiển thị itemId thô (pattern Task 13 EquipmentBagSection).
function itemName(instance: EquipmentInstance): string {
  return gameManager.getEquipmentTemplate(instance.itemId)?.name ?? instance.itemId
}

function itemDescription(instance: EquipmentInstance): string | undefined {
  return gameManager.getEquipmentTemplate(instance.itemId)?.description
}

function itemIcon(instance: EquipmentInstance): string | undefined {
  return instance.icon ?? gameManager.getEquipmentTemplate(instance.itemId)?.icon
}

// Tên ghép động (2026-08-15) — Phẩm · Set (nếu có) · Địa Giới+Tên gốc,
// xem EquipmentNaming.ts. Chỉ slot ĐANG mặc mới có (đồng nhất với
// tooltipBySlot bên dưới) — slot trống fallback về `label` mặc định
// của SlotView.vue.
const nameSegmentsBySlot = computed<Record<EquipmentSlot, NameSegment[] | undefined>>(() => {
  stateVersion.value

  const result = {} as Record<EquipmentSlot, NameSegment[] | undefined>

  for (const entry of SLOT_LAYOUT) {
    const instance = equippedBySlot.value[entry.slot]

    // Audit fix 2026-08-31 — registry miss → hiển thị itemId thô thay vì
    // chết panel (composeEquipmentNameSegments đòi template thật).
    const template = instance ? gameManager.getEquipmentTemplate(instance.itemId) : undefined

    result[entry.slot] = instance
      ? template
        ? composeEquipmentNameSegments(instance, template, gameManager.zoneRegistry)
        : [{ text: instance.itemId }]
      : undefined
  }

  return result
})

// Tooltip có cấu trúc (2026-08-15) — chỉ slot ĐANG mặc mới có, slot
// trống fallback về title/description đơn giản mặc định của
// SlotView.vue (tooltip undefined = dùng lại hành vi cũ).
const tooltipBySlot = computed<Record<EquipmentSlot, EquipmentTooltipContent | undefined>>(() => {
  stateVersion.value

  const result = {} as Record<EquipmentSlot, EquipmentTooltipContent | undefined>

  for (const entry of SLOT_LAYOUT) {
    const instance = equippedBySlot.value[entry.slot]

    // Audit fix 2026-08-31 — registry miss → không tooltip (SlotView
    // tooltip optional), slot vẫn hiển thị, không chết panel.
    const template = instance ? gameManager.getEquipmentTemplate(instance.itemId) : undefined

    result[entry.slot] = instance && template
      ? buildEquipmentTooltip(
          instance,
          template,
          gameManager.affixRegistry,
          gameManager.getSlotState(entry.slot),
          gameManager.zoneRegistry,
        )
      : undefined
  }

  return result
})

// Slot Revamp (mục 17.7 "Equipment paperdoll: empty/filled, enhance,
// formation/talisman marker") — Quality/Rarity rank + badge Cường Hóa
// giờ do SlotView tự vẽ CSS, thay `.paperdoll__enhance-badge` absolute-
// position bên ngoài slot cũ.
const qualityRankBySlot = computed<Record<EquipmentSlot, number | undefined>>(() => {
  const result = {} as Record<EquipmentSlot, number | undefined>

  for (const entry of SLOT_LAYOUT) {
    const instance = equippedBySlot.value[entry.slot]

    result[entry.slot] = instance ? professionGradeRank(instance.grade) : undefined
  }

  return result
})

const rarityRankBySlot = computed<Record<EquipmentSlot, number | undefined>>(() => {
  const result = {} as Record<EquipmentSlot, number | undefined>

  for (const entry of SLOT_LAYOUT) {
    const instance = equippedBySlot.value[entry.slot]

    result[entry.slot] = instance ? itemQualityRank(instance.quality) : undefined
  }

  return result
})

const badgesBySlot = computed<Record<EquipmentSlot, SlotBadge[]>>(() => {
  const result = {} as Record<EquipmentSlot, SlotBadge[]>

  for (const entry of SLOT_LAYOUT) {
    const level = enhanceLevelBySlot.value[entry.slot]

    result[entry.slot] = level > 0 ? [{ kind: 'enhance', text: `+${level}` }] : []
  }

  return result
})

function onSlotClick(instance: EquipmentInstance | undefined) {
  if (instance) {
    unequip(instance.instanceId)
  }
}
</script>

<template>
  <div class="paperdoll">
    <div v-for="entry in SLOT_LAYOUT" :key="entry.slot" class="paperdoll__cell">
      <div class="paperdoll__slot-wrap">
        <SlotView
          class="paperdoll__slot"
          :item="equippedBySlot[entry.slot] ?? null"
          :label="equippedBySlot[entry.slot] ? itemName(equippedBySlot[entry.slot]!) : entry.label"
          :name-segments="nameSegmentsBySlot[entry.slot]"
          :description="
            equippedBySlot[entry.slot] ? itemDescription(equippedBySlot[entry.slot]!) : undefined
          "
          :equipment-quality-rank="qualityRankBySlot[entry.slot]"
          :rarity-rank="rarityRankBySlot[entry.slot]"
          :badges="badgesBySlot[entry.slot]"
          :tooltip="tooltipBySlot[entry.slot]"
          :icon="equippedBySlot[entry.slot] ? itemIcon(equippedBySlot[entry.slot]!) : undefined"
          @click="onSlotClick(equippedBySlot[entry.slot])"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.paperdoll {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 6px;
  height: 100%;
  padding: 6px;
  box-sizing: border-box;
  font-family: var(--font-body);
}

.paperdoll__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 0;
  min-width: 0;
}

.paperdoll__slot-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  max-width: 90%;
  aspect-ratio: 1;
}

.paperdoll__slot {
  width: 100%;
}
</style>
