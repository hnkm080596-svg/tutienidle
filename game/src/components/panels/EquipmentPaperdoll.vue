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

// Luoi 3 cot x 2 hang (thay luc giac quanh sprite cu - khoi Equipment
// gio chi chiem 30% chieu cao panel, co dinh cho Hanh Trang/Tu Nghe,
// xem LeftPanel.vue) - khong con sprite nhan vat o giua.
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

// MASTER SPEC Muc XVI (Phase 9) - enhanceLevel gio thuoc SLOT, hien
// duoc NGAY CA KHI slot dang trong (doi/thao trang bi khong mat cap
// da cuong hoa) - minh chung truc quan cho tach Item/Slot.
const enhanceLevelBySlot = computed<Record<EquipmentSlot, number>>(() => {
  stateVersion.value

  const result = {} as Record<EquipmentSlot, number>

  for (const entry of SLOT_LAYOUT) {
    result[entry.slot] = gameManager.equipmentOps.getSlotState(entry.slot).enhanceLevel
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

  for (const entry of SLOT_LAYOUT) {
    const instance = equippedBySlot.value[entry.slot]

    // Audit fix 2026-08-31 - registry miss -> hien thi itemId tho thay vi
    // chet panel (composeEquipmentNameSegments doi template that).
    const template = instance ? gameManager.equipmentOps.getEquipmentTemplate(instance.itemId) : undefined

    result[entry.slot] = instance
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

  for (const entry of SLOT_LAYOUT) {
    const instance = equippedBySlot.value[entry.slot]

    // Audit fix 2026-08-31 - registry miss -> khong tooltip (SlotView
    // tooltip optional), slot van hien thi, khong chet panel.
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

// Slot Revamp (muc 17.7 "Equipment paperdoll: empty/filled, enhance,
// formation/talisman marker") - Quality/Rarity rank + badge Cuong Hoa
// gio do SlotView tu ve CSS, thay `.paperdoll__enhance-badge` absolute-
// position ben ngoai slot cu.
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
    emit('select', instance.instanceId)
    useAudioStore().cue('ui.equip')
    unequip(instance.instanceId)
  }
}
</script>

<template>
  <div class="paperdoll">
    <img class="paperdoll__base" :src="PAPERDOLL_BASE_SRC" alt="" aria-hidden="true" />
    <div v-for="entry in SLOT_LAYOUT" :key="entry.slot" class="paperdoll__cell">
      <div class="paperdoll__slot-wrap">
        <SlotView
          class="paperdoll__slot"
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
  position: relative;
  /* Own stacking context so the negative-z base stays between the
     paperdoll background and the runtime socket cells. */
  isolation: isolate;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: min-content;
  gap: 8px;
  align-content: center;
  justify-items: center;
  height: 100%;
  padding: 6px;
  box-sizing: border-box;
  font-family: var(--font-body);
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
