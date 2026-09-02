<script setup lang="ts">
// Task 19 (item-grade-quality-rework, rework P6) — Tab Tinh Luyện
// extracted from EquipmentHallPanel.vue shell. Preview state
// (pendingRefineValues, lockedIndices) is now LOCAL — v-if unmount on
// tab switch resets it automatically (matching old switchTab()'s manual
// clearPendingRefinePreview() call); onBeforeUnmount still discards the
// paid-for core preview so an overlay remount can't reuse a stale payload.
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { LUYEN_KHI_TINH_HOA_ID } from '@/core/equipment/TinhHoaMaterial'
import { equipmentSlotLabel, SPIRIT_STONE_LABEL } from '@/core/presentation/labels'
import { useActionFeedbackStore } from '@/stores/actionFeedback'
import SlotView from '@/components/common/SlotView.vue'
import GameButton from '@/components/common/GameButton.vue'
import type { RefineValueEntry } from '@/core/equipment/EquipmentSystem'
import { getEffectiveAffixValue } from '@/core/equipment/EquipmentSystem'
import { useEquippedRows, useHallSlotRows, useItemRenState, type HallSlotRow } from './useEquippedRows'
import { affixDisplayLabel, formatAffixValue, tierClass } from './equipmentHallDisplay'
import { HALL_SELECTION_KEY } from './hallSelection'

const { t } = useI18n({ useScope: 'local' })

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

const { refinePreview, refineCommit, refineDiscard } = useEquipmentActions()

const feedback = useActionFeedbackStore()

const hallSelection = inject(HALL_SELECTION_KEY)

if (!hallSelection) {
  throw new Error('RefineTab phải được render trong cây con đã provide HALL_SELECTION_KEY')
}

const { selectedInstanceId, selectEquipped, clearSelection } = hallSelection

const { equippedRows } = useEquippedRows()

const hallSlotRows = useHallSlotRows(equippedRows)

const itemRenState = useItemRenState(selectedInstanceId)

const selectedRow = computed(
  () => equippedRows.value.find((row) => row.instanceId === selectedInstanceId.value) ?? null,
)

const lockedIndices = ref<number[]>([])

const pendingRefineValues = ref<RefineValueEntry[] | null>(null)

function clearPendingRefinePreview() {
  refineDiscard(selectedInstanceId.value ?? undefined)

  pendingRefineValues.value = null
}

function selectHallSlotForAction(row: HallSlotRow) {
  clearPendingRefinePreview()

  if (row.equippedRow) {
    selectEquipped(row.equippedRow.instanceId)
  } else {
    clearSelection()
  }

  lockedIndices.value = []
}

onBeforeUnmount(clearPendingRefinePreview)

const selectedAffixes = computed(() => {
  stateVersion.value

  if (!selectedInstanceId.value) {
    return []
  }

  const instance = gameManager.equipmentBag.get(selectedInstanceId.value)

  if (!instance) {
    return []
  }

  return instance.affixes.map((rolled, index) => {
    const affix = gameManager.affixRegistry.has(rolled.affixId)
      ? gameManager.affixRegistry.get(rolled.affixId)
      : undefined

    return {
      index,

      label: affixDisplayLabel(rolled, gameManager.affixRegistry),

      tier: rolled.tier,

      // Stat key để formatStat chọn độ chính xác đúng loại stat (bug
      // 2026-08-30: toFixed(1) ép attackSpeed 0.015 thành "0.0").
      stat: affix?.stat,
    }
  })
})

/** Giá trị hiệu lực hiện tại của 1 dòng affix (cột "Hiện tại" Tinh Luyện). */
function currentAffixValue(index: number): number | null {
  if (!selectedInstanceId.value) {
    return null
  }

  const instance = gameManager.equipmentBag.get(selectedInstanceId.value)

  const rolled = instance?.affixes[index]

  if (!instance || !rolled) {
    return null
  }

  const affix = gameManager.affixRegistry.has(rolled.affixId)
    ? gameManager.affixRegistry.get(rolled.affixId)
    : undefined

  return affix ? getEffectiveAffixValue(rolled, affix) : rolled.value
}

function toggleLock(index: number) {
  const position = lockedIndices.value.indexOf(index)

  if (position >= 0) {
    lockedIndices.value.splice(position, 1)
  } else if (lockedIndices.value.length < 3) {
    // Không cho khóa toàn bộ: tối đa N-1 (và ≤3).
    if (lockedIndices.value.length + 1 < selectedAffixes.value.length) {
      lockedIndices.value.push(index)
    }
  }

  clearPendingRefinePreview()
}

const refineCost = computed(() => {
  stateVersion.value

  return gameManager.getRefineCost(
    selectedAffixes.value.length,
    lockedIndices.value.length,
    selectedRow.value?.quality,
  )
})

// Refine consumes the generic spirit-stone stack; keep this as computed
// derived state so stateVersion refreshes the displayed owned amount.
const refineSpiritStoneCostMaterialId = computed(() => {
  stateVersion.value

  return refineCost.value.spiritStoneMaterialId
})

const refineSpiritStoneCostName = computed(() => {
  const id = refineSpiritStoneCostMaterialId.value

  return gameManager.materialRegistry.has(id) ? gameManager.materialRegistry.get(id).name : SPIRIT_STONE_LABEL
})

const refineSpiritStoneOwned = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(refineSpiritStoneCostMaterialId.value)
})

const refineEssenceOwned = computed(() => {
  stateVersion.value

  if (!selectedRow.value) {
    return 0
  }

  return gameManager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)
})

function canRefine(): boolean {
  const ren = itemRenState.value

  return (
    selectedAffixes.value.length > 0 &&
    lockedIndices.value.length < selectedAffixes.value.length &&
    refineEssenceOwned.value >= refineCost.value.essenceUnits &&
    refineSpiritStoneOwned.value >= refineCost.value.spiritStone &&
    ren !== null &&
    ren.points >= refineCost.value.refinementPoints
  )
}

function doRefinePreview() {
  if (!selectedRow.value) {
    feedback.warning(t('panels.equipmentHall.messages.refineNeedItem'))

    return
  }

  clearPendingRefinePreview()

  const values = refinePreview(selectedRow.value.instanceId, [...lockedIndices.value])

  if (values) {
    pendingRefineValues.value = values
  }
}

function doRefineKeep() {
  if (!selectedRow.value || !pendingRefineValues.value) {
    return
  }

  const instanceId = selectedRow.value.instanceId
  const values = pendingRefineValues.value

  // commit attempt luôn tiêu capability core, nên local preview cũng phải biến
  // mất kể cả commit bị từ chối do state vừa thay đổi.
  pendingRefineValues.value = null
  refineCommit(instanceId, values)
}

function doRefineDiscard() {
  clearPendingRefinePreview()
}

const pendingRefineByIndex = computed(() => {
  const map = new Map<number, number>()

  for (const entry of pendingRefineValues.value ?? []) {
    map.set(entry.index, entry.value)
  }

  return map
})

const refineRenAfter = computed(() =>
  itemRenState.value ? Math.max(0, itemRenState.value.points - refineCost.value.refinementPoints) : 0,
)
</script>

<template>
  <section class="qi-hall__body qi-hall__split">
    <div class="qi-hall__split-left">
      <div class="qi-hall__slot-grid" :aria-label="t('panels.equipmentHall.aria.refineSlots')">
        <SlotView
          v-for="row in hallSlotRows"
          :key="row.slot"
          class="qi-hall__slot"
          :item="row.equippedRow?.instance ?? null"
          :label="row.equippedRow?.name ?? equipmentSlotLabel(row.slot)"
          :name-segments="row.equippedRow?.nameSegments"
          :icon="row.equippedRow?.icon"
          :equipment-quality-rank="row.equippedRow?.gradeRank"
          :rarity-rank="row.equippedRow?.qualityRank"
          :tooltip="row.equippedRow?.tooltip ?? { title: equipmentSlotLabel(row.slot), description: t('panels.equipmentHall.tooltips.emptySlotNoRefine') }"
          :state="{ interaction: row.equippedRow?.instanceId === selectedInstanceId ? 'selected' : 'idle', marker: row.equippedRow ? 'equipped' : undefined }"
          @click="selectHallSlotForAction(row)"
        />
      </div>
    </div>

    <div v-if="selectedRow" class="qi-hall__split-right">
      <!-- Card duy nhất (2026-08-30 spec, khớp đúng Cường Hóa đã duyệt)
           — cột "Khóa" gộp thẳng vào bảng thay vì tách 2 cột flex
           riêng, Điểm Rèn làm dòng chú thích. -->
      <div class="qi-hall__preview-card">
        <p v-if="itemRenState" class="qi-hall__col-title">
          {{ t('panels.equipmentHall.labels.forgePoints') }} {{ itemRenState.points }}/{{ itemRenState.max }} {{ t('panels.equipmentHall.labels.levelArrow') }} {{ refineRenAfter }}/{{ itemRenState.max }}
          · {{ t('panels.equipmentHall.labels.maxLockPrefix') }} {{ Math.min(3, Math.max(0, selectedAffixes.length - 1)) }} {{ t('panels.equipmentHall.labels.maxLockSuffix') }}
        </p>

        <table v-if="selectedAffixes.length" class="qi-hall__compare-table" :aria-label="t('panels.equipmentHall.aria.refineComparison')">
          <thead>
            <tr>
              <th scope="col">{{ t('panels.equipmentHall.table.header.stat') }}</th>
              <th scope="col">{{ t('panels.equipmentHall.table.header.before') }}</th>
              <th scope="col" aria-hidden="true"></th>
              <th scope="col">{{ t('panels.equipmentHall.table.header.after') }}</th>
              <th scope="col">{{ t('panels.equipmentHall.table.header.lock') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="affix in selectedAffixes" :key="affix.index">
              <th scope="row"><span :class="tierClass(affix.tier)">{{ affix.label }}</span></th>
              <td>{{ currentAffixValue(affix.index) !== null ? formatAffixValue(affix.stat, currentAffixValue(affix.index)!) : '—' }}</td>
              <td class="qi-hall__compare-arrow" aria-hidden="true">⇒</td>
              <td>
                <span v-if="lockedIndices.includes(affix.index)" class="qi-hall__owned">{{ t('panels.equipmentHall.status.kept') }}</span>
                <strong v-else-if="pendingRefineByIndex.has(affix.index)">{{ formatAffixValue(affix.stat, pendingRefineByIndex.get(affix.index)!) }}</strong>
                <span v-else class="qi-hall__owned">{{ t('panels.equipmentHall.status.notRolled') }}</span>
              </td>
              <td>
                <input
                  type="checkbox"
                  :checked="lockedIndices.includes(affix.index)"
                  @change="toggleLock(affix.index)"
                />
              </td>
            </tr>
          </tbody>
        </table>

        <p v-else class="qi-hall__empty">{{ t('panels.equipmentHall.empty.noAffixesToRefine') }}</p>
      </div>

      <!-- Bỏ jargon nội bộ "Cost hệ số N+L" + Điểm Rèn trùng dòng chú
           thích đầu card (2026-08-30, bug report) — chỉ còn quy tắc
           tăng 5–20% cho dòng đủ điều kiện, không khóa, clamp trần tier
           (không hiển thị ở đâu khác) và chi phí Tinh Hoa/Linh
           Thạch thật sự chưa có chỗ nào hiện. -->
      <p class="qi-hall__info-row qi-hall__costline">
        {{ t('panels.equipmentHall.labels.refineRule') }} {{ refineCost.essenceUnits }} {{ t('panels.equipmentHall.labels.essenceName') }}
        ({{ t('panels.equipmentHall.labels.ownedPrefix') }} {{ refineEssenceOwned }}) · {{ refineCost.spiritStone }} {{ refineSpiritStoneCostName }}
      </p>

      <div class="qi-hall__button-row">
        <GameButton size="lg" :disabled="!canRefine()" @click="doRefinePreview">
          {{ t('panels.equipmentHall.buttons.refinePreview') }}
        </GameButton>

        <GameButton v-if="pendingRefineValues" size="lg" variant="secondary" @click="doRefineKeep">
          {{ t('panels.equipmentHall.buttons.keep') }}
        </GameButton>

        <GameButton v-if="pendingRefineValues" size="lg" variant="secondary" @click="doRefineDiscard">
          {{ t('panels.equipmentHall.buttons.discard') }}
        </GameButton>
      </div>
    </div>

    <p v-else class="qi-hall__split-right qi-hall__empty qi-hall__empty--centered">{{ t('panels.equipmentHall.empty.selectItem') }}</p>
  </section>
</template>

<style scoped>
.qi-hall__body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.qi-hall__split {
  flex-direction: row;
  gap: 14px;
}

.qi-hall__split-left {
  flex: 0 0 84px;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-right: 10px;
  border-right: 1px solid color-mix(in srgb, var(--scene-fire-text-soft) 22%, transparent);
}

.qi-hall__split-right {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 4%;
}

.qi-hall__slot-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: repeat(6, 1fr);
  gap: 4px;
}

.qi-hall__slot {
  min-width: 0;
}

.qi-hall__preview-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  overflow-y: auto;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--paper-50) 70%, transparent);
}

.qi-hall__col-title {
  margin: 0 0 8px;
  padding-left: 10px;
  border-left: 3px solid var(--paper-eyebrow);
  font: 700 var(--text-title) var(--font-display);
  color: var(--paper-text);
}

.qi-hall__compare-table {
  width: 100%;
  margin: 0;
  border-collapse: collapse;
  font-size: var(--text-md);
}

.qi-hall__compare-table th,
.qi-hall__compare-table td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--paper-line);
  text-align: left;
  color: var(--paper-text);
  font-variant-numeric: tabular-nums;
}

.qi-hall__compare-table thead th {
  padding-top: 4px;
  padding-bottom: 8px;
  font: 700 var(--text-sm) var(--font-body);
  color: var(--paper-eyebrow);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 2px solid color-mix(in srgb, var(--paper-eyebrow) 35%, var(--paper-line));
}

.qi-hall__compare-table thead th:not(:first-child) {
  text-align: center;
}

.qi-hall__compare-table tbody th {
  font: 600 var(--text-md) var(--font-display);
  letter-spacing: 0.01em;
}

.qi-hall__compare-table tbody tr:nth-child(even) {
  background: color-mix(in srgb, var(--mineral-gold) 5%, transparent);
}

.qi-hall__compare-table tbody td:not(.qi-hall__compare-arrow) {
  text-align: center;
  font-size: var(--text-lg);
}

.qi-hall__compare-table td.qi-hall__compare-arrow {
  width: 28px;
  padding: 9px 2px;
  text-align: center;
  color: color-mix(in srgb, var(--paper-eyebrow) 55%, var(--paper-text-soft));
  font-size: var(--text-lg);
  border-bottom-color: transparent;
}

.qi-hall__empty {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--paper-line);
  color: var(--paper-text-soft);
  font-size: var(--text-sm);
  text-align: center;
}

.qi-hall__empty--centered {
  display: flex;
  align-items: center;
  justify-content: center;
}

.qi-hall__owned {
  margin-left: auto;
  color: var(--paper-text-soft);
}

.qi-hall__costline {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}

.qi-hall__info-row {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  padding: 6px 0;
  border-top: 1px solid color-mix(in srgb, var(--scene-fire-text-soft) 22%, transparent);
}

.qi-hall__button-row {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.qi-hall__button-row .game-button {
  min-width: 120px;
}

.qi-hall__tier-1 { color: var(--affix-tier-1); }
.qi-hall__tier-2 { color: var(--affix-tier-2); }
.qi-hall__tier-3 { color: var(--affix-tier-3); }
.qi-hall__tier-4 { color: var(--affix-tier-4); }
.qi-hall__tier-5 {
  color: transparent;
  background: var(--rank-gradient-10);
  background-clip: text;
  -webkit-background-clip: text;
  font-weight: 700;
}

@container overlay-panel (max-width: 760px) {
  .qi-hall__split { flex-direction: column; }
  .qi-hall__split-left {
    flex: 0 0 auto;
    flex-direction: row;
    padding-right: 0;
    padding-bottom: 8px;
    border-right: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--scene-fire-text-soft) 22%, transparent);
  }
  .qi-hall__slot-grid { grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); grid-template-rows: none; }
}
</style>
