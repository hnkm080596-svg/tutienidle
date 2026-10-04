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
import { useAudioStore } from '@/stores/audio'
import { stableSceneArtUrl } from '@/presentation/huyenKim/StableSceneArt'

// equipment-paperdoll-base (stable art): neutral mannequin substrate under
// the six runtime sockets - no gameplay identity, decorative alignment
// only. Runtime keeps item/socket/rarity ownership.
const PAPERDOLL_BASE_SRC = stableSceneArtUrl('equipment-paperdoll-base', '@2x')

const { t } = useI18n()
const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion, bumpState } = useStateVersion()
const { unequip } = useEquipmentActions()

// Scene 12 scaffold: the item-card detail view wants the clicked
// instance; the unequip mutation below stays the slot's behavior.
const emit = defineEmits<{ select: [instanceId: string] }>()

// Two socket columns x three rows with the character art kept in the
// middle gap (v3 Trang Bi layout): left column Vu Khi / Dao Quan /
// Linh Gioi, right column Dao Bao / Dao Hai / Linh Chau.
// Slot labels go through i18n (panels.bag.paperdoll.slots.*) - P16.
const SLOT_COLUMNS: readonly (readonly EquipmentSlot[])[] = [
  ['weapon', 'helmet', 'ring'],
  ['armor', 'boots', 'necklace'],
]
const SLOT_SLOTS = SLOT_COLUMNS.flat()

const equippedBySlot = computed<Record<EquipmentSlot, EquipmentInstance | undefined>>(() => {
  stateVersion.value

  const result = {} as Record<EquipmentSlot, EquipmentInstance | undefined>

  for (const slot of SLOT_SLOTS) {
    result[slot] = gameManager.equipmentBag.getEquippedInSlot(slot)
  }

  return result
})

// MASTER SPEC Muc XVI (Phase 9) - enhanceLevel gio thuoc SLOT, hien
// duoc NGAY CA KHI slot dang trong (doi/thao trang bi khong mat cap
// da cuong hoa) - minh chung truc quan cho tach Item/Slot.
const enhanceLevelBySlot = computed<Record<EquipmentSlot, number>>(() => {
  stateVersion.value

  const result = {} as Record<EquipmentSlot, number>

  for (const slot of SLOT_SLOTS) {
    result[slot] = gameManager.equipmentOps.getSlotState(slot).enhanceLevel
  }

  return result
})

// Audit fix 2026-08-31 - equipmentRegistry.get() THROW voi itemId la
// (data edit/save lech) tung chet ca khoi trang bi qua ErrorBoundary;
// getEquipmentTemplate() tra an toan tra undefined (GameManager.ts) +
// fallback hien thi itemId tho (pattern Task 13 EquipmentBagSection).
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

// Ten ghep dong (2026-08-15) - Pham * Set (neu co) * Dia Gioi+Ten goc,
// xem EquipmentNaming.ts. Chi slot DANG mac moi co (dong nhat voi
// tooltipBySlot ben duoi) - slot trong fallback ve `label` mac dinh
// cua SlotView.vue.
const nameSegmentsBySlot = computed<Record<EquipmentSlot, NameSegment[] | undefined>>(() => {
  stateVersion.value

  const result = {} as Record<EquipmentSlot, NameSegment[] | undefined>

  for (const slot of SLOT_SLOTS) {
    const instance = equippedBySlot.value[slot]

    // Audit fix 2026-08-31 - registry miss -> hien thi itemId tho thay vi
    // chet panel (composeEquipmentNameSegments doi template that).
    const template = instance ? gameManager.equipmentOps.getEquipmentTemplate(instance.itemId) : undefined

    result[slot] = instance
      ? template
        ? composeEquipmentNameSegments(instance, template, gameManager.zoneRegistry)
        : [{ text: instance.itemId }]
      : undefined
  }

  return result
})

// Tooltip co cau truc (2026-08-15) - chi slot DANG mac moi co, slot
// trong fallback ve title/description don gian mac dinh cua
// SlotView.vue (tooltip undefined = dung lai hanh vi cu).
const tooltipBySlot = computed<Record<EquipmentSlot, EquipmentTooltipContent | undefined>>(() => {
  stateVersion.value

  const result = {} as Record<EquipmentSlot, EquipmentTooltipContent | undefined>

  for (const slot of SLOT_SLOTS) {
    const instance = equippedBySlot.value[slot]

    // Audit fix 2026-08-31 - registry miss -> khong tooltip (SlotView
    // tooltip optional), slot van hien thi, khong chet panel.
    const template = instance ? gameManager.equipmentOps.getEquipmentTemplate(instance.itemId) : undefined

    // G1 (Mission G Task 37) - the tooltip contract requires the
    // authoritative range quote; a miss = malformed item data, so the
    // tooltip drops (same "registry miss -> no tooltip" rule above).
    const mainStatRangeQuote = instance && template
      ? gameManager.equipmentSystem.quoteMainStatRange(instance, gameManager.equipmentRegistry)
      : undefined

    result[slot] = instance && template && mainStatRangeQuote
      ? buildEquipmentTooltip(
          instance,
          template,
          gameManager.affixRegistry,
          gameManager.equipmentOps.getSlotState(slot),
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

// Slot Revamp (muc 17.7 "Equipment paperdoll: empty/filled, enhance,
// formation/talisman marker") - Quality/Rarity rank + badge Cuong Hoa
// gio do SlotView tu ve CSS, thay `.paperdoll__enhance-badge` absolute-
// position ben ngoai slot cu.
const qualityRankBySlot = computed<Record<EquipmentSlot, number | undefined>>(() => {
  const result = {} as Record<EquipmentSlot, number | undefined>

  for (const slot of SLOT_SLOTS) {
    const instance = equippedBySlot.value[slot]

    result[slot] = instance ? professionGradeRank(instance.grade) : undefined
  }

  return result
})

const rarityRankBySlot = computed<Record<EquipmentSlot, number | undefined>>(() => {
  const result = {} as Record<EquipmentSlot, number | undefined>

  for (const slot of SLOT_SLOTS) {
    const instance = equippedBySlot.value[slot]

    result[slot] = instance ? itemQualityRank(instance.quality) : undefined
  }

  return result
})

const badgesBySlot = computed<Record<EquipmentSlot, SlotBadge[]>>(() => {
  const result = {} as Record<EquipmentSlot, SlotBadge[]>

  for (const slot of SLOT_SLOTS) {
    const level = enhanceLevelBySlot.value[slot]

    result[slot] = level > 0 ? [{ kind: 'enhance', text: `+${level}` }] : []
  }

  return result
})

function onSlotClick(instance: EquipmentInstance | undefined) {
  if (instance) {
    emit('select', instance.instanceId)
    useAudioStore().cue('ui.equip')
    unequip(instance.instanceId)
  }
}
</script>

<template>
  <div class="paperdoll">
    <img class="paperdoll__base" :src="PAPERDOLL_BASE_SRC" alt="" aria-hidden="true" />
    <div v-for="(column, i) in SLOT_COLUMNS" :key="i" class="paperdoll__col">
      <div v-for="slot in column" :key="slot" class="paperdoll__cell">
        <div class="paperdoll__slot-wrap">
          <SlotView
            class="paperdoll__slot"
            variant="bag"
            :item="equippedBySlot[slot] ?? null"
            :label="equippedBySlot[slot] ? itemName(equippedBySlot[slot]!) : t(`panels.bag.paperdoll.slots.${slot}`)"
            :accessible-label="equippedBySlot[slot] ? itemAccessibleLabel(equippedBySlot[slot]!) : undefined"
            :name-segments="nameSegmentsBySlot[slot]"
            :description="
              equippedBySlot[slot] ? itemDescription(equippedBySlot[slot]!) : undefined
            "
            :equipment-quality-rank="qualityRankBySlot[slot]"
            :rarity-rank="rarityRankBySlot[slot]"
            :badges="badgesBySlot[slot]"
            :tooltip="tooltipBySlot[slot]"
            :icon="equippedBySlot[slot] ? itemIcon(equippedBySlot[slot]!) : undefined"
            @click="onSlotClick(equippedBySlot[slot])"
          />
        </div>
        <span class="paperdoll__label">{{ t(`panels.bag.paperdoll.slots.${slot}`) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.paperdoll {
  position: relative;
  /* Own stacking context so the negative-z base stays between the
     paperdoll background and the runtime socket cells. */
  isolation: isolate;
  /* Two socket columns flanking the centered mannequin art. */
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  height: 100%;
  padding: 6px 14px;
  box-sizing: border-box;
  font-family: var(--font-body);
}

.paperdoll__col {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 74px;
}

/* Neutral mannequin substrate (stable art): centered behind the socket
   grid; sockets keep full interaction above it. */
.paperdoll__base {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  /* Substrate must paint under the static grid cells - positioned
     elements at z:auto would otherwise cover the runtime sockets. */
  z-index: -1;
  height: 92%;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  opacity: 0.55;
  pointer-events: none;
}

.paperdoll__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  min-height: 0;
  min-width: 0;
}

.paperdoll__slot-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 74px;
  aspect-ratio: 1;
}

.paperdoll__label {
  font-size: 12px;
  font-weight: 600;
  color: #473315;
  text-align: center;
}

/* Paperdoll slots use variant="bag" (owner ruling 2026-10-04): the 6
   worn slots join the dense Trang Bi cells - drawn frame-s-slot chrome
   over the dark tile + the shared pale-gold hover frame. Quality aura
   (rarityRank >= 3) still rides on top. */
.paperdoll__slot {
  width: 100%;
}
</style>
