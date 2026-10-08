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
import { EQUIPMENT_SLOTS } from '@/core/equipment/EquipmentSlotState'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import EquipmentArtSlot from '@/components/common/art/EquipmentArtSlot.vue'
import { equipmentArt } from '@/components/common/art/equipmentArt'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
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

// Stat glyph map - cung bo voi SUMMARY_STATS trong EquipmentSurface
// (preview dung ♥⚔◈☯✧➶).
const STAT_GLYPHS: Partial<Record<keyof Stats, string>> = {
  maxHp: '\u2665',
  might: '\u2694',
  defense: '\u25C8',
  maxMp: '\u262F',
  criticalRate: '\u2727',
  speed: '\u27B6',
}

function statGlyph(stat: keyof Stats | undefined): string {
  return (stat && STAT_GLYPHS[stat]) || '\u2726'
}

// Material khong co icon rieng (essence/spirit_stone) -> icon theo
// category tu controls art (giong preview: essence/crystal).
const MATERIAL_CATEGORY_ART: Record<string, string> = {
  essence: '/assets/ui/tien-hiep-2026-10/controls/resource-essence-v1.png',
  spirit_stone: '/assets/ui/tien-hiep-2026-10/controls/resource-crystal-v1.png',
}

function materialIcon(materialId: string): string | undefined {
  const material = gameManager.materialRegistry.get(materialId)
  const art = material?.icon ?? (material?.category ? MATERIAL_CATEGORY_ART[material.category] : undefined)
  return art ? resolveAssetUrl(art) : undefined
}

const levelSealSrc = equipmentArt('equipment-level-seal-v1')

const circleFrameSrc = equipmentArt('equipment-circle-frame-v1')

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
  <!-- Reskin theo Codex EquipmentForgePreview (tab 'enhance'): lech
       da ghi nhan = hang chon slot o dau card (preview chon dich qua
       socket doll; live can picker vi Cuong Hoa gan SLOT). -->
  <div class="equipment-forge-workspace forge-enhance">
    <h2>{{ t('panels.equipmentHall.tabs.enhance') }}</h2>

    <div class="enhance-slot-strip" :aria-label="t('panels.equipmentHall.aria.enhanceSlots')">
      <button
        v-for="row in enhanceRows"
        :key="row.slot"
        type="button"
        class="enhance-slot"
        :class="{ selected: row.slot === selectedEnhanceSlot, 'enhance-slot--empty': !row.equippedRow, 'enhance-slot--filled': row.equippedRow }"
        :aria-pressed="row.slot === selectedEnhanceSlot"
        :aria-label="equipmentSlotLabel(row.slot)"
        :title="row.equippedRow?.name ?? equipmentSlotLabel(row.slot)"
        @click="selectEnhanceSlot(row.slot)"
      >
        <img class="enhance-slot__frame" :src="circleFrameSrc" alt="" aria-hidden="true" />
        <img v-if="row.equippedRow?.icon" class="enhance-slot__icon" :src="row.equippedRow.icon" alt="" aria-hidden="true" />
        <b class="enhance-slot__level">+{{ row.enhanceLevel }}</b>
      </button>
    </div>

    <template v-if="selectedEnhanceRow">
      <div class="equipment-enhancement-levels">
        <span class="equipment-level-seal"
          ><img :src="levelSealSrc" alt="" /><b>+{{ selectedEnhanceRow.enhanceLevel }}</b></span
        ><template v-if="selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel"
          ><span class="equipment-level-arrow" aria-hidden="true">»</span
          ><span class="equipment-level-seal"
            ><img :src="levelSealSrc" alt="" /><b>+{{ selectedEnhanceRow.enhanceLevel + 1 }}</b></span
          ></template
        >
      </div>

      <h3 class="equipment-forge-divider">{{ t('panels.equipmentHall.forge.afterEnhance') }}</h3>

      <div
        v-if="enhancePreviewRows && selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel"
        class="equipment-enhancement-table"
        :aria-label="t('panels.equipmentHall.aria.enhanceComparison')"
      >
        <div class="equipment-table-head">
          <span>{{ t('panels.equipmentHall.forge.current') }} (+{{ selectedEnhanceRow.enhanceLevel }})</span
          ><span>{{ t('panels.equipmentHall.forge.result') }} (+{{ selectedEnhanceRow.enhanceLevel + 1 }})</span>
        </div>
        <div v-for="statRow in enhancePreviewRows" :key="statRow.key" class="equipment-enhance-stat">
          <span class="equipment-stat-name"
            ><i aria-hidden="true">{{ statGlyph(statRow.stat) }}</i
            >{{ statRow.label }}</span
          ><b>{{ formatAffixValue(statRow.stat, statRow.currentValue) }}</b
          ><span class="equipment-stat-arrow" aria-hidden="true">»</span
          ><strong
            >{{ formatAffixValue(statRow.stat, statRow.nextValue) }}
            <em class="equipment-stat-delta">+{{ formatStat('affixDeltaPercent', statRow.percent) }}</em></strong
          >
        </div>
      </div>
      <p v-else class="enhance-empty">
        {{ enhancePreviewRows ? t('panels.equipmentHall.empty.maxLevel') : t('panels.equipmentHall.empty.noStats') }}
      </p>

      <template v-if="selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel">
        <h3 class="equipment-forge-divider material-divider">{{ t('panels.equipmentHall.forge.materials') }}</h3>
        <div class="equipment-forge-materials">
          <div
            v-for="cost in selectedEnhanceRow.costs"
            :key="cost.materialId"
            class="equipment-material"
            :class="{ 'is-missing': cost.owned < cost.amount }"
          >
            <div class="equipment-material-icon">
              <EquipmentArtSlot :icon="materialIcon(cost.materialId)" :label="cost.label" empty />
            </div>
            <div>
              <span>{{ cost.label }}</span
              ><b>{{ cost.owned }}/{{ cost.amount }}</b>
            </div>
          </div>
          <div
            class="equipment-material"
            :class="{ 'is-missing': selectedEnhanceRow.spiritStoneOwned < selectedEnhanceRow.spiritStone }"
          >
            <div class="equipment-material-icon">
              <EquipmentArtSlot
                :icon="materialIcon(selectedEnhanceRow.spiritStoneMaterialId)"
                :label="materialLabel(selectedEnhanceRow.spiritStoneMaterialId, gameManager.materialRegistry)"
                empty
              />
            </div>
            <div>
              <span>{{ materialLabel(selectedEnhanceRow.spiritStoneMaterialId, gameManager.materialRegistry) }}</span
              ><b>{{ selectedEnhanceRow.spiritStoneOwned }}/{{ selectedEnhanceRow.spiritStone }}</b>
            </div>
          </div>
        </div>
        <div class="equipment-forge-actions">
          <EquipmentArtButton
            gold
            :disabled="!canEnhance(selectedEnhanceRow)"
            @click="doEnhance(selectedEnhanceRow)"
            >{{ t('panels.equipmentHall.buttons.enhance') }}</EquipmentArtButton
          >
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
/* Forge layout copied verbatim from the approved preview
   (ui-preview/equipment/EquipmentForgePreview.vue, 'enhance' branch). */
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
.equipment-enhancement-levels {
  position: relative;
  display: flex;
  justify-content: center;
  gap: 120px;
  height: 76px;
  flex: none;
}
.equipment-level-seal {
  position: relative;
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
}
.equipment-level-seal img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.equipment-level-seal b {
  position: relative;
  z-index: 1;
  font-size: 30px;
  line-height: 1;
  color: #e8cb80;
}
.equipment-level-arrow {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: #dfb365;
  font-size: 40px;
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
.equipment-enhancement-table {
  border: 1px solid #92744280;
  padding: 3px 10px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.equipment-table-head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  border-bottom: 1px solid #987b4850;
  padding: 3px 0 6px;
}
.equipment-enhance-stat {
  display: grid;
  grid-template-columns: 1.4fr 0.8fr 22px 0.85fr;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-height: 0;
  font-size: 13px;
  border-bottom: 1px solid #96764440;
}
.equipment-enhance-stat:last-child {
  border: 0;
}
.equipment-stat-name {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.equipment-stat-name i {
  font: 20px/1 serif;
  font-style: normal;
  color: #ecdab5;
}
.equipment-enhance-stat b {
  font-weight: 400;
}
.equipment-enhance-stat strong {
  color: #e6ca7d;
  text-align: right;
  font-weight: 500;
}
.equipment-stat-delta {
  font-style: normal;
  font-size: 11px;
  color: #93cfa0;
}
.equipment-stat-arrow {
  color: #c7a15e;
}
.equipment-forge-materials {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
  flex: none;
  min-height: 53px;
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
.equipment-material > div:last-child {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
.equipment-forge-actions > button {
  min-width: 220px;
  min-height: 42px;
  font-size: 23px;
  padding: 7px 25px;
}
.enhance-empty {
  flex: 1;
  display: grid;
  place-items: center;
  margin: 0;
  font-size: 14px;
  color: #c1b18d;
}

/* Hang chon slot - live-only (preview chon dich qua socket doll tren
   cot trai; EnhanceTab gan SLOT nen can picker ro rang trong card). */
.enhance-slot-strip {
  display: flex;
  justify-content: center;
  gap: 14px;
  flex: none;
  height: 52px;
}
.enhance-slot {
  position: relative;
  width: 52px;
  height: 52px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.enhance-slot__frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
.enhance-slot__icon {
  position: absolute;
  inset: 14%;
  width: 72%;
  height: 72%;
  object-fit: contain;
}
.enhance-slot__level {
  position: absolute;
  right: -4px;
  bottom: -2px;
  font-size: 11px;
  line-height: 1;
  color: #e8cb80;
  text-shadow: 0 1px 2px #000;
}
.enhance-slot.selected .enhance-slot__frame {
  filter: brightness(1.35) drop-shadow(0 0 5px #d9a94f88);
}
.enhance-slot:not(.selected):hover .enhance-slot__frame {
  filter: brightness(1.18);
}
</style>
