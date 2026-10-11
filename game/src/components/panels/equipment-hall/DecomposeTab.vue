<script setup lang="ts">
// Task 14-UI rework (owner ruling 2026-10-12) -- Tab Phan Giai doi tu
// engine NHAN CONG chay theo tick sang hanh dong truc tiep kieu Hoa
// Luyen: nhung nguyen tui nguyen lieu o mode 'pick', chon nhieu stack
// khoang, bulk actions + nut vang mo ConfirmModal preview tinh hoa,
// xac nhan la phan giai ngay. Khong con worker slider/capacity/estimate.
//
// Logic decompose truc tiep nam o DecomposeSystem (listDecomposableIds /
// previewDecompose / decompose) - tab nay chi la UI + selection state,
// khong tu implement filter hay cong thuc yield.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { materialLabel } from '@/core/presentation/labels'
import { classifyDecomposableMaterial } from '@/core/production/DecomposeSystem'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import MaterialBagSection from '@/components/panels/bag-sections/MaterialBagSection.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import {
  bagGridPoint,
  collectBagCellPoints,
  playDecomposeFx,
  type DecomposeFxStream,
  type DecomposeFxPoint,
} from '@/components/fx/decomposeFx'

const { t } = useI18n()

const gameManager = useGameManager()

const { stateVersion, bumpState } = useStateVersion()

const system = gameManager.decomposeSystem

// =========================
// Tab Phan Giai - filter + multi-select + preview + confirm
// (khung DissolveTab - "mang nguyen UI cua Hoa Luyen qua")
// =========================

const decomposeSelected = ref<Set<string>>(new Set())

// Stack materialId phan giai duoc = ore/wood/herb trong tui
// (DecomposeSystem classifyDecomposableMaterial). Stack khac mo (inert).
const decomposeSelectableIds = computed(() => {
  stateVersion.value

  // Hotfix 2026-10-12: logic direct-decompose chua deploy xong thi render
  // rong thay vi crash tab (method co the vang mat luc hot-reload).
  return typeof system.listDecomposableIds === 'function' ? system.listDecomposableIds() : []
})

const decomposeInertIds = computed(() => {
  stateVersion.value

  const selectable = new Set(decomposeSelectableIds.value)

  return gameManager.materialBag
    .getAll()
    .map((stack) => stack.material.id)
    .filter((id) => !selectable.has(id))
})

// Ids hien tai TUI dang hien thi (sau filter Loai/Sap Xep cua chinh
// tui) - 'filtered' emit scope Chon Tat Ca vao view thay vi toan tui.
// Seed day du selectable: bag mount SAU row nay nen khong co seed thi
// frame dau hien count 0 + disable Chon Tat Ca.
const decomposeVisibleIds = ref<Set<string>>(new Set(decomposeSelectableIds.value))

function onBagFiltered(ids: string[]) {
  decomposeVisibleIds.value = new Set(ids)
}

const decomposeVisibleSelectableIds = computed(() => {
  const visible = decomposeVisibleIds.value

  return decomposeSelectableIds.value.filter((id) => visible.has(id))
})

const decomposePickedIds = computed(() => [...decomposeSelected.value])

// Prune ghost ids khi tap selectable doi (filter, phan giai xong,
// stack het hang) - giong watcher cua DissolveTab: id roi khoi tap
// pickable ma con trong selection se lam sai count + preview.
watch(decomposeSelectableIds, (ids) => {
  if (decomposeSelected.value.size === 0) {
    return
  }

  const live = new Set(ids)
  const next = new Set([...decomposeSelected.value].filter((id) => live.has(id)))

  if (next.size !== decomposeSelected.value.size) {
    decomposeSelected.value = next
  }
})

function toggleDecompose(materialId: string) {
  const next = new Set(decomposeSelected.value)

  if (next.has(materialId)) {
    next.delete(materialId)
  } else {
    next.add(materialId)
  }

  decomposeSelected.value = next
}

function selectAllDecomposeByFilter() {
  decomposeSelected.value = new Set(decomposeVisibleSelectableIds.value)
}

function clearDecomposeSelection() {
  decomposeSelected.value = new Set()
}

const decomposePreview = computed(() => {
  stateVersion.value

  return typeof system.previewDecompose === 'function'
    ? system.previewDecompose(Array.from(decomposeSelected.value))
    : []
})

const decomposeDialogOpen = ref(false)

// Dialog thuoc ve tap selection luc mo: moi thay doi selection (prune,
// clear, toggle, select-all, reset sau decompose) lam tap da review
// loi thoi - dong dialog, tap moi can review lai (parity DissolveTab).
watch(decomposeSelected, () => {
  decomposeDialogOpen.value = false
})

function doDecompose() {
  if (decomposeSelected.value.size === 0) {
    return
  }

  decomposeDialogOpen.value = true
}

// Dissolve FX (owner spec 2026-10-11): streams are captured BEFORE
// decompose() removes the stacks - the consumed cells unmount with them.
// One stream per output family (ore -> luyen_khi, wood -> bui_go, herb ->
// luyen_dan tinh hoa), origins = that family's picked cell centers.
const workspaceRef = ref<HTMLElement | null>(null)

function collectDecomposeStreams(): DecomposeFxStream[] {
  const root = workspaceRef.value
  const originsByOutput = new Map<string, DecomposeFxPoint[]>()

  for (const materialId of decomposeSelected.value) {
    const material = gameManager.materialRegistry.has(materialId)
      ? gameManager.materialRegistry.get(materialId)
      : undefined
    const family = material ? classifyDecomposableMaterial(material) : null

    if (family === null) {
      continue
    }

    const points = collectBagCellPoints(root, [materialId])
    originsByOutput.set(
      family.outputMaterialId,
      [...(originsByOutput.get(family.outputMaterialId) ?? []), ...points],
    )
  }

  const fallback = bagGridPoint(root)

  return decomposePreview.value
    .map((row): DecomposeFxStream => {
      const origins = originsByOutput.get(row.materialId) ?? []

      // A stack picked on another bag page/filter renders no cell - the
      // grid center stands in so every output family still gets a stream.
      if (origins.length === 0 && fallback !== null) {
        origins.push(fallback)
      }

      return { materialId: row.materialId, amount: row.maxAmount, origins }
    })
    .filter((stream) => stream.origins.length > 0)
}

function confirmDecompose() {
  const streams = collectDecomposeStreams()

  if (
    typeof system.decompose === 'function' &&
    system.decompose(Array.from(decomposeSelected.value))
  ) {
    decomposeSelected.value = new Set()
    bumpState()
    playDecomposeFx(streams)
  }

  decomposeDialogOpen.value = false
}
</script>

<template>
  <!-- Chrome khop DissolveTab (owner ruling 2026-10-12): card toi,
       tui nhung o pick mode, bulk actions + submit vang, ConfirmModal
       danger preview phan thuong. -->
  <div ref="workspaceRef" class="equipment-forge-workspace decompose-workspace">
    <MaterialBagSection
      class="decompose-bag"
      mode="pick"
      sort-key="decompose"
      :picked-ids="decomposePickedIds"
      :inert-ids="decomposeInertIds"
      :show-count="false"
      @pick="toggleDecompose"
      @filtered="onBagFiltered"
    />

    <div class="equipment-forge-actions">
      <button
        type="button"
        class="decompose-filters__bulk"
        :disabled="decomposeVisibleSelectableIds.length === 0"
        @click="selectAllDecomposeByFilter"
      >
        {{ t('panels.equipmentHall.buttons.selectAll') }} ({{ decomposeVisibleSelectableIds.length }})
      </button>

      <button
        type="button"
        class="decompose-filters__bulk"
        :disabled="decomposeSelected.size === 0"
        @click="clearDecomposeSelection"
      >
        {{ t('panels.equipmentHall.buttons.clearAll') }}
      </button>

      <EquipmentArtButton
        filter-art
        :gold="decomposeSelected.size > 0"
        class="equipment-forge-actions__submit"
        :disabled="decomposeSelected.size === 0"
        @click="doDecompose"
      >
        {{ t('panels.equipmentHall.tabs.decompose') }}
      </EquipmentArtButton>
    </div>

    <ConfirmModal
      :open="decomposeDialogOpen"
      danger
      :title="t('panels.equipmentHall.tabs.decompose')"
      :message="`${t('panels.equipmentHall.labels.dissolveReward')} (${t('panels.equipmentHall.labels.itemCount', { count: decomposeSelected.size })})`"
      :confirm-label="t('panels.equipmentHall.buttons.decomposeConfirm')"
      @confirm="confirmDecompose"
      @cancel="decomposeDialogOpen = false"
    >
      <div class="decompose-dialog__detail">
        <p v-for="entry in decomposePreview" :key="entry.materialId">
          {{ materialLabel(entry.materialId, gameManager.materialRegistry) }}: {{ entry.minAmount === entry.maxAmount ? entry.minAmount : `${entry.minAmount}–${entry.maxAmount}` }}
        </p>
        <p class="decompose-warning">{{ t('panels.equipmentHall.warnings.irreversible') }}</p>
      </div>
    </ConfirmModal>
  </div>
</template>

<style scoped>
.equipment-forge-workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
/* Bulk buttons = chip art cua dropdown tui (equipment-filter-*,
   native 1225x324; disabled fades - khong co art disabled). */
.decompose-filters__bulk {
  flex: 0 0 auto;
  height: 40px;
  aspect-ratio: 1225 / 324;
  border: 0;
  background: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-normal-v2.png') center / contain no-repeat;
  color: #f2e3c2;
  font: 700 12px var(--pc-font-body, var(--font-display, Georgia, serif));
  padding: 0 12px;
  cursor: pointer;
  white-space: nowrap;
}
.decompose-filters__bulk:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.decompose-filters__bulk:not(:disabled):hover {
  background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-hover-v2.png');
}
.decompose-filters__bulk:not(:disabled):active {
  background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-pressed-v2.png');
}
.decompose-bag {
  flex: 1 1 auto;
  min-height: 0;
}
.decompose-dialog__detail p {
  margin: 0 0 3px;
  font-size: 12px;
  color: #2f5d33;
}
.decompose-warning {
  color: var(--crimson, #c05a4e) !important;
}
.equipment-forge-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
}
/* Spacing deu tren hang (parity DissolveTab): select-all canh trai,
   submit canh phai, clear o giua - hai gap bang nhau. */
.equipment-forge-actions__submit {
  min-width: 255px;
  min-height: 48px;
  font-family: var(--pc-font-body, var(--font-display, Georgia, serif));
  font-weight: 700;
  font-size: 24px;
  padding: 8px 29px;
  margin-right: 10px;
}
</style>
