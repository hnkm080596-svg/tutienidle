<script setup lang="ts">
// Task 19 (item-grade-quality-rework, rework P6) - Tab Cuong Hoa
// extracted from EquipmentHallPanel.vue shell. Cuong Hoa gan SLOT (not
// selectedInstanceId) - hoan toan tu chua, KHONG can inject shared
// selection (chi Wash/Refine moi dung selectedInstanceId/selectEquipped).
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

const { t } = useI18n()

const player = usePlayerStore()

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

const { enhance } = useEquipmentActions()

const { equippedRows } = useEquippedRows()

// =========================
// Tab Cuong Hoa
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

// perf-optimize-pass Task 5 - `stateVersion.value` doc vo dieu kien o
// day KHONG can cong visibility rieng: EnhanceTab chi TON TAI khi tab
// dang hien. Chuoi v-if (khong co <KeepAlive> nao trong app):
//   FunctionOverlayPanel `v-if="mode"` (ben trong OverlayPanel
//   `v-if="open"`) -> EquipmentHallPanel `v-if="activeTab === 'enhance'"`.
// Doi tab hoac dong panel la unmount han component, effect scope cua
// computed bi stop nen no khong recompute theo tick nua. Khi tab DANG
// hien thi recompute moi tick la DUNG YEU CAU (cot "so huu" nguyen
// lieu/linh thach phai chay theo thoi gian that). Them co visibility
// cuc bo o day chi la code chet - xem task-5-report.md.
const enhanceRows = computed<EnhanceSlotRow[]>(() => {
  stateVersion.value

  // Slot-level rework (yeu cau 2026-08-26): Cuong Hoa gan SLOT -
  // slot TRONG van hien tran/cost va nang duoc; realmId lay theo nguoi
  // choi hien hanh de resolve catalog nghe.
  const realmId = player.$state.realmId

  const equippedRowBySlot = new Map(equippedRows.value.map((row) => [row.slot, row]))

  return gameManager.equipmentOps.getAllSlotStates().map((slotState) => {
    const equipped = gameManager.equipmentBag.getEquippedInSlot(slotState.slot)

    const costs = gameManager.equipmentOps.getEnhanceCost(slotState.slot, realmId).map((entry) => ({
      materialId: entry.materialId,

      label: materialLabel(entry.materialId, gameManager.materialRegistry),

      amount: entry.amount,

      owned: gameManager.materialBag.getAmount(entry.materialId),
    }))

    const spiritStone = gameManager.equipmentOps.getEnhanceSpiritStoneCost(slotState.slot, realmId)
    const spiritStoneMaterialId = getSpiritStoneMaterialIdForEnhanceLevel(slotState.enhanceLevel)

    const maxLevel = MAX_SLOT_ENHANCE_LEVEL

    return {
      slot: slotState.slot,

      itemName: equipped
        ? gameManager.equipmentOps.getEquipmentTemplate(equipped.itemId)?.name ?? equipped.itemId
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

  // Stat key de formatStat chon do chinh xac theo loai stat - so thap
  // phan nho (attackSpeed 0.01-0.02) khong bi toFixed(1) thanh "0.0"
  // (bug report 2026-08-30).
  stat: keyof Stats | undefined

  currentValue: number

  nextValue: number

  // Percent growth as stat-ratio (0-1), not display-percent (0-100) -
  // stored as ratio so formatStat('affixDeltaPercent', ...) applies
  // the x100.toFixed(1)% logic automatically.
  percent: number
}

/**
 * Xem truoc "sau Cuong Hoa" - xac dinh (khong random), luon tinh duoc ngay
 * khi co mainStat, khong can preview/giu/bo nhu Tay/Tinh Luyen. Danh sach
 * dong khop CHINH XAC nhung gi EquipmentSystem.applyModifiers() that su
 * scale theo enhanceLevel (2026-08-30 bug report: cot "Sau Cuong Hoa" cu
 * chi tinh mainStat, bo sot toan bo affix phu nen 2 cot khong khop dong) -
 * dong dau LUON la mainStat, sau do tung affix theo DUNG thu tu
 * instance.affixes de 2 cot "Hien tai"/"Sau" render cung danh sach, khop
 * 1-1 theo index thay vi 2 mang khac nguon.
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
      // `x100.toFixed(1)%` percent formatting.
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
          :accessible-label="row.equippedRow?.accessibleLabel"
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
      <!-- Dung THANG <table> giong Tay/Tinh Luyen thay vi 2 cot flex doc
           lap (2026-08-30 bug report: "khong ngang hang voi nhau" - 2
           cot flex co gian rieng nen dong chinh/dong phu lech nhau khi
           so dong hoac do dai noi dung khac nhau; <tr> dam bao khop
           hang-voi-hang that su). Bo han dong tieu de "Slot * Ten mon"
           cu (2026-08-30, bug report thu 2: dong do tao lech - thong
           tin nay da co san qua o dang chon o luoi ben trai, khong can
           lap lai). Header bang dung "Truoc/Sau" y het Tay/Tinh Luyen
           thay vi hien so cap tho mau eyebrow kho doc - cap doi doi
           xuong 1 dong chu thich mau chu thuong, de doc. -->
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
/* Shared .qi-hall__* layout lives in ./qi-hall.css (one owner - see the
   sheet header for the specificity-war rationale). Only Enhance-private
   classes stay scoped here. */
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
</style>
