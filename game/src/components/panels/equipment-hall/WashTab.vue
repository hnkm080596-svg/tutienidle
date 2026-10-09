<script setup lang="ts">
// Task 19 (item-grade-quality-rework, rework P6) - Tab Tay Luyen
// extracted from EquipmentHallPanel.vue shell. Preview state
// (pendingWashAffixes) is now LOCAL - v-if unmount on tab switch resets
// it automatically, matching the manual reset the old switchTab() did.
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { LUYEN_KHI_TINH_HOA_ID } from '@/core/equipment/TinhHoaMaterial'
import type { RolledAffix } from '@/core/equipment/RolledAffix'
import { SPIRIT_STONE_LABEL } from '@/core/presentation/labels'
import { ITEM_QUALITY_ORDER } from '@/core/item/ItemQuality'
import { useActionFeedbackStore } from '@/stores/actionFeedback'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import SlotView from '@/components/common/SlotView.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { getEffectiveAffixValue } from '@/core/equipment/EquipmentSystem'
import { useEquippedRows, useItemRenState } from './useEquippedRows'
import { affixDisplayLabel, formatAffixValue, tierClass } from './equipmentHallDisplay'
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

const { selectedInstanceId } = hallSelection

const { equippedRows } = useEquippedRows()

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

function discardPendingTicket() {
  if (pendingWashTicket.value) {
    washDiscard(pendingWashTicket.value)
  }

  pendingWashTicket.value = null
}

// Item pick happens on the paperdoll (owner ruling 2026-10-08: same as
// Enhance). A paid preview ticket is bound to the item it rolled for -
// switching selection must discard it so Keep can never commit a stale
// roll onto a different item (the old slot strip did this on click).
watch(selectedInstanceId, discardPendingTicket)

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

interface AffixView {
  index: number
  label: string
  tier: number
  /** Formatted combat-truth value (rolled value; affixes no longer take
   *  the enhance scale - owner ruling 2026-10-08). */
  valueText: string
}

function toAffixView(rolled: RolledAffix, index: number): AffixView {
  const affix = gameManager.affixRegistry.has(rolled.affixId)
    ? gameManager.affixRegistry.get(rolled.affixId)
    : undefined
  const value = affix ? getEffectiveAffixValue(rolled, affix) : rolled.value
  return {
    index,
    label: affixDisplayLabel(rolled, gameManager.affixRegistry),
    tier: rolled.tier,
    valueText: formatAffixValue(affix?.stat, value),
  }
}

const pendingWashAffixDisplay = computed<AffixView[]>(() =>
  pendingWashAffixes.value.map((rolled, index) => toAffixView(rolled, index)),
)

const selectedAffixes = computed<AffixView[]>(() => {
  stateVersion.value

  if (!selectedInstanceId.value) {
    return []
  }

  const instance = gameManager.equipmentBag.get(selectedInstanceId.value)

  if (!instance) {
    return []
  }

  return instance.affixes.map((rolled, index) => toAffixView(rolled, index))
})

interface AffixCompareRow {
  index: number

  before?: AffixView

  after?: AffixView

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

    before: current[position],

    after: pending[position],

    hasTicket: pendingWashTicket.value !== null,
  }))
})

/** Fixed 5-slot card (owner ruling 2026-10-08): an item can roll at
 *  most 5 affix lines (Tien). The card always renders all 5 slots,
 *  empty slots keep their hairline so the rows stay evenly spaced
 *  no matter how many lines the item actually has. */
const washCompareSlots = computed<(AffixCompareRow | null)[]>(() => {
  const rows = washAffixCompareRows.value
  return [0, 1, 2, 3, 4].map((index) => rows[index] ?? null)
})

const MATERIAL_CATEGORY_ART: Record<string, string> = {
  essence: '/assets/ui/tien-hiep-2026-10/controls/resource-essence-v1.png',
  spirit_stone: '/assets/ui/tien-hiep-2026-10/controls/resource-crystal-v1.png',
}

function materialIcon(materialId: string): string | undefined {
  // Guard the registry: .get() throws on unknown ids - a missing
  // material must degrade to no icon, not crash the tab (same .has()
  // pattern as the cost-name computeds).
  const material = gameManager.materialRegistry.has(materialId)
    ? gameManager.materialRegistry.get(materialId)
    : undefined
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
  <!-- Shared layout with Enhance (owner ruling 2026-10-08): Tay Luyen
       needs room for up to 5 affix lines so the preview cell + the 2
       circles are dropped - only the before/after affix list (name
       left, value right, hairline), the wash materials row, and the
       action buttons pinned to the card bottom. Pick gear off the doll. -->
  <div class="equipment-forge-workspace forge-wash">
    <h2>{{ t('panels.equipmentHall.tabs.wash') }}</h2>

    <template v-if="selectedRow">
      <div v-if="washAffixCompareRows.length" class="forge-compare">
        <template v-for="(row, slot) in washCompareSlots" :key="slot">
          <template v-if="row">
            <div class="forge-compare__cell">
              <template v-if="row.before">
                <span class="equipment-stat-name" :class="tierClass(row.before.tier)">{{ row.before.label }}</span>
                <b class="forge-compare__value">{{ row.before.valueText }}</b>
              </template>
              <span v-else class="wash-status">{{ t('panels.equipmentHall.status.added') }}</span>
            </div>
            <span class="forge-compare__row-arrow" aria-hidden="true">»</span>
            <div class="forge-compare__cell forge-compare__cell--next">
              <template v-if="row.after">
                <span class="equipment-stat-name" :class="tierClass(row.after.tier)">{{ row.after.label }}</span>
                <b class="forge-compare__value">{{ row.after.valueText }}</b>
              </template>
              <span v-else class="wash-status">{{
                row.hasTicket
                  ? t('panels.equipmentHall.status.removed')
                  : t('panels.equipmentHall.status.notRolled')
              }}</span>
            </div>
          </template>
          <template v-else>
            <div class="forge-compare__cell forge-compare__cell--empty"></div>
            <span class="forge-compare__row-arrow"></span>
            <div class="forge-compare__cell forge-compare__cell--empty"></div>
          </template>
        </template>
      </div>
      <p v-else class="forge-empty">{{ t('panels.equipmentHall.empty.noAffixes') }}</p>

      <!-- Pinned bottom block (same as Enhance): materials ride above
           the actions band, both anchored to the card's bottom edge via
           .equipment-workspace (positioned ancestor outside this flex
           column) - no scrollbar ever appears. -->
      <div class="equipment-forge-materials">
        <div
          v-for="material in washMaterials"
          :key="material.id"
          class="equipment-material"
          :class="{ 'is-missing': material.owned < material.amount }"
        >
          <div class="equipment-material-icon">
            <SlotView variant="equipment" static :item="null" :icon="material.icon" :label="material.label" />
          </div>
          <div>
            <span>{{ material.label }}</span
            ><b>{{ material.owned }}/{{ material.amount }}</b>
          </div>
        </div>
      </div>
      <!-- Owner ruling 2026-10-09: forge uses are a shared wallet between
           Wash and Refine; a spent wallet freezes the item's sub-lines
           forever. One small hint line, no layout change. -->
      <p class="forge-ren-hint">{{ t('panels.equipmentHall.labels.renSharedHint') }}</p>
      <div class="equipment-forge-actions">
        <EquipmentArtButton filter-art :gold="canWash()" :disabled="!canWash()" @click="doWashPreview">
          {{ t('panels.equipmentHall.buttons.washPreview') }}
        </EquipmentArtButton>
        <EquipmentArtButton v-if="pendingWashTicket" filter-art gold @click="doWashKeep">
          {{ t('panels.equipmentHall.buttons.keep') }}
        </EquipmentArtButton>
        <EquipmentArtButton v-if="pendingWashTicket" filter-art @click="discardPendingTicket">
          {{ t('panels.equipmentHall.buttons.discard') }}
        </EquipmentArtButton>
      </div>
    </template>
    <p v-else class="forge-empty">{{ t('panels.equipmentHall.empty.selectItem') }}</p>
  </div>
</template>

<style scoped>
/* Same forge chrome as EnhanceTab (owner ruling 2026-10-08): title at
   top, before/after compare fills the middle, materials + actions are
   absolutely pinned to the card's bottom edge so they never collide
   and never produce a scrollbar. */
.equipment-forge-workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.forge-wash {
  padding-bottom: 185px;
}
.forge-wash .equipment-forge-materials {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 85px;
}
.forge-wash .equipment-forge-actions {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: -2px;
}
/* Shared-wallet hint sits in the strip between the pinned materials
   row and the actions band - text only, no layout change. */
.forge-ren-hint {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 62px;
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  color: #cbb27a;
  opacity: 0.9;
}
.equipment-forge-workspace h2 {
  font-size: 26px;
  margin: 0;
  border-bottom: 1px solid #9b7d4066;
  padding-bottom: 7px;
  line-height: 1.15;
}
/* Before/after compare: ONE 2-column grid so each affix row shares its
   height across both sides (labels can wrap without desyncing rows).
   Rolls are scrollable inside the area but the scrollbar stays hidden
   (app-wide rule). The arrow sits dead-center as an overlay. */
.forge-compare {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr);
  grid-template-rows: repeat(5, minmax(0, 1fr));
  column-gap: 14px;
  flex: 1;
  min-height: 120px;
  margin-top: 6px;
  padding: 4px 10px;
  border: 1px solid #9b7d4055;
  border-radius: 4px;
  background: #f4e9cf0d;
  overflow-y: auto;
  scrollbar-width: none;
  /* Owner request 2026-10-08: the card is resizable by drag
     (native bottom-right grip) so row spacing can be tuned live. */
  resize: both;
  /* DEBUG outlines while aligning (remove when layout is settled). */
  outline: 2px dashed #37e6f0cc;
  outline-offset: 1px;
}
.forge-compare::-webkit-scrollbar {
  display: none;
}
/* Per-row arrow: sits on the same baseline as the two stat cells so
   the number pair and the arrow can never drift apart (replaces the
   one dead-center overlay that misaligned with the rows). */
.forge-compare__row-arrow {
  align-self: center;
  justify-self: center;
  color: #dfb365;
  font-size: 22px;
  line-height: 1;
  pointer-events: none;
}
.forge-compare__cell {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 9px 2px;
  border-bottom: 1px solid #96764440;
  font-size: 17px;
  min-height: 0;
  /* DEBUG (owner asked for outlines while aligning the 5-row card). */
  outline: 1px solid #ff6fb366;
}
.forge-compare__cell--empty {
  visibility: hidden;
  /* DEBUG: keep the empty slot's outline visible while aligning. */
  visibility: visible;
}
/* tierClass() emits qi-hall__tier-N - owned solely by qi-hall.css
   (owner ruling 2026-10-08: keep the sheet's designed tier colors). */
.equipment-stat-name {
  min-width: 0;
}
.forge-compare__value {
  font-weight: 600;
  color: #ebce84;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.wash-status {
  color: #8f7f5f;
  font-size: 13px;
  margin: auto;
}
/* Materials row: identical metrics to Enhance (icon 65px, label
   column ~150px, owned/amount on one baseline). */
.equipment-forge-materials {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 28px;
  flex: none;
  min-height: 80px;
  /* DEBUG */
  outline: 2px dashed #8effa0aa;
}
.equipment-material {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  /* DEBUG */
  outline: 1px solid #ffbf47aa;
}
.equipment-material > div:last-child {
  /* DEBUG */
  outline: 1px solid #37e6f0aa;
}
/* Material name stays on ONE line in both columns - a wrapped name
   pushed the count into the middle and looked asymmetric (owner
   callout 2026-10-08). */
.equipment-material > div:last-child > span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 16px;
}
.equipment-forge-actions {
  /* DEBUG */
  outline: 2px dashed #37e6f0aa;
}
.equipment-forge-actions :deep(button) {
  /* DEBUG */
  outline: 1px solid #ffbf47aa;
}
.equipment-material-icon {
  width: 65px;
  height: 65px;
  flex: none;
  align-self: center;
}
.equipment-material-icon :deep(.slot-view) {
  width: 100%;
  height: 100%;
}
.equipment-material > div:last-child {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 4px;
  align-self: stretch;
  font-size: 18px;
  line-height: 1.15;
  max-width: 175px;
  min-width: 0;
}
.equipment-material b {
  font-weight: 400;
  color: #8bca8d;
  font-size: 18px;
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
/* Same filter-art pill as Enhance's submit (owner ruling 2026-10-08). */
/* Three short-label pills share the row when a roll is pending
   (Wash / Keep / Discard) - same shrink-to-fit as RefineTab. */
.equipment-forge-actions > button {
  width: 220px;
  min-width: 0;
  font-size: 24px;
}
.forge-empty {
  flex: 1;
  display: grid;
  place-items: center;
  margin: 0;
  font-size: 15px;
  color: #c1b18d;
}
</style>
