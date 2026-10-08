<script setup lang="ts">
// Task 19 (item-grade-quality-rework, rework P6) - Tab Tay Luyen
// extracted from EquipmentHallPanel.vue shell. Preview state
// (pendingWashAffixes) is now LOCAL - v-if unmount on tab switch resets
// it automatically, matching the manual reset the old switchTab() did.
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { LUYEN_KHI_TINH_HOA_ID } from '@/core/equipment/TinhHoaMaterial'
import type { RolledAffix } from '@/core/equipment/RolledAffix'
import { equipmentSlotLabel, SPIRIT_STONE_LABEL } from '@/core/presentation/labels'
import { ITEM_QUALITY_ORDER } from '@/core/item/ItemQuality'
import { useActionFeedbackStore } from '@/stores/actionFeedback'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import EquipmentArtSlot from '@/components/common/art/EquipmentArtSlot.vue'
import { equipmentArt } from '@/components/common/art/equipmentArt'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { useEquippedRows, useHallSlotRows, useItemRenState, type HallSlotRow } from './useEquippedRows'
import { affixDisplayLabel, tierClass } from './equipmentHallDisplay'
import { HALL_SELECTION_KEY } from './hallSelection'

const { t } = useI18n()

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

const { washPreview, washPreviewAffixes, washDiscard, washCommit } = useEquipmentActions()

const feedback = useActionFeedbackStore()

const hallSelection = inject(HALL_SELECTION_KEY)

if (!hallSelection) {
  throw new Error('WashTab phải được render trong cây con đã provide HALL_SELECTION_KEY')
}

const { selectedInstanceId, selectEquipped, clearSelection } = hallSelection

const { equippedRows } = useEquippedRows()

const hallSlotRows = useHallSlotRows(equippedRows)

const itemRenState = useItemRenState(selectedInstanceId)

const selectedRow = computed(
  () => equippedRows.value.find((row) => row.instanceId === selectedInstanceId.value) ?? null,
)

// Preview dang cho "giu/bo" (2026-08-30 spec) - LOCAL (v-if unmount tu
// reset khi doi tab, giu dung semantics switchTab() cu).
// R9 (AR-21): chi giu TICKET ID + display copy; affixes authoritative
// nam trong domain - UI khong the fabricate ket qua commit.
const pendingWashTicket = ref<string | null>(null)

const pendingWashAffixes = computed<RolledAffix[]>(() =>
  pendingWashTicket.value ? washPreviewAffixes(pendingWashTicket.value) ?? [] : [],
)

function selectHallSlotForAction(row: HallSlotRow) {
  if (row.equippedRow) {
    selectEquipped(row.equippedRow.instanceId)
  } else {
    clearSelection()
  }

  discardPendingTicket()
}

function discardPendingTicket() {
  if (pendingWashTicket.value) {
    washDiscard(pendingWashTicket.value)
  }

  pendingWashTicket.value = null
}

// T4-33 - the ticket was PAID at preview time; an unmount that keeps it
// armed lets a remounted tab reuse a stale paid roll.
onBeforeUnmount(discardPendingTicket)

const washCost = computed(() => {
  stateVersion.value

  return gameManager.equipmentOps.getWashCost(selectedRow.value?.quality ?? ITEM_QUALITY_ORDER[0]!)
})

const washSpiritStoneCostName = computed(() =>
  gameManager.materialRegistry.has(SPIRIT_STONE_MATERIAL_ID)
    ? gameManager.materialRegistry.get(SPIRIT_STONE_MATERIAL_ID).name
    : SPIRIT_STONE_LABEL,
)

const washSpiritStoneOwned = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
})

const washEssenceOwned = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)
})

function canWash(): boolean {
  const ren = itemRenState.value
  const row = selectedRow.value
  if (!row) {
    return false
  }
  return (
    ren !== null &&
    ren.points > 0 &&
    washEssenceOwned.value >= washCost.value.tinhHoa &&
    washSpiritStoneOwned.value >= washCost.value.spiritStone
  )
}

function doWashPreview() {
  if (!selectedRow.value) {
    feedback.warning(t('panels.equipmentHall.messages.washNeedItem'))

    return
  }

  // A new preview replaces the old ticket (and its paid roll is forfeited,
  // same as the old local-state behavior: re-roll pays again).
  const ticketId = washPreview(selectedRow.value.instanceId)

  if (ticketId) {
    pendingWashTicket.value = ticketId
  }
}

function doWashKeep() {
  if (!selectedRow.value || !pendingWashTicket.value) {
    return
  }

  // The domain consumes the ticket on EVERY commit attempt (R9/AR-21,
  // refine-style), so a failed commit must not leave a dead armed "Keep" -
  // the rejection is already surfaced via withSyncAndResult feedback.
  washCommit(selectedRow.value.instanceId, pendingWashTicket.value)
  pendingWashTicket.value = null
}

const pendingWashAffixDisplay = computed(() =>
  pendingWashAffixes.value.map((rolled, index) => ({
    index,

    label: affixDisplayLabel(rolled, gameManager.affixRegistry),

    tier: rolled.tier,
  })),
)

const selectedAffixes = computed(() => {
  stateVersion.value

  if (!selectedInstanceId.value) {
    return []
  }

  const instance = gameManager.equipmentBag.get(selectedInstanceId.value)

  if (!instance) {
    return []
  }

  return instance.affixes.map((rolled, index) => ({
    index,

    label: affixDisplayLabel(rolled, gameManager.affixRegistry),

    tier: rolled.tier,
  }))
})

interface AffixCompareRow {
  index: number

  beforeLabel?: string

  beforeTier?: number

  afterLabel?: string

  afterTier?: number

  /** True while a paid ticket is pending - distinguishes "rolled zero
   * lines" (removed) from "no roll pending" (notRolled). */
  hasTicket: boolean
}

/** Tay Luyen reroll TOAN BO affix (doi ca identity) - moi dong so sanh
 * by EXACT index position between current affixes and the pending preview.
 * T4-33: rows cover BOTH lists - a roll with more lines than the item
 * currently has must still show the extra rolled line, and a roll that
 * dropped a line shows it as removed. */
const washAffixCompareRows = computed<AffixCompareRow[]>(() => {
  const pending = pendingWashAffixDisplay.value
  const current = selectedAffixes.value
  const rowCount = Math.max(current.length, pending.length)

  return Array.from({ length: rowCount }, (_, position) => ({
    index: position,

    beforeLabel: current[position]?.label,

    beforeTier: current[position]?.tier,

    afterLabel: pending[position]?.label,

    afterTier: pending[position]?.tier,

    hasTicket: pendingWashTicket.value !== null,
  }))
})

const washRenAfter = computed(() =>
  itemRenState.value ? Math.max(0, itemRenState.value.points - 1) : 0,
)

const circleFrameSrc = equipmentArt('equipment-circle-frame-v1')

const MATERIAL_CATEGORY_ART: Record<string, string> = {
  essence: '/assets/ui/tien-hiep-2026-10/controls/resource-essence-v1.png',
  spirit_stone: '/assets/ui/tien-hiep-2026-10/controls/resource-crystal-v1.png',
}

function materialIcon(materialId: string): string | undefined {
  const material = gameManager.materialRegistry.get(materialId)
  const art = material?.icon ?? (material?.category ? MATERIAL_CATEGORY_ART[material.category] : undefined)
  return art ? resolveAssetUrl(art) : undefined
}

const washMaterials = computed(() => [
  {
    id: LUYEN_KHI_TINH_HOA_ID,
    label: t('panels.equipmentHall.labels.essenceName'),
    icon: materialIcon(LUYEN_KHI_TINH_HOA_ID),
    owned: washEssenceOwned.value,
    amount: washCost.value.tinhHoa,
  },
  {
    id: SPIRIT_STONE_MATERIAL_ID,
    label: washSpiritStoneCostName.value,
    icon: materialIcon(SPIRIT_STONE_MATERIAL_ID),
    owned: washSpiritStoneOwned.value,
    amount: washCost.value.spiritStone,
  },
])
</script>

<template>
  <!-- Reskin theo Codex EquipmentForgePreview ('wash'): 2 cot
       Hien tai / Ket qua. Lech ghi nhan: khong nut khoa tung dong
       (domain chi ho tro khoa cho Tinh Luyen, khong cho Tay Luyen);
       hang chon slot o dau card (preview chon qua socket doll). -->
  <div class="equipment-forge-workspace forge-wash">
    <h2>{{ t('panels.equipmentHall.tabs.wash') }}</h2>

    <div class="wash-slot-strip" :aria-label="t('panels.equipmentHall.aria.washSlots')">
      <button
        v-for="row in hallSlotRows"
        :key="row.slot"
        type="button"
        class="wash-slot"
        :class="{ selected: row.equippedRow?.instanceId === selectedInstanceId }"
        :aria-pressed="row.equippedRow?.instanceId === selectedInstanceId"
        :aria-label="row.equippedRow?.accessibleLabel ?? equipmentSlotLabel(row.slot)"
        :title="row.equippedRow?.name ?? equipmentSlotLabel(row.slot)"
        @click="selectHallSlotForAction(row)"
      >
        <img class="wash-slot__frame" :src="circleFrameSrc" alt="" aria-hidden="true" />
        <img v-if="row.equippedRow?.icon" class="wash-slot__icon" :src="row.equippedRow.icon" alt="" aria-hidden="true" />
      </button>
    </div>

    <template v-if="selectedRow">
      <p v-if="itemRenState" class="wash-ren">
        {{ t('panels.equipmentHall.labels.forgePoints') }} {{ itemRenState.points }}/{{ itemRenState.max }}
        {{ t('panels.equipmentHall.labels.levelArrow') }} {{ washRenAfter }}/{{ itemRenState.max }}
      </p>

      <div v-if="washAffixCompareRows.length" class="equipment-wash-columns">
        <section>
          <h3>{{ t('panels.equipmentHall.forge.current') }}</h3>
          <div v-for="row in washAffixCompareRows" :key="`before-${row.index}`" class="equipment-affix-row">
            <span v-if="row.beforeLabel" class="equipment-stat-name" :class="tierClass(row.beforeTier!)">{{ row.beforeLabel }}</span>
            <span v-else class="equipment-stat-name wash-status">{{ t('panels.equipmentHall.status.added') }}</span>
          </div>
        </section>
        <section>
          <h3>{{ t('panels.equipmentHall.forge.result') }}</h3>
          <div v-for="row in washAffixCompareRows" :key="`after-${row.index}`" class="equipment-affix-row">
            <span v-if="row.afterLabel" class="equipment-stat-name" :class="tierClass(row.afterTier!)">{{ row.afterLabel }}</span>
            <span v-else class="equipment-stat-name wash-status">{{
              row.hasTicket
                ? t('panels.equipmentHall.status.removed')
                : t('panels.equipmentHall.status.notRolled')
            }}</span>
          </div>
        </section>
      </div>
      <p v-else class="wash-empty">{{ t('panels.equipmentHall.empty.noAffixes') }}</p>

      <h3 class="equipment-forge-divider material-divider">{{ t('panels.equipmentHall.forge.washMaterials') }}</h3>
      <div class="equipment-forge-materials">
        <div
          v-for="material in washMaterials"
          :key="material.id"
          class="equipment-material"
          :class="{ 'is-missing': material.owned < material.amount }"
        >
          <div class="equipment-material-icon">
            <EquipmentArtSlot :icon="material.icon" :label="material.label" empty />
          </div>
          <span>{{ material.label }}</span>
          <b>{{ material.owned }}/{{ material.amount }}</b>
        </div>
      </div>

      <div class="equipment-forge-actions">
        <EquipmentArtButton gold :disabled="!canWash()" @click="doWashPreview">
          {{ t('panels.equipmentHall.buttons.washPreview') }}
        </EquipmentArtButton>
        <EquipmentArtButton
          v-if="pendingWashTicket"
          :disabled="!pendingWashTicket"
          @click="doWashKeep"
        >
          {{ t('panels.equipmentHall.buttons.keep') }}
        </EquipmentArtButton>
      </div>
    </template>
    <p v-else class="wash-empty">{{ t('panels.equipmentHall.empty.selectItem') }}</p>
  </div>
</template>

<style scoped>
/* Forge layout copied from the approved preview
   (ui-preview/equipment/EquipmentForgePreview.vue, 'wash' branch). */
.equipment-forge-workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.equipment-forge-workspace h2 {
  font-size: 26px;
  margin: 0;
  border-bottom: 1px solid #9b7d4066;
  padding-bottom: 7px;
  line-height: 1.15;
}
.equipment-forge-divider {
  margin: 0;
  text-align: center;
  font-size: 16px;
  line-height: 1.2;
  display: flex;
  align-items: center;
  gap: 10px;
}
.equipment-forge-divider::before,
.equipment-forge-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #a4894e;
  opacity: 0.6;
}
.equipment-wash-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  flex: 1;
  min-height: 0;
}
.equipment-wash-columns > section {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 8px;
}
.equipment-wash-columns h3 {
  text-align: center;
  font-size: 19px;
  margin: 0;
  padding: 3px 0 6px;
  border-bottom: 1px solid #9d804a;
}
.equipment-affix-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 11px;
  border: 1px solid #987b4855;
  flex: 1;
  min-height: 0;
  font-size: 14px;
}
/* tierClass() emits qi-hall__tier-N (equipmentHallDisplay.ts) - defined
   locally so the scene does not depend on the legacy qi-hall.css bundle. */
.qi-hall__tier-1 { color: var(--affix-tier-1); }
.qi-hall__tier-2 { color: var(--affix-tier-2); }
.qi-hall__tier-3 { color: var(--affix-tier-3); }
.qi-hall__tier-4 { color: var(--affix-tier-4); }
.qi-hall__tier-5 { color: var(--affix-tier-5); }
.equipment-stat-name {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.wash-status {
  color: #8f7f5f;
  font-size: 12px;
}
.equipment-forge-materials {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 43px;
  flex: none;
  min-height: 53px;
}
.forge-wash .equipment-material {
  flex-direction: column;
  gap: 4px;
}
.forge-wash .equipment-material-icon {
  height: 44px;
  width: 44px;
}
.equipment-material {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.equipment-material-icon {
  width: 48px;
  height: 48px;
  flex: none;
}
.equipment-material span {
  font-size: 13px;
}
.equipment-material b {
  font-weight: 400;
  color: #8bca8d;
  font-size: 13px;
  white-space: nowrap;
}
.equipment-material.is-missing b {
  color: var(--crimson, #c05a4e);
}
.equipment-forge-actions {
  display: flex;
  justify-content: center;
  gap: 18px;
  flex: none;
}
.forge-wash .equipment-forge-actions > button {
  min-width: 0;
  flex: 1;
  font-size: 21px;
}
.wash-ren {
  margin: 0;
  text-align: center;
  font-size: 13px;
  color: #c1b18d;
}
.wash-empty {
  flex: 1;
  display: grid;
  place-items: center;
  margin: 0;
  font-size: 14px;
  color: #c1b18d;
}

/* Hang chon slot - live-only (preview chon qua socket doll). */
.wash-slot-strip {
  display: flex;
  justify-content: center;
  gap: 14px;
  flex: none;
  height: 52px;
}
.wash-slot {
  position: relative;
  width: 52px;
  height: 52px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.wash-slot__frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
.wash-slot__icon {
  position: absolute;
  inset: 14%;
  width: 72%;
  height: 72%;
  object-fit: contain;
}
.wash-slot.selected .wash-slot__frame {
  filter: brightness(1.35) drop-shadow(0 0 5px #d9a94f88);
}
.wash-slot:not(.selected):hover .wash-slot__frame {
  filter: brightness(1.18);
}
</style>

