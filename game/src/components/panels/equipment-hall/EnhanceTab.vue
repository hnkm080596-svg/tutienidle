<script setup lang="ts">
// Task 19 (item-grade-quality-rework, rework P6) — Tab Cường Hóa
// extracted from EquipmentHallPanel.vue shell. Cường Hóa gắn SLOT (not
// selectedInstanceId) — hoàn toàn tự chứa, KHÔNG cần inject shared
// selection (chỉ Wash/Refine mới dùng selectedInstanceId/selectEquipped).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'
import { materialLabel, equipmentSlotLabel } from '@/core/presentation/labels'
import { statLabel, formatStat } from '@/core/stats/StatLabels'
import type { Stats } from '@/core/stats/StatBlock'
import {
  getSpiritStoneMaterialIdForEnhanceLevel,
} from '@/core/material/SpiritStoneMaterial'
import SlotView from '@/components/common/SlotView.vue'
import { EQUIPMENT_SLOTS } from '@/core/equipment/EquipmentSlotState'
import GameButton from '@/components/common/GameButton.vue'
import {
  calculateEquipmentScale,
  getEffectiveAffixValue,
} from '@/core/equipment/EquipmentSystem'
import { MAX_SLOT_ENHANCE_LEVEL } from '@/core/equipment/EnhanceCurve'
import { useEquippedRows } from './useEquippedRows'
import { formatAffixValue } from './equipmentHallDisplay'

const { t } = useI18n({ useScope: 'local' })

const player = usePlayerStore()

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

const { enhance } = useEquipmentActions()

const { equippedRows } = useEquippedRows()

// =========================
// Tab Cường Hóa
// =========================

interface EnhanceSlotRow {
  slot: EquipmentSlot

  itemName: string

  enhanceLevel: number

  maxLevel: number

  costs: Array<{ materialId: string; label: string; amount: number; owned: number }>

  spiritStone: number
  spiritStoneMaterialId: string
  spiritStoneOwned: number

  equippedRow?: (typeof equippedRows.value)[number]
}

const enhanceRows = computed<EnhanceSlotRow[]>(() => {
  stateVersion.value

  // Slot-level rework (yêu cầu 2026-08-26): Cường Hóa gắn SLOT —
  // slot TRỐNG vẫn hiện trần/cost và nâng được; realmId lấy theo người
  // chơi hiện hành để resolve catalog nghề.
  const realmId = player.$state.realmId

  const equippedRowBySlot = new Map(equippedRows.value.map((row) => [row.slot, row]))

  return gameManager.getAllSlotStates().map((slotState) => {
    const equipped = gameManager.equipmentBag.getEquippedInSlot(slotState.slot)

    const costs = gameManager.getEnhanceCost(slotState.slot, realmId).map((entry) => ({
      materialId: entry.materialId,

      label: materialLabel(entry.materialId, gameManager.materialRegistry),

      amount: entry.amount,

      owned: gameManager.materialBag.getAmount(entry.materialId),
    }))

    const spiritStone = gameManager.getEnhanceSpiritStoneCost(slotState.slot, realmId)
    const spiritStoneMaterialId = getSpiritStoneMaterialIdForEnhanceLevel(slotState.enhanceLevel)

    const maxLevel = MAX_SLOT_ENHANCE_LEVEL

    return {
      slot: slotState.slot,

      itemName: equipped
        ? gameManager.getEquipmentTemplate(equipped.itemId)?.name ?? equipped.itemId
        : t('panels.equipmentHall.labels.emptySlotPlaceholder'),

      enhanceLevel: slotState.enhanceLevel,

      maxLevel,

      costs,

      spiritStone,
      spiritStoneMaterialId,
      spiritStoneOwned: gameManager.materialBag.getAmount(spiritStoneMaterialId),

      equippedRow: equippedRowBySlot.get(slotState.slot),
    }
  })
})

const selectedEnhanceSlot = ref<EquipmentSlot>(EQUIPMENT_SLOTS[0]!)

const selectedEnhanceRow = computed(() =>
  enhanceRows.value.find((row) => row.slot === selectedEnhanceSlot.value) ?? null,
)

function selectEnhanceSlot(slot: EquipmentSlot) {
  selectedEnhanceSlot.value = slot
}

function canEnhance(row: EnhanceSlotRow): boolean {
  return (
    row.enhanceLevel < row.maxLevel &&
    row.costs.every((cost) => cost.owned >= cost.amount) &&
    row.spiritStoneOwned >= row.spiritStone
  )
}

function doEnhance(row: EnhanceSlotRow) {
  enhance(row.slot)
}

interface EnhancePreviewRow {
  key: string

  label: string

  // Stat key để formatStat chọn độ chính xác theo loại stat — số thập
  // phân nhỏ (attackSpeed 0.01–0.02) không bị toFixed(1) thành "0.0"
  // (bug report 2026-08-30).
  stat: keyof Stats | undefined

  currentValue: number

  nextValue: number

  // Percent growth as stat-ratio (0-1), not display-percent (0-100) —
  // stored as ratio so formatStat('affixDeltaPercent', ...) applies
  // the ×100.toFixed(1)% logic automatically.
  percent: number
}

/**
 * Xem trước "sau Cường Hóa" — xác định (không random), luôn tính được ngay
 * khi có mainStat, không cần preview/giữ/bỏ như Tẩy/Tinh Luyện. Danh sách
 * dòng khớp CHÍNH XÁC những gì EquipmentSystem.applyModifiers() thật sự
 * scale theo enhanceLevel (2026-08-30 bug report: cột "Sau Cường Hóa" cũ
 * chỉ tính mainStat, bỏ sót toàn bộ affix phụ nên 2 cột không khớp dòng) —
 * dòng đầu LUÔN là mainStat, sau đó từng affix theo ĐÚNG thứ tự
 * instance.affixes để 2 cột "Hiện tại"/"Sau" render cùng danh sách, khớp
 * 1-1 theo index thay vì 2 mảng khác nguồn.
 */
const enhancePreviewRows = computed<EnhancePreviewRow[] | null>(() => {
  stateVersion.value

  const row = selectedEnhanceRow.value

  const instance = row?.equippedRow?.instance

  if (!row || !instance) {
    return null
  }

  const currentScale = calculateEquipmentScale(row.enhanceLevel)
  const nextScale = calculateEquipmentScale(row.enhanceLevel + 1)

  function toRow(key: string, label: string, stat: keyof Stats | undefined, baseFlat: number): EnhancePreviewRow {
    const currentValue = baseFlat * currentScale

    const nextValue = baseFlat * nextScale

    return {
      key,

      label,

      stat,

      currentValue,

      nextValue,

      // Stat-ratio (0-1) so formatStat() can apply the standard
      // `×100.toFixed(1)%` percent formatting.
      percent: currentValue > 0 ? (nextValue - currentValue) / currentValue : 0,
    }
  }

  const rows: EnhancePreviewRow[] = [
    toRow('main', statLabel(instance.mainStat.stat), instance.mainStat.stat, instance.mainStat.flat ?? 0),
  ]

  instance.affixes.forEach((rolled, index) => {
    const affix = gameManager.affixRegistry.has(rolled.affixId)
      ? gameManager.affixRegistry.get(rolled.affixId)
      : undefined

    if (!affix) {
      return
    }

    rows.push(toRow(`affix-${index}`, statLabel(affix.stat), affix.stat, getEffectiveAffixValue(rolled, affix)))
  })

  return rows
})
</script>

<template>
  <section class="qi-hall__body qi-hall__split">
    <div class="qi-hall__split-left">
      <div class="qi-hall__slot-grid" :aria-label="t('panels.equipmentHall.aria.enhanceSlots')">
        <SlotView
          v-for="row in enhanceRows"
          :key="row.slot"
          class="qi-hall__slot"
          :item="row.equippedRow?.instance ?? null"
          :label="row.equippedRow?.name ?? equipmentSlotLabel(row.slot)"
          :name-segments="row.equippedRow?.nameSegments"
          :icon="row.equippedRow?.icon"
          :equipment-quality-rank="row.equippedRow?.gradeRank"
          :rarity-rank="row.equippedRow?.qualityRank"
          :tooltip="row.equippedRow?.tooltip ?? { title: equipmentSlotLabel(row.slot), description: t('panels.equipmentHall.tooltips.emptySlotCanEnhance') }"
          :badges="[{ kind: 'enhance', text: `+${row.enhanceLevel}` }]"
          :state="{ interaction: row.slot === selectedEnhanceSlot ? 'selected' : 'idle' }"
          @click="selectEnhanceSlot(row.slot)"
        />
      </div>
    </div>

    <div v-if="selectedEnhanceRow" class="qi-hall__split-right">
      <!-- Dùng THẲNG <table> giống Tẩy/Tinh Luyện thay vì 2 cột flex độc
           lập (2026-08-30 bug report: "không ngang hàng với nhau" — 2
           cột flex co giãn riêng nên dòng chính/dòng phụ lệch nhau khi
           số dòng hoặc độ dài nội dung khác nhau; <tr> đảm bảo khớp
           hàng-với-hàng thật sự). Bỏ hẳn dòng tiêu đề "Slot · Tên món"
           cũ (2026-08-30, bug report thứ 2: dòng đó tạo lệch — thông
           tin này đã có sẵn qua ô đang chọn ở lưới bên trái, không cần
           lặp lại). Header bảng dùng "Trước/Sau" y hệt Tẩy/Tinh Luyện
           thay vì hiện số cấp thô màu eyebrow khó đọc — cấp đổi dời
           xuống 1 dòng chú thích màu chữ thường, dễ đọc. -->
      <div class="qi-hall__preview-card">
        <p v-if="enhancePreviewRows && selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel" class="qi-hall__col-title">
          {{ t('panels.equipmentHall.labels.levelPrefix') }} +{{ selectedEnhanceRow.enhanceLevel }}/{{ selectedEnhanceRow.maxLevel }}
          {{ t('panels.equipmentHall.labels.levelArrow') }} +{{ selectedEnhanceRow.enhanceLevel + 1 }}/{{ selectedEnhanceRow.maxLevel }}
        </p>

        <table
          v-if="enhancePreviewRows && selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel"
          class="qi-hall__compare-table"
          :aria-label="t('panels.equipmentHall.aria.enhanceComparison')"
        >
          <thead>
            <tr>
              <th scope="col">{{ t('panels.equipmentHall.table.header.stat') }}</th>
              <th scope="col">{{ t('panels.equipmentHall.table.header.before') }}</th>
              <th scope="col" aria-hidden="true"></th>
              <th scope="col">{{ t('panels.equipmentHall.table.header.after') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="statRow in enhancePreviewRows" :key="statRow.key">
              <th scope="row">{{ statRow.label }}</th>
              <td>{{ formatAffixValue(statRow.stat, statRow.currentValue) }}</td>
              <td class="qi-hall__compare-arrow" aria-hidden="true">⇒</td>
              <td>
                {{ formatAffixValue(statRow.stat, statRow.nextValue) }}
                <span class="qi-hall__up-arrow">▲ +{{ formatStat('affixDeltaPercent', statRow.percent) }}</span>
              </td>
            </tr>
          </tbody>
        </table>

        <p v-else class="qi-hall__empty">
          {{ enhancePreviewRows ? t('panels.equipmentHall.empty.maxLevel') : t('panels.equipmentHall.empty.noStats') }}
        </p>
      </div>

      <ul v-if="selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel" class="qi-hall__info-row enhance-row__costs">
        <li
          v-for="cost in selectedEnhanceRow.costs"
          :key="cost.materialId"
          :class="{ 'is-missing': cost.owned < cost.amount }"
        >
          {{ cost.label }}: {{ cost.owned }}/{{ cost.amount }}
        </li>
        <li :class="{ 'is-missing': selectedEnhanceRow.spiritStoneOwned < selectedEnhanceRow.spiritStone }">
          {{ materialLabel(selectedEnhanceRow.spiritStoneMaterialId, gameManager.materialRegistry) }}:
          {{ selectedEnhanceRow.spiritStoneOwned }}/{{ selectedEnhanceRow.spiritStone }}
        </li>
      </ul>

      <div class="qi-hall__button-row">
        <GameButton
          v-if="selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel"
          size="lg"
          :disabled="!canEnhance(selectedEnhanceRow)"
          @click="doEnhance(selectedEnhanceRow)"
        >
          {{ t('panels.equipmentHall.buttons.enhance') }}
        </GameButton>
      </div>
    </div>
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

/* Card bọc bảng so sánh — DÙNG CHUNG Cường Hóa/Tẩy/Tinh Luyện (2026-08-30
   spec). flex:1 để chiếm hết khoảng trống còn lại giữa header và info-row/
   button-row, justify-content:center để bảng không dính sát lên trên
   khi ít dòng (tránh trống dưới). */
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

.qi-hall__up-arrow {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--jade) 16%, transparent);
  color: var(--jade);
  font-weight: 700;
  font-size: var(--text-sm);
}

.qi-hall__empty {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--paper-line);
  color: var(--paper-text-soft);
  font-size: var(--text-sm);
  text-align: center;
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

.enhance-row__costs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.enhance-row__costs li.is-missing {
  color: var(--crimson);
}

/* Cụm nút hành động LUÔN Ở CUỐI, CĂN PHẢI (2026-08-30 spec) — dùng chung
   cho Cường Hóa/Tẩy/Tinh Luyện. */
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
