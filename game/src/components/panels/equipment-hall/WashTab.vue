<script setup lang="ts">
// Task 19 (item-grade-quality-rework, rework P6) — Tab Tẩy Luyện
// extracted from EquipmentHallPanel.vue shell. Preview state
// (pendingWashAffixes) is now LOCAL — v-if unmount on tab switch resets
// it automatically, matching the manual reset the old switchTab() did.
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { LUYEN_KHI_TINH_HOA_ID } from '@/core/equipment/TinhHoaMaterial'
import type { RolledAffix } from '@/core/equipment/RolledAffix'
import { equipmentSlotLabel, SPIRIT_STONE_LABEL } from '@/core/presentation/labels'
import { ITEM_QUALITY_ORDER } from '@/core/item/ItemQuality'
import { useActionFeedbackStore } from '@/stores/actionFeedback'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'
import SlotView from '@/components/common/SlotView.vue'
import GameButton from '@/components/common/GameButton.vue'
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

// Preview đang chờ "giữ/bỏ" (2026-08-30 spec) — LOCAL (v-if unmount tự
// reset khi đổi tab, giữ đúng semantics switchTab() cũ).
// R9 (AR-21): chỉ giữ TICKET ID + display copy; affixes authoritative
// nằm trong domain — UI không thể fabricate kết quả commit.
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

  if (washCommit(selectedRow.value.instanceId, pendingWashTicket.value)) {
    pendingWashTicket.value = null
  }
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

  beforeLabel: string

  beforeTier: number

  afterLabel?: string

  afterTier?: number
}

/** Tẩy Luyện reroll TOÀN BỘ affix (đổi cả identity) — mỗi dòng so sánh
 * theo ĐÚNG vị trí index giữa affix hiện tại và affix preview đang chờ. */
const washAffixCompareRows = computed<AffixCompareRow[]>(() => {
  const pending = pendingWashAffixDisplay.value

  return selectedAffixes.value.map((affix, position) => ({
    index: affix.index,

    beforeLabel: affix.label,

    beforeTier: affix.tier,

    afterLabel: pending[position]?.label,

    afterTier: pending[position]?.tier,
  }))
})

const washRenAfter = computed(() =>
  itemRenState.value ? Math.max(0, itemRenState.value.points - 1) : 0,
)
</script>

<template>
  <section class="qi-hall__body qi-hall__split">
    <div class="qi-hall__split-left">
      <div class="qi-hall__slot-grid" :aria-label="t('panels.equipmentHall.aria.washSlots')">
        <SlotView
          v-for="row in hallSlotRows"
          :key="row.slot"
          class="qi-hall__slot"
                    :item="row.equippedRow?.instance ?? null"
          :label="row.equippedRow?.name ?? equipmentSlotLabel(row.slot)"
          :accessible-label="row.equippedRow?.accessibleLabel"
          :name-segments="row.equippedRow?.nameSegments"
          :icon="row.equippedRow?.icon"
          :equipment-quality-rank="row.equippedRow?.gradeRank"
          :rarity-rank="row.equippedRow?.qualityRank"
          :tooltip="row.equippedRow?.tooltip ?? { title: equipmentSlotLabel(row.slot), description: t('panels.equipmentHall.tooltips.emptySlotNoWash') }"
          :state="{ interaction: row.equippedRow?.instanceId === selectedInstanceId ? 'selected' : 'idle', marker: row.equippedRow ? 'equipped' : undefined }"
          @click="selectHallSlotForAction(row)"
        />
      </div>
    </div>

    <div v-if="selectedRow" class="qi-hall__split-right">
      <!-- Card duy nhất (2026-08-30 spec, khớp đúng Cường Hóa đã duyệt)
           — Điểm Rèn làm dòng chú thích, mỗi dòng phụ 1 hàng thật
           trong bảng, không còn 2 cột flex + bảng meta tách rời. -->
      <div class="qi-hall__preview-card">
        <p v-if="itemRenState" class="qi-hall__col-title">
          {{ t('panels.equipmentHall.labels.forgePoints') }} {{ itemRenState.points }}/{{ itemRenState.max }} {{ t('panels.equipmentHall.labels.levelArrow') }} {{ washRenAfter }}/{{ itemRenState.max }}
        </p>

        <table v-if="washAffixCompareRows.length" class="qi-hall__compare-table" :aria-label="t('panels.equipmentHall.aria.washComparison')">
          <thead>
            <tr>
              <th scope="col">{{ t('panels.equipmentHall.table.header.stat') }}</th>
              <th scope="col">{{ t('panels.equipmentHall.table.header.before') }}</th>
              <th scope="col" aria-hidden="true"></th>
              <th scope="col">{{ t('panels.equipmentHall.table.header.after') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, position) in washAffixCompareRows" :key="row.index">
              <th scope="row">{{ t('panels.equipmentHall.labels.rowLine') }} {{ position + 1 }}</th>
              <td><span :class="tierClass(row.beforeTier)">{{ row.beforeLabel }}</span></td>
              <td class="qi-hall__compare-arrow" aria-hidden="true">⇒</td>
              <td>
                <span v-if="row.afterLabel" :class="tierClass(row.afterTier!)">{{ row.afterLabel }}</span>
                <span v-else class="qi-hall__owned">{{ t('panels.equipmentHall.status.notRolled') }}</span>
              </td>
            </tr>
          </tbody>
        </table>

        <p v-else class="qi-hall__empty">{{ t('panels.equipmentHall.empty.noAffixes') }}</p>
      </div>

      <div class="qi-hall__info-row">
        <!-- Điểm Rèn tốn mỗi lượt đã hiện ở dòng chú thích đầu card
             (2026-08-30, bug report: trùng lặp) — costline chỉ còn chi
             phí KHÁC (Linh Thạch) chưa hiện ở đâu. -->
        <p class="qi-hall__costline">
          {{ t('panels.equipmentHall.labels.costPerUse') }} {{ washCost.tinhHoa }} {{ t('panels.equipmentHall.labels.essenceName') }}
          ({{ t('panels.equipmentHall.labels.ownedPrefix') }} {{ washEssenceOwned }}) · {{ washCost.spiritStone }} {{ washSpiritStoneCostName }}
        </p>
      </div>

      <div class="qi-hall__button-row">
        <GameButton size="lg" :disabled="!canWash()" @click="doWashPreview">
          {{ t('panels.equipmentHall.buttons.washPreview') }}
        </GameButton>

        <GameButton v-if="pendingWashTicket" size="lg" variant="secondary" @click="doWashKeep">
          {{ t('panels.equipmentHall.buttons.keep') }}
        </GameButton>
      </div>
    </div>

    <p v-else class="qi-hall__split-right qi-hall__empty qi-hall__empty--centered">{{ t('panels.equipmentHall.empty.selectItem') }}</p>
  </section>
</template>

