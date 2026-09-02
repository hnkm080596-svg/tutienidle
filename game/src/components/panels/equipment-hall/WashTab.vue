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

const { t } = useI18n({ useScope: 'local' })

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

const { washPreview, washCommit } = useEquipmentActions()

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
const pendingWashAffixes = ref<RolledAffix[] | null>(null)

const selectedOreId = ref<string | null>(null)

function selectHallSlotForAction(row: HallSlotRow) {
  if (row.equippedRow) {
    selectEquipped(row.equippedRow.instanceId)
  } else {
    clearSelection()
  }

  pendingWashAffixes.value = null

  selectedOreId.value = null
}

/** Chọn ore cùng realm cho Tẩy Luyện — chỉ hiện stack người chơi có. */
const oreChoices = computed(() => {
  stateVersion.value

  if (!selectedRow.value) {
    return []
  }

  const prefix = `${selectedRow.value.realmId}_ore_`

  return gameManager.materialBag
    .getAll()
    .filter((stack) => stack.material.id.startsWith(prefix))
    .map((stack) => ({
      materialId: stack.material.id,

      name: stack.material.name,

      owned: stack.amount,
    }))
})

const washCost = computed(() => {
  stateVersion.value

  return gameManager.getWashCost(selectedRow.value?.quality ?? ITEM_QUALITY_ORDER[0]!)
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
    feedback.warning(t('panels.equipmentHall.messages.refineNeedItem'))

    return
  }

  const affixes = washPreview(selectedRow.value.instanceId)

  if (affixes) {
    pendingWashAffixes.value = affixes
  }
}

function doWashKeep() {
  if (!selectedRow.value || !pendingWashAffixes.value) {
    return
  }

  if (washCommit(selectedRow.value.instanceId, pendingWashAffixes.value)) {
    pendingWashAffixes.value = null
  }
}

const pendingWashAffixDisplay = computed(() =>
  (pendingWashAffixes.value ?? []).map((rolled, index) => ({
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
          :name-segments="row.equippedRow?.nameSegments"
          :icon="row.equippedRow?.icon"
          :equipment-quality-rank="row.equippedRow?.qualityRank"
          :rarity-rank="row.equippedRow?.rarityRank"
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
        <div class="qi-hall__info-options">
          <span class="qi-hall__info-label">{{ t('panels.equipmentHall.labels.oreSelection') }}</span>

          <label v-for="ore in oreChoices" :key="ore.materialId" class="qi-hall__option">
            <input type="radio" :value="ore.materialId" v-model="selectedOreId" />

            <span>{{ ore.name }} ×{{ ore.owned }}</span>
          </label>
        </div>

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

        <GameButton v-if="pendingWashAffixes" size="lg" variant="secondary" @click="doWashKeep">
          {{ t('panels.equipmentHall.buttons.keep') }}
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

.qi-hall__option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  min-height: var(--tap-min);
  font-size: var(--text-sm);
  cursor: pointer;
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

.qi-hall__info-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}

.qi-hall__info-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--paper-eyebrow);
  text-transform: uppercase;
  letter-spacing: 0.03em;
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
  background: var(--rank-gradient-9);
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
