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
import { equipmentQualityRank, itemGradeRank } from '@/composables/slots/normalizeSlotRank'
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

function itemName(instance: EquipmentInstance): string {
  return gameManager.equipmentRegistry.get(instance.itemId).name
}

function itemDescription(instance: EquipmentInstance): string | undefined {
  return gameManager.equipmentRegistry.get(instance.itemId).description
}

function itemIcon(instance: EquipmentInstance): string | undefined {
  return instance.icon ?? gameManager.equipmentRegistry.get(instance.itemId).icon
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

    result[entry.slot] = instance
      ? composeEquipmentNameSegments(
          instance,
          gameManager.equipmentRegistry.get(instance.itemId),
          gameManager.zoneRegistry,
        )
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

    result[entry.slot] = instance
      ? buildEquipmentTooltip(
          instance,
          gameManager.equipmentRegistry.get(instance.itemId),
          gameManager.affixRegistry,
          gameManager.getSlotState(entry.slot),
          gameManager.formationRegistry,
          gameManager.talismanRegistry,
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

    result[entry.slot] = instance ? equipmentQualityRank(instance.quality) : undefined
  }

  return result
})

const rarityRankBySlot = computed<Record<EquipmentSlot, number | undefined>>(() => {
  const result = {} as Record<EquipmentSlot, number | undefined>

  for (const entry of SLOT_LAYOUT) {
    const instance = equippedBySlot.value[entry.slot]

    result[entry.slot] = instance ? itemGradeRank(instance.rarity) : undefined
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

// MASTER SPEC Mục XVI (Phase 9) — Formation giờ thuộc SLOT 'weapon',
// không thuộc instance vũ khí cụ thể (đọc qua equipmentSlotManager,
// KHÔNG còn instance.socketedFormation).
const weaponSlotState = computed(() => {
  stateVersion.value

  return gameManager.getSlotState('weapon')
})

function socketedFormationName(): string | undefined {
  const socketed = weaponSlotState.value.socketedFormation

  if (!socketed) {
    return undefined
  }

  return gameManager.formationRegistry.has(socketed.formationId)
    ? gameManager.formationRegistry.get(socketed.formationId).name
    : socketed.formationId
}

function unsocketFormationFromWeapon() {
  if (gameManager.unsocketFormation()) {
    // Trận Pháp cộng modifier qua getAggregatedModifiers() (tính lại
    // mỗi tick) — đồng bộ ngay ở đây để stat panel phản hồi tức thời
    // thay vì đợi tick kế tiếp (~200ms, không sai nhưng chậm hơn cần).
    player.setExternalModifiers(gameManager.getAggregatedModifiers(player.$state))
    bumpState()
  }
}

// Home Hub Phase 5 — Phù Chú áp được lên MỌI slot (không riêng vũ
// khí như Trận Pháp, xem EquipmentBagSection.vue's filter), badge đối
// xứng paperdoll__formation-badge nhưng KHÔNG có nút gỡ (Phù Chú hiện
// không có cơ chế unsocket, xem GameManager.applyTalisman()).
const talismanNamesBySlot = computed<Record<EquipmentSlot, string[]>>(() => {
  stateVersion.value

  const result = {} as Record<EquipmentSlot, string[]>

  for (const entry of SLOT_LAYOUT) {
    result[entry.slot] = gameManager.getSlotState(entry.slot).appliedTalismanIds.map(id =>
      gameManager.talismanRegistry.has(id) ? gameManager.talismanRegistry.get(id).name : id,
    )
  }

  return result
})
</script>

<template>
  <div class="paperdoll">
    <div
      v-for="entry in SLOT_LAYOUT"
      :key="entry.slot"
      class="paperdoll__cell"
    >
      <div class="paperdoll__slot-wrap">
        <SlotView
          class="paperdoll__slot"
          :item="equippedBySlot[entry.slot] ?? null"
          :label="equippedBySlot[entry.slot] ? itemName(equippedBySlot[entry.slot]!) : entry.label"
          :name-segments="nameSegmentsBySlot[entry.slot]"
          :description="equippedBySlot[entry.slot] ? itemDescription(equippedBySlot[entry.slot]!) : undefined"
          :quality-rank="qualityRankBySlot[entry.slot]"
          :rarity-rank="rarityRankBySlot[entry.slot]"
          :badges="badgesBySlot[entry.slot]"
          :tooltip="tooltipBySlot[entry.slot]"
          :icon="equippedBySlot[entry.slot] ? itemIcon(equippedBySlot[entry.slot]!) : undefined"
          @click="onSlotClick(equippedBySlot[entry.slot])"
        />
      </div>

      <div
        v-if="entry.slot === 'weapon' && weaponSlotState.socketedFormation"
        class="paperdoll__formation-badge"
      >
        <span>{{ socketedFormationName() }}</span>

        <button type="button" @click.stop="unsocketFormationFromWeapon">Gỡ</button>
      </div>

      <div v-if="talismanNamesBySlot[entry.slot].length > 0" class="paperdoll__talisman-badge">
        <span v-for="name in talismanNamesBySlot[entry.slot]" :key="name">{{ name }}</span>
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
  width: 90%;
}

.paperdoll__slot {
  width: 100%;
}

.paperdoll__formation-badge {
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: var(--text-xs);
  color: var(--gold-500);
  white-space: nowrap;
}

.paperdoll__formation-badge button {
  font-size: var(--text-xs);
  padding: 1px 5px;
}

.paperdoll__talisman-badge {
  margin-top: 2px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  font-size: var(--text-xs);
  color: var(--jade);
  white-space: nowrap;
}
</style>
