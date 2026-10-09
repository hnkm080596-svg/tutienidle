<script setup lang="ts">
// Task 19 (item-grade-quality-rework, rework P6) - Tab Cuong Hoa
// extracted from EquipmentHallPanel.vue shell. Cuong Hoa gan SLOT (not
// selectedInstanceId) - noi can bo song theo shared hall selection: doll
// click (instanceId) -> resolve SLOT de cung cap cho enhance (owner
// ruling 2026-10-08: 'đồ sẽ chọn trực tiếp từ cái doll').
import { computed, inject, ref, watch } from 'vue'
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
import SlotView from '@/components/common/SlotView.vue'
import { equipmentArt } from '@/components/common/art/equipmentArt'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import {
  calculateEquipmentScale,
} from '@/core/equipment/EquipmentSystem'
import { MAX_SLOT_ENHANCE_LEVEL } from '@/core/equipment/EnhanceCurve'
import { useEquippedRows } from './useEquippedRows'
import { formatAffixValue } from './equipmentHallDisplay'
import { HALL_SELECTION_KEY } from './hallSelection'

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

// Item pick happens on the paperdoll directly (owner ruling 2026-10-08:
// 'đồ sẽ chọn trực tiếp từ cái doll') - the shared hall selection
// carries the clicked instance; Enhance still resolves to its SLOT.
// Optional inject: the preview mounts this tab without the provider.
const hallSelection = inject(HALL_SELECTION_KEY, null)

watch(
  () => hallSelection?.selectedInstanceId.value,
  (instanceId) => {
    if (!instanceId) return
    const row = equippedRows.value.find((candidate) => candidate.instanceId === instanceId)
    if (row) selectedEnhanceSlot.value = row.slot
  },
)

function canEnhance(row: EnhanceSlotRow): boolean {
  return (
    row.enhanceLevel < row.maxLevel &&
    row.costs.every((cost) => cost.owned >= cost.amount) &&
    row.spiritStoneOwned >= row.spiritStone
  )
}

// Success/fail burst on the projection cell (owner ask 2026-10-08):
// `enhance()` returns ok synchronously - with canEnhance already true,
// a false here is the failed roll (materials lost). The class re-add
// restarts the CSS animation on every click.
const slotBurst = ref<'' | 'burst-success' | 'burst-fail'>('')

let burstTimer: ReturnType<typeof setTimeout> | undefined

function doEnhance(row: EnhanceSlotRow) {
  if (!canEnhance(row)) return

  const ok = enhance(row.slot)

  slotBurst.value = ''

  requestAnimationFrame(() => {
    slotBurst.value = ok ? 'burst-success' : 'burst-fail'
  })

  clearTimeout(burstTimer)

  burstTimer = setTimeout(() => {
    slotBurst.value = ''
  }, 950)
}

// Stat glyph map - same set as SUMMARY_STATS in EquipmentSurface.
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
  // Guard the registry: .get() throws on unknown ids - a missing
  // material must degrade to no icon, not crash the tab (same .has()
  // pattern as the cost-name computeds).
  const material = gameManager.materialRegistry.has(materialId)
    ? gameManager.materialRegistry.get(materialId)
    : undefined
  const art = material?.icon ?? (material?.category ? MATERIAL_CATEGORY_ART[material.category] : undefined)
  return art ? resolveAssetUrl(art) : undefined
}

const levelSealSrc = equipmentArt('equipment-level-seal-v1')

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
 * khi co mainStat, khong can preview/giu/bo nhu Tay/Tinh Luyen. Owner
 * ruling 2026-10-08: Cuong Hoa scale CHI mainStat - stat phu (affix)
 * thuoc he Tinh Luyen, nen preview chi con DUNG 1 dong mainStat.
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

  return rows
})

// Main stat name under the projection cell (owner ruling 2026-10-08) -
// the first preview row IS the item's mainStat.
const mainStatLabel = computed(() => enhancePreviewRows.value?.[0]?.label ?? '')
</script>

<template>
  <!-- Reskin theo Codex EquipmentForgePreview (tab 'enhance'): lech
       da ghi nhan = hang chon slot o dau card (preview chon dich qua
       socket doll; live can picker vi Cuong Hoa gan SLOT). -->
  <div class="equipment-forge-workspace forge-enhance">
    <h2>{{ t('panels.equipmentHall.tabs.enhance') }}</h2>

    <!-- Compare grid (owner ruling 2026-10-08): LEFT = ONE socket-frame
         cell in the doll's chrome + the main stat name beneath it
         (picking an item on the doll shows it here); MIDDLE = current
         level seal + current stats; arrow; RIGHT = next level seal +
         next stats. Materials + the enhance button stay at the bottom. -->
    <div v-if="selectedEnhanceRow" class="enhance-compare" :aria-label="t('panels.equipmentHall.aria.enhanceComparison')">
      <div class="enhance-slot-single" :class="slotBurst" :aria-label="t('panels.equipmentHall.aria.enhanceSlots')">
        <!-- Projection cell (owner ruling 2026-10-08): socket frame +
             the SLOT NAME, not the item art - the cell answers "which
             slot is selected", not "what does it hold". Per-slot art
             replaces the text once Minh draws it. -->
        <SlotView
          class="enhance-slot__view"
          variant="socket"
          static
          :item="null"
          :label="equipmentSlotLabel(selectedEnhanceRow.slot)"
        />
        <span class="enhance-slot__name">{{ equipmentSlotLabel(selectedEnhanceRow.slot) }}</span>
      </div>
      <span class="equipment-level-seal enhance-compare__seal"
        ><img :src="levelSealSrc" alt="" /><b>+{{ selectedEnhanceRow.enhanceLevel }}</b></span
      >

      <template v-if="selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel">
        <span class="equipment-level-arrow" aria-hidden="true">»</span>
        <span class="equipment-level-seal enhance-compare__seal enhance-compare__seal--next"
          ><img :src="levelSealSrc" alt="" /><b>+{{ selectedEnhanceRow.enhanceLevel + 1 }}</b></span
        >
      </template>

      <!-- Stat cluster (owner ruling 2026-10-08): name + before values +
           stat arrow + after values toggle as ONE group - an empty slot
           has no item, hence no stats, hence no arrows. Grid areas are
           class-placed so DOM order does not matter. -->
      <template v-if="enhancePreviewRows">
        <div class="enhance-compare__mainstat">{{ mainStatLabel }}</div>
        <ul class="enhance-compare__stats">
          <li v-for="statRow in enhancePreviewRows" :key="statRow.key" class="enhance-compare__row">
            <b class="enhance-compare__value">{{ formatAffixValue(statRow.stat, statRow.currentValue) }}</b>
          </li>
        </ul>
        <template v-if="selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel">
          <span class="equipment-level-arrow equipment-level-arrow--stat" aria-hidden="true">»</span>
          <ul class="enhance-compare__stats enhance-compare__stats--next">
            <li v-for="statRow in enhancePreviewRows" :key="statRow.key" class="enhance-compare__row">
              <b class="enhance-compare__value"
                >{{ formatAffixValue(statRow.stat, statRow.nextValue)
                }}<em class="enhance-compare__delta"> +{{ formatStat('affixDeltaPercent', statRow.percent) }}</em></b
              >
            </li>
          </ul>
        </template>
      </template>
    </div>
    <p
      v-if="selectedEnhanceRow && (!enhancePreviewRows || selectedEnhanceRow.enhanceLevel >= selectedEnhanceRow.maxLevel)"
      class="enhance-empty"
    >
      {{ enhancePreviewRows ? t('panels.equipmentHall.empty.maxLevel') : t('panels.equipmentHall.empty.noStats') }}
    </p>

    <template v-if="selectedEnhanceRow">
      <template v-if="selectedEnhanceRow.enhanceLevel < selectedEnhanceRow.maxLevel">
        <div class="equipment-forge-materials">
          <div
            v-for="cost in selectedEnhanceRow.costs"
            :key="cost.materialId"
            class="equipment-material"
            :class="{ 'is-missing': cost.owned < cost.amount }"
          >
            <div class="equipment-material-icon">
              <SlotView variant="equipment" static :item="null" :icon="materialIcon(cost.materialId)" :label="cost.label" />
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
              <SlotView
                variant="equipment"
                static
                :item="null"
                :icon="materialIcon(selectedEnhanceRow.spiritStoneMaterialId)"
                :label="materialLabel(selectedEnhanceRow.spiritStoneMaterialId, gameManager.materialRegistry)"
              />
            </div>
            <div>
              <span>{{ materialLabel(selectedEnhanceRow.spiritStoneMaterialId, gameManager.materialRegistry) }}</span
              ><b>{{ selectedEnhanceRow.spiritStoneOwned }}/{{ selectedEnhanceRow.spiritStone }}</b>
            </div>
          </div>
        </div>
        <div class="equipment-forge-actions">
          <!-- Button states (owner ruling 2026-10-08): the same
               equipment-filter-* art the bag card dropdown uses -
               normal dark pill when not ready, gold 'selected' art when
               canEnhance, plus the shared hover/pressed/disabled art. -->
          <EquipmentArtButton
            filter-art
            :gold="canEnhance(selectedEnhanceRow)"
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
/* Pinned bottom block (owner ruling 2026-10-08): the actions band
   anchors to the card's bottom edge and the materials row rides on
   top of it, so both read as one block while the title stays at the
   top. They are absolutely positioned with .equipment-workspace (a
   positioned ancestor OUTSIDE the scrollable) as containing block,
   so no scrollbar appears. The padding below reserves their height
   so flowing content never collides with them. */
.forge-enhance {
  padding-bottom: 185px;
}
.forge-enhance .equipment-forge-materials {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 85px;
}
.forge-enhance .equipment-forge-actions {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: -2px;
}
.equipment-forge-workspace h2 {
  font-size: 26px;
  margin: 0;
  border-bottom: 1px solid #9b7d4066;
  padding-bottom: 7px;
  line-height: 1.15;
}
/* Compare grid (owner ruling 2026-10-08): 3 columns - item / current /
   > / next - on 2 rows (level seals on row 1, stat lists on row 2) so
   the arrow aligns with the seals' centers exactly. */
.enhance-compare {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) auto minmax(0, 1.2fr);
  grid-template-rows: auto auto;
  gap: 0 14px;
  flex: 1;
  min-height: 0;
  padding: 0;
  align-content: space-between;
  margin-top: 6px;
}
/* The projection cell sits on row 1 so its vertical center aligns
   with the two level seals; the main stat name lands on row 2, level
   with the stat values (owner ruling 2026-10-08). */
.enhance-compare > .enhance-slot-single {
  grid-column: 1;
  grid-row: 1;
  justify-self: center;
  align-self: center;
}
/* Main stat name under the slot shares the stat-number size so the row
   reads level across all four columns (owner ruling 2026-10-08). */
.enhance-compare > .enhance-compare__mainstat {
  grid-column: 1;
  grid-row: 2;
  justify-self: center;
  align-self: start;
  font-size: 28px;
  font-weight: 600;
  color: #e8c98a;
  text-align: center;
  padding: 5px 2px;
  border-bottom: 1px solid #96764440;
}
.enhance-compare > .enhance-compare__seal {
  grid-column: 2;
  grid-row: 1;
  justify-self: center;
  align-self: center;
}
.enhance-compare > .enhance-compare__seal--next {
  grid-column: 4;
}
.enhance-compare > .enhance-compare__stats {
  grid-column: 2;
  grid-row: 2;
  justify-self: center;
}
.enhance-compare > .enhance-compare__stats--next {
  grid-column: 4;
}
/* Stat rows reuse the equipment summary card font pattern
   (EquipmentSurface .equipment-summary__*): soft name left, gold
   tabular value right, hairline row separators. */
.enhance-compare__stats {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  max-width: 240px;
}
.enhance-compare__row {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 8px;
  padding: 5px 2px;
  border-bottom: 1px solid #96764440;
  font-size: 28px;
}
.enhance-compare__row:last-child {
  border-bottom: 0;
}
.enhance-compare__value {
  position: relative;
  font-weight: 600;
  color: #ebce84;
  font-variant-numeric: tabular-nums;
}
/* The +x.x% gain hangs off the number's right edge instead of sharing
   the line, so current/next values stay the same size and each sits
   dead-center in its own column (owner ruling 2026-10-08). */
.enhance-compare__delta {
  position: absolute;
  left: calc(100% + 6px);
  bottom: 6px;
  font-style: normal;
  font-size: 16px;
  color: #93cfa0;
  white-space: nowrap;
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
  grid-column: 3;
  grid-row: 1;
  align-self: center;
  justify-self: center;
  color: #dfb365;
  font-size: 40px;
  line-height: 1;
}
/* Second arrow on the stats row, level with the stat values. */
.equipment-level-arrow--stat {
  grid-row: 2;
  align-self: start;
  margin-top: 4px;
  font-size: 32px;
}
/* Materials row: stretch so both material cells are equally tall;
   combined with the text column's space-between the owned/amount counts
   land on exactly the same baseline (owner ruling 2026-10-08). */
.equipment-forge-materials {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 28px;
  flex: none;
  min-height: 80px;
}
.equipment-material {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
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
/* Material label column bounded (~150px) and stretched to the row's
   height with space-between so the owned/amount counts sit on the same
   baseline across materials regardless of name length (owner ruling
   2026-10-08). */
.equipment-material > div:last-child {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 4px;
  align-self: stretch;
  font-size: 18px;
  line-height: 1.15;
  max-width: 150px;
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
/* Enhance submit: the bag-card dropdown frame at compare-text scale
   (owner ruling 2026-10-08) - 'filter-art' keeps the 1225/324 pill
   ratio so the frame grows with the text instead of a fixed rect. */
.equipment-forge-actions > button {
  width: 300px;
  font-size: 24px;
}
.enhance-empty {
  flex: 1;
  display: grid;
  place-items: center;
  margin: 0;
  font-size: 14px;
  color: #c1b18d;
}

/* Single slot projection (owner ruling 2026-10-08): ONE cell in the
   same 'socket' frame the doll wears, 1.5x the doll cell size,
   centered in the card. Display only; selection lives on the doll. */
.enhance-slot-single {
  position: relative;
  width: 111px;
  height: 111px;
  flex: none;
}
.enhance-slot__view {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.enhance-slot__name {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  color: #d8c9a3;
  text-shadow: 0 1px 3px rgb(0 0 0 / 80%);
  text-align: center;
  padding: 10px;
  pointer-events: none;
}

/* Enhance roll bursts (owner ask 2026-10-08): success = expanding gold
   ring + bright flash over the cell; fail = red ember puff + shake.
   ::after is free on .enhance-slot-single (the frame art lives inside
   SlotView), pointer-events none so the doll click-through stays. */
.enhance-slot-single.burst-success::after {
  content: '';
  position: absolute;
  inset: -14px;
  border-radius: 16px;
  border: 3px solid #ffd97a;
  box-shadow:
    0 0 26px 6px rgb(255 214 122 / 45%),
    inset 0 0 22px rgb(255 214 122 / 55%);
  animation: enhance-burst-ring 0.9s ease-out forwards;
  pointer-events: none;
}
.enhance-slot-single.burst-success .enhance-slot__view {
  animation: enhance-flash 0.55s ease-out;
}
@keyframes enhance-burst-ring {
  0% {
    transform: scale(0.55);
    opacity: 0.95;
  }
  55% {
    transform: scale(1.12);
    opacity: 0.75;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}
@keyframes enhance-flash {
  0% {
    filter: brightness(2.3);
  }
  100% {
    filter: none;
  }
}
.enhance-slot-single.burst-fail {
  animation: enhance-shake 0.45s ease-in-out;
}
.enhance-slot-single.burst-fail::after {
  content: '';
  position: absolute;
  inset: -12px;
  border-radius: 14px;
  background: radial-gradient(closest-side, rgb(255 84 56 / 55%), transparent 72%);
  animation: enhance-fail-puff 0.6s ease-out forwards;
  pointer-events: none;
}
@keyframes enhance-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-4px);
  }
  40% {
    transform: translateX(4px);
  }
  60% {
    transform: translateX(-3px);
  }
  80% {
    transform: translateX(2px);
  }
}
@keyframes enhance-fail-puff {
  0% {
    transform: scale(0.7);
    opacity: 1;
  }
  100% {
    transform: scale(1.35);
    opacity: 0;
  }
}
</style>
