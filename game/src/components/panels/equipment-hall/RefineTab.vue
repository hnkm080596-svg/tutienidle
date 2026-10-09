<script setup lang="ts">
// Task 19 (item-grade-quality-rework, rework P6) - Tab Tinh Luyen
// extracted from EquipmentHallPanel.vue shell. Preview state
// (pendingRefineValues, lockedIndices) is now LOCAL - v-if unmount on
// tab switch resets it automatically (matching old switchTab()'s manual
// clearPendingRefinePreview() call); onBeforeUnmount still discards the
// paid-for core preview so an overlay remount can't reuse a stale payload.
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useEquipmentActions } from '@/composables/useEquipmentActions'
import { LUYEN_KHI_TINH_HOA_ID } from '@/core/equipment/TinhHoaMaterial'
import { SPIRIT_STONE_LABEL } from '@/core/presentation/labels'
import { useActionFeedbackStore } from '@/stores/actionFeedback'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import SlotView from '@/components/common/SlotView.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { RefineValueEntry } from '@/core/equipment/EquipmentSystem'
import { getEffectiveAffixValue } from '@/core/equipment/EquipmentSystem'
import { useEquippedRows, useItemRenState } from './useEquippedRows'
import { affixDisplayLabel, formatAffixValue, tierClass } from './equipmentHallDisplay'
import { HALL_SELECTION_KEY } from './hallSelection'

const { t } = useI18n()

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

const { refinePreview, refineCommit, refineDiscard } = useEquipmentActions()

const feedback = useActionFeedbackStore()

const hallSelection = inject(HALL_SELECTION_KEY)

if (!hallSelection) {
  throw new Error('RefineTab phải được render trong cây con đã provide HALL_SELECTION_KEY')
}

const { selectedInstanceId } = hallSelection

const { equippedRows } = useEquippedRows()

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

// Item pick happens on the paperdoll (owner ruling 2026-10-08: same as
// Enhance). Switching selection discards the armed preview + resets
// locks - the old slot strip did both on click; keep that semantics.
watch(selectedInstanceId, () => {
  clearPendingRefinePreview()
  lockedIndices.value = []
})

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

      // Stat key de formatStat chon do chinh xac dung loai stat (bug
      // 2026-08-30: toFixed(1) ep attackSpeed 0.015 thanh "0.0").
      stat: affix?.stat,
    }
  })
})

function toggleLock(index: number) {
  const position = lockedIndices.value.indexOf(index)

  if (position >= 0) {
    lockedIndices.value.splice(position, 1)
  } else if (lockedIndices.value.length < 3) {
    // Khong cho khoa toan bo: toi da N-1 (va <=3).
    if (lockedIndices.value.length + 1 < selectedAffixes.value.length) {
      lockedIndices.value.push(index)
    }
  }

  clearPendingRefinePreview()
}

const refineCost = computed(() => {
  stateVersion.value

  return gameManager.equipmentOps.getRefineCost(
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

  // commit attempt luon tieu capability core, nen local preview cung phai bien
  // mat ke ca commit bi tu choi do state vua thay doi.
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

/** Each affix row: label + current value on the left, refine result on
 *  the right (kept / pending value / not-rolled-yet), lock toggle on
 *  the row's left edge. */
const refineRows = computed(() => {
  if (!selectedInstanceId.value) {
    return [] as const
  }

  const instance = gameManager.equipmentBag.get(selectedInstanceId.value)

  if (!instance) {
    return [] as const
  }

  return instance.affixes.map((rolled, index) => {
    const affix = gameManager.affixRegistry.has(rolled.affixId)
      ? gameManager.affixRegistry.get(rolled.affixId)
      : undefined

    const current = affix ? getEffectiveAffixValue(rolled, affix) : rolled.value
    const locked = lockedIndices.value.includes(index)
    const pending = pendingRefineByIndex.value.get(index)

    // Tier min/max band (owner ruling 2026-10-08: the bar under each
    // row shows where the value sits inside its tier range). Registry
    // miss or a tier the affix no longer lists -> no bar, row still
    // renders (same degrade rule as tooltips).
    const tierDef = affix?.tiers.find((def) => def.tier === rolled.tier)
    const range = tierDef && tierDef.max > tierDef.min
      ? { min: tierDef.min, max: tierDef.max }
      : null

    return {
      index,
      label: affixDisplayLabel(rolled, gameManager.affixRegistry),
      tier: rolled.tier,
      stat: affix?.stat,
      current,
      locked,
      pending,
      range,
    }
  })
})

function rangePct(value: number, range: { min: number; max: number }): number {
  const pct = ((value - range.min) / (range.max - range.min)) * 100
  return Math.min(100, Math.max(0, pct))
}

/** Fixed 5-slot card (owner ruling 2026-10-08, same as Tẩy Luyện):
 *  an item can roll at most 5 affix lines (Tiên). The card always
 *  renders all 5 slots so rows stay evenly spaced. */
const refineSlots = computed(() => {
  const rows = refineRows.value
  return [0, 1, 2, 3, 4].map((index) => rows[index] ?? null)
})

const refineMaterials = computed(() => [
  {
    id: LUYEN_KHI_TINH_HOA_ID,
    label: t('panels.equipmentHall.labels.essenceName'),
    icon: materialIcon(LUYEN_KHI_TINH_HOA_ID),
    owned: refineEssenceOwned.value,
    amount: refineCost.value.essenceUnits,
  },
  {
    id: refineSpiritStoneCostMaterialId.value,
    label: refineSpiritStoneCostName.value,
    icon: materialIcon(refineSpiritStoneCostMaterialId.value),
    owned: refineSpiritStoneOwned.value,
    amount: refineCost.value.spiritStone,
  },
])
</script>

<template>
  <!-- Bố cục chung với Cường Hóa (owner ruling 2026-10-08): Tinh Luyện
       cần area cho tối đa 5 dòng affix nên BỎ ô chiếu + 2 vòng tròn -
       chỉ còn affix hiện tại -> kết quả tinh luyện (khóa từng dòng ở
       mép trái), hàng nguyên liệu của Tinh Luyện và nút hành động ghim
       đáy card. Chọn đồ trực tiếp trên doll. -->
  <div class="equipment-forge-workspace forge-refine">
    <h2>{{ t('panels.equipmentHall.tabs.refine') }}</h2>

    <template v-if="selectedRow">
      <div v-if="refineRows.length" class="forge-compare">
        <template v-for="(row, slot) in refineSlots" :key="slot">
          <div v-if="row" class="forge-compare__cell forge-compare__cell--lockable">
            <button
              type="button"
              class="refine-lock"
              :class="{ 'is-locked': row.locked }"
              :aria-pressed="row.locked"
              :aria-label="t('panels.equipmentHall.table.header.lock')"
              :title="t('panels.equipmentHall.table.header.lock')"
              @click="toggleLock(row.index)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 10V7a5 5 0 0 1 10 0v3M6 10h12v11H6z" />
                <path d="M12 14v3" />
              </svg>
            </button>
            <span class="equipment-stat-name" :class="tierClass(row.tier)">{{ row.label }}</span>
            <b class="forge-compare__value">{{ formatAffixValue(row.stat, row.current) }}</b>
          </div>
          <div v-else class="forge-compare__cell forge-compare__cell--empty"></div>
          <!-- Right side IS the tier-range statbar (owner ruling
               2026-10-08: name + bar only, no after-column): gold fill
               = value now inside [min,max]; an armed roll renders the
               delta segment - green when it grows, red when it drops. -->
          <div v-if="row && row.range" class="forge-compare__cell refine-range">
            <div class="refine-range__track">
              <i
                class="refine-range__fill"
                :style="{ width: `${rangePct(row.current, row.range)}%` }"
              ></i>
              <i
                v-if="row.pending !== undefined && rangePct(row.pending, row.range) !== rangePct(row.current, row.range)"
                class="refine-range__delta"
                :class="rangePct(row.pending, row.range) > rangePct(row.current, row.range)
                  ? 'refine-range__delta--up'
                  : 'refine-range__delta--down'"
                :style="{
                  left: `${Math.min(rangePct(row.current, row.range), rangePct(row.pending, row.range))}%`,
                  width: `${Math.abs(rangePct(row.pending, row.range) - rangePct(row.current, row.range))}%`,
                }"
              ></i>
            </div>
          </div>
          <div v-else class="forge-compare__cell forge-compare__cell--empty"></div>
        </template>
      </div>
      <p v-else class="forge-empty">{{ t('panels.equipmentHall.empty.noAffixesToRefine') }}</p>

      <!-- Pinned bottom block (same as Cường Hóa). -->
      <div class="equipment-forge-materials">
        <div
          v-for="material in refineMaterials"
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
      <div class="equipment-forge-actions">
        <EquipmentArtButton filter-art :gold="canRefine()" :disabled="!canRefine()" @click="doRefinePreview">
          {{ t('panels.equipmentHall.buttons.refinePreview') }}
        </EquipmentArtButton>
        <EquipmentArtButton v-if="pendingRefineValues" filter-art gold @click="doRefineKeep">
          {{ t('panels.equipmentHall.buttons.keep') }}
        </EquipmentArtButton>
        <EquipmentArtButton v-if="pendingRefineValues" filter-art @click="doRefineDiscard">
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
.forge-refine {
  padding-bottom: 185px;
}
.forge-refine .equipment-forge-materials {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 85px;
}
.forge-refine .equipment-forge-actions {
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
/* Name | tier-statbar compare: 2 columns, the right cell IS the bar
   (owner ruling 2026-10-08 - no after column, no arrow). The card
   always holds exactly 5 evenly-spaced rows; it is resizable by drag
   (native grip) while the owner tunes spacing. Scrollbar hidden. */
.forge-compare {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: repeat(5, minmax(0, 1fr));
  column-gap: 20px;
  flex: 1;
  min-height: 120px;
  margin-top: 6px;
  padding: 4px 10px;
  border: 1px solid #9b7d4055;
  border-radius: 4px;
  background: #f4e9cf0d;
  overflow-y: auto;
  scrollbar-width: none;
}
.forge-compare::-webkit-scrollbar {
  display: none;
}
/* Tier-range statbar inside the right cell: fill = value's position
   inside [min,max]; an armed roll paints the gained/lost segment. */
.refine-range {
  display: flex;
  align-items: center;
  gap: 8px;
}
.refine-range__track {
  position: relative;
  flex: 1;
  height: 9px;
  border-radius: 5px;
  background: #96764433;
  box-shadow: inset 0 1px 2px #00000040;
  overflow: hidden;
}
.refine-range__fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 5px;
  background: linear-gradient(180deg, #f0d48a, #c9a24e);
  box-shadow: inset 0 1px 0 #fff5d655;
  transition: width 0.25s ease;
}
.refine-range__delta {
  position: absolute;
  top: 0;
  bottom: 0;
}
.refine-range__delta--up {
  background: #93cfa0cc;
  box-shadow: 0 0 6px #93cfa080;
}
.refine-range__delta--down {
  background: #d97b6ccc;
  box-shadow: 0 0 6px #d97b6c80;
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
}
.forge-compare__cell--empty {
  visibility: hidden;
}
.forge-compare__cell--next {
  justify-content: center;
}
/* tierClass() emits qi-hall__tier-N - owned solely by qi-hall.css. */
.equipment-stat-name {
  min-width: 0;
  flex: 1;
}
.forge-compare__value {
  font-weight: 600;
  color: #ebce84;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
/* Per-row lock toggle on the left edge of the "before" cell. */
.refine-lock {
  width: 26px;
  height: 26px;
  padding: 4px;
  flex: none;
  align-self: center;
  border: 1px solid #96764440;
  border-radius: 4px;
  background: transparent;
  color: #a08b62;
  cursor: pointer;
}
.refine-lock svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
}
.refine-lock.is-locked {
  color: #e8c98a;
  border-color: #d9a94f88;
  background: #d9a94f1a;
}
/* Materials row: identical metrics to Cường Hóa. */
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
/* Material name stays on ONE line in both columns - a wrapped name
   pushed the count into the middle and looked asymmetric (owner
   callout 2026-10-08). */
.equipment-material > div:last-child > span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 16px;
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
.equipment-forge-actions > button {
  width: 220px;
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
