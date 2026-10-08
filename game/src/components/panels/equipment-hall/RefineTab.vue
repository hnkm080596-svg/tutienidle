<script setup lang="ts">
// Task 19 (item-grade-quality-rework, rework P6) - Tab Tinh Luyen
// extracted from EquipmentHallPanel.vue shell. Preview state
// (pendingRefineValues, lockedIndices) is now LOCAL - v-if unmount on
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
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import EquipmentEnergyTube from '@/components/common/art/EquipmentEnergyTube.vue'
import SlotView from '@/components/common/SlotView.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { RefineValueEntry } from '@/core/equipment/EquipmentSystem'
import { getEffectiveAffixValue } from '@/core/equipment/EquipmentSystem'
import { useEquippedRows, useHallSlotRows, useItemRenState, type HallSlotRow } from './useEquippedRows'
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

const refineRenAfter = computed(() =>
  itemRenState.value ? Math.max(0, itemRenState.value.points - refineCost.value.refinementPoints) : 0,
)



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

/** Ong nang luong moi dong: fill = gia tri hien tai / tran tier. */
const TIER_COLORS = ['#8fb9c9', '#8bca8d', '#bb8dde', '#d8b15a', '#e08d6e'] as const

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
    const cap = affix?.tiers[rolled.tier]?.max
    const fill = cap && cap > 0 ? Math.min(100, (current / cap) * 100) : 0
    const locked = lockedIndices.value.includes(index)
    const pending = pendingRefineByIndex.value.get(index)

    return {
      index,
      label: affixDisplayLabel(rolled, gameManager.affixRegistry),
      tier: rolled.tier,
      stat: affix?.stat,
      current,
      fill,
      color: TIER_COLORS[Math.min(Math.max(rolled.tier - 1, 0), TIER_COLORS.length - 1)]!,
      locked,
      pending,
    }
  })
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
  <!-- Reskin theo Codex EquipmentForgePreview ('refine'): hang stat +
       ong nang luong. Lech ghi nhan: preview co nut refine TUNG DONG
       nhung domain chi roll mot luot toan bo dong khong khoa - cot
       action dung nut khoa/mo (domain ho tro); hang chon slot o dau
       card (preview chon qua socket doll). -->
  <div class="equipment-forge-workspace forge-refine">
    <h2>{{ t('panels.equipmentHall.tabs.refine') }}</h2>

    <div class="refine-slot-strip" :aria-label="t('panels.equipmentHall.aria.refineSlots')">
      <button
        v-for="row in hallSlotRows"
        :key="row.slot"
        type="button"
        class="refine-slot"
        :class="{ selected: row.equippedRow?.instanceId === selectedInstanceId }"
        :aria-pressed="row.equippedRow?.instanceId === selectedInstanceId"
        :aria-label="row.equippedRow?.accessibleLabel ?? equipmentSlotLabel(row.slot)"
        :title="row.equippedRow?.name ?? equipmentSlotLabel(row.slot)"
        @click="selectHallSlotForAction(row)"
      >
        <SlotView
          class="refine-slot__view"
          variant="circle"
          static
          :item="row.equippedRow?.instance ?? null"
          :icon="row.equippedRow?.icon"
          :label="row.equippedRow?.name ?? equipmentSlotLabel(row.slot)"
          :accessible-label="row.equippedRow?.accessibleLabel"
          :equipment-quality-rank="row.equippedRow?.gradeRank"
          :rarity-rank="row.equippedRow?.qualityRank"
        />
      </button>
    </div>

    <template v-if="selectedRow">
      <p v-if="itemRenState" class="refine-ren">
        {{ t('panels.equipmentHall.labels.forgePoints') }} {{ itemRenState.points }}/{{ itemRenState.max }}
        {{ t('panels.equipmentHall.labels.levelArrow') }} {{ refineRenAfter }}/{{ itemRenState.max }}
        · {{ t('panels.equipmentHall.labels.maxLockPrefix') }} {{ Math.min(3, Math.max(0, selectedAffixes.length - 1)) }} {{ t('panels.equipmentHall.labels.maxLockSuffix') }}
      </p>

      <div v-if="refineRows.length" class="equipment-refinement-rows">
        <div v-for="row in refineRows" :key="row.index" class="equipment-refine-row">
          <span class="equipment-stat-name" :class="tierClass(row.tier)">{{ row.label }}</span>
          <div class="equipment-refine-current">
            <small>{{ t('panels.equipmentHall.forge.current') }}</small
            ><b>{{ formatAffixValue(row.stat, row.current) }}</b>
          </div>
          <EquipmentEnergyTube :fill="row.fill" :color="row.color" />
          <div class="equipment-refine-next">
            <small>{{ t('panels.equipmentHall.forge.result') }}</small>
            <b v-if="row.locked">{{ t('panels.equipmentHall.status.kept') }}</b>
            <b v-else-if="row.pending !== undefined">{{ formatAffixValue(row.stat, row.pending) }}</b>
            <b v-else class="refine-next--idle">{{ t('panels.equipmentHall.status.notRolled') }}</b>
          </div>
          <div class="equipment-refine-action">
            <EquipmentArtButton
              square-art
              :gold="row.locked"
              :aria-pressed="row.locked"
              :aria-label="t('panels.equipmentHall.table.header.lock')"
              @click="toggleLock(row.index)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 10V7a5 5 0 0 1 10 0v3M6 10h12v11H6z" />
                <path d="M12 14v3" />
              </svg>
            </EquipmentArtButton>
          </div>
        </div>
      </div>
      <p v-else class="refine-empty">{{ t('panels.equipmentHall.empty.noAffixesToRefine') }}</p>

      <p class="refine-rule">
        {{ t('panels.equipmentHall.labels.refineRule') }} {{ refineCost.essenceUnits }} {{ t('panels.equipmentHall.labels.essenceName') }}
        ({{ t('panels.equipmentHall.labels.ownedPrefix') }} {{ refineEssenceOwned }}) · {{ refineCost.spiritStone }} {{ refineSpiritStoneCostName }}
      </p>

      <h3 class="equipment-forge-divider material-divider">{{ t('panels.equipmentHall.forge.refinementMaterials') }}</h3>
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
          <b>{{ material.owned }}/{{ material.amount }}</b>
        </div>
      </div>

      <div class="equipment-forge-actions">
        <EquipmentArtButton gold :disabled="!canRefine()" @click="doRefinePreview">
          {{ t('panels.equipmentHall.buttons.refinePreview') }}
        </EquipmentArtButton>
        <EquipmentArtButton v-if="pendingRefineValues" @click="doRefineKeep">
          {{ t('panels.equipmentHall.buttons.keep') }}
        </EquipmentArtButton>
        <EquipmentArtButton v-if="pendingRefineValues" @click="doRefineDiscard">
          {{ t('panels.equipmentHall.buttons.discard') }}
        </EquipmentArtButton>
      </div>
    </template>
    <p v-else class="refine-empty">{{ t('panels.equipmentHall.empty.selectItem') }}</p>
  </div>
</template>

<style scoped>
/* Forge layout copied from the approved preview
   (ui-preview/equipment/EquipmentForgePreview.vue, 'refine' branch). */
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
.equipment-refinement-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
}
.equipment-refine-row {
  display: grid;
  grid-template-columns: 1.1fr 0.65fr 1.15fr 0.7fr 40px;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-height: 0;
  border: 1px solid #987b4855;
  padding: 4px 8px;
  font-size: 14px;
}
.equipment-stat-name {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.equipment-refine-current,
.equipment-refine-next {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.equipment-refine-row small {
  font-size: 11px;
  white-space: nowrap;
  color: #c1b18d;
}
.equipment-refine-row b {
  font-size: 17px;
  font-weight: 500;
}
.equipment-refine-next b {
  color: #93cfa0;
}
.equipment-refine-next .refine-next--idle {
  color: #8f7f5f;
  font-size: 12px;
  font-weight: 400;
}
.equipment-refine-action {
  display: flex;
  align-items: center;
  justify-content: center;
}
.equipment-refine-action > button {
  width: 31px;
  height: 31px;
  min-height: 31px;
  padding: 5px;
}
.equipment-refine-action svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
}
.equipment-forge-materials {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  flex: none;
  min-height: 46px;
}
.forge-refine .equipment-material {
  flex-direction: column;
  gap: 2px;
}
.forge-refine .equipment-material-icon {
  width: 37px;
  height: 37px;
}
.forge-refine .equipment-material b {
  font-size: 11px;
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
.equipment-material-icon :deep(.slot-view) {
  width: 100%;
  height: 100%;
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
.forge-refine .equipment-forge-actions > button {
  min-height: 35px;
  font-size: 20px;
}
.refine-ren {
  margin: 0;
  text-align: center;
  font-size: 13px;
  color: #c1b18d;
}
.refine-rule {
  margin: 0;
  text-align: center;
  font-size: 11px;
  color: #8f7f5f;
}
.refine-empty {
  flex: 1;
  display: grid;
  place-items: center;
  margin: 0;
  font-size: 14px;
  color: #c1b18d;
}

/* Hang chon slot - live-only (preview chon qua socket doll). */
.refine-slot-strip {
  display: flex;
  justify-content: center;
  gap: 14px;
  flex: none;
  height: 52px;
}
.refine-slot {
  position: relative;
  width: 52px;
  height: 52px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.refine-slot__view {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.refine-slot :deep(.slot-view__icon-wrap) {
  inset: 14%;
}
.refine-slot.selected :deep(.slot-view__ring-art) {
  filter: brightness(1.35) drop-shadow(0 0 5px #d9a94f88);
}
.refine-slot:not(.selected):hover :deep(.slot-view__ring-art) {
  filter: brightness(1.18);
}
</style>

