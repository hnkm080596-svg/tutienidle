<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SlotView from '../common/SlotView.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { usePlayerStore } from '@/stores/player'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import { buildEquipmentTooltip } from '@/composables/useEquipmentTooltip'
import { composeEquipmentNameSegments } from '@/core/equipment/EquipmentNaming'
import { gradeLabel } from '@/core/presentation/labels'
import { itemQualityRank, professionGradeRank } from '@/core/profession/slotRank'
import type { EquipmentTooltipContent } from '@/composables/useTooltip'
import type { NameSegment } from '@/core/item/NameSegment'
import type { SlotBadge } from '@/components/common/SlotTypes'

const { t } = useI18n()
const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()
const { unequip } = useEquipmentActions()

// Lưới 3 cột × 2 hàng (thay lục giác quanh sprite cũ — khối Equipment
// giờ chỉ chiếm 30% chiều cao panel, cố định cho Hành Trang/Tứ Nghệ,
// xem LeftPanel.vue) — không còn sprite nhân vật ở giữa.
// Slot labels go through i18n (panels.bag.paperdoll.slots.*) - P16.
const SLOT_LAYOUT: { slot: EquipmentSlot }[] = [
  { slot: 'helmet' },
  { slot: 'necklace' },
  { slot: 'ring' },
  { slot: 'weapon' },
  { slot: 'armor' },
  { slot: 'boots' },
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
    result[entry.slot] = gameManager.equipmentOps.getSlotState(entry.slot).enhanceLevel
  }

  return result
})

// Audit fix 2026-08-31 — equipmentRegistry.get() THROW với itemId lạ
// (data edit/save lệch) từng chết cả khối trang bị qua ErrorBoundary;
// getEquipmentTemplate() tra an toàn trả undefined (GameManager.ts) +
// fallback hiển thị itemId thô (pattern Task 13 EquipmentBagSection).
function itemName(instance: EquipmentInstance): string {
  return gameManager.equipmentOps.getEquipmentTemplate(instance.itemId)?.name ?? instance.itemId
}

// spec section 5b - aria includes the Pham word (the seal is a
// decorative glyph; screen readers get the grade via this label).
function itemAccessibleLabel(instance: EquipmentInstance): string {
  return `${itemName(instance)}, ${gradeLabel(instance.grade)}`
}

function itemDescription(instance: EquipmentInstance): string | undefined {
  return gameManager.equipmentOps.getEquipmentTemplate(instance.itemId)?.description
}

function itemIcon(instance: EquipmentInstance): string | undefined {
  return instance.icon ?? gameManager.equipmentOps.getEquipmentTemplate(instance.itemId)?.icon
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
    const template = instance ? gameManager.equipmentOps.getEquipmentTemplate(instance.itemId) : undefined

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
    const template = instance ? gameManager.equipmentOps.getEquipmentTemplate(instance.itemId) : undefined

    // G1 (Mission G Task 37) - the tooltip contract requires the
    // authoritative range quote; a miss = malformed item data, so the
    // tooltip drops (same "registry miss -> no tooltip" rule above).
    const mainStatRangeQuote = instance && template
      ? gameManager.equipmentSystem.quoteMainStatRange(instance, gameManager.equipmentRegistry)
      : undefined

    result[entry.slot] = instance && template && mainStatRangeQuote
      ? buildEquipmentTooltip(
          instance,
          template,
          gameManager.affixRegistry,
          gameManager.equipmentOps.getSlotState(entry.slot),
          gameManager.zoneRegistry,
          // No compare context (item-info-card spec section 4): the
          // paperdoll renders only EQUIPPED items - an equipped item IS
          // the compare counterpart, never a candidate for one.
          undefined,
          mainStatRangeQuote,
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
          class="paperdoll__slot sys-chamfer"
          variant="equipment"
          :item="equippedBySlot[entry.slot] ?? null"
          :label="equippedBySlot[entry.slot] ? itemName(equippedBySlot[entry.slot]!) : t(`panels.bag.paperdoll.slots.${entry.slot}`)"
          :accessible-label="equippedBySlot[entry.slot] ? itemAccessibleLabel(equippedBySlot[entry.slot]!) : undefined"
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
  grid-auto-rows: min-content;
  gap: 8px;
  align-content: center;
  justify-items: center;
  height: 100%;
  padding: 6px;
  box-sizing: border-box;
  font-family: var(--sys-font-body, var(--font-body));
}

.paperdoll__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 0;
  min-width: 0;
}

.paperdoll__slot-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
}

/* Paperdoll slots use variant="equipment" - the 6 worn slots get the
   "empty" glass tile + "click" select frame (SlotVariant registry).
   Quality aura (rarityRank >= 3) still rides on top. Empty slots stay
   bare: no silhouette art. */
.paperdoll__slot {
  width: 100%;
}
</style>
